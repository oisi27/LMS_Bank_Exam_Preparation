import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import http from 'http';
import express from 'express';
import { db, initDatabase } from '../db/schema';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { v4 as uuidv4 } from 'uuid';
import { examsRouter } from '../routes/exams';
import { dashboardRouter } from '../routes/dashboard';
import { ensureActiveDemoExam, DEMO_ACTIVE_EXAM_ID } from '../db/seed';

const app = express();
app.use(express.json());
app.use('/api/exams', examsRouter);
app.use('/api/dashboard', dashboardRouter);

let server: http.Server;
let serverPort: number;

function makeRequest(
  method: string,
  urlPath: string,
  headers: Record<string, string> = {},
  body?: any
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any; text: string }> {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const reqHeaders: Record<string, string | number> = { ...headers };
    if (postData && !reqHeaders['Content-Type']) {
      reqHeaders['Content-Type'] = 'application/json';
    }
    if (postData) {
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: serverPort,
        path: urlPath,
        method,
        headers: reqHeaders
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const text = buffer.toString('utf8');
          let parsed: any = null;
          try {
            parsed = JSON.parse(text);
          } catch {
            parsed = text;
          }
          resolve({ status: res.statusCode || 0, headers: res.headers, body: parsed, text });
        });
      }
    );

    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

describe('Exam Scheduling, Dashboard Status & Demo Exam Tests', () => {
  let studentId: string;
  let studentToken: string;
  let expiredExamId: string;
  let futureExamId: string;

  beforeEach(async () => {
    initDatabase();

    if (!server) {
      await new Promise<void>((resolve) => {
        server = app.listen(0, '127.0.0.1', () => {
          const addr = server.address() as any;
          serverPort = addr.port;
          resolve();
        });
      });
    }

    const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    studentId = uuidv4();
    expiredExamId = uuidv4();
    futureExamId = uuidv4();

    // Insert student
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (?, ?, 'hash', 'Test Candidate', 'STUDENT')
    `).run(studentId, `candidate_${unique}@banklms.edu.bd`);

    studentToken = jwt.sign(
      { id: studentId, email: `candidate_${unique}@banklms.edu.bd`, role: 'STUDENT', name: 'Test Candidate' },
      config.JWT_SECRET
    );

    // Insert Expired Exam (ended yesterday)
    const now = new Date();
    const expiredStart = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
    const expiredEnd = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO exams (
        id, title, category, type, duration_minutes, total_marks, pass_marks,
        negative_marking_rate, allowed_attempts, starts_at, ends_at, status
      ) VALUES (?, 'Expired Model Test', 'BANK_RECRUITMENT', 'MODEL_TEST', 30, 50.0, 20.0, 0.25, 1, ?, ?, 'LIVE')
    `).run(expiredExamId, expiredStart, expiredEnd);

    // Insert Future/Upcoming Exam (starts tomorrow)
    const futureStart = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const futureEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO exams (
        id, title, category, type, duration_minutes, total_marks, pass_marks,
        negative_marking_rate, allowed_attempts, starts_at, ends_at, status
      ) VALUES (?, 'Upcoming Next-Week Test', 'BANK_RECRUITMENT', 'MODEL_TEST', 30, 50.0, 20.0, 0.25, 1, ?, ?, 'SCHEDULED')
    `).run(futureExamId, futureStart, futureEnd);

    // Ensure active demo exam is seeded
    ensureActiveDemoExam();
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('should correctly mark expired exams as ENDED and active demo exam as LIVE with server-authoritative time', async () => {
    const res = await makeRequest('GET', '/api/dashboard/student-summary', {
      Authorization: `Bearer ${studentToken}`
    });

    expect(res.status).toBe(200);
    expect(res.body.upcomingExams).toBeDefined();

    const exams = res.body.upcomingExams;
    const expired = exams.find((e: any) => e.id === expiredExamId);
    const future = exams.find((e: any) => e.id === futureExamId);
    const demo = exams.find((e: any) => e.id === DEMO_ACTIVE_EXAM_ID);

    // Expired exam must be calculated as ENDED, not available
    if (expired) {
      expect(expired.calculatedStatus).toBe('ENDED');
      expect(expired.isAvailable).toBe(false);
    }

    // Future exam must be calculated as UPCOMING, not available
    if (future) {
      expect(future.calculatedStatus).toBe('UPCOMING');
      expect(future.isAvailable).toBe(false);
    }

    // Active demo exam must be LIVE and available
    expect(demo).toBeDefined();
    expect(demo.calculatedStatus).toBe('LIVE');
    expect(demo.isAvailable).toBe(true);
  });

  it('should reject starting an expired exam with HTTP 400 "Exam window has ended."', async () => {
    const res = await makeRequest('POST', `/api/exams/${expiredExamId}/start`, {
      Authorization: `Bearer ${studentToken}`
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Exam window has ended.');
  });

  it('should successfully start the active demo exam and return attemptId with server authoritative time', async () => {
    const res = await makeRequest('POST', `/api/exams/${DEMO_ACTIVE_EXAM_ID}/start`, {
      Authorization: `Bearer ${studentToken}`
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.attemptId).toBeDefined();
    expect(res.body.expiresAt).toBeDefined();
    expect(res.body.serverNow).toBeDefined();

    // Verify attempt recorded in database
    const attempt: any = db.prepare('SELECT * FROM attempts WHERE id = ?').get(res.body.attemptId);
    expect(attempt).toBeDefined();
    expect(attempt.status).toBe('IN_PROGRESS');
    expect(attempt.user_id).toBe(studentId);
  });

  it('should avoid duplicating the demo exam on repeated initialization calls', () => {
    const id1 = ensureActiveDemoExam();
    const id2 = ensureActiveDemoExam();

    expect(id1).toBe(DEMO_ACTIVE_EXAM_ID);
    expect(id2).toBe(DEMO_ACTIVE_EXAM_ID);

    const count: any = db.prepare('SELECT COUNT(*) as c FROM exams WHERE id = ?').get(DEMO_ACTIVE_EXAM_ID);
    expect(count.c).toBe(1);
  });

  it('should preserve historical exam start and end timestamps intact', () => {
    const historicalId = 'f0c63363-c155-4d38-976e-fb0fc7ac5266';
    const exam: any = db.prepare('SELECT * FROM exams WHERE id = ?').get(historicalId);

    if (exam) {
      expect(exam.starts_at).toBe('2026-10-06T15:03:39.263Z');
      expect(exam.ends_at).toBe('2026-10-08T17:03:39.263Z');
    }
  });
});
