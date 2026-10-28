import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import http from 'http';
import cookieParser from 'cookie-parser';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { db, initDatabase } from '../db/schema';
import { authRouter } from '../routes/auth';
import { examsRouter } from '../routes/exams';
import { dashboardRouter } from '../routes/dashboard';
import { config } from '../config/env';

const JWT_SECRET = config.JWT_SECRET || 'bank_exam_jwt_secret_dev_key_2026';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRouter);
app.use('/api/exams', examsRouter);
app.use('/api/dashboard', dashboardRouter);

let server: http.Server;
let serverPort: number;

function makeRequest(
  method: string,
  urlPath: string,
  body?: any,
  headers: Record<string, string> = {}
): Promise<{ status: number; body: any; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? JSON.stringify(body) : undefined;
    const reqHeaders: Record<string, string> = { ...headers };
    if (payload !== undefined) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(payload).toString();
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
          resolve({ status: res.statusCode || 0, body: parsed, headers: res.headers });
        });
      }
    );
    req.on('error', reject);
    if (payload !== undefined) req.write(payload);
    req.end();
  });
}

function generateAccessToken(userId: string, role: string = 'STUDENT', expiresIn: string = '1h') {
  return jwt.sign(
    { id: userId, email: `${userId}@test.local`, role, name: `Student ${userId.substring(0, 4)}` },
    JWT_SECRET,
    { expiresIn }
  );
}

function issueRefreshTokenInDb(userId: string) {
  const refreshToken = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(`
    INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(uuidv4(), userId, refreshToken, expiresAt);
  return refreshToken;
}

describe('Automated Regression: Student QA Fixes (Auth Resilience & Exam History)', () => {
  let studentId: string;
  let otherStudentId: string;
  let instructorId: string;
  let examInstantId: string;
  let examScheduledId: string;
  let examManualId: string;
  let questionId: string;
  let optAId: string;
  let optBId: string;

  beforeAll(async () => {
    initDatabase();

    studentId = uuidv4();
    otherStudentId = uuidv4();
    instructorId = uuidv4();

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(studentId, `student_${studentId.substring(0, 6)}@test.local`, 'hash_pwd', 'QA Test Student', 'STUDENT');

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(otherStudentId, `other_${otherStudentId.substring(0, 6)}@test.local`, 'hash_pwd', 'Other QA Student', 'STUDENT');

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(instructorId, `inst_${instructorId.substring(0, 6)}@test.local`, 'hash_pwd', 'QA Instructor', 'INSTRUCTOR');

    questionId = uuidv4();
    db.prepare(`
      INSERT INTO questions (
        id, subject, chapter, topic, difficulty, type, prompt,
        explanation, default_marks, default_negative_marks, is_approved
      ) VALUES (?, 'Banking', 'General Banking', 'Accounting', 'EASY', 'SINGLE_MCQ', 'What is 2 + 2 in banking accounting?', 'Basic arithmetic', 1.0, 0.25, 1)
    `).run(questionId);

    optAId = uuidv4();
    optBId = uuidv4();
    db.prepare(`INSERT INTO question_options (id, question_id, option_key, text, is_correct, sort_order) VALUES (?, ?, 'A', '4', 1, 0)`).run(optAId, questionId);
    db.prepare(`INSERT INTO question_options (id, question_id, option_key, text, is_correct, sort_order) VALUES (?, ?, 'B', '5', 0, 1)`).run(optBId, questionId);

    const now = new Date();
    const startsAt = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
    const endsAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    const futureEndsAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    // Exam 1: INSTANT result release
    examInstantId = uuidv4();
    db.prepare(`
      INSERT INTO exams (
        id, title, category, type, duration_minutes, total_marks, pass_marks,
        negative_marking_rate, allowed_attempts, starts_at, ends_at, status,
        result_release_mode, integrity_enabled, max_violations_allowed, created_by
      ) VALUES (?, 'QA Instant Exam', 'BANK_RECRUITMENT', 'MODEL_TEST', 30, 1.0, 0.5, 0.25, 5, ?, ?, 'LIVE', 'INSTANT', 1, 3, ?)
    `).run(examInstantId, startsAt, endsAt, instructorId);

    db.prepare(`
      INSERT INTO exam_questions (id, exam_id, question_id, section_name, marks, negative_marks, order_index)
      VALUES (?, ?, ?, 'General', 1.0, 0.25, 0)
    `).run(uuidv4(), examInstantId, questionId);

    // Exam 2: SCHEDULED result release (ends in the future)
    examScheduledId = uuidv4();
    db.prepare(`
      INSERT INTO exams (
        id, title, category, type, duration_minutes, total_marks, pass_marks,
        negative_marking_rate, allowed_attempts, starts_at, ends_at, status,
        result_release_mode, integrity_enabled, max_violations_allowed, created_by
      ) VALUES (?, 'QA Scheduled Exam', 'BANK_RECRUITMENT', 'MODEL_TEST', 30, 1.0, 0.5, 0.25, 5, ?, ?, 'LIVE', 'SCHEDULED', 1, 3, ?)
    `).run(examScheduledId, startsAt, futureEndsAt, instructorId);

    db.prepare(`
      INSERT INTO exam_questions (id, exam_id, question_id, section_name, marks, negative_marks, order_index)
      VALUES (?, ?, ?, 'General', 1.0, 0.25, 0)
    `).run(uuidv4(), examScheduledId, questionId);

    // Exam 3: MANUAL result release
    examManualId = uuidv4();
    db.prepare(`
      INSERT INTO exams (
        id, title, category, type, duration_minutes, total_marks, pass_marks,
        negative_marking_rate, allowed_attempts, starts_at, ends_at, status,
        result_release_mode, integrity_enabled, max_violations_allowed, created_by
      ) VALUES (?, 'QA Manual Release Exam', 'BANK_RECRUITMENT', 'MODEL_TEST', 30, 1.0, 0.5, 0.25, 5, ?, ?, 'LIVE', 'MANUAL', 1, 3, ?)
    `).run(examManualId, startsAt, endsAt, instructorId);

    db.prepare(`
      INSERT INTO exam_questions (id, exam_id, question_id, section_name, marks, negative_marks, order_index)
      VALUES (?, ?, ?, 'General', 1.0, 0.25, 0)
    `).run(uuidv4(), examManualId, questionId);

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        serverPort = addr.port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  describe('Priority 1: Token Expiry, Refresh, and Exam Recovery', () => {
    it('1. Rejects request with expired access token (401)', async () => {
      const expiredToken = generateAccessToken(studentId, 'STUDENT', '-10s');
      const res = await makeRequest('GET', '/api/exams', undefined, {
        Authorization: `Bearer ${expiredToken}`
      });
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/expired|invalid/i);
    });

    it('2. Exchanges valid HttpOnly refresh cookie for a fresh access token and rotates cookie', async () => {
      const currentRefresh = issueRefreshTokenInDb(studentId);
      const refreshRes = await makeRequest('POST', '/api/auth/refresh', undefined, {
        Cookie: `refreshToken=${currentRefresh}`
      });

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.success).toBe(true);
      expect(refreshRes.body.accessToken).toBeDefined();

      // Check rotated cookie
      const setCookieHeader = refreshRes.headers['set-cookie'];
      expect(setCookieHeader).toBeDefined();

      // Verify old refresh token was revoked
      const oldRec: any = db.prepare('SELECT revoked_at FROM refresh_tokens WHERE token_hash = ?').get(currentRefresh);
      expect(oldRec.revoked_at).not.toBeNull();
    });

    it('3. Successfully autosaves and submits answers using refreshed access token after expiry', async () => {
      // Step A: Start exam with an initial token
      const token1 = generateAccessToken(studentId, 'STUDENT', '1h');
      const startRes = await makeRequest('POST', `/api/exams/${examInstantId}/start`, undefined, {
        Authorization: `Bearer ${token1}`
      });
      expect(startRes.status).toBe(200);
      const attemptId = startRes.body.attemptId;
      expect(attemptId).toBeDefined();

      // Step B: Simulate access token expiry during autosave
      const expiredToken = generateAccessToken(studentId, 'STUDENT', '-5s');
      const failedAutosave = await makeRequest('POST', '/api/exams/autosave', {
        attemptId,
        questionId,
        selectedOptionIds: [optAId],
        clientSequence: 1
      }, {
        Authorization: `Bearer ${expiredToken}`
      });
      expect(failedAutosave.status).toBe(401);

      // Step C: Trigger refresh via cookie
      const currentRefresh = issueRefreshTokenInDb(studentId);
      const refreshRes = await makeRequest('POST', '/api/auth/refresh', undefined, {
        Cookie: `refreshToken=${currentRefresh}`
      });
      expect(refreshRes.status).toBe(200);
      const refreshedAccessToken = refreshRes.body.accessToken;

      // Step D: Retry autosave with new access token -> must succeed and preserve answers
      const retryAutosave = await makeRequest('POST', '/api/exams/autosave', {
        attemptId,
        questionId,
        selectedOptionIds: [optAId],
        clientSequence: 2
      }, {
        Authorization: `Bearer ${refreshedAccessToken}`
      });
      expect(retryAutosave.status).toBe(200);
      expect(retryAutosave.body.saved).toBe(true);

      // Step E: Submit exam with refreshed access token -> must generate exactly one result
      const submitRes = await makeRequest('POST', `/api/exams/${attemptId}/submit`, {}, {
        Authorization: `Bearer ${refreshedAccessToken}`
      });
      expect(submitRes.status).toBe(200);
      expect(submitRes.body.success).toBe(true);
      expect(submitRes.body.grade).toBeDefined();
      expect(submitRes.body.grade.score).toBe(1.0);

      // Ensure attempt is marked GRADED and exactly 1 result row exists
      const attemptRow: any = db.prepare('SELECT status FROM attempts WHERE id = ?').get(attemptId);
      expect(attemptRow.status).toBe('GRADED');

      const resultRows: any = db.prepare('SELECT id FROM exam_results WHERE attempt_id = ?').all(attemptId);
      expect(resultRows.length).toBe(1);
    });

    it('4. Ensures submission idempotency on double retry', async () => {
      // Start another attempt
      const token = generateAccessToken(studentId, 'STUDENT', '1h');
      const startRes = await makeRequest('POST', `/api/exams/${examInstantId}/start`, undefined, {
        Authorization: `Bearer ${token}`
      });
      const attemptId = startRes.body.attemptId;

      // First submission
      const sub1 = await makeRequest('POST', `/api/exams/${attemptId}/submit`, {}, {
        Authorization: `Bearer ${token}`
      });
      expect(sub1.status).toBe(200);
      expect(sub1.body.success).toBe(true);

      // Second immediate retry submission
      const sub2 = await makeRequest('POST', `/api/exams/${attemptId}/submit`, {}, {
        Authorization: `Bearer ${token}`
      });
      expect(sub2.status).toBe(200);
      expect(sub2.body.alreadySubmitted).toBe(true);

      // Verify still exactly one result in DB
      const resultRows: any = db.prepare('SELECT id FROM exam_results WHERE attempt_id = ?').all(attemptId);
      expect(resultRows.length).toBe(1);
    });

    it('5. Gracefully rejects revoked or expired refresh token with 401 without infinite looping', async () => {
      const revokedRefresh = uuidv4();
      db.prepare(`
        INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, revoked_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(uuidv4(), studentId, revokedRefresh, new Date(Date.now() + 100000).toISOString(), new Date().toISOString());

      const res = await makeRequest('POST', '/api/auth/refresh', undefined, {
        Cookie: `refreshToken=${revokedRefresh}`
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid, revoked, or expired/i);
    });
  });

  describe('Priority 2: Student Dashboard Exam History and Release Modes', () => {
    let scheduledAttemptId: string;
    let manualAttemptId: string;

    beforeAll(async () => {
      const token = generateAccessToken(studentId, 'STUDENT', '1h');

      // Attempt for Scheduled Exam
      const schedStart = await makeRequest('POST', `/api/exams/${examScheduledId}/start`, undefined, {
        Authorization: `Bearer ${token}`
      });
      scheduledAttemptId = schedStart.body.attemptId;
      await makeRequest('POST', `/api/exams/${scheduledAttemptId}/submit`, {}, {
        Authorization: `Bearer ${token}`
      });

      // Attempt for Manual Exam
      const manStart = await makeRequest('POST', `/api/exams/${examManualId}/start`, undefined, {
        Authorization: `Bearer ${token}`
      });
      manualAttemptId = manStart.body.attemptId;
      await makeRequest('POST', `/api/exams/${manualAttemptId}/submit`, {}, {
        Authorization: `Bearer ${token}`
      });
    });

    it('1. Student summary returns recentResults with release mode, exam status, and ends_at', async () => {
      const token = generateAccessToken(studentId, 'STUDENT', '1h');
      const res = await makeRequest('GET', '/api/dashboard/student-summary', undefined, {
        Authorization: `Bearer ${token}`
      });

      expect(res.status).toBe(200);
      expect(res.body.recentResults).toBeDefined();
      expect(Array.isArray(res.body.recentResults)).toBe(true);
      expect(res.body.recentResults.length).toBeGreaterThanOrEqual(2);

      const scheduledItem = res.body.recentResults.find((r: any) => r.exam_title === 'QA Scheduled Exam');
      expect(scheduledItem).toBeDefined();
      expect(scheduledItem.result_release_mode).toBe('SCHEDULED');
      expect(scheduledItem.ends_at).toBeDefined();

      const manualItem = res.body.recentResults.find((r: any) => r.exam_title === 'QA Manual Release Exam');
      expect(manualItem).toBeDefined();
      expect(manualItem.result_release_mode).toBe('MANUAL');
    });

    it('2. Strict isolation: another student cannot see this student’s exam results', async () => {
      const otherToken = generateAccessToken(otherStudentId, 'STUDENT', '1h');
      const res = await makeRequest('GET', '/api/dashboard/student-summary', undefined, {
        Authorization: `Bearer ${otherToken}`
      });

      expect(res.status).toBe(200);
      expect(res.body.recentResults).toEqual([]);
    });

    it('3. Result review endpoint enforces release policy for SCHEDULED (unexpired) exams', async () => {
      const token = generateAccessToken(studentId, 'STUDENT', '1h');
      const res = await makeRequest('GET', `/api/exams/${scheduledAttemptId}/review`, undefined, {
        Authorization: `Bearer ${token}`
      });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('scheduled to be released');
    });

    it('4. Result review endpoint enforces release policy for MANUAL exams', async () => {
      const token = generateAccessToken(studentId, 'STUDENT', '1h');
      const res = await makeRequest('GET', `/api/exams/${manualAttemptId}/review`, undefined, {
        Authorization: `Bearer ${token}`
      });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('have not been published by the instructor yet');
    });

    it('5. Result review endpoint forbids other students from reviewing attempts not belonging to them', async () => {
      const otherToken = generateAccessToken(otherStudentId, 'STUDENT', '1h');
      const res = await makeRequest('GET', `/api/exams/${scheduledAttemptId}/review`, undefined, {
        Authorization: `Bearer ${otherToken}`
      });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Unauthorized/i);
    });
  });
});
