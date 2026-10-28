import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import http from 'http';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { db, initDatabase } from '../db/schema';
import { examsRouter } from '../routes/exams';
import { config } from '../config/env';

const JWT_SECRET = config.JWT_SECRET || 'bank_exam_jwt_secret_dev_key_2026';

const app = express();
app.use(express.json());
app.use('/api/exams', examsRouter);

let server: http.Server;
let serverPort: number;

function makeRequest(
  method: string,
  urlPath: string,
  body?: any,
  headers: Record<string, string> = {}
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const reqHeaders: Record<string, string> = { ...headers };
    if (payload) {
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
          resolve({ status: res.statusCode || 0, body: parsed });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function generateToken(userId: string, role: string = 'STUDENT') {
  return jwt.sign(
    { id: userId, email: `${userId}@test.local`, role, name: `User ${userId}` },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

describe('Safe Integration Tests: Exam Submission, Automatic Grading & Result Generation Workflow', () => {
  let studentId: string;
  let instructorId: string;
  let otherStudentId: string;
  let studentToken: string;
  let instructorToken: string;
  let otherStudentToken: string;
  let examIdInstant: string;
  let examIdScheduled: string;
  let examIdManual: string;
  let q1Id: string;
  let q2Id: string;
  let q3Id: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        serverPort = addr.port;
        resolve();
      });
    });
  });

  beforeEach(() => {
    initDatabase();

    studentId = uuidv4();
    instructorId = uuidv4();
    otherStudentId = uuidv4();

    // 1. Create users
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (?, ?, 'hash', 'Student Demo User', 'STUDENT')
    `).run(studentId, `student_${Date.now()}_${Math.random()}@banklms.ac.bd`);

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (?, ?, 'hash', 'Instructor Demo User', 'INSTRUCTOR')
    `).run(instructorId, `instructor_${Date.now()}_${Math.random()}@banklms.ac.bd`);

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (?, ?, 'hash', 'Other Student User', 'STUDENT')
    `).run(otherStudentId, `other_${Date.now()}_${Math.random()}@banklms.ac.bd`);

    studentToken = generateToken(studentId, 'STUDENT');
    instructorToken = generateToken(instructorId, 'INSTRUCTOR');
    otherStudentToken = generateToken(otherStudentId, 'STUDENT');

    // 2. Create questions:
    // Q1: SINGLE_MCQ (marks: 1.0, negative: 0.25)
    q1Id = uuidv4();
    db.prepare(`
      INSERT INTO questions (id, subject, chapter, topic, difficulty, type, prompt)
      VALUES (?, 'Math', 'Percentages', 'Profit Loss', 'EASY', 'SINGLE_MCQ', 'What is 10% of 200?')
    `).run(q1Id);
    const q1OptA = uuidv4();
    const q1OptB = uuidv4();
    db.prepare(`INSERT INTO question_options (id, question_id, option_key, text, is_correct, sort_order) VALUES (?, ?, 'A', '20', 1, 0)`).run(q1OptA, q1Id);
    db.prepare(`INSERT INTO question_options (id, question_id, option_key, text, is_correct, sort_order) VALUES (?, ?, 'B', '25', 0, 1)`).run(q1OptB, q1Id);

    // Q2: MULTI_SELECT (marks: 2.0, negative: 0.5)
    q2Id = uuidv4();
    db.prepare(`
      INSERT INTO questions (id, subject, chapter, topic, difficulty, type, prompt)
      VALUES (?, 'Math', 'Number Theory', 'Primes', 'MEDIUM', 'MULTI_SELECT', 'Select prime numbers')
    `).run(q2Id);
    const q2OptA = uuidv4();
    const q2OptB = uuidv4();
    const q2OptC = uuidv4();
    db.prepare(`INSERT INTO question_options (id, question_id, option_key, text, is_correct, sort_order) VALUES (?, ?, 'A', '2', 1, 0)`).run(q2OptA, q2Id);
    db.prepare(`INSERT INTO question_options (id, question_id, option_key, text, is_correct, sort_order) VALUES (?, ?, 'B', '3', 1, 1)`).run(q2OptB, q2Id);
    db.prepare(`INSERT INTO question_options (id, question_id, option_key, text, is_correct, sort_order) VALUES (?, ?, 'C', '4', 0, 2)`).run(q2OptC, q2Id);

    // Q3: NUMERIC (marks: 1.0, negative: 0.25)
    q3Id = uuidv4();
    db.prepare(`
      INSERT INTO questions (id, subject, chapter, topic, difficulty, type, prompt, correct_numeric, numeric_tolerance)
      VALUES (?, 'Math', 'Algebra', 'Equations', 'HARD', 'NUMERIC', 'Solve for x: 2x = 10', 5.0, 0.01)
    `).run(q3Id);

    // 3. Create Exams:
    const now = new Date();
    const startsAt = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
    const endsAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    const futureEndsAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    // Exam 1: INSTANT release mode
    examIdInstant = uuidv4();
    db.prepare(`
      INSERT INTO exams (
        id, title, category, type, duration_minutes, total_marks, pass_marks,
        negative_marking_rate, allowed_attempts, starts_at, ends_at, status,
        result_release_mode, integrity_enabled, max_violations_allowed, created_by
      ) VALUES (?, 'Instant Result Exam', 'BANK_RECRUITMENT', 'MODEL_TEST', 30, 4.0, 2.0, 0.25, 5, ?, ?, 'LIVE', 'INSTANT', 1, 3, ?)
    `).run(examIdInstant, startsAt, endsAt, instructorId);

    // Exam 2: SCHEDULED release mode (ends in the future)
    examIdScheduled = uuidv4();
    db.prepare(`
      INSERT INTO exams (
        id, title, category, type, duration_minutes, total_marks, pass_marks,
        negative_marking_rate, allowed_attempts, starts_at, ends_at, status,
        result_release_mode, integrity_enabled, max_violations_allowed, created_by
      ) VALUES (?, 'Scheduled Result Exam', 'BANK_RECRUITMENT', 'MODEL_TEST', 30, 4.0, 2.0, 0.25, 5, ?, ?, 'LIVE', 'SCHEDULED', 1, 3, ?)
    `).run(examIdScheduled, startsAt, futureEndsAt, instructorId);

    // Exam 3: MANUAL release mode (not yet RESULTS_PUBLISHED)
    examIdManual = uuidv4();
    db.prepare(`
      INSERT INTO exams (
        id, title, category, type, duration_minutes, total_marks, pass_marks,
        negative_marking_rate, allowed_attempts, starts_at, ends_at, status,
        result_release_mode, integrity_enabled, max_violations_allowed, created_by
      ) VALUES (?, 'Manual Release Exam', 'BANK_RECRUITMENT', 'MODEL_TEST', 30, 4.0, 2.0, 0.25, 5, ?, ?, 'LIVE', 'MANUAL', 1, 3, ?)
    `).run(examIdManual, startsAt, endsAt, instructorId);

    // Attach questions to all 3 exams
    for (const eid of [examIdInstant, examIdScheduled, examIdManual]) {
      db.prepare(`INSERT INTO exam_questions (id, exam_id, question_id, section_name, marks, negative_marks, order_index) VALUES (?, ?, ?, 'Math', 1.0, 0.25, 0)`).run(uuidv4(), eid, q1Id);
      db.prepare(`INSERT INTO exam_questions (id, exam_id, question_id, section_name, marks, negative_marks, order_index) VALUES (?, ?, ?, 'Math', 2.0, 0.50, 1)`).run(uuidv4(), eid, q2Id);
      db.prepare(`INSERT INTO exam_questions (id, exam_id, question_id, section_name, marks, negative_marks, order_index) VALUES (?, ?, ?, 'Math', 1.0, 0.25, 2)`).run(uuidv4(), eid, q3Id);
    }
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  // -------------------------------------------------------------
  // Test 1: Exam Start -> Answer Autosave -> Manual Submit & Instant Result Generation
  // -------------------------------------------------------------
  it('1. Full Lifecycle: Exam start -> Autosave -> Manual submission -> Instant grading and result persistence', async () => {
    // 1. Start exam
    const startRes = await makeRequest('POST', `/api/exams/${examIdInstant}/start`, undefined, {
      Authorization: `Bearer ${studentToken}`
    });

    expect(startRes.status).toBe(200);
    expect(startRes.body.success).toBe(true);
    const attemptId = startRes.body.attemptId;
    expect(attemptId).toBeDefined();

    // 2. Autosave correct answer for Q1
    const q1Opts: any[] = db.prepare('SELECT id FROM question_options WHERE question_id = ? AND is_correct = 1').all(q1Id);
    const autosaveRes = await makeRequest('POST', '/api/exams/autosave', {
      attemptId,
      questionId: q1Id,
      selectedOptionIds: [q1Opts[0].id],
      clientSequence: 1
    }, {
      Authorization: `Bearer ${studentToken}`
    });

    expect(autosaveRes.status).toBe(200);
    expect(autosaveRes.body.saved).toBe(true);

    // 3. Manual Submit
    const submitRes = await makeRequest('POST', `/api/exams/${attemptId}/submit`, {}, {
      Authorization: `Bearer ${studentToken}`,
      'x-idempotency-key': `submit-${attemptId}`
    });

    expect(submitRes.status).toBe(200);
    expect(submitRes.body.success).toBe(true);
    expect(submitRes.body.status).toBe('GRADED');
    expect(submitRes.body.grade).toBeDefined();
    expect(submitRes.body.grade.score).toBe(1.0); // Q1 correct = 1.0, Q2 skipped = 0, Q3 skipped = 0
    expect(submitRes.body.grade.maximumMarks).toBe(4.0);
    expect(submitRes.body.grade.correctCount).toBe(1);
    expect(submitRes.body.grade.skippedCount).toBe(2);

    // Verify DB records
    const attemptDb: any = db.prepare('SELECT * FROM attempts WHERE id = ?').get(attemptId);
    expect(attemptDb.status).toBe('GRADED');
    expect(attemptDb.submitted_at).toBeDefined();

    const resultDb: any = db.prepare('SELECT * FROM exam_results WHERE attempt_id = ?').get(attemptId);
    expect(resultDb).toBeDefined();
    expect(resultDb.score).toBe(1.0);
    expect(resultDb.user_id).toBe(studentId);
  });

  // -------------------------------------------------------------
  // Test 2: Negative marking calculation
  // -------------------------------------------------------------
  it('2. Negative Marking: Correctly applies negative marking penalty on wrong answers', async () => {
    const startRes = await makeRequest('POST', `/api/exams/${examIdInstant}/start`, undefined, {
      Authorization: `Bearer ${studentToken}`
    });

    const attemptId = startRes.body.attemptId;

    // Q1 Correct (+1.0)
    const q1OptsCorrect: any[] = db.prepare('SELECT id FROM question_options WHERE question_id = ? AND is_correct = 1').all(q1Id);
    await makeRequest('POST', '/api/exams/autosave', {
      attemptId,
      questionId: q1Id,
      selectedOptionIds: [q1OptsCorrect[0].id],
      clientSequence: 1
    }, {
      Authorization: `Bearer ${studentToken}`
    });

    // Q2 Wrong (-0.50)
    const q2OptsWrong: any[] = db.prepare('SELECT id FROM question_options WHERE question_id = ? AND is_correct = 0').all(q2Id);
    await makeRequest('POST', '/api/exams/autosave', {
      attemptId,
      questionId: q2Id,
      selectedOptionIds: [q2OptsWrong[0].id],
      clientSequence: 1
    }, {
      Authorization: `Bearer ${studentToken}`
    });

    // Q3 Wrong numeric (-0.25)
    await makeRequest('POST', '/api/exams/autosave', {
      attemptId,
      questionId: q3Id,
      numericAnswer: 999.0, // Expected 5.0
      clientSequence: 1
    }, {
      Authorization: `Bearer ${studentToken}`
    });

    const submitRes = await makeRequest('POST', `/api/exams/${attemptId}/submit`, {}, {
      Authorization: `Bearer ${studentToken}`
    });

    expect(submitRes.status).toBe(200);
    // Score = 1.0 (Q1) - 0.50 (Q2) - 0.25 (Q3) = 0.25
    expect(submitRes.body.grade.score).toBe(0.25);
    expect(submitRes.body.grade.correctCount).toBe(1);
    expect(submitRes.body.grade.wrongCount).toBe(2);
    expect(submitRes.body.grade.skippedCount).toBe(0);
  });

  // -------------------------------------------------------------
  // Test 3: Auto-Submit on Timer Expiry during Autosave triggers grading
  // -------------------------------------------------------------
  it('3. Auto-Submit on Timer Expiration: Immediately grades and generates result record on timer expiry', async () => {
    const startRes = await makeRequest('POST', `/api/exams/${examIdInstant}/start`, undefined, {
      Authorization: `Bearer ${studentToken}`
    });

    const attemptId = startRes.body.attemptId;

    // Save one correct answer
    const q1OptsCorrect: any[] = db.prepare('SELECT id FROM question_options WHERE question_id = ? AND is_correct = 1').all(q1Id);
    await makeRequest('POST', '/api/exams/autosave', {
      attemptId,
      questionId: q1Id,
      selectedOptionIds: [q1OptsCorrect[0].id],
      clientSequence: 1
    }, {
      Authorization: `Bearer ${studentToken}`
    });

    // Artificially simulate timer expiration on server: set expires_at into the past
    const pastTime = new Date(Date.now() - 5000).toISOString();
    db.prepare('UPDATE attempts SET expires_at = ? WHERE id = ?').run(pastTime, attemptId);

    // Call autosave again -> server detects expiration -> triggers finalizeAndGradeAttempt
    const expiredAutosaveRes = await makeRequest('POST', '/api/exams/autosave', {
      attemptId,
      questionId: q1Id,
      selectedOptionIds: [q1OptsCorrect[0].id],
      clientSequence: 2
    }, {
      Authorization: `Bearer ${studentToken}`
    });

    expect(expiredAutosaveRes.status).toBe(403);
    expect(expiredAutosaveRes.body.error).toContain('timer has expired');

    // Verify attempt is marked GRADED and exam_results record exists!
    const resultDb: any = db.prepare('SELECT * FROM exam_results WHERE attempt_id = ?').get(attemptId);
    expect(resultDb).toBeDefined();
    expect(resultDb.score).toBe(1.0);
    expect(resultDb.correct_count).toBe(1);

    // Verify when client subsequently calls submit, it receives the already graded result gracefully
    const submitRes = await makeRequest('POST', `/api/exams/${attemptId}/submit`, {}, {
      Authorization: `Bearer ${studentToken}`
    });

    expect(submitRes.status).toBe(200);
    expect(submitRes.body.alreadySubmitted).toBe(true);
    expect(submitRes.body.grade.score).toBe(1.0);
  });

  // -------------------------------------------------------------
  // Test 4: Auto-Submit via Submit endpoint when attempt already marked AUTO_SUBMITTED without results
  // -------------------------------------------------------------
  it('4. Auto-Submit Recovery: Gracefully grades and persists results when attempt was previously locked as AUTO_SUBMITTED', async () => {
    const attemptId = uuidv4();
    const pastTime = new Date(Date.now() - 60000).toISOString();

    // Create an un-graded AUTO_SUBMITTED attempt (simulating historical state or disconnect)
    db.prepare(`
      INSERT INTO attempts (id, exam_id, user_id, started_at, expires_at, submitted_at, status)
      VALUES (?, ?, ?, ?, ?, ?, 'AUTO_SUBMITTED')
    `).run(attemptId, examIdInstant, studentId, pastTime, pastTime, pastTime);

    // Insert an answer
    const q1OptsCorrect: any[] = db.prepare('SELECT id FROM question_options WHERE question_id = ? AND is_correct = 1').all(q1Id);
    db.prepare(`
      INSERT INTO attempt_answers (id, attempt_id, question_id, selected_option_ids)
      VALUES (?, ?, ?, ?)
    `).run(uuidv4(), attemptId, q1Id, JSON.stringify([q1OptsCorrect[0].id]));

    // Calling submit on this attempt should grade it rather than returning null!
    const submitRes = await makeRequest('POST', `/api/exams/${attemptId}/submit`, {}, {
      Authorization: `Bearer ${studentToken}`
    });

    expect(submitRes.status).toBe(200);
    expect(submitRes.body.success).toBe(true);
    expect(submitRes.body.grade).toBeDefined();
    expect(submitRes.body.grade.score).toBe(1.0);

    const resultDb: any = db.prepare('SELECT * FROM exam_results WHERE attempt_id = ?').get(attemptId);
    expect(resultDb).toBeDefined();
    expect(resultDb.score).toBe(1.0);
  });

  // -------------------------------------------------------------
  // Test 5: Idempotency & Duplicate Submission Prevention
  // -------------------------------------------------------------
  it('5. Double Submit Prevention: Concurrent or duplicate submit requests produce exactly one exam_results row', async () => {
    const startRes = await makeRequest('POST', `/api/exams/${examIdInstant}/start`, undefined, {
      Authorization: `Bearer ${studentToken}`
    });

    const attemptId = startRes.body.attemptId;

    // Execute first submit
    const res1 = await makeRequest('POST', `/api/exams/${attemptId}/submit`, {}, {
      Authorization: `Bearer ${studentToken}`,
      'x-idempotency-key': `idem-${attemptId}`
    });

    expect(res1.status).toBe(200);
    expect(res1.body.alreadySubmitted).toBe(false);

    // Execute duplicate submit
    const res2 = await makeRequest('POST', `/api/exams/${attemptId}/submit`, {}, {
      Authorization: `Bearer ${studentToken}`,
      'x-idempotency-key': `idem-${attemptId}`
    });

    expect(res2.status).toBe(200);
    expect(res2.body.alreadySubmitted).toBe(true);

    // Verify exact row count in exam_results
    const resultsCount: any = db.prepare('SELECT COUNT(*) as count FROM exam_results WHERE attempt_id = ?').get(attemptId);
    expect(resultsCount.count).toBe(1);
  });

  // -------------------------------------------------------------
  // Test 6: Result Release Permissions (INSTANT vs SCHEDULED vs MANUAL)
  // -------------------------------------------------------------
  it('6. Result Release Control: Respects INSTANT, SCHEDULED, and MANUAL release permissions', async () => {
    // 6A: INSTANT Exam -> Student can review immediately after submit
    const startInstant = await makeRequest('POST', `/api/exams/${examIdInstant}/start`, undefined, {
      Authorization: `Bearer ${studentToken}`
    });
    const instantAttemptId = startInstant.body.attemptId;
    await makeRequest('POST', `/api/exams/${instantAttemptId}/submit`, {}, {
      Authorization: `Bearer ${studentToken}`
    });

    const reviewInstantRes = await makeRequest('GET', `/api/exams/${instantAttemptId}/review`, undefined, {
      Authorization: `Bearer ${studentToken}`
    });
    expect(reviewInstantRes.status).toBe(200);
    expect(reviewInstantRes.body.result).toBeDefined();

    // 6B: SCHEDULED Exam (window still open) -> Student is blocked from reviewing until window ends
    const startSched = await makeRequest('POST', `/api/exams/${examIdScheduled}/start`, undefined, {
      Authorization: `Bearer ${studentToken}`
    });
    const schedAttemptId = startSched.body.attemptId;
    await makeRequest('POST', `/api/exams/${schedAttemptId}/submit`, {}, {
      Authorization: `Bearer ${studentToken}`
    });

    const reviewSchedRes = await makeRequest('GET', `/api/exams/${schedAttemptId}/review`, undefined, {
      Authorization: `Bearer ${studentToken}`
    });
    expect(reviewSchedRes.status).toBe(403);
    expect(reviewSchedRes.body.error).toContain('scheduled to be released');

    // 6C: MANUAL Exam (status = LIVE) -> Student blocked from review
    const startManual = await makeRequest('POST', `/api/exams/${examIdManual}/start`, undefined, {
      Authorization: `Bearer ${studentToken}`
    });
    const manualAttemptId = startManual.body.attemptId;
    await makeRequest('POST', `/api/exams/${manualAttemptId}/submit`, {}, {
      Authorization: `Bearer ${studentToken}`
    });

    const reviewManualRes = await makeRequest('GET', `/api/exams/${manualAttemptId}/review`, undefined, {
      Authorization: `Bearer ${studentToken}`
    });
    expect(reviewManualRes.status).toBe(403);
    expect(reviewManualRes.body.error).toContain('not been published');

    // 6D: Privileged Instructor can ALWAYS review attempts for any release mode
    const instructorReviewRes = await makeRequest('GET', `/api/exams/${manualAttemptId}/review`, undefined, {
      Authorization: `Bearer ${instructorToken}`
    });
    expect(instructorReviewRes.status).toBe(200);
    expect(instructorReviewRes.body.result).toBeDefined();

    // 6E: Other Student cannot access unauthorized attempts
    const unauthorizedReviewRes = await makeRequest('GET', `/api/exams/${instantAttemptId}/review`, undefined, {
      Authorization: `Bearer ${otherStudentToken}`
    });
    expect(unauthorizedReviewRes.status).toBe(403);
  });

  // -------------------------------------------------------------
  // Test 7: Instructor Submissions Retrieval
  // -------------------------------------------------------------
  it('7. Instructor Submissions Retrieval: Correctly lists student attempts, accurate score, and completion stats', async () => {
    // Student completes attempt
    const startRes = await makeRequest('POST', `/api/exams/${examIdInstant}/start`, undefined, {
      Authorization: `Bearer ${studentToken}`
    });
    const attemptId = startRes.body.attemptId;

    const q1OptsCorrect: any[] = db.prepare('SELECT id FROM question_options WHERE question_id = ? AND is_correct = 1').all(q1Id);
    await makeRequest('POST', '/api/exams/autosave', {
      attemptId,
      questionId: q1Id,
      selectedOptionIds: [q1OptsCorrect[0].id],
      clientSequence: 1
    }, {
      Authorization: `Bearer ${studentToken}`
    });

    await makeRequest('POST', `/api/exams/${attemptId}/submit`, {}, {
      Authorization: `Bearer ${studentToken}`
    });

    // Instructor views submissions
    const subRes = await makeRequest('GET', `/api/exams/${examIdInstant}/submissions`, undefined, {
      Authorization: `Bearer ${instructorToken}`
    });

    expect(subRes.status).toBe(200);
    expect(subRes.body.success).toBe(true);
    expect(subRes.body.analytics.totalAttempts).toBe(1);
    expect(subRes.body.analytics.gradedCount).toBe(1);
    expect(subRes.body.analytics.averageScore).toBe(1.0);
    expect(subRes.body.submissions.length).toBe(1);
    expect(subRes.body.submissions[0].attemptId).toBe(attemptId);
    expect(subRes.body.submissions[0].score).toBe(1.0);
    expect(subRes.body.submissions[0].studentName).toBe('Student Demo User');
  });

  // -------------------------------------------------------------
  // Test 8: Incomplete Attempts do not receive fabricated grades
  // -------------------------------------------------------------
  it('8. Incomplete Attempts: Active IN_PROGRESS attempts have no fabricated results until finalization', async () => {
    const startRes = await makeRequest('POST', `/api/exams/${examIdInstant}/start`, undefined, {
      Authorization: `Bearer ${studentToken}`
    });
    const attemptId = startRes.body.attemptId;

    // Verify no result record exists for IN_PROGRESS attempt
    const resultDb: any = db.prepare('SELECT * FROM exam_results WHERE attempt_id = ?').get(attemptId);
    expect(resultDb).toBeUndefined();

    // In instructor submissions list, attempt shows In Progress without fabricated score
    const subRes = await makeRequest('GET', `/api/exams/${examIdInstant}/submissions`, undefined, {
      Authorization: `Bearer ${instructorToken}`
    });

    expect(subRes.status).toBe(200);
    const sub = subRes.body.submissions.find((s: any) => s.attemptId === attemptId);
    expect(sub).toBeDefined();
    expect(sub.resultId).toBeNull();
    expect(sub.score).toBeNull();
    expect(sub.attemptStatus).toBe('IN_PROGRESS');
  });
});
