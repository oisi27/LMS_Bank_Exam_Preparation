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

describe('Milestone 4 Step 1: Exam Builder Backend API Hardening Tests', () => {
  let instructorId: string;
  let instructor2Id: string;
  let studentId: string;
  let adminId: string;

  let instructorToken: string;
  let instructor2Token: string;
  let studentToken: string;
  let adminToken: string;

  let validQuestion1Id: string;
  let validQuestion2Id: string;
  let invalidQuestionId: string;

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

    instructorId = uuidv4();
    instructor2Id = uuidv4();
    studentId = uuidv4();
    adminId = uuidv4();

    // Insert users
    const insertUser = db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (?, ?, 'hash', ?, ?)
    `);

    insertUser.run(instructorId, `inst_${Date.now()}@banklms.ac.bd`, 'Instructor One', 'INSTRUCTOR');
    insertUser.run(instructor2Id, `inst2_${Date.now()}@banklms.ac.bd`, 'Instructor Two', 'INSTRUCTOR');
    insertUser.run(studentId, `stud_${Date.now()}@banklms.ac.bd`, 'Student User', 'STUDENT');
    insertUser.run(adminId, `admin_${Date.now()}@banklms.ac.bd`, 'Admin User', 'ADMIN');

    instructorToken = generateToken(instructorId, 'INSTRUCTOR', 'inst@test.com');
    instructor2Token = generateToken(instructor2Id, 'INSTRUCTOR', 'inst2@test.com');
    studentToken = generateToken(studentId, 'STUDENT', 'stud@test.com');
    adminToken = generateToken(adminId, 'ADMIN', 'admin@test.com');

    // Insert valid questions
    validQuestion1Id = uuidv4();
    validQuestion2Id = uuidv4();
    invalidQuestionId = uuidv4();

    const insertQ = db.prepare(`
      INSERT INTO questions (id, subject, chapter, topic, difficulty, type, prompt)
      VALUES (?, 'Math', 'Percentages', 'Profit Loss', 'EASY', 'SINGLE_MCQ', ?)
    `);
    insertQ.run(validQuestion1Id, 'Valid Question 1?');
    insertQ.run(validQuestion2Id, 'Valid Question 2?');
    insertQ.run(invalidQuestionId, 'Invalid Question with no options?');

    const insertOpt = db.prepare(`
      INSERT INTO question_options (id, question_id, option_key, text, is_correct, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    // Valid Q1 options (2 options, 1 correct)
    insertOpt.run(uuidv4(), validQuestion1Id, 'A', '10%', 1, 0);
    insertOpt.run(uuidv4(), validQuestion1Id, 'B', '20%', 0, 1);

    // Valid Q2 options (2 options, 1 correct)
    insertOpt.run(uuidv4(), validQuestion2Id, 'A', '30%', 1, 0);
    insertOpt.run(uuidv4(), validQuestion2Id, 'B', '40%', 0, 1);
  });

  it('should support ?mine=true to filter exams by authenticated instructor', async () => {
    // Instructor 1 creates an exam
    const resCreate1 = await makeRequest(
      'POST',
      '/api/exams',
      { Authorization: `Bearer ${instructorToken}` },
      {
        title: 'Instructor 1 Exam',
        category: 'BANK_RECRUITMENT',
        type: 'MODEL_TEST',
        status: 'DRAFT',
        durationMinutes: 45,
        totalMarks: 50,
        passMarks: 20,
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 3600000).toISOString(),
        questionIds: [validQuestion1Id]
      }
    );
    expect(resCreate1.status).toBe(201);

    // Instructor 2 creates an exam
    const resCreate2 = await makeRequest(
      'POST',
      '/api/exams',
      { Authorization: `Bearer ${instructor2Token}` },
      {
        title: 'Instructor 2 Exam',
        category: 'BANK_RECRUITMENT',
        type: 'MODEL_TEST',
        status: 'DRAFT',
        durationMinutes: 30,
        totalMarks: 30,
        passMarks: 15,
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 3600000).toISOString(),
        questionIds: [validQuestion2Id]
      }
    );
    expect(resCreate2.status).toBe(201);

    // Instructor 1 requests with mine=true -> only sees their own
    const resMine = await makeRequest(
      'GET',
      '/api/exams?mine=true',
      { Authorization: `Bearer ${instructorToken}` }
    );
    expect(resMine.status).toBe(200);
    const mineExams = resMine.body.exams;
    expect(mineExams.every((e: any) => e.createdBy === instructorId)).toBe(true);
    expect(mineExams.some((e: any) => e.title === 'Instructor 1 Exam')).toBe(true);
    expect(mineExams.some((e: any) => e.title === 'Instructor 2 Exam')).toBe(false);

    // Student requesting mine=true does NOT get access to drafts
    const resStudentMine = await makeRequest(
      'GET',
      '/api/exams?mine=true',
      { Authorization: `Bearer ${studentToken}` }
    );
    expect(resStudentMine.status).toBe(200);
    expect(resStudentMine.body.exams.some((e: any) => e.status === 'DRAFT')).toBe(false);
  });

  it('should update assigned questions on a DRAFT exam atomically', async () => {
    // Create draft exam with Q1
    const resCreate = await makeRequest(
      'POST',
      '/api/exams',
      { Authorization: `Bearer ${instructorToken}` },
      {
        title: 'Draft Exam For Question Replacement',
        status: 'DRAFT',
        durationMinutes: 60,
        totalMarks: 100,
        passMarks: 40,
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 3600000).toISOString(),
        questionIds: [validQuestion1Id]
      }
    );
    expect(resCreate.status).toBe(201);
    const examId = resCreate.body.examId;

    // Replace question with Q2 using PUT
    const resUpdate = await makeRequest(
      'PUT',
      `/api/exams/${examId}`,
      { Authorization: `Bearer ${instructorToken}` },
      {
        title: 'Updated Draft Exam',
        questionIds: [validQuestion2Id]
      }
    );
    expect(resUpdate.status).toBe(200);

    // Verify questions in exam
    const resGet = await makeRequest(
      'GET',
      `/api/exams/${examId}`,
      { Authorization: `Bearer ${instructorToken}` }
    );
    expect(resGet.status).toBe(200);
    expect(resGet.body.exam.questions.length).toBe(1);
    expect(resGet.body.exam.questions[0].questionId).toBe(validQuestion2Id);
  });

  it('should reject duplicate question assignments in both POST and PUT', async () => {
    // Try POST with duplicate question ID
    const resPostDup = await makeRequest(
      'POST',
      '/api/exams',
      { Authorization: `Bearer ${instructorToken}` },
      {
        title: 'Duplicate Questions Exam',
        status: 'DRAFT',
        durationMinutes: 60,
        totalMarks: 100,
        passMarks: 40,
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 3600000).toISOString(),
        questionIds: [validQuestion1Id, validQuestion1Id]
      }
    );
    expect(resPostDup.status).toBe(400);
    expect(resPostDup.body.error).toContain('Duplicate question assignment');

    // Create valid draft exam
    const resCreate = await makeRequest(
      'POST',
      '/api/exams',
      { Authorization: `Bearer ${instructorToken}` },
      {
        title: 'Valid Draft Exam',
        status: 'DRAFT',
        durationMinutes: 60,
        totalMarks: 100,
        passMarks: 40,
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 3600000).toISOString(),
        questionIds: [validQuestion1Id]
      }
    );
    expect(resCreate.status).toBe(201);
    const examId = resCreate.body.examId;

    // Try PUT with duplicate questions
    const resPutDup = await makeRequest(
      'PUT',
      `/api/exams/${examId}`,
      { Authorization: `Bearer ${instructorToken}` },
      {
        questionIds: [validQuestion2Id, validQuestion2Id]
      }
    );
    expect(resPutDup.status).toBe(400);
    expect(resPutDup.body.error).toContain('Duplicate question assignment');
  });

  it('should reject modifying questions with an invalid question format', async () => {
    const resCreate = await makeRequest(
      'POST',
      '/api/exams',
      { Authorization: `Bearer ${instructorToken}` },
      {
        title: 'Valid Draft Exam',
        status: 'DRAFT',
        durationMinutes: 60,
        totalMarks: 100,
        passMarks: 40,
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 3600000).toISOString(),
        questionIds: [validQuestion1Id]
      }
    );
    const examId = resCreate.body.examId;

    // Attempt to update with invalid question (no options)
    const resPutInvalid = await makeRequest(
      'PUT',
      `/api/exams/${examId}`,
      { Authorization: `Bearer ${instructorToken}` },
      {
        questionIds: [invalidQuestionId]
      }
    );
    expect(resPutInvalid.status).toBe(400);
    expect(resPutInvalid.body.error).toContain('must have at least 2 options');

    // Verify rollback: original question 1 remains assigned
    const resGet = await makeRequest(
      'GET',
      `/api/exams/${examId}`,
      { Authorization: `Bearer ${instructorToken}` }
    );
    expect(resGet.body.exam.questions.length).toBe(1);
    expect(resGet.body.exam.questions[0].questionId).toBe(validQuestion1Id);
  });

  it('should prevent modifying another instructor’s exam', async () => {
    // Instructor 1 creates exam
    const resCreate = await makeRequest(
      'POST',
      '/api/exams',
      { Authorization: `Bearer ${instructorToken}` },
      {
        title: 'Instructor 1 Exam',
        status: 'DRAFT',
        durationMinutes: 60,
        totalMarks: 100,
        passMarks: 40,
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 3600000).toISOString(),
        questionIds: [validQuestion1Id]
      }
    );
    const examId = resCreate.body.examId;

    // Instructor 2 attempts to edit it
    const resForbidden = await makeRequest(
      'PUT',
      `/api/exams/${examId}`,
      { Authorization: `Bearer ${instructor2Token}` },
      {
        title: 'Hacked Title'
      }
    );
    expect(resForbidden.status).toBe(403);
    expect(resForbidden.body.error).toContain('only edit exams they created');
  });

  it('should reject question modification if status is not DRAFT', async () => {
    // Create LIVE exam
    const resCreate = await makeRequest(
      'POST',
      '/api/exams',
      { Authorization: `Bearer ${instructorToken}` },
      {
        title: 'Live Exam',
        status: 'LIVE',
        durationMinutes: 60,
        totalMarks: 100,
        passMarks: 40,
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 3600000).toISOString(),
        questionIds: [validQuestion1Id]
      }
    );
    const examId = resCreate.body.examId;

    // Attempt to modify questions
    const resReject = await makeRequest(
      'PUT',
      `/api/exams/${examId}`,
      { Authorization: `Bearer ${instructorToken}` },
      {
        questionIds: [validQuestion2Id]
      }
    );
    expect(resReject.status).toBe(400);
    expect(resReject.body.error).toContain('Only DRAFT exams allow question modification');
  });

  it('should protect existing student attempts from question re-assignment', async () => {
    // Create DRAFT exam
    const resCreate = await makeRequest(
      'POST',
      '/api/exams',
      { Authorization: `Bearer ${instructorToken}` },
      {
        title: 'Exam With Attempt Protection',
        status: 'DRAFT',
        durationMinutes: 60,
        totalMarks: 100,
        passMarks: 40,
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 3600000).toISOString(),
        questionIds: [validQuestion1Id]
      }
    );
    const examId = resCreate.body.examId;

    // Insert an attempt for this exam
    db.prepare(`
      INSERT INTO attempts (id, exam_id, user_id, status, started_at, expires_at)
      VALUES (?, ?, ?, 'SUBMITTED', (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')), (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')))
    `).run(uuidv4(), examId, studentId);

    // Attempt question update
    const resProtect = await makeRequest(
      'PUT',
      `/api/exams/${examId}`,
      { Authorization: `Bearer ${instructorToken}` },
      {
        questionIds: [validQuestion2Id]
      }
    );
    expect(resProtect.status).toBe(400);
    expect(resProtect.body.error).toContain('student attempt(s) already exist');
  });
});
