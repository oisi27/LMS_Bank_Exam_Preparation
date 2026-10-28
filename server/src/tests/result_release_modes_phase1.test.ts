import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import http from 'http';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { db, initDatabase } from '../db/schema';
import { examsRouter } from '../routes/exams';
import { dashboardRouter } from '../routes/dashboard';
import { config } from '../config/env';

const JWT_SECRET = config.JWT_SECRET || 'bank_exam_jwt_secret_dev_key_2026';

const app = express();
app.use(express.json());
app.use('/api/exams', examsRouter);
app.use('/api/dashboard', dashboardRouter);

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

describe('Phase 1 Verification: Instructor-Controlled Result Publication Modes (INSTANT, SCHEDULED, MANUAL)', () => {
  let studentId: string;
  let otherStudentId: string;
  let instructorId: string;
  let unauthorizedInstructorId: string;

  let studentToken: string;
  let otherStudentToken: string;
  let instructorToken: string;
  let unauthorizedInstructorToken: string;

  let q1Id: string;
  let q1CorrectOptId: string;

  beforeAll(async () => {
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

  beforeEach(() => {
    initDatabase();

    studentId = uuidv4();
    otherStudentId = uuidv4();
    instructorId = uuidv4();
    unauthorizedInstructorId = uuidv4();

    studentToken = generateToken(studentId, 'STUDENT');
    otherStudentToken = generateToken(otherStudentId, 'STUDENT');
    instructorToken = generateToken(instructorId, 'INSTRUCTOR');
    unauthorizedInstructorToken = generateToken(unauthorizedInstructorId, 'INSTRUCTOR');

    // Create users in test database
    const nowIso = new Date().toISOString();
    for (const [uid, urole] of [
      [studentId, 'STUDENT'],
      [otherStudentId, 'STUDENT'],
      [instructorId, 'INSTRUCTOR'],
      [unauthorizedInstructorId, 'INSTRUCTOR']
    ]) {
      db.prepare(`
        INSERT OR REPLACE INTO users (id, email, password_hash, name, role, is_active, created_at, updated_at)
        VALUES (?, ?, 'hash', ?, ?, 1, ?, ?)
      `).run(uid, `${uid}@test.local`, `User ${uid}`, urole, nowIso, nowIso);
    }

    // Insert a reusable approved Question
    q1Id = uuidv4();
    q1CorrectOptId = uuidv4();
    const wrongOptId = uuidv4();

    db.prepare(`
      INSERT INTO questions (
        id, subject, chapter, topic, difficulty, type,
        prompt, explanation, is_approved, author_id
      ) VALUES (?, 'Mathematics', 'Arithmetic', 'Percentages', 'MEDIUM', 'SINGLE_MCQ', 'What is 10% of 100?', '10% of 100 is 10.', 1, ?)
    `).run(q1Id, instructorId);

    db.prepare(`
      INSERT INTO question_options (id, question_id, option_key, text, is_correct, sort_order)
      VALUES (?, ?, 'A', '10', 1, 0), (?, ?, 'B', '20', 0, 1)
    `).run(q1CorrectOptId, q1Id, wrongOptId, q1Id);
  });

  // Helper to create an exam with specific mode, timing, and status
  function createExamFixture(options: {
    releaseMode: 'INSTANT' | 'SCHEDULED' | 'MANUAL';
    status?: 'DRAFT' | 'SCHEDULED' | 'LIVE' | 'CLOSED' | 'RESULTS_PUBLISHED';
    startsAt?: string;
    endsAt?: string;
    createdBy?: string;
  }) {
    const examId = uuidv4();
    const startsAt = options.startsAt || new Date(Date.now() - 3600000).toISOString();
    const endsAt = options.endsAt || new Date(Date.now() + 3600000).toISOString();
    const status = options.status || 'LIVE';
    const createdBy = options.createdBy || instructorId;

    db.prepare(`
      INSERT INTO exams (
        id, title, category, type, duration_minutes, total_marks, pass_marks,
        negative_marking_rate, allowed_attempts, starts_at, ends_at, status,
        result_release_mode, integrity_enabled, max_violations_allowed, created_by
      ) VALUES (?, ?, 'BANK_RECRUITMENT', 'MODEL_TEST', 30, 1.0, 0.5, 0.25, 5, ?, ?, ?, ?, 1, 3, ?)
    `).run(examId, `Exam ${options.releaseMode}`, startsAt, endsAt, status, options.releaseMode, createdBy);

    db.prepare(`
      INSERT INTO exam_questions (id, exam_id, question_id, section_name, marks, negative_marks, order_index)
      VALUES (?, ?, ?, 'Math', 1.0, 0.25, 0)
    `).run(uuidv4(), examId, q1Id);

    return examId;
  }

  // --------------------------------------------------------------------------
  // Requirement 1: INSTANT: score is returned after submission
  // --------------------------------------------------------------------------
  it('1. INSTANT: score, percentage, and counts are immediately returned upon submission', async () => {
    const examId = createExamFixture({ releaseMode: 'INSTANT' });

    // Start exam
    const startRes = await makeRequest('POST', `/api/exams/${examId}/start`, undefined, {
      Authorization: `Bearer ${studentToken}`
    });
    expect(startRes.status).toBe(200);
    const attemptId = startRes.body.attemptId;

    // Answer correctly
    await makeRequest('POST', '/api/exams/autosave', {
      attemptId,
      questionId: q1Id,
      selectedOptionIds: [q1CorrectOptId],
      clientSequence: 1
    }, {
      Authorization: `Bearer ${studentToken}`
    });

    // Submit exam
    const submitRes = await makeRequest('POST', `/api/exams/${attemptId}/submit`, {}, {
      Authorization: `Bearer ${studentToken}`
    });

    expect(submitRes.status).toBe(200);
    expect(submitRes.body.success).toBe(true);
    expect(submitRes.body.resultsWithheld).toBeFalsy();
    expect(submitRes.body.grade).toBeDefined();
    expect(submitRes.body.grade.score).toBe(1.0);
    expect(submitRes.body.grade.correctCount).toBe(1);
    expect(submitRes.body.grade.isPassed).toBe(true);

    // Review is immediately accessible
    const reviewRes = await makeRequest('GET', `/api/exams/${attemptId}/review`, undefined, {
      Authorization: `Bearer ${studentToken}`
    });
    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.result.score).toBe(1.0);
  });

  // --------------------------------------------------------------------------
  // Requirement 2: SCHEDULED before release: submission succeeds but score is hidden
  // --------------------------------------------------------------------------
  it('2. SCHEDULED before release: submission succeeds but score is hidden with clear scheduled release notice', async () => {
    const futureEndsAt = new Date(Date.now() + 7200000).toISOString(); // 2 hours in future
    const examId = createExamFixture({
      releaseMode: 'SCHEDULED',
      endsAt: futureEndsAt
    });

    // Start attempt
    const startRes = await makeRequest('POST', `/api/exams/${examId}/start`, undefined, {
      Authorization: `Bearer ${studentToken}`
    });
    const attemptId = startRes.body.attemptId;

    // Answer question
    await makeRequest('POST', '/api/exams/autosave', {
      attemptId,
      questionId: q1Id,
      selectedOptionIds: [q1CorrectOptId],
      clientSequence: 1
    }, {
      Authorization: `Bearer ${studentToken}`
    });

    // Submit attempt
    const submitRes = await makeRequest('POST', `/api/exams/${attemptId}/submit`, {}, {
      Authorization: `Bearer ${studentToken}`
    });

    expect(submitRes.status).toBe(200);
    expect(submitRes.body.success).toBe(true);
    expect(submitRes.body.resultsWithheld).toBe(true);
    expect(submitRes.body.releaseMode).toBe('SCHEDULED');
    expect(submitRes.body.grade).toBeUndefined(); // Score NOT in response!
    expect(submitRes.body.message).toBe('Exam submitted successfully. Your result will be available at the scheduled publication time.');

    // Result is securely stored in database on backend
    const savedResult: any = db.prepare('SELECT * FROM exam_results WHERE attempt_id = ?').get(attemptId);
    expect(savedResult).toBeDefined();
    expect(savedResult.score).toBe(1.0);
  });

  // --------------------------------------------------------------------------
  // Requirement 3: SCHEDULED after release: authorized result access succeeds
  // --------------------------------------------------------------------------
  it('3. SCHEDULED after release: student can access results once release time has passed', async () => {
    // Ends 5 minutes ago (window ended)
    const pastEndsAt = new Date(Date.now() - 300000).toISOString();
    const examId = createExamFixture({
      releaseMode: 'SCHEDULED',
      endsAt: pastEndsAt
    });

    // Attempt was already completed in the past
    const attemptId = uuidv4();
    db.prepare(`
      INSERT INTO attempts (id, exam_id, user_id, started_at, expires_at, submitted_at, status)
      VALUES (?, ?, ?, ?, ?, ?, 'GRADED')
    `).run(attemptId, examId, studentId, pastEndsAt, pastEndsAt, pastEndsAt);

    db.prepare(`
      INSERT INTO exam_results (id, attempt_id, exam_id, user_id, score, total_marks, correct_count, wrong_count, skipped_count, accuracy_percentage, time_spent_seconds, is_passed)
      VALUES (?, ?, ?, ?, 1.0, 1.0, 1, 0, 0, 100, 60, 1)
    `).run(uuidv4(), attemptId, examId, studentId);

    // Student reviews attempt
    const reviewRes = await makeRequest('GET', `/api/exams/${attemptId}/review`, undefined, {
      Authorization: `Bearer ${studentToken}`
    });
    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.result.score).toBe(1.0);

    // Student accesses leaderboard
    const leaderboardRes = await makeRequest('GET', `/api/exams/${examId}/leaderboard`, undefined, {
      Authorization: `Bearer ${studentToken}`
    });
    expect(leaderboardRes.status).toBe(200);
    expect(leaderboardRes.body.currentUser.rank).toBe(1);
  });

  // --------------------------------------------------------------------------
  // Requirement 4: MANUAL before publication: score is hidden
  // --------------------------------------------------------------------------
  it('4. MANUAL before publication: score is hidden with awaiting instructor publication message', async () => {
    const examId = createExamFixture({
      releaseMode: 'MANUAL',
      status: 'LIVE'
    });

    const startRes = await makeRequest('POST', `/api/exams/${examId}/start`, undefined, {
      Authorization: `Bearer ${studentToken}`
    });
    const attemptId = startRes.body.attemptId;

    await makeRequest('POST', '/api/exams/autosave', {
      attemptId,
      questionId: q1Id,
      selectedOptionIds: [q1CorrectOptId],
      clientSequence: 1
    }, {
      Authorization: `Bearer ${studentToken}`
    });

    const submitRes = await makeRequest('POST', `/api/exams/${attemptId}/submit`, {}, {
      Authorization: `Bearer ${studentToken}`
    });

    expect(submitRes.status).toBe(200);
    expect(submitRes.body.resultsWithheld).toBe(true);
    expect(submitRes.body.releaseMode).toBe('MANUAL');
    expect(submitRes.body.grade).toBeUndefined(); // Score NOT in response!
    expect(submitRes.body.message).toBe('Exam submitted successfully. Your result is awaiting publication by the instructor.');
  });

  // --------------------------------------------------------------------------
  // Requirement 5: MANUAL after authorized publication: result becomes visible
  // --------------------------------------------------------------------------
  it('5. MANUAL after authorized publication: result becomes visible to students', async () => {
    const examId = createExamFixture({
      releaseMode: 'MANUAL',
      status: 'LIVE'
    });

    const startRes = await makeRequest('POST', `/api/exams/${examId}/start`, undefined, {
      Authorization: `Bearer ${studentToken}`
    });
    const attemptId = startRes.body.attemptId;

    await makeRequest('POST', `/api/exams/${attemptId}/submit`, {}, {
      Authorization: `Bearer ${studentToken}`
    });

    // Before publication: review is blocked with 403
    const prePubReview = await makeRequest('GET', `/api/exams/${attemptId}/review`, undefined, {
      Authorization: `Bearer ${studentToken}`
    });
    expect(prePubReview.status).toBe(403);

    // Authorized instructor publishes results
    const publishRes = await makeRequest('POST', `/api/exams/${examId}/publish-results`, {}, {
      Authorization: `Bearer ${instructorToken}`
    });
    expect(publishRes.status).toBe(200);
    expect(publishRes.body.success).toBe(true);
    expect(publishRes.body.status).toBe('RESULTS_PUBLISHED');

    // After publication: review and leaderboard become accessible to student
    const postPubReview = await makeRequest('GET', `/api/exams/${attemptId}/review`, undefined, {
      Authorization: `Bearer ${studentToken}`
    });
    expect(postPubReview.status).toBe(200);
    expect(postPubReview.body.result).toBeDefined();

    const postPubLeaderboard = await makeRequest('GET', `/api/exams/${examId}/leaderboard`, undefined, {
      Authorization: `Bearer ${studentToken}`
    });
    expect(postPubLeaderboard.status).toBe(200);
  });

  // --------------------------------------------------------------------------
  // Requirement 6: Student cannot access unpublished results through alternative endpoints
  // --------------------------------------------------------------------------
  it('6. Alternative Endpoints: Review, leaderboard, and student summary do NOT leak unpublished results', async () => {
    const examId = createExamFixture({
      releaseMode: 'MANUAL',
      status: 'LIVE'
    });

    const startRes = await makeRequest('POST', `/api/exams/${examId}/start`, undefined, {
      Authorization: `Bearer ${studentToken}`
    });
    const attemptId = startRes.body.attemptId;

    await makeRequest('POST', '/api/exams/autosave', {
      attemptId,
      questionId: q1Id,
      selectedOptionIds: [q1CorrectOptId],
      clientSequence: 1
    }, {
      Authorization: `Bearer ${studentToken}`
    });

    await makeRequest('POST', `/api/exams/${attemptId}/submit`, {}, {
      Authorization: `Bearer ${studentToken}`
    });

    // Endpoint A: Review -> 403 Forbidden
    const reviewRes = await makeRequest('GET', `/api/exams/${attemptId}/review`, undefined, {
      Authorization: `Bearer ${studentToken}`
    });
    expect(reviewRes.status).toBe(403);
    expect(reviewRes.body.error).toContain('not been published');

    // Endpoint B: Leaderboard -> 403 Forbidden
    const leaderboardRes = await makeRequest('GET', `/api/exams/${examId}/leaderboard`, undefined, {
      Authorization: `Bearer ${studentToken}`
    });
    expect(leaderboardRes.status).toBe(403);
    expect(leaderboardRes.body.error).toContain('not been published');

    // Endpoint C: Student Summary Dashboard -> score/accuracy masked to null
    const summaryRes = await makeRequest('GET', '/api/dashboard/student-summary', undefined, {
      Authorization: `Bearer ${studentToken}`
    });
    expect(summaryRes.status).toBe(200);

    const candidateRecentResult = summaryRes.body.recentResults.find((r: any) => r.attempt_id === attemptId);
    expect(candidateRecentResult).toBeDefined();
    expect(candidateRecentResult.is_released).toBe(false);
    expect(candidateRecentResult.score).toBeNull();
    expect(candidateRecentResult.accuracy_percentage).toBeNull();
    expect(candidateRecentResult.correct_count).toBeNull();
    expect(candidateRecentResult.is_passed).toBeNull();

    // Aggregated stats exclude unpublished exam from average score
    expect(summaryRes.body.stats.totalExamsTaken).toBe(0);
    expect(summaryRes.body.stats.averageScore).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Requirement 7: Unauthorized users cannot manually publish results
  // --------------------------------------------------------------------------
  it('7. Unauthorized publication rejected: Students and non-owner instructors cannot publish results', async () => {
    const examId = createExamFixture({
      releaseMode: 'MANUAL',
      createdBy: instructorId
    });

    // Student attempt to publish -> 403 Forbidden
    const studentPub = await makeRequest('POST', `/api/exams/${examId}/publish-results`, {}, {
      Authorization: `Bearer ${studentToken}`
    });
    expect(studentPub.status).toBe(403);

    // Another instructor (not owner) attempt to publish -> 403 Forbidden
    const otherInstPub = await makeRequest('POST', `/api/exams/${examId}/publish-results`, {}, {
      Authorization: `Bearer ${unauthorizedInstructorToken}`
    });
    expect(otherInstPub.status).toBe(403);
    expect(otherInstPub.body.error).toContain('Instructors can only publish results for exams they created');

    // Verify exam status remains LIVE
    const examRow: any = db.prepare('SELECT status FROM exams WHERE id = ?').get(examId);
    expect(examRow.status).toBe('LIVE');
  });

  // --------------------------------------------------------------------------
  // Requirement 8: Existing grading, negative marking, and submission behavior remain unchanged
  // --------------------------------------------------------------------------
  it('8. Integrity of grading formulas and negative marking: Correctly penalizes wrong answer with -0.25', async () => {
    const examId = createExamFixture({ releaseMode: 'INSTANT' });

    const startRes = await makeRequest('POST', `/api/exams/${examId}/start`, undefined, {
      Authorization: `Bearer ${studentToken}`
    });
    const attemptId = startRes.body.attemptId;

    // Pick a wrong option
    const wrongOpt: any = db.prepare('SELECT id FROM question_options WHERE question_id = ? AND is_correct = 0').get(q1Id);
    await makeRequest('POST', '/api/exams/autosave', {
      attemptId,
      questionId: q1Id,
      selectedOptionIds: [wrongOpt.id],
      clientSequence: 1
    }, {
      Authorization: `Bearer ${studentToken}`
    });

    const submitRes = await makeRequest('POST', `/api/exams/${attemptId}/submit`, {}, {
      Authorization: `Bearer ${studentToken}`
    });

    expect(submitRes.status).toBe(200);
    expect(submitRes.body.grade.score).toBe(-0.25); // Negative marking applied!
    expect(submitRes.body.grade.wrongCount).toBe(1);
    expect(submitRes.body.grade.correctCount).toBe(0);
    expect(submitRes.body.grade.isPassed).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Requirement 9: Refreshing or reloading does not reveal unpublished results
  // --------------------------------------------------------------------------
  it('9. Idempotent re-submission & page reload does not reveal unpublished results', async () => {
    const examId = createExamFixture({ releaseMode: 'MANUAL', status: 'LIVE' });

    const startRes = await makeRequest('POST', `/api/exams/${examId}/start`, undefined, {
      Authorization: `Bearer ${studentToken}`
    });
    const attemptId = startRes.body.attemptId;

    // First submit -> Score withheld
    const res1 = await makeRequest('POST', `/api/exams/${attemptId}/submit`, {}, {
      Authorization: `Bearer ${studentToken}`,
      'x-idempotency-key': `key-${attemptId}`
    });
    expect(res1.body.resultsWithheld).toBe(true);
    expect(res1.body.grade).toBeUndefined();

    // Reload / Repeat Submit -> Score still withheld!
    const res2 = await makeRequest('POST', `/api/exams/${attemptId}/submit`, {}, {
      Authorization: `Bearer ${studentToken}`,
      'x-idempotency-key': `key-${attemptId}`
    });
    expect(res2.body.alreadySubmitted).toBe(true);
    expect(res2.body.resultsWithheld).toBe(true);
    expect(res2.body.grade).toBeUndefined(); // Never leaked on retry
  });

  // --------------------------------------------------------------------------
  // Requirement 10: API Creation & Update Settings for Result Release Mode
  // --------------------------------------------------------------------------
  it('10. API Creation & Update: Instructor can create and update exam settings with resultReleaseMode', async () => {
    // 10A: Create exam with MANUAL release mode
    const createRes = await makeRequest('POST', '/api/exams', {
      title: 'Manual Release Custom Exam',
      category: 'BANK_RECRUITMENT',
      type: 'MODEL_TEST',
      status: 'DRAFT',
      durationMinutes: 45,
      totalMarks: 1.0,
      passMarks: 0.5,
      negativeMarkingRate: 0.25,
      allowedAttempts: 2,
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 86400000).toISOString(),
      resultReleaseMode: 'MANUAL',
      questionIds: [q1Id]
    }, {
      Authorization: `Bearer ${instructorToken}`
    });

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    const newExamId = createRes.body.examId;
    expect(newExamId).toBeDefined();

    // 10B: Verify persisted in DB
    const dbRow: any = db.prepare('SELECT result_release_mode FROM exams WHERE id = ?').get(newExamId);
    expect(dbRow.result_release_mode).toBe('MANUAL');

    // 10C: Update exam settings to SCHEDULED
    const updateRes = await makeRequest('PUT', `/api/exams/${newExamId}`, {
      resultReleaseMode: 'SCHEDULED'
    }, {
      Authorization: `Bearer ${instructorToken}`
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.success).toBe(true);

    const updatedRow: any = db.prepare('SELECT result_release_mode FROM exams WHERE id = ?').get(newExamId);
    expect(updatedRow.result_release_mode).toBe('SCHEDULED');
  });

  // --------------------------------------------------------------------------
  // Requirement 11: Backward Compatibility & Default Behavior
  // --------------------------------------------------------------------------
  it('11. Backward Compatibility: Default release mode is INSTANT when omitted in create payload', async () => {
    const createRes = await makeRequest('POST', '/api/exams', {
      title: 'Default Legacy Exam',
      category: 'BANK_RECRUITMENT',
      type: 'MODEL_TEST',
      status: 'DRAFT',
      durationMinutes: 30,
      totalMarks: 1.0,
      passMarks: 0.5,
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 86400000).toISOString(),
      questionIds: [q1Id]
    }, {
      Authorization: `Bearer ${instructorToken}`
    });

    expect(createRes.status).toBe(201);
    const legacyExamId = createRes.body.examId;
    expect(legacyExamId).toBeDefined();

    const dbRow: any = db.prepare('SELECT result_release_mode FROM exams WHERE id = ?').get(legacyExamId);
    expect(dbRow.result_release_mode).toBe('INSTANT');
  });

  // --------------------------------------------------------------------------
  // Requirement 12: Dynamic SCHEDULED Transition at Expiration Boundary
  // --------------------------------------------------------------------------
  it('12. Dynamic SCHEDULED Transition: Results automatically transition from withheld to visible when window concludes', async () => {
    // 1. Create a SCHEDULED exam ending in 1 hour
    const examId = createExamFixture({
      releaseMode: 'SCHEDULED',
      endsAt: new Date(Date.now() + 3600000).toISOString()
    });

    // 2. Student starts and submits attempt
    const startRes = await makeRequest('POST', `/api/exams/${examId}/start`, undefined, {
      Authorization: `Bearer ${studentToken}`
    });
    const attemptId = startRes.body.attemptId;

    const submitRes = await makeRequest('POST', `/api/exams/${attemptId}/submit`, {}, {
      Authorization: `Bearer ${studentToken}`
    });
    expect(submitRes.body.resultsWithheld).toBe(true);

    // Leaderboard blocked
    const preLeaderboard = await makeRequest('GET', `/api/exams/${examId}/leaderboard`, undefined, {
      Authorization: `Bearer ${studentToken}`
    });
    expect(preLeaderboard.status).toBe(403);

    // 3. Fast-forward exam window: update ends_at to 1 minute in the past
    const pastTime = new Date(Date.now() - 60000).toISOString();
    db.prepare('UPDATE exams SET ends_at = ? WHERE id = ?').run(pastTime, examId);

    // 4. Student re-checks leaderboard and review: both now succeed!
    const postLeaderboard = await makeRequest('GET', `/api/exams/${examId}/leaderboard`, undefined, {
      Authorization: `Bearer ${studentToken}`
    });
    expect(postLeaderboard.status).toBe(200);
    expect(postLeaderboard.body.currentUser.rank).toBe(1);

    const postReview = await makeRequest('GET', `/api/exams/${attemptId}/review`, undefined, {
      Authorization: `Bearer ${studentToken}`
    });
    expect(postReview.status).toBe(200);
    expect(postReview.body.result).toBeDefined();
  });
});
