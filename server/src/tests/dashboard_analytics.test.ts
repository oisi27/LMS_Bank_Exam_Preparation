import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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

let server: http.Server;
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
  return jwt.sign({ id: userId, email: `${userId}@test.local`, role }, config.JWT_SECRET || 'test_jwt_secret_bank_lms_super_secure_key_fall_2026', {
    expiresIn: '1h'
  });
}

describe('Phase 7 Milestone 1 Step 4: Student Weak-Topic & Chapter Accuracy Analytics', () => {
  const studentA = `stud_analytics_a_${Date.now()}`;
  const studentB = `stud_analytics_b_${Date.now()}`;
  const freshStudent = `stud_analytics_fresh_${Date.now()}`;

  let examId1: string;
  let q1Id: string;
  let q2Id: string;
  let q3Id: string;
  let q4NoMetaId: string;
  let opt1Correct: string;
  let opt1Wrong: string;
  let opt2Correct: string;
  let opt2Wrong: string;
  let opt3Correct: string;
  let opt3Wrong: string;

  beforeAll(async () => {
    initDatabase();

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        serverPort = (server.address() as any).port;
        resolve();
      });
    });

    // Seed test users
    for (const uid of [studentA, studentB, freshStudent]) {
      db.prepare(`
        INSERT INTO users (id, email, password_hash, name, role)
        VALUES (?, ?, 'hash', ?, 'STUDENT')
      `).run(uid, `${uid}@test.local`, `Candidate ${uid}`);
    }

    // Seed test exam
    examId1 = uuidv4();
    db.prepare(`
      INSERT INTO exams (
        id, title, title_bangla, description, category, type, duration_minutes, total_marks, pass_marks,
        negative_marking_rate, allowed_attempts, starts_at, ends_at, status, result_release_mode
      ) VALUES (?, 'Analytics Evaluation Exam', 'এনালিটিক্স পরীক্ষা', 'Test Exam', 'BANK_RECRUITMENT', 'MODEL_TEST', 60, 4.0, 2.0, 0.25, 1,
        '2026-01-01T00:00:00Z', '2026-12-31T23:59:59Z', 'LIVE', 'INSTANT')
    `).run(examId1);

    // Q1: Math / Commercial Arithmetic / Percentage (Candidate A will answer CORRECT)
    q1Id = uuidv4();
    db.prepare(`
      INSERT INTO questions (
        id, subject, chapter, topic, difficulty, type, prompt, default_marks, default_negative_marks, is_approved
      ) VALUES (?, 'Quantitative Aptitude', 'Commercial Arithmetic', 'Percentage & Profit', 'MEDIUM', 'SINGLE_MCQ', 'What is 20% of 150?', 1.0, 0.25, 1)
    `).run(q1Id);

    opt1Correct = uuidv4();
    opt1Wrong = uuidv4();
    db.prepare(`INSERT INTO question_options (id, question_id, option_key, text, is_correct, sort_order) VALUES (?, ?, 'A', '30', 1, 1)`).run(opt1Correct, q1Id);
    db.prepare(`INSERT INTO question_options (id, question_id, option_key, text, is_correct, sort_order) VALUES (?, ?, 'B', '40', 0, 2)`).run(opt1Wrong, q1Id);

    // Q2: Math / Commercial Arithmetic / Simple Interest (Candidate A will answer WRONG -> Weak Topic)
    q2Id = uuidv4();
    db.prepare(`
      INSERT INTO questions (
        id, subject, chapter, topic, difficulty, type, prompt, default_marks, default_negative_marks, is_approved
      ) VALUES (?, 'Quantitative Aptitude', 'Commercial Arithmetic', 'Simple Interest', 'HARD', 'SINGLE_MCQ', 'Calculate SI on 1000 at 5% for 2 yrs', 1.0, 0.25, 1)
    `).run(q2Id);

    opt2Correct = uuidv4();
    opt2Wrong = uuidv4();
    db.prepare(`INSERT INTO question_options (id, question_id, option_key, text, is_correct, sort_order) VALUES (?, ?, 'A', '100', 1, 1)`).run(opt2Correct, q2Id);
    db.prepare(`INSERT INTO question_options (id, question_id, option_key, text, is_correct, sort_order) VALUES (?, ?, 'B', '200', 0, 2)`).run(opt2Wrong, q2Id);

    // Q3: English / Vocabulary / Antonyms (Candidate A will SKIP -> Should not reduce accuracy percentage of answered questions)
    q3Id = uuidv4();
    db.prepare(`
      INSERT INTO questions (
        id, subject, chapter, topic, difficulty, type, prompt, default_marks, default_negative_marks, is_approved
      ) VALUES (?, 'English Language', 'Vocabulary', 'Antonyms', 'EASY', 'SINGLE_MCQ', 'Antonym of Lucid is?', 1.0, 0.25, 1)
    `).run(q3Id);

    opt3Correct = uuidv4();
    opt3Wrong = uuidv4();
    db.prepare(`INSERT INTO question_options (id, question_id, option_key, text, is_correct, sort_order) VALUES (?, ?, 'A', 'Obscure', 1, 1)`).run(opt3Correct, q3Id);
    db.prepare(`INSERT INTO question_options (id, question_id, option_key, text, is_correct, sort_order) VALUES (?, ?, 'B', 'Clear', 0, 2)`).run(opt3Wrong, q3Id);

    // Q4: Missing/blank topic metadata (empty string subject, chapter, topic) -> Candidate A will answer correctly
    q4NoMetaId = uuidv4();
    db.prepare(`
      INSERT INTO questions (
        id, subject, chapter, topic, difficulty, type, prompt, default_marks, default_negative_marks, is_approved, correct_numeric, numeric_tolerance
      ) VALUES (?, '', '', '', 'MEDIUM', 'NUMERIC', 'Enter the square root of 64', 1.0, 0.25, 1, 8.0, 0.0)
    `).run(q4NoMetaId);

    // Link all 4 questions to exam
    let ord = 1;
    for (const qId of [q1Id, q2Id, q3Id, q4NoMetaId]) {
      db.prepare(`
        INSERT INTO exam_questions (id, exam_id, question_id, section_name, marks, negative_marks, order_index)
        VALUES (?, ?, ?, 'Core Section', 1.0, 0.25, ?)
      `).run(uuidv4(), examId1, qId, ord++);
    }

    // Attempt for Student A (Finalized / GRADED)
    const attemptA = uuidv4();
    db.prepare(`
      INSERT INTO attempts (id, exam_id, user_id, started_at, expires_at, submitted_at, status)
      VALUES (?, ?, ?, '2026-02-01T10:00:00Z', '2026-02-01T11:00:00Z', '2026-02-01T10:45:00Z', 'GRADED')
    `).run(attemptA, examId1, studentA);

    // Answers for Student A:
    // Q1 -> Correct
    db.prepare(`
      INSERT INTO attempt_answers (id, attempt_id, question_id, selected_option_ids, client_sequence)
      VALUES (?, ?, ?, ?, 1)
    `).run(uuidv4(), attemptA, q1Id, JSON.stringify([opt1Correct]));

    // Q2 -> Wrong (Selected opt2Wrong)
    db.prepare(`
      INSERT INTO attempt_answers (id, attempt_id, question_id, selected_option_ids, client_sequence)
      VALUES (?, ?, ?, ?, 1)
    `).run(uuidv4(), attemptA, q2Id, JSON.stringify([opt2Wrong]));

    // Q3 -> Skipped (No row or empty selection)
    // Q4 -> Correct (Numeric 8.0)
    db.prepare(`
      INSERT INTO attempt_answers (id, attempt_id, question_id, numeric_answer, client_sequence)
      VALUES (?, ?, ?, 8.0, 1)
    `).run(uuidv4(), attemptA, q4NoMetaId);

    // Attempt for Student B (Finalized / SUBMITTED) - to test student isolation
    const attemptB = uuidv4();
    db.prepare(`
      INSERT INTO attempts (id, exam_id, user_id, started_at, expires_at, submitted_at, status)
      VALUES (?, ?, ?, '2026-02-01T10:00:00Z', '2026-02-01T11:00:00Z', '2026-02-01T10:45:00Z', 'SUBMITTED')
    `).run(attemptB, examId1, studentB);

    // Student B answered Q2 correctly (100% on Simple Interest)
    db.prepare(`
      INSERT INTO attempt_answers (id, attempt_id, question_id, selected_option_ids, client_sequence)
      VALUES (?, ?, ?, ?, 1)
    `).run(uuidv4(), attemptB, q2Id, JSON.stringify([opt2Correct]));
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('fresh student with 0 finalized attempts receives empty arrays and safe 0 metrics', async () => {
    const token = generateToken(freshStudent);
    const res = await makeRequest('GET', '/api/dashboard/student-summary', {
      Authorization: `Bearer ${token}`
    });

    expect(res.status).toBe(200);
    expect(res.body.topicAnalytics).toBeDefined();
    expect(Array.isArray(res.body.topicAnalytics)).toBe(true);
    expect(res.body.topicAnalytics.length).toBe(0);

    expect(res.body.weakTopics).toBeDefined();
    expect(Array.isArray(res.body.weakTopics)).toBe(true);
    expect(res.body.weakTopics.length).toBe(0);

    expect(res.body.subjectAccuracy).toBeDefined();
    expect(Array.isArray(res.body.subjectAccuracy)).toBe(true);
    expect(res.body.subjectAccuracy.length).toBe(0);
  });

  it('correctly calculates accuracy for answered questions and tracks skipped questions without lowering accuracy', async () => {
    const token = generateToken(studentA);
    const res = await makeRequest('GET', '/api/dashboard/student-summary', {
      Authorization: `Bearer ${token}`
    });

    expect(res.status).toBe(200);

    // Q1: Percentage & Profit (1 attempted, 1 correct -> 100% accuracy, not weak)
    const percentageTopic = res.body.topicAnalytics.find(
      (t: any) => t.topic === 'Percentage & Profit'
    );
    expect(percentageTopic).toBeDefined();
    expect(percentageTopic.totalQuestions).toBe(1);
    expect(percentageTopic.attemptedCount).toBe(1);
    expect(percentageTopic.correctCount).toBe(1);
    expect(percentageTopic.wrongCount).toBe(0);
    expect(percentageTopic.skippedCount).toBe(0);
    expect(percentageTopic.accuracyPercentage).toBe(100);
    expect(percentageTopic.isWeak).toBe(false);

    // Q3: Antonyms (1 total, 0 attempted, 1 skipped -> 0% accuracy, but not marked weak because attemptedCount = 0)
    const antonymsTopic = res.body.topicAnalytics.find(
      (t: any) => t.topic === 'Antonyms'
    );
    expect(antonymsTopic).toBeDefined();
    expect(antonymsTopic.totalQuestions).toBe(1);
    expect(antonymsTopic.attemptedCount).toBe(0);
    expect(antonymsTopic.correctCount).toBe(0);
    expect(antonymsTopic.wrongCount).toBe(0);
    expect(antonymsTopic.skippedCount).toBe(1);
    expect(antonymsTopic.accuracyPercentage).toBe(0);
    expect(antonymsTopic.isWeak).toBe(false);
  });

  it('identifies topics below 50% accuracy as weak topics and sorts them into weakTopics list', async () => {
    const token = generateToken(studentA);
    const res = await makeRequest('GET', '/api/dashboard/student-summary', {
      Authorization: `Bearer ${token}`
    });

    expect(res.status).toBe(200);

    // Q2: Simple Interest (1 attempted, 0 correct, 1 wrong -> 0% accuracy, isWeak = true)
    const siTopic = res.body.topicAnalytics.find(
      (t: any) => t.topic === 'Simple Interest'
    );
    expect(siTopic).toBeDefined();
    expect(siTopic.attemptedCount).toBe(1);
    expect(siTopic.correctCount).toBe(0);
    expect(siTopic.wrongCount).toBe(1);
    expect(siTopic.accuracyPercentage).toBe(0);
    expect(siTopic.isWeak).toBe(true);

    // Check weakTopics list
    expect(res.body.weakTopics.length).toBeGreaterThanOrEqual(1);
    const weakSI = res.body.weakTopics.find((t: any) => t.topic === 'Simple Interest');
    expect(weakSI).toBeDefined();
    expect(weakSI.accuracyPercentage).toBe(0);
  });

  it('handles missing/null topic metadata gracefully with fallback classifications', async () => {
    const token = generateToken(studentA);
    const res = await makeRequest('GET', '/api/dashboard/student-summary', {
      Authorization: `Bearer ${token}`
    });

    expect(res.status).toBe(200);

    // Q4 had NULL subject, chapter, topic -> Should fall back gracefully without error
    const fallbackTopic = res.body.topicAnalytics.find(
      (t: any) => t.subject === 'General Aptitude'
    );
    expect(fallbackTopic).toBeDefined();
    expect(fallbackTopic.attemptedCount).toBe(1);
    expect(fallbackTopic.correctCount).toBe(1);
    expect(fallbackTopic.accuracyPercentage).toBe(100);
  });

  it('enforces strict student isolation (Student B data does not leak into Student A analytics)', async () => {
    // Student B answered Simple Interest correctly (100%)
    const tokenB = generateToken(studentB);
    const resB = await makeRequest('GET', '/api/dashboard/student-summary', {
      Authorization: `Bearer ${tokenB}`
    });

    expect(resB.status).toBe(200);
    const siTopicB = resB.body.topicAnalytics.find(
      (t: any) => t.topic === 'Simple Interest'
    );
    expect(siTopicB).toBeDefined();
    expect(siTopicB.accuracyPercentage).toBe(100);
    expect(siTopicB.isWeak).toBe(false);

    // Verify Student B has no weak topics
    const weakSIB = resB.body.weakTopics.find((t: any) => t.topic === 'Simple Interest');
    expect(weakSIB).toBeUndefined();

    // Verify Student A's Simple Interest is STILL 0% and marked weak
    const tokenA = generateToken(studentA);
    const resA = await makeRequest('GET', '/api/dashboard/student-summary', {
      Authorization: `Bearer ${tokenA}`
    });
    const siTopicA = resA.body.topicAnalytics.find(
      (t: any) => t.topic === 'Simple Interest'
    );
    expect(siTopicA.accuracyPercentage).toBe(0);
    expect(siTopicA.isWeak).toBe(true);
  });
});
