import { describe, it, expect, beforeAll } from 'vitest';
import http from 'http';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db, initDatabase } from '../db/schema';
import { dashboardRouter } from '../routes/dashboard';
import { config } from '../config/env';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/dashboard', dashboardRouter);

let serverPort: number;

function makeRequest(
  method: string,
  urlPath: string,
  headers: Record<string, string> = {}
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: serverPort,
        path: urlPath,
        method,
        headers
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
          resolve({ status: res.statusCode || 0, body: parsed });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

function generateToken(userId: string, role: string = 'STUDENT') {
  return jwt.sign(
    { id: userId, email: `${userId}@test.local`, role, name: `Student ${userId}` },
    config.JWT_SECRET || 'test_jwt_secret_bank_lms_super_secure_key_fall_2026',
    { expiresIn: '1h' }
  );
}

describe('Phase 2: Safe Duplicate Mock Test Display & Ordering Suite', () => {
  const studentId = `stud_p2_${Date.now()}`;
  let studentToken: string;

  const now = new Date();
  const pastStart = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
  const futureEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const futureStart = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
  const futureEnd2 = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const expiredEnd = new Date(now.getTime() - 30 * 60 * 1000).toISOString();

  const liveExamId1 = `exam_live_1_${Date.now()}`;
  const liveExamId2 = `exam_live_2_${Date.now()}`; // Same title as liveExamId1!
  const upcomingExamId = `exam_up_${Date.now()}`;
  const endedExamId = `exam_end_${Date.now()}`;

  beforeAll(async () => {
    initDatabase();

    await new Promise<void>((resolve) => {
      const server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        serverPort = addr.port;
        resolve();
      });
    });

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, is_active, target_exam, target_date)
      VALUES (?, ?, 'hash', 'Phase 2 Tester', 'STUDENT', 1, 'Bangladesh Bank Assistant Director', '2026-12-31')
    `).run(studentId, `${studentId}@test.local`);

    studentToken = generateToken(studentId, 'STUDENT');

    // Insert two LIVE exams with identical titles but different IDs
    db.prepare(`
      INSERT INTO exams (id, title, category, type, status, duration_minutes, total_marks, pass_marks, starts_at, ends_at)
      VALUES (?, 'Combined Senior Officer Mock Exam', 'BANK_RECRUITMENT', 'MODEL_TEST', 'LIVE', 60, 100.0, 50.0, ?, ?)
    `).run(liveExamId1, pastStart, futureEnd);

    db.prepare(`
      INSERT INTO exams (id, title, category, type, status, duration_minutes, total_marks, pass_marks, starts_at, ends_at)
      VALUES (?, 'Combined Senior Officer Mock Exam', 'BANK_RECRUITMENT', 'MODEL_TEST', 'LIVE', 60, 100.0, 50.0, ?, ?)
    `).run(liveExamId2, pastStart, futureEnd);

    // Insert an UPCOMING exam
    db.prepare(`
      INSERT INTO exams (id, title, category, type, status, duration_minutes, total_marks, pass_marks, starts_at, ends_at)
      VALUES (?, 'Bangladesh Bank AD Upcoming Special', 'BANK_RECRUITMENT', 'MODEL_TEST', 'SCHEDULED', 90, 100.0, 50.0, ?, ?)
    `).run(upcomingExamId, futureStart, futureEnd2);

    // Insert an ENDED exam
    db.prepare(`
      INSERT INTO exams (id, title, category, type, status, duration_minutes, total_marks, pass_marks, starts_at, ends_at)
      VALUES (?, 'Historical Model Test Expired', 'BANK_RECRUITMENT', 'MODEL_TEST', 'LIVE', 60, 100.0, 50.0, ?, ?)
    `).run(endedExamId, pastStart, expiredEnd);
  });

  it('1. Returns all separate exams with their authentic distinct IDs', async () => {
    const res = await makeRequest('GET', '/api/dashboard/student-summary', {
      Authorization: `Bearer ${studentToken}`
    });

    expect(res.status).toBe(200);
    expect(res.body.upcomingExams).toBeDefined();

    const exams: any[] = res.body.upcomingExams;
    const foundLive1 = exams.find(e => e.id === liveExamId1);
    const foundLive2 = exams.find(e => e.id === liveExamId2);

    expect(foundLive1).toBeDefined();
    expect(foundLive2).toBeDefined();
    expect(foundLive1.id).not.toBe(foundLive2.id);
    expect(foundLive1.title).toBe(foundLive2.title);
  });

  it('2. Orders LIVE exams before UPCOMING exams before ENDED exams', async () => {
    const res = await makeRequest('GET', '/api/dashboard/student-summary', {
      Authorization: `Bearer ${studentToken}`
    });

    const exams: any[] = res.body.upcomingExams;
    const liveIndex = exams.findIndex(e => e.id === liveExamId1);
    const upcomingIndex = exams.findIndex(e => e.id === upcomingExamId);
    const endedIndex = exams.findIndex(e => e.id === endedExamId);

    expect(liveIndex).toBeGreaterThanOrEqual(0);
    expect(upcomingIndex).toBeGreaterThanOrEqual(0);
    expect(endedIndex).toBeGreaterThanOrEqual(0);

    // LIVE must appear before UPCOMING and ENDED
    expect(liveIndex).toBeLessThan(upcomingIndex);
    expect(upcomingIndex).toBeLessThan(endedIndex);
  });

  it('3. Guarantees calculatedStatus and isAvailable accurately reflect live server clock', async () => {
    const res = await makeRequest('GET', '/api/dashboard/student-summary', {
      Authorization: `Bearer ${studentToken}`
    });

    const exams: any[] = res.body.upcomingExams;
    const live1 = exams.find(e => e.id === liveExamId1);
    const up = exams.find(e => e.id === upcomingExamId);
    const ended = exams.find(e => e.id === endedExamId);

    // LIVE exam within window
    expect(live1.calculatedStatus).toBe('LIVE');
    expect(live1.isAvailable).toBe(true);

    // Future scheduled exam
    expect(up.calculatedStatus).toBe('UPCOMING');
    expect(up.isAvailable).toBe(false);

    // Past expired exam
    expect(ended.calculatedStatus).toBe('ENDED');
    expect(ended.isAvailable).toBe(false);
  });

  it('4. Provides sessionCode and sessionTag for disambiguating identical titles', async () => {
    const res = await makeRequest('GET', '/api/dashboard/student-summary', {
      Authorization: `Bearer ${studentToken}`
    });

    const exams: any[] = res.body.upcomingExams;
    const live1 = exams.find(e => e.id === liveExamId1);
    const live2 = exams.find(e => e.id === liveExamId2);

    expect(live1.sessionCode).toBe(liveExamId1.slice(0, 8));
    expect(live2.sessionCode).toBe(liveExamId2.slice(0, 8));
    expect(live1.sessionTag).toBeDefined();
    expect(live2.sessionTag).toBeDefined();
  });

  it('5. Ensures Student Goal and Course Progress remain completely functional', async () => {
    const res = await makeRequest('GET', '/api/dashboard/student-summary', {
      Authorization: `Bearer ${studentToken}`
    });

    expect(res.body.goal).toBeDefined();
    expect(res.body.goal.targetExam).toBe('Bangladesh Bank Assistant Director');
    expect(res.body.goal.targetBank).toBe('Bangladesh Bank');
    expect(res.body.goal.targetPosition).toBe('Assistant Director');
    expect(typeof res.body.goal.daysRemaining).toBe('number');
    expect(res.body.courseProgress).toBeDefined();
    expect(Array.isArray(res.body.courseProgress)).toBe(true);
  });
});
