import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'http';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db, initDatabase } from '../db/schema';
import { examsRouter } from '../routes/exams';
import { config } from '../config/env';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/exams', examsRouter);

let server: http.Server;
let serverPort: number;

function generateToken(userId: string, role: string, email: string = 'test@example.com') {
  return jwt.sign(
    { id: userId, email, role, name: 'Test User' },
    config.JWT_SECRET || 'test_jwt_secret_bank_lms_super_secure_key_fall_2026',
    { expiresIn: '15m' }
  );
}

function makeRequest(
  method: string,
  urlPath: string,
  headers: Record<string, string> = {},
  body?: any
): Promise<{ status: number; body: any }> {
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
          resolve({ status: res.statusCode || 0, body: parsed });
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

describe('Milestone 5 Step 1: Competitive Leaderboard & Student Ranking Tests', () => {
  let examId: string;
  let scheduledExamId: string;
  let manualExamId: string;

  let student1Id: string;
  let student2Id: string;
  let student3Id: string;
  let instructorId: string;

  let student1Token: string;
  let student2Token: string;
  let student3Token: string;
  let instructorToken: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (typeof addr === 'object' && addr !== null) {
          serverPort = addr.port;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  beforeEach(() => {
    initDatabase();

    student1Id = uuidv4();
    student2Id = uuidv4();
    student3Id = uuidv4();
    instructorId = uuidv4();

    examId = uuidv4();
    scheduledExamId = uuidv4();
    manualExamId = uuidv4();

    // Insert users
    const insertUser = db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (?, ?, 'hash', ?, ?)
    `);

    insertUser.run(student1Id, `s1_${Date.now()}@banklms.ac.bd`, 'Tahmid Rahman', 'STUDENT');
    insertUser.run(student2Id, `s2_${Date.now()}@banklms.ac.bd`, 'Sadia Islam', 'STUDENT');
    insertUser.run(student3Id, `s3_${Date.now()}@banklms.ac.bd`, 'Nabil Chowdhury', 'STUDENT');
    insertUser.run(instructorId, `inst_${Date.now()}@banklms.ac.bd`, 'Faculty Head', 'INSTRUCTOR');

    student1Token = generateToken(student1Id, 'STUDENT', 's1@banklms.ac.bd');
    student2Token = generateToken(student2Id, 'STUDENT', 's2@banklms.ac.bd');
    student3Token = generateToken(student3Id, 'STUDENT', 's3@banklms.ac.bd');
    instructorToken = generateToken(instructorId, 'INSTRUCTOR', 'inst@banklms.ac.bd');

    const now = new Date();
    const startsAt = new Date(now.getTime() - 3600000).toISOString();
    const endsAt = new Date(now.getTime() + 86400000).toISOString();

    // 1. Standard instant exam
    db.prepare(`
      INSERT INTO exams (
        id, title, category, type, duration_minutes, total_marks, pass_marks,
        negative_marking_rate, allowed_attempts, starts_at, ends_at, status, result_release_mode, created_by
      ) VALUES (?, 'Model Test Instant Leaderboard', 'BANK_RECRUITMENT', 'MODEL_TEST', 60, 100, 40, 0.25, 2, ?, ?, 'LIVE', 'INSTANT', ?)
    `).run(examId, startsAt, endsAt, instructorId);

    // 2. Scheduled release exam (ends in future)
    db.prepare(`
      INSERT INTO exams (
        id, title, category, type, duration_minutes, total_marks, pass_marks,
        negative_marking_rate, allowed_attempts, starts_at, ends_at, status, result_release_mode, created_by
      ) VALUES (?, 'Scheduled Release Exam', 'BANK_RECRUITMENT', 'MODEL_TEST', 60, 100, 40, 0.25, 1, ?, ?, 'LIVE', 'SCHEDULED', ?)
    `).run(scheduledExamId, startsAt, endsAt, instructorId);

    // 3. Manual release exam (status LIVE, not RESULTS_PUBLISHED)
    db.prepare(`
      INSERT INTO exams (
        id, title, category, type, duration_minutes, total_marks, pass_marks,
        negative_marking_rate, allowed_attempts, starts_at, ends_at, status, result_release_mode, created_by
      ) VALUES (?, 'Manual Release Exam', 'BANK_RECRUITMENT', 'MODEL_TEST', 60, 100, 40, 0.25, 1, ?, ?, 'LIVE', 'MANUAL', ?)
    `).run(manualExamId, startsAt, endsAt, instructorId);
  });

  it('should rank students by net score, then fewer wrong answers, then time spent', async () => {
    // Insert results for 3 students:
    // Student 1: Score 85, Wrong 5, Time 1800s
    // Student 2: Score 85, Wrong 3 (fewer errors -> should rank higher than Student 1!), Time 2000s
    // Student 3: Score 90, Wrong 2, Time 1500s -> Rank 1

    const insertAttempt = db.prepare(`
      INSERT INTO attempts (id, exam_id, user_id, status, started_at, expires_at, submitted_at)
      VALUES (?, ?, ?, 'SUBMITTED', ?, ?, ?)
    `);

    const insertResult = db.prepare(`
      INSERT INTO exam_results (
        id, attempt_id, exam_id, user_id, score, total_marks,
        correct_count, wrong_count, skipped_count, accuracy_percentage,
        time_spent_seconds, is_passed, created_at
      ) VALUES (?, ?, ?, ?, ?, 100, ?, ?, ?, 80, ?, 1, ?)
    `);

    const att1 = uuidv4();
    const att2 = uuidv4();
    const att3 = uuidv4();

    insertAttempt.run(att1, examId, student1Id, '2026-10-19T09:30:00.000Z', '2026-10-19T10:30:00.000Z', '2026-10-19T10:00:00.000Z');
    insertAttempt.run(att2, examId, student2Id, '2026-10-19T09:30:00.000Z', '2026-10-19T10:30:00.000Z', '2026-10-19T10:05:00.000Z');
    insertAttempt.run(att3, examId, student3Id, '2026-10-19T09:00:00.000Z', '2026-10-19T10:00:00.000Z', '2026-10-19T09:30:00.000Z');

    // Student 1
    insertResult.run(uuidv4(), att1, examId, student1Id, 85, 87, 5, 8, 1800, '2026-10-19T10:00:00.000Z');
    // Student 2: Same score as Student 1 (85), but fewer wrong answers (3 vs 5)
    insertResult.run(uuidv4(), att2, examId, student2Id, 85, 86, 3, 11, 2000, '2026-10-19T10:05:00.000Z');
    // Student 3: Highest score (90)
    insertResult.run(uuidv4(), att3, examId, student3Id, 90, 91, 2, 7, 1500, '2026-10-19T09:30:00.000Z');

    const res = await makeRequest('GET', `/api/exams/${examId}/leaderboard`, {
      Authorization: `Bearer ${student1Token}`
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.analytics.totalParticipants).toBe(3);
    expect(res.body.analytics.highestScore).toBe(90);

    const top10 = res.body.top10;
    expect(top10.length).toBe(3);

    // Rank 1: Student 3 (Highest score: 90)
    expect(top10[0].rank).toBe(1);
    expect(top10[0].userId).toBe(student3Id);
    expect(top10[0].score).toBe(90);

    // Rank 2: Student 2 (Tie-breaker won: 3 wrong answers vs 5 wrong answers)
    expect(top10[1].rank).toBe(2);
    expect(top10[1].userId).toBe(student2Id);
    expect(top10[1].wrongCount).toBe(3);

    // Rank 3: Student 1
    expect(top10[2].rank).toBe(3);
    expect(top10[2].userId).toBe(student1Id);
    expect(top10[2].wrongCount).toBe(5);

    // Current user context
    expect(res.body.currentUser).toBeDefined();
    expect(res.body.currentUser.userId).toBe(student1Id);
    expect(res.body.currentUser.rank).toBe(3);
    expect(res.body.currentUser.isCurrentUser).toBe(true);
  });

  it('should count only the best eligible attempt per student', async () => {
    const insertAttempt = db.prepare(`
      INSERT INTO attempts (id, exam_id, user_id, status, started_at, expires_at, submitted_at)
      VALUES (?, ?, ?, 'SUBMITTED', ?, ?, ?)
    `);

    const insertResult = db.prepare(`
      INSERT INTO exam_results (
        id, attempt_id, exam_id, user_id, score, total_marks,
        correct_count, wrong_count, skipped_count, accuracy_percentage,
        time_spent_seconds, is_passed, created_at
      ) VALUES (?, ?, ?, ?, ?, 100, 50, 5, 45, 90, 1200, 1, ?)
    `);

    const attA = uuidv4();
    const attB = uuidv4();

    insertAttempt.run(attA, examId, student1Id, '2026-10-19T07:30:00.000Z', '2026-10-19T08:30:00.000Z', '2026-10-19T08:00:00.000Z');
    insertAttempt.run(attB, examId, student1Id, '2026-10-19T08:30:00.000Z', '2026-10-19T09:30:00.000Z', '2026-10-19T09:00:00.000Z');

    // Student 1 takes exam twice: attempt 1 score 60, attempt 2 score 80
    insertResult.run(uuidv4(), attA, examId, student1Id, 60, '2026-10-19T08:00:00.000Z');
    insertResult.run(uuidv4(), attB, examId, student1Id, 80, '2026-10-19T09:00:00.000Z');

    const res = await makeRequest('GET', `/api/exams/${examId}/leaderboard`, {
      Authorization: `Bearer ${student1Token}`
    });

    expect(res.status).toBe(200);
    // Student 1 should only appear once in leaderboard with best score 80
    expect(res.body.analytics.totalParticipants).toBe(1);
    expect(res.body.top10[0].score).toBe(80);
    expect(res.body.top10[0].userId).toBe(student1Id);
  });

  it('should respect result_release_mode rules (SCHEDULED and MANUAL)', async () => {
    const attScheduled = uuidv4();
    db.prepare(`
      INSERT INTO attempts (id, exam_id, user_id, status, started_at, expires_at, submitted_at)
      VALUES (?, ?, ?, 'SUBMITTED', (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')), (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')), (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')))
    `).run(attScheduled, scheduledExamId, student1Id);

    // Insert student result for scheduled exam
    db.prepare(`
      INSERT INTO exam_results (
        id, attempt_id, exam_id, user_id, score, total_marks,
        correct_count, wrong_count, skipped_count, accuracy_percentage,
        time_spent_seconds, is_passed
      ) VALUES (?, ?, ?, ?, 75, 100, 75, 0, 25, 100, 1200, 1)
    `).run(uuidv4(), attScheduled, scheduledExamId, student1Id);

    // Student request to SCHEDULED exam while window has not ended -> HTTP 403
    const resScheduled = await makeRequest('GET', `/api/exams/${scheduledExamId}/leaderboard`, {
      Authorization: `Bearer ${student1Token}`
    });
    expect(resScheduled.status).toBe(403);
    expect(resScheduled.body.error).toContain('scheduled to be published after');

    // Instructor request to SCHEDULED exam -> authorized (HTTP 200)
    const resInstScheduled = await makeRequest('GET', `/api/exams/${scheduledExamId}/leaderboard`, {
      Authorization: `Bearer ${instructorToken}`
    });
    expect(resInstScheduled.status).toBe(200);

    // Student request to MANUAL exam while status is LIVE -> HTTP 403
    const resManual = await makeRequest('GET', `/api/exams/${manualExamId}/leaderboard`, {
      Authorization: `Bearer ${student1Token}`
    });
    expect(resManual.status).toBe(403);
    expect(resManual.body.error).toContain('have not been published');
  });

  it('should return 404 for non-existent exam ID', async () => {
    const res = await makeRequest('GET', `/api/exams/${uuidv4()}/leaderboard`, {
      Authorization: `Bearer ${student1Token}`
    });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Exam not found');
  });
});
