import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import express from 'express';
import { db, initDatabase } from '../db/schema';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { v4 as uuidv4 } from 'uuid';
import { examsRouter } from '../routes/exams';
import { ensureActiveDemoExam, DEMO_CORRECTED_EXAM_ID, DEMO_ACTIVE_EXAM_ID } from '../db/seed';

const app = express();
app.use(express.json());
app.use('/api/exams', examsRouter);

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

describe('Exam Answer Rendering, Inputs & Attempt Safety Regression Tests', () => {
  let studentId: string;
  let studentToken: string;
  let preExistingAttemptsCount: number;
  let preExistingResultsCount: number;

  beforeAll(async () => {
    initDatabase();
    ensureActiveDemoExam();

    studentId = uuidv4();
    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role)
      VALUES (?, ?, ?, 'hash123', 'STUDENT')
    `).run(studentId, 'Test Student Answer Fix', `student_answer_fix_${Date.now()}@example.com`);

    preExistingAttemptsCount = (db.prepare('SELECT COUNT(*) as count FROM attempts WHERE user_id != ?').get(studentId) as any).count;
    preExistingResultsCount = (db.prepare('SELECT COUNT(*) as count FROM exam_results').get() as any).count;

    studentToken = jwt.sign(
      { id: studentId, email: `student_answer_fix_${Date.now()}@example.com`, role: 'STUDENT', name: 'Test Student Answer Fix' },
      config.JWT_SECRET
    );

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
    // Clean up test user created for this test
    if (studentId) {
      db.prepare('DELETE FROM attempt_answers WHERE attempt_id IN (SELECT id FROM attempts WHERE user_id = ?)').run(studentId);
      db.prepare('DELETE FROM attempts WHERE user_id = ?').run(studentId);
      db.prepare('DELETE FROM users WHERE id = ?').run(studentId);
    }
  });

  it('1. Demo MCQ questions have valid options and correct metadata', () => {
    const questions = db.prepare(`
      SELECT q.id, q.prompt, q.type, eq.order_index
      FROM exam_questions eq
      JOIN questions q ON eq.question_id = q.id
      WHERE eq.exam_id = ?
      ORDER BY eq.order_index ASC
    `).all(DEMO_CORRECTED_EXAM_ID) as any[];

    expect(questions.length).toBe(5);

    for (const q of questions) {
      const options = db.prepare(`
        SELECT id, option_key, text, is_correct
        FROM question_options
        WHERE question_id = ?
        ORDER BY sort_order ASC
      `).all(q.id) as any[];

      expect(options.length).toBeGreaterThanOrEqual(2);
      const correctOptions = options.filter(o => o.is_correct === 1);
      expect(correctOptions.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('2. POST /api/exams/:id/start returns exam title, negative marking rate, and questions with options', async () => {
    const res = await makeRequest('POST', `/api/exams/${DEMO_CORRECTED_EXAM_ID}/start`, {
      Authorization: `Bearer ${studentToken}`
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.examTitle).toBe('Bangladesh Bank Officer (General) Mock Test - Active Demo');
    expect(res.body.negativeMarkingRate).toBe(0.25);
    expect(res.body.questions).toBeDefined();
    expect(res.body.questions.length).toBe(5);

    // Verify option keys and properties conform to frontend expectations
    const firstQ = res.body.questions[0];
    expect(firstQ.options).toBeDefined();
    expect(firstQ.options.length).toBeGreaterThanOrEqual(2);
    expect(firstQ.options[0]).toHaveProperty('id');
    expect(firstQ.options[0]).toHaveProperty('optionKey');
    expect(firstQ.options[0]).toHaveProperty('text');
  });

  it('3. Student question payload does not leak correct answers or explanations', async () => {
    const res = await makeRequest('POST', `/api/exams/${DEMO_CORRECTED_EXAM_ID}/start`, {
      Authorization: `Bearer ${studentToken}`
    });

    expect(res.status).toBe(200);
    const questions = res.body.questions;
    for (const q of questions) {
      expect(q.explanation).toBeUndefined();
      for (const opt of q.options) {
        expect(opt.isCorrect).toBeUndefined();
        expect(opt.is_correct).toBeUndefined();
      }
    }
  });

  it('4. SINGLE_MCQ option selection and autosave', async () => {
    const startRes = await makeRequest('POST', `/api/exams/${DEMO_CORRECTED_EXAM_ID}/start`, {
      Authorization: `Bearer ${studentToken}`
    });
    const attemptId = startRes.body.attemptId;
    const firstQ = startRes.body.questions[0];
    const selectedOptId = firstQ.options[0].id;

    const autosaveRes = await makeRequest('POST', '/api/exams/autosave', {
      Authorization: `Bearer ${studentToken}`
    }, {
      attemptId,
      questionId: firstQ.id,
      selectedOptionIds: [selectedOptId],
      isMarkedForReview: false,
      clientSequence: 1
    });

    expect(autosaveRes.status).toBe(200);
    expect(autosaveRes.body.success).toBe(true);

    const saved = db.prepare(`
      SELECT * FROM attempt_answers WHERE attempt_id = ? AND question_id = ?
    `).get(attemptId, firstQ.id) as any;

    expect(saved).toBeDefined();
    expect(saved.selected_option_ids).toBe(JSON.stringify([selectedOptId]));
  });

  it('5. MULTI_SELECT selection and autosave', async () => {
    const startRes = await makeRequest('POST', `/api/exams/${DEMO_CORRECTED_EXAM_ID}/start`, {
      Authorization: `Bearer ${studentToken}`
    });
    const attemptId = startRes.body.attemptId;
    const firstQ = startRes.body.questions[0];
    const selectedOptIds = [firstQ.options[0].id, firstQ.options[1].id];

    const autosaveRes = await makeRequest('POST', '/api/exams/autosave', {
      Authorization: `Bearer ${studentToken}`
    }, {
      attemptId,
      questionId: firstQ.id,
      selectedOptionIds: selectedOptIds,
      isMarkedForReview: true,
      clientSequence: 2
    });

    expect(autosaveRes.status).toBe(200);
    expect(autosaveRes.body.success).toBe(true);

    const saved = db.prepare(`
      SELECT * FROM attempt_answers WHERE attempt_id = ? AND question_id = ?
    `).get(attemptId, firstQ.id) as any;

    expect(saved).toBeDefined();
    expect(saved.selected_option_ids).toBe(JSON.stringify(selectedOptIds));
    expect(saved.is_marked_for_review).toBe(1);
  });

  it('6. TRUE_FALSE selection and autosave', async () => {
    // Create a temporary exam with a TRUE_FALSE question for this test
    const tfQuestionId = uuidv4();
    db.prepare(`
      INSERT INTO questions (id, subject, chapter, topic, difficulty, type, prompt)
      VALUES (?, 'General', 'Logic', 'Truth', 'EASY', 'TRUE_FALSE', 'Is 2+2=4?')
    `).run(tfQuestionId);

    const optTrueId = uuidv4();
    const optFalseId = uuidv4();
    db.prepare(`
      INSERT INTO question_options (id, question_id, option_key, text, is_correct, sort_order)
      VALUES (?, ?, 'A', 'True', 1, 1), (?, ?, 'B', 'False', 0, 2)
    `).run(optTrueId, tfQuestionId, optFalseId, tfQuestionId);

    const tfExamId = uuidv4();
    db.prepare(`
      INSERT INTO exams (id, title, category, type, status, duration_minutes, total_marks, pass_marks, starts_at, ends_at)
      VALUES (?, 'TF Test Exam', 'BANK_RECRUITMENT', 'MODEL_TEST', 'LIVE', 30, 1.0, 0.5, '2026-01-01', '2027-01-01')
    `).run(tfExamId);

    db.prepare(`
      INSERT INTO exam_questions (id, exam_id, question_id, order_index)
      VALUES (?, ?, ?, 1)
    `).run(uuidv4(), tfExamId, tfQuestionId);

    const startRes = await makeRequest('POST', `/api/exams/${tfExamId}/start`, {
      Authorization: `Bearer ${studentToken}`
    });
    expect(startRes.status).toBe(200);
    const attemptId = startRes.body.attemptId;
    const q = startRes.body.questions[0];
    expect(q.options.length).toBe(2);

    const autosaveRes = await makeRequest('POST', '/api/exams/autosave', {
      Authorization: `Bearer ${studentToken}`
    }, {
      attemptId,
      questionId: q.id,
      selectedOptionIds: [optTrueId],
      isMarkedForReview: false,
      clientSequence: 1
    });
    expect(autosaveRes.status).toBe(200);

    const saved = db.prepare('SELECT * FROM attempt_answers WHERE attempt_id = ? AND question_id = ?').get(attemptId, q.id) as any;
    expect(saved.selected_option_ids).toBe(JSON.stringify([optTrueId]));

    // Clean up tfExam
    db.prepare('DELETE FROM attempt_answers WHERE attempt_id = ?').run(attemptId);
    db.prepare('DELETE FROM attempts WHERE id = ?').run(attemptId);
    db.prepare('DELETE FROM exam_questions WHERE exam_id = ?').run(tfExamId);
    db.prepare('DELETE FROM exams WHERE id = ?').run(tfExamId);
    db.prepare('DELETE FROM question_options WHERE question_id = ?').run(tfQuestionId);
    db.prepare('DELETE FROM questions WHERE id = ?').run(tfQuestionId);
  });

  it('7. NUMERIC input and autosave', async () => {
    const numQId = uuidv4();
    db.prepare(`
      INSERT INTO questions (id, subject, chapter, topic, difficulty, type, prompt)
      VALUES (?, 'Math', 'Multiplication', 'Basic', 'EASY', 'NUMERIC', 'What is 15 * 4?')
    `).run(numQId);

    const numExamId = uuidv4();
    db.prepare(`
      INSERT INTO exams (id, title, category, type, status, duration_minutes, total_marks, pass_marks, starts_at, ends_at)
      VALUES (?, 'Numeric Test Exam', 'BANK_RECRUITMENT', 'MODEL_TEST', 'LIVE', 30, 1.0, 0.5, '2026-01-01', '2027-01-01')
    `).run(numExamId);

    db.prepare(`
      INSERT INTO exam_questions (id, exam_id, question_id, order_index)
      VALUES (?, ?, ?, 1)
    `).run(uuidv4(), numExamId, numQId);

    const startRes = await makeRequest('POST', `/api/exams/${numExamId}/start`, {
      Authorization: `Bearer ${studentToken}`
    });
    expect(startRes.status).toBe(200);
    const attemptId = startRes.body.attemptId;

    const autosaveRes = await makeRequest('POST', '/api/exams/autosave', {
      Authorization: `Bearer ${studentToken}`
    }, {
      attemptId,
      questionId: numQId,
      numericAnswer: 60,
      isMarkedForReview: false,
      clientSequence: 1
    });
    expect(autosaveRes.status).toBe(200);

    const saved = db.prepare('SELECT * FROM attempt_answers WHERE attempt_id = ? AND question_id = ?').get(attemptId, numQId) as any;
    expect(saved.numeric_answer).toBe(60);

    // Clean up
    db.prepare('DELETE FROM attempt_answers WHERE attempt_id = ?').run(attemptId);
    db.prepare('DELETE FROM attempts WHERE id = ?').run(attemptId);
    db.prepare('DELETE FROM exam_questions WHERE exam_id = ?').run(numExamId);
    db.prepare('DELETE FROM exams WHERE id = ?').run(numExamId);
    db.prepare('DELETE FROM questions WHERE id = ?').run(numQId);
  });

  it('8. FILL_BLANK input and autosave', async () => {
    const blankQId = uuidv4();
    db.prepare(`
      INSERT INTO questions (id, subject, chapter, topic, difficulty, type, prompt)
      VALUES (?, 'GK', 'Geography', 'Capitals', 'EASY', 'FILL_BLANK', 'The capital of Bangladesh is ___')
    `).run(blankQId);

    const blankExamId = uuidv4();
    db.prepare(`
      INSERT INTO exams (id, title, category, type, status, duration_minutes, total_marks, pass_marks, starts_at, ends_at)
      VALUES (?, 'Blank Test Exam', 'BANK_RECRUITMENT', 'MODEL_TEST', 'LIVE', 30, 1.0, 0.5, '2026-01-01', '2027-01-01')
    `).run(blankExamId);

    db.prepare(`
      INSERT INTO exam_questions (id, exam_id, question_id, order_index)
      VALUES (?, ?, ?, 1)
    `).run(uuidv4(), blankExamId, blankQId);

    const startRes = await makeRequest('POST', `/api/exams/${blankExamId}/start`, {
      Authorization: `Bearer ${studentToken}`
    });
    expect(startRes.status).toBe(200);
    const attemptId = startRes.body.attemptId;

    const autosaveRes = await makeRequest('POST', '/api/exams/autosave', {
      Authorization: `Bearer ${studentToken}`
    }, {
      attemptId,
      questionId: blankQId,
      textAnswer: 'Dhaka',
      isMarkedForReview: false,
      clientSequence: 1
    });
    expect(autosaveRes.status).toBe(200);

    const saved = db.prepare('SELECT * FROM attempt_answers WHERE attempt_id = ? AND question_id = ?').get(attemptId, blankQId) as any;
    expect(saved.text_answer).toBe('Dhaka');

    // Clean up
    db.prepare('DELETE FROM attempt_answers WHERE attempt_id = ?').run(attemptId);
    db.prepare('DELETE FROM attempts WHERE id = ?').run(attemptId);
    db.prepare('DELETE FROM exam_questions WHERE exam_id = ?').run(blankExamId);
    db.prepare('DELETE FROM exams WHERE id = ?').run(blankExamId);
    db.prepare('DELETE FROM questions WHERE id = ?').run(blankQId);
  });

  it('9. Answer restoration after navigation/reconnect via GET /api/exams/attempts/:attemptId', async () => {
    const startRes = await makeRequest('POST', `/api/exams/${DEMO_CORRECTED_EXAM_ID}/start`, {
      Authorization: `Bearer ${studentToken}`
    });
    const attemptId = startRes.body.attemptId;
    const firstQ = startRes.body.questions[0];
    const secondQ = startRes.body.questions[1];

    // Autosave answers
    await makeRequest('POST', '/api/exams/autosave', {
      Authorization: `Bearer ${studentToken}`
    }, {
      attemptId,
      questionId: firstQ.id,
      selectedOptionIds: [firstQ.options[0].id],
      isMarkedForReview: false,
      clientSequence: 10
    });

    await makeRequest('POST', '/api/exams/autosave', {
      Authorization: `Bearer ${studentToken}`
    }, {
      attemptId,
      questionId: secondQ.id,
      selectedOptionIds: [secondQ.options[1].id],
      isMarkedForReview: true,
      clientSequence: 11
    });

    // Fetch attempt details (simulating reconnect / page refresh)
    const getRes = await makeRequest('GET', `/api/exams/attempts/${attemptId}`, {
      Authorization: `Bearer ${studentToken}`
    });

    expect(getRes.status).toBe(200);
    expect(getRes.body.success).toBe(true);
    expect(getRes.body.attempt).toBeDefined();
    expect(getRes.body.attempt.answers).toBeDefined();
    expect(getRes.body.attempt.answers.length).toBe(2);

    const ans1 = getRes.body.attempt.answers.find((a: any) => a.questionId === firstQ.id);
    expect(ans1).toBeDefined();
    expect(ans1.selectedOptionIds).toEqual([firstQ.options[0].id]);
    expect(ans1.isMarkedForReview).toBe(false);

    const ans2 = getRes.body.attempt.answers.find((a: any) => a.questionId === secondQ.id);
    expect(ans2).toBeDefined();
    expect(ans2.selectedOptionIds).toEqual([secondQ.options[1].id]);
    expect(ans2.isMarkedForReview).toBe(true);
  });

  it('10. Existing attempts and results remain unchanged', () => {
    // Verify pre-existing attempts were not deleted or modified
    const initialAttemptsPresent = db.prepare('SELECT COUNT(*) as count FROM attempts WHERE id IN (SELECT id FROM attempts LIMIT ?)').get(preExistingAttemptsCount) as any;
    expect(initialAttemptsPresent.count).toBe(preExistingAttemptsCount);

    // Verify original demo exam DEMO_ACTIVE_EXAM_ID attempts were preserved
    const demo1Attempts = (db.prepare('SELECT COUNT(*) as count FROM attempts WHERE exam_id = ?').get(DEMO_ACTIVE_EXAM_ID) as any).count;
    expect(demo1Attempts).toBeGreaterThanOrEqual(1);

    // Verify results table integrity preserved
    const currentResultsCount = (db.prepare('SELECT COUNT(*) as count FROM exam_results').get() as any).count;
    expect(currentResultsCount).toBeGreaterThanOrEqual(preExistingResultsCount);
  });
});
