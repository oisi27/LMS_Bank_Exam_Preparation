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
          resolve({ status: res.statusCode || 500, body: parsed });
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

describe('Proposal Gap Fix Step 2: Instructor Exam Results & Integrity Review Tests', () => {
  let adminToken: string;
  let instructorAToken: string;
  let instructorBToken: string;
  let studentToken: string;

  const adminId = 'a1000000-0000-4000-8000-000000000001';
  const instructorAId = 'b1000000-0000-4000-8000-000000000001';
  const instructorBId = 'b2000000-0000-4000-8000-000000000002';
  const studentId = 'c1000000-0000-4000-8000-000000000001';

  let examAId: string;
  let attemptAId: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
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

    // Upsert users
    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
      ON CONFLICT(id) DO UPDATE SET role = excluded.role, is_active = 1
    `).run(adminId, 'Admin Head', 'admin_head@banklms.edu.bd', 'hash', 'ADMIN');

    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
      ON CONFLICT(id) DO UPDATE SET role = excluded.role, is_active = 1
    `).run(instructorAId, 'Instructor Alice', 'alice@banklms.edu.bd', 'hash', 'INSTRUCTOR');

    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
      ON CONFLICT(id) DO UPDATE SET role = excluded.role, is_active = 1
    `).run(instructorBId, 'Instructor Bob', 'bob@banklms.edu.bd', 'hash', 'INSTRUCTOR');

    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
      ON CONFLICT(id) DO UPDATE SET role = excluded.role, is_active = 1
    `).run(studentId, 'Candidate Charlie', 'charlie@banklms.edu.bd', 'hash', 'STUDENT');

    adminToken = generateToken(adminId, 'ADMIN', 'admin_head@banklms.edu.bd');
    instructorAToken = generateToken(instructorAId, 'INSTRUCTOR', 'alice@banklms.edu.bd');
    instructorBToken = generateToken(instructorBId, 'INSTRUCTOR', 'bob@banklms.edu.bd');
    studentToken = generateToken(studentId, 'STUDENT', 'charlie@banklms.edu.bd');

    // Create an exam authored by Instructor A
    examAId = uuidv4();
    db.prepare(`
      INSERT INTO exams (id, title, category, type, status, duration_minutes, total_marks, pass_marks, negative_marking_rate, allowed_attempts, starts_at, ends_at, created_by)
      VALUES (?, 'Alice Exam - Bangladesh Affairs', 'BANK_RECRUITMENT', 'MODEL_TEST', 'LIVE', 60, 100, 40, 0.25, 1, '2026-10-21T00:00:00Z', '2026-10-22T00:00:00Z', ?)
    `).run(examAId, instructorAId);

    // Create an attempt and submission by Charlie for Exam A
    attemptAId = uuidv4();
    db.prepare(`
      INSERT INTO attempts (id, exam_id, user_id, status, started_at, expires_at, submitted_at)
      VALUES (?, ?, ?, 'GRADED', '2026-10-21T10:00:00Z', '2026-10-21T11:00:00Z', '2026-10-21T10:45:00Z')
    `).run(attemptAId, examAId, studentId);

    db.prepare(`
      INSERT INTO exam_results (id, attempt_id, exam_id, user_id, score, total_marks, correct_count, wrong_count, skipped_count, accuracy_percentage, time_spent_seconds, is_passed)
      VALUES (?, ?, ?, ?, 75.0, 100, 80, 20, 0, 80.0, 2700, 1)
    `).run(uuidv4(), attemptAId, examAId, studentId);

    // Create an integrity violation for this attempt
    db.prepare(`
      INSERT INTO exam_violations (id, attempt_id, violation_type, details, occurred_at)
      VALUES (?, ?, 'TAB_SWITCH', ?, '2026-10-21T10:15:00Z')
    `).run(uuidv4(), attemptAId, JSON.stringify({ window: 'unfocused' }));
  });

  it('should allow exam creator (Instructor A) to review student results and integrity flags for their own exam', async () => {
    const res = await makeRequest(
      'GET',
      `/api/exams/${examAId}/submissions`,
      { Authorization: `Bearer ${instructorAToken}` }
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.exam.id).toBe(examAId);
    expect(res.body.analytics.totalAttempts).toBe(1);
    expect(res.body.analytics.averageScore).toBe(75);
    expect(res.body.analytics.totalViolations).toBe(1);

    // Verify submission record
    expect(res.body.submissions.length).toBe(1);
    expect(res.body.submissions[0].studentName).toBe('Candidate Charlie');
    expect(res.body.submissions[0].score).toBe(75);
    expect(res.body.submissions[0].isPassed).toBe(true);
    expect(res.body.submissions[0].violationCount).toBe(1);

    // Verify violation record
    expect(res.body.violations.length).toBe(1);
    expect(res.body.violations[0].violationType).toBe('TAB_SWITCH');
    expect(res.body.violations[0].studentName).toBe('Candidate Charlie');
  });

  it('should FORBID Instructor B from viewing submissions and integrity logs of Instructor A exam (403 Access Denied)', async () => {
    const res = await makeRequest(
      'GET',
      `/api/exams/${examAId}/submissions`,
      { Authorization: `Bearer ${instructorBToken}` }
    );

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Access denied');
  });

  it('should allow ADMIN to review any exam submissions and integrity violations', async () => {
    const res = await makeRequest(
      'GET',
      `/api/exams/${examAId}/submissions`,
      { Authorization: `Bearer ${adminToken}` }
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.submissions.length).toBe(1);
  });

  it('should FORBID normal STUDENT role from accessing the submissions endpoint (403 Role Forbidden)', async () => {
    const res = await makeRequest(
      'GET',
      `/api/exams/${examAId}/submissions`,
      { Authorization: `Bearer ${studentToken}` }
    );

    expect(res.status).toBe(403);
  });

  it('should handle in-progress and un-graded attempts cleanly with attemptStatus and null result values', async () => {
    const studentDId = uuidv4();
    const inProgressAttemptId = uuidv4();

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, is_active)
      VALUES (?, ?, 'hash', 'Candidate Dana', 'STUDENT', 1)
    `).run(studentDId, `student_d_${Date.now()}_${Math.random()}@test.local`);

    // Insert an in-progress attempt that has no exam_results row
    db.prepare(`
      INSERT INTO attempts (id, exam_id, user_id, started_at, expires_at, status)
      VALUES (?, ?, ?, '2026-10-25T10:00:00.000Z', '2026-10-25T11:00:00.000Z', 'IN_PROGRESS')
    `).run(inProgressAttemptId, examAId, studentDId);

    const res = await makeRequest(
      'GET',
      `/api/exams/${examAId}/submissions`,
      { Authorization: `Bearer ${instructorAToken}` }
    );

    expect(res.status).toBe(200);
    expect(res.body.analytics.totalAttempts).toBe(2);
    expect(res.body.analytics.gradedCount).toBe(1); // Only 1 graded attempt

    const inProgressSub = res.body.submissions.find((s: any) => s.attemptId === inProgressAttemptId);
    expect(inProgressSub).toBeDefined();
    expect(inProgressSub.attemptStatus).toBe('IN_PROGRESS');
    expect(inProgressSub.resultId).toBeNull();
    expect(inProgressSub.score).toBeNull();
    expect(inProgressSub.accuracyPercentage).toBeNull();
    expect(inProgressSub.studentName).toBe('Candidate Dana');
  });

  it('should return questionsSumMarks in GET /api/exams/:id and keep total_marks consistent upon question updates', async () => {
    // 1. Create a draft exam with 2 questions
    const q1Id = uuidv4();
    const q2Id = uuidv4();

    db.prepare(`
      INSERT INTO questions (id, subject, chapter, topic, difficulty, type, prompt, is_approved)
      VALUES (?, 'MATH', 'Algebra', 'Linear', 'MEDIUM', 'SINGLE_MCQ', 'Q1 Prompt', 1)
    `).run(q1Id);
    db.prepare(`
      INSERT INTO question_options (id, question_id, option_key, text, is_correct)
      VALUES (?, ?, 'A', 'Opt 1', 1), (?, ?, 'B', 'Opt 2', 0)
    `).run(uuidv4(), q1Id, uuidv4(), q1Id);

    db.prepare(`
      INSERT INTO questions (id, subject, chapter, topic, difficulty, type, prompt, is_approved)
      VALUES (?, 'MATH', 'Algebra', 'Linear', 'MEDIUM', 'SINGLE_MCQ', 'Q2 Prompt', 1)
    `).run(q2Id);
    db.prepare(`
      INSERT INTO question_options (id, question_id, option_key, text, is_correct)
      VALUES (?, ?, 'A', 'Opt 1', 1), (?, ?, 'B', 'Opt 2', 0)
    `).run(uuidv4(), q2Id, uuidv4(), q2Id);

    const testExamId = uuidv4();
    db.prepare(`
      INSERT INTO exams (id, title, category, type, status, duration_minutes, total_marks, pass_marks, starts_at, ends_at, created_by)
      VALUES (?, 'Marks Sync Test Exam', 'BANK_RECRUITMENT', 'MODEL_TEST', 'DRAFT', 60, 50, 20, '2026-10-25T10:00:00.000Z', '2026-10-30T10:00:00.000Z', ?)
    `).run(testExamId, instructorAId);

    // Update questions on the exam
    const updateRes = await makeRequest(
      'PUT',
      `/api/exams/${testExamId}`,
      { Authorization: `Bearer ${instructorAToken}` },
      { questionIds: [q1Id, q2Id] }
    );
    expect(updateRes.status).toBe(200);

    // Verify GET /api/exams/:id returns synchronized questionsSumMarks
    const examDetailRes = await makeRequest(
      'GET',
      `/api/exams/${testExamId}`,
      { Authorization: `Bearer ${instructorAToken}` }
    );

    expect(examDetailRes.status).toBe(200);
    expect(examDetailRes.body.exam.questionsSumMarks).toBe(2);
    expect(examDetailRes.body.exam.totalMarks).toBe(2);
    expect(examDetailRes.body.exam.questions.length).toBe(2);
  });

  it('should return Unknown Candidate fallback when user name is null and provide valid ISO occurredAt timestamps', async () => {
    const namelessStudentId = uuidv4();
    const namelessAttemptId = uuidv4();
    const violationId = uuidv4();

    // Create user with null/empty name
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, is_active)
      VALUES (?, ?, 'hash', '', 'STUDENT', 1)
    `).run(namelessStudentId, `nameless_${Date.now()}@test.local`);

    db.prepare(`
      INSERT INTO attempts (id, exam_id, user_id, started_at, expires_at, status)
      VALUES (?, ?, ?, '2026-10-26T12:00:00.000Z', '2026-10-26T13:00:00.000Z', 'SUBMITTED')
    `).run(namelessAttemptId, examAId, namelessStudentId);

    db.prepare(`
      INSERT INTO exam_results (id, attempt_id, exam_id, user_id, score, total_marks, correct_count, wrong_count, skipped_count, accuracy_percentage, time_spent_seconds, is_passed)
      VALUES (?, ?, ?, ?, 80, 100, 8, 2, 0, 80, 1200, 1)
    `).run(uuidv4(), namelessAttemptId, examAId, namelessStudentId);

    const testTimeIso = '2026-10-26T12:15:30.500Z';
    db.prepare(`
      INSERT INTO exam_violations (id, attempt_id, violation_type, occurred_at, details)
      VALUES (?, ?, 'FULLSCREEN_EXIT', ?, '{"note":"test"}')
    `).run(violationId, namelessAttemptId, testTimeIso);

    const res = await makeRequest(
      'GET',
      `/api/exams/${examAId}/submissions`,
      { Authorization: `Bearer ${instructorAToken}` }
    );

    expect(res.status).toBe(200);

    const submission = res.body.submissions.find((s: any) => s.attemptId === namelessAttemptId);
    expect(submission).toBeDefined();
    expect(submission.studentName).toBe('Unknown Candidate');
    expect(submission.score).toBe(80);
    expect(submission.totalMarks).toBe(100);

    const violation = res.body.violations.find((v: any) => v.id === violationId);
    expect(violation).toBeDefined();
    expect(violation.occurredAt).toBe(testTimeIso);
    expect(new Date(violation.occurredAt).getTime()).not.toBeNaN();
  });
});
