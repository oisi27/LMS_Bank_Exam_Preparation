import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db, initDatabase } from '../db/schema';
import { questionsRouter } from '../routes/questions';
import { examsRouter } from '../routes/exams';
import { config } from '../config/env';
import { gradeExamAttempt, QuestionGradingSpec, StudentAnswerSubmission } from '../services/gradingEngine';
import { DEMO_CORRECTED_EXAM_ID, ensureActiveDemoExam } from '../db/seed';

let app: express.Application;
let server: any;
let port: number;

function makeRequest(
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body?: any
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const url = `http://127.0.0.1:${port}${path}`;
    fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: body ? JSON.stringify(body) : undefined
    })
      .then(async (res) => {
        const text = await res.text();
        let parsed = {};
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = { raw: text };
        }
        resolve({ status: res.status, body: parsed });
      })
      .catch(reject);
  });
}

describe('Question Bank Quality, Non-MCQ Grading & Security Regression Tests', () => {
  let instructorId: string;
  let studentId: string;
  let instructorToken: string;
  let studentToken: string;

  beforeAll(async () => {
    initDatabase();
    ensureActiveDemoExam();

    instructorId = uuidv4();
    studentId = uuidv4();

    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role)
      VALUES (?, 'Instructor QBank', ?, 'hash', 'INSTRUCTOR')
    `).run(instructorId, `inst_qb_${Date.now()}@example.com`);

    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role)
      VALUES (?, 'Student QBank', ?, 'hash', 'STUDENT')
    `).run(studentId, `stud_qb_${Date.now()}@example.com`);

    instructorToken = jwt.sign(
      { id: instructorId, email: `inst_qb_${Date.now()}@example.com`, role: 'INSTRUCTOR' },
      config.JWT_SECRET
    );
    studentToken = jwt.sign(
      { id: studentId, email: `stud_qb_${Date.now()}@example.com`, role: 'STUDENT' },
      config.JWT_SECRET
    );

    app = express();
    app.use(express.json());
    app.use('/api/questions', questionsRouter);
    app.use('/api/exams', examsRouter);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        port = (server.address() as any).port;
        resolve();
      });
    });
  });

  // 1. Numeric exact-match grading
  it('1. Numeric exact-match grading evaluates correctly', () => {
    const specs: QuestionGradingSpec[] = [
      { id: 'q_num_1', type: 'NUMERIC', marks: 2.0, negativeMarks: 0.5, correctOptions: [], correctNumeric: 42, numericTolerance: 0.0 }
    ];
    const correctAns: StudentAnswerSubmission[] = [
      { questionId: 'q_num_1', numericAnswer: 42 }
    ];
    const res = gradeExamAttempt(specs, correctAns, 1.0);
    expect(res.correctCount).toBe(1);
    expect(res.wrongCount).toBe(0);
    expect(res.totalScore).toBe(2.0);
    expect(res.breakdown[0].isCorrect).toBe(true);
  });

  // 2. Numeric tolerance grading
  it('2. Numeric tolerance allows answers within boundary and rejects outside', () => {
    const specs: QuestionGradingSpec[] = [
      { id: 'q_num_tol', type: 'NUMERIC', marks: 2.0, negativeMarks: 0.5, correctOptions: [], correctNumeric: 3.1416, numericTolerance: 0.001 }
    ];
    // Within tolerance
    const withinAns: StudentAnswerSubmission[] = [
      { questionId: 'q_num_tol', numericAnswer: 3.142 }
    ];
    const withinRes = gradeExamAttempt(specs, withinAns, 1.0);
    expect(withinRes.correctCount).toBe(1);
    expect(withinRes.totalScore).toBe(2.0);

    // Outside tolerance
    const outsideAns: StudentAnswerSubmission[] = [
      { questionId: 'q_num_tol', numericAnswer: 3.145 }
    ];
    const outsideRes = gradeExamAttempt(specs, outsideAns, 1.0);
    expect(outsideRes.correctCount).toBe(0);
    expect(outsideRes.wrongCount).toBe(1);
    expect(outsideRes.totalScore).toBe(-0.5);
  });

  // 3. Incorrect numeric answer and negative marking
  it('3. Incorrect numeric answer applies negative marking', () => {
    const specs: QuestionGradingSpec[] = [
      { id: 'q_num_neg', type: 'NUMERIC', marks: 1.0, negativeMarks: 0.25, correctOptions: [], correctNumeric: 100, numericTolerance: 0.0 }
    ];
    const wrongAns: StudentAnswerSubmission[] = [
      { questionId: 'q_num_neg', numericAnswer: 99 }
    ];
    const res = gradeExamAttempt(specs, wrongAns, 0.5);
    expect(res.correctCount).toBe(0);
    expect(res.wrongCount).toBe(1);
    expect(res.totalScore).toBe(-0.25);
    expect(res.isPassed).toBe(false);
  });

  // 4. Fill-blank case-insensitive and whitespace-normalized grading
  it('4. Fill-blank handles case-insensitivity and whitespace normalization', () => {
    const specs: QuestionGradingSpec[] = [
      { id: 'q_fb_1', type: 'FILL_BLANK', marks: 1.0, negativeMarks: 0.25, correctOptions: [], correctText: 'Dhaka' }
    ];
    const variants = ['dhaka', '  DHAKA  ', 'DhAkA', ' dhaka   '];
    for (const v of variants) {
      const res = gradeExamAttempt(specs, [{ questionId: 'q_fb_1', textAnswer: v }], 0.5);
      expect(res.correctCount).toBe(1);
      expect(res.totalScore).toBe(1.0);
    }
  });

  // 5. Incorrect fill-blank answer and negative marking
  it('5. Incorrect fill-blank answer applies negative marks', () => {
    const specs: QuestionGradingSpec[] = [
      { id: 'q_fb_neg', type: 'FILL_BLANK', marks: 1.0, negativeMarks: 0.25, correctOptions: [], correctText: 'Bangladesh' }
    ];
    const res = gradeExamAttempt(specs, [{ questionId: 'q_fb_neg', textAnswer: 'India' }], 0.5);
    expect(res.wrongCount).toBe(1);
    expect(res.totalScore).toBe(-0.25);
  });

  // 6. Missing grading metadata handling
  it('6. Missing grading metadata safely marks as wrong without crashing', () => {
    const specs: QuestionGradingSpec[] = [
      { id: 'q_meta_num', type: 'NUMERIC', marks: 1.0, negativeMarks: 0.25, correctOptions: [] }, // no correctNumeric
      { id: 'q_meta_fb', type: 'FILL_BLANK', marks: 1.0, negativeMarks: 0.25, correctOptions: [] } // no correctText
    ];
    const answers: StudentAnswerSubmission[] = [
      { questionId: 'q_meta_num', numericAnswer: 50 },
      { questionId: 'q_meta_fb', textAnswer: 'anything' }
    ];
    const res = gradeExamAttempt(specs, answers, 1.0);
    expect(res.correctCount).toBe(0);
    expect(res.wrongCount).toBe(2);
    expect(res.totalScore).toBe(-0.5);
  });

  // 7. Correct answer secrecy before submission (Zero Leak)
  it('7. Students cannot see correct answers or explanations in pre-submission exam payload', async () => {
    const startRes = await makeRequest('POST', `/api/exams/${DEMO_CORRECTED_EXAM_ID}/start`, {
      Authorization: `Bearer ${studentToken}`
    });
    expect(startRes.status).toBe(200);
    const questions = startRes.body.questions;
    expect(questions.length).toBeGreaterThan(0);

    for (const q of questions) {
      expect(q.explanation).toBeUndefined();
      expect(q.correctNumeric).toBeUndefined();
      expect(q.correctText).toBeUndefined();
      for (const opt of q.options) {
        expect(opt.isCorrect).toBeUndefined();
        expect(opt.is_correct).toBeUndefined();
      }
    }
  });

  // 8. Correct answer visibility after submission in review
  it('8. Correct answers and detailed explanations are exposed in post-submission review', async () => {
    const startRes = await makeRequest('POST', `/api/exams/${DEMO_CORRECTED_EXAM_ID}/start`, {
      Authorization: `Bearer ${studentToken}`
    });
    const attemptId = startRes.body.attemptId;

    // Submit attempt
    const submitRes = await makeRequest('POST', `/api/exams/${attemptId}/submit`, {
      Authorization: `Bearer ${studentToken}`
    });
    expect(submitRes.status).toBe(200);

    // Fetch review
    const reviewRes = await makeRequest('GET', `/api/exams/${attemptId}/review`, {
      Authorization: `Bearer ${studentToken}`
    });
    expect(reviewRes.status).toBe(200);
    const items = reviewRes.body.reviewItems;
    expect(items.length).toBeGreaterThan(0);

    // Each review item has explanation and correct indicators
    for (const item of items) {
      expect(item.explanation).toBeDefined();
      if (item.options && item.options.length > 0) {
        const hasCorrect = item.options.some((o: any) => o.is_correct === 1);
        expect(hasCorrect).toBe(true);
      }
    }
  });

  // 9. Invalid MCQ publication and assignment rejection
  it('9. Reject creating or assigning optionless or invalid questions to exams', async () => {
    // A. Rejects creating SINGLE_MCQ with 0 options
    const createRes = await makeRequest('POST', '/api/questions', {
      Authorization: `Bearer ${instructorToken}`
    }, {
      subject: 'Math',
      chapter: 'Algebra',
      topic: 'Equations',
      difficulty: 'EASY',
      type: 'SINGLE_MCQ',
      prompt: 'Invalid MCQ without options',
      options: []
    });
    expect(createRes.status).toBe(400);

    // B. Rejects creating SINGLE_MCQ with 0 correct options
    const zeroCorrectRes = await makeRequest('POST', '/api/questions', {
      Authorization: `Bearer ${instructorToken}`
    }, {
      subject: 'Math',
      chapter: 'Algebra',
      topic: 'Equations',
      difficulty: 'EASY',
      type: 'SINGLE_MCQ',
      prompt: 'Invalid MCQ without correct option',
      options: [
        { optionKey: 'A', text: 'Option 1', isCorrect: false },
        { optionKey: 'B', text: 'Option 2', isCorrect: false }
      ]
    });
    expect(zeroCorrectRes.status).toBe(400);

    // C. Rejects assigning an optionless question to a new exam
    const optionlessQId = '0515cac0-093c-40e8-ad7c-d9b2c6868500'; // Existing optionless test question
    const examAssignRes = await makeRequest('POST', '/api/exams', {
      Authorization: `Bearer ${instructorToken}`
    }, {
      title: 'Invalid Assignment Test Exam',
      category: 'BANK_RECRUITMENT',
      type: 'MODEL_TEST',
      durationMinutes: 10,
      totalMarks: 1.0,
      passMarks: 0.5,
      negativeMarkingRate: 0.25,
      allowedAttempts: 1,
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 86400000).toISOString(),
      resultReleaseMode: 'INSTANT',
      questionIds: [optionlessQId]
    });
    expect(examAssignRes.status).toBe(400);
    expect(examAssignRes.body.error).toContain('must have at least 2 options');
  });

  // 10. Existing MCQ and MULTI_SELECT grading remains unchanged
  it('10. Existing MCQ and MULTI_SELECT evaluation remains fully functional', () => {
    const specs: QuestionGradingSpec[] = [
      { id: 'q_mcq', type: 'SINGLE_MCQ', marks: 1.0, negativeMarks: 0.25, correctOptions: ['opt_A'] },
      { id: 'q_ms', type: 'MULTI_SELECT', marks: 2.0, negativeMarks: 0.5, correctOptions: ['opt_1', 'opt_2'] }
    ];
    const answers: StudentAnswerSubmission[] = [
      { questionId: 'q_mcq', selectedOptionIds: ['opt_A'] },
      { questionId: 'q_ms', selectedOptionIds: ['opt_1', 'opt_2'] }
    ];
    const res = gradeExamAttempt(specs, answers, 2.0);
    expect(res.correctCount).toBe(2);
    expect(res.wrongCount).toBe(0);
    expect(res.totalScore).toBe(3.0);
    expect(res.isPassed).toBe(true);
  });

  // 11. ACID question answer keys unchanged and explanation clarified
  it('11. ACID question retains exact answer keys (A, B, D correct; C wrong) with clarified explanation', () => {
    const acidQ: any = db.prepare(`
      SELECT q.id, q.type, q.explanation, q.prompt
      FROM questions q
      WHERE q.prompt LIKE '%Which of the following are ACID properties in database transaction management?%'
      LIMIT 1
    `).get();

    expect(acidQ).toBeDefined();
    expect(acidQ.type).toBe('MULTI_SELECT');
    expect(acidQ.explanation).toContain('Distribution (C) is a distributed systems concept and is NOT an ACID property');

    const opts = db.prepare(`
      SELECT option_key, text, is_correct
      FROM question_options
      WHERE question_id = ?
      ORDER BY option_key ASC
    `).all(acidQ.id) as any[];

    expect(opts.length).toBe(4);
    expect(opts[0]).toEqual({ option_key: 'A', text: 'Atomicity', is_correct: 1 });
    expect(opts[1]).toEqual({ option_key: 'B', text: 'Consistency', is_correct: 1 });
    expect(opts[2]).toEqual({ option_key: 'C', text: 'Distribution', is_correct: 0 });
    expect(opts[3]).toEqual({ option_key: 'D', text: 'Durability', is_correct: 1 });
  });

  // 12. Historical attempt/result integrity
  it('12. Historical attempts, answers, and results remain intact in the database', () => {
    const attemptCount: any = db.prepare('SELECT COUNT(*) as cnt FROM attempts').get();
    const resultCount: any = db.prepare('SELECT COUNT(*) as cnt FROM exam_results').get();
    const violationCount: any = db.prepare('SELECT COUNT(*) as cnt FROM exam_violations').get();

    expect(attemptCount.cnt).toBeGreaterThan(0);
    expect(resultCount.cnt).toBeGreaterThan(0);
    expect(violationCount.cnt).toBeGreaterThan(0);
  });
});
