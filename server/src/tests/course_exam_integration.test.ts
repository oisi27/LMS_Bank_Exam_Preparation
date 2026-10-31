import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'http';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db, initDatabase } from '../db/schema';
import { examsRouter } from '../routes/exams';
import { coursesRouter } from '../routes/courses';
import { config } from '../config/env';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/exams', examsRouter);
app.use('/api/courses', coursesRouter);

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
    const finalBody = body && body.title ? {
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 86400000).toISOString(),
      ...body
    } : body;
    const postData = finalBody ? JSON.stringify(finalBody) : null;
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

describe('Option B: Complete Course-Based Exam Integration Tests', () => {
  let instructor1Id: string;
  let instructor2Id: string;
  let studentId: string;
  let adminId: string;

  let instructor1Token: string;
  let instructor2Token: string;
  let studentToken: string;
  let adminToken: string;

  let courseAId: string;
  let courseBId: string;
  let courseOtherInstructorId: string;
  let categoryId: string;
  let approvedQuestionId: string;

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

    instructor1Id = uuidv4();
    instructor2Id = uuidv4();
    studentId = uuidv4();
    adminId = uuidv4();

    const insertUser = db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (?, ?, ?, ?, ?)
    `);

    insertUser.run(instructor1Id, `inst1_${instructor1Id}@banklms.ac.bd`, 'hash', 'Instructor One', 'INSTRUCTOR');
    insertUser.run(instructor2Id, `inst2_${instructor2Id}@banklms.ac.bd`, 'hash', 'Instructor Two', 'INSTRUCTOR');
    insertUser.run(studentId, `student_${studentId}@du.ac.bd`, 'hash', 'Student Farabi', 'STUDENT');
    insertUser.run(adminId, `admin_${adminId}@banklms.ac.bd`, 'hash', 'Admin Naushin', 'ADMIN');

    instructor1Token = generateToken(instructor1Id, 'INSTRUCTOR', `inst1_${instructor1Id}@banklms.ac.bd`);
    instructor2Token = generateToken(instructor2Id, 'INSTRUCTOR', `inst2_${instructor2Id}@banklms.ac.bd`);
    studentToken = generateToken(studentId, 'STUDENT', `student_${studentId}@du.ac.bd`);
    adminToken = generateToken(adminId, 'ADMIN', `admin_${adminId}@banklms.ac.bd`);

    // Create a category
    categoryId = uuidv4();
    db.prepare(`
      INSERT INTO categories (id, name, slug)
      VALUES (?, 'Math Category', ?)
    `).run(categoryId, `math-cat-${categoryId}`);

    // Create courses
    courseAId = uuidv4();
    courseBId = uuidv4();
    courseOtherInstructorId = uuidv4();

    const insertCourse = db.prepare(`
      INSERT INTO courses (id, category_id, title, slug, instructor_id, status, is_archived)
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `);

    insertCourse.run(courseAId, categoryId, 'Bank Math Mastery A', `math-mastery-a-${courseAId}`, instructor1Id, 'PUBLISHED');
    insertCourse.run(courseBId, categoryId, 'Bank Math Mastery B', `math-mastery-b-${courseBId}`, instructor1Id, 'PUBLISHED');
    insertCourse.run(courseOtherInstructorId, categoryId, 'Course Other Instructor', `other-course-${courseOtherInstructorId}`, instructor2Id, 'PUBLISHED');

    // Create an approved question for live exam testing
    approvedQuestionId = uuidv4();
    db.prepare(`
      INSERT INTO questions (id, subject, chapter, topic, difficulty, type, prompt, is_approved, author_id)
      VALUES (?, 'Mathematics', 'Arithmetic', 'Work', 'MEDIUM', 'SINGLE_MCQ', 'What is 2 + 2?', 1, ?)
    `).run(approvedQuestionId, instructor1Id);

    const insertOpt = db.prepare(`
      INSERT INTO question_options (id, question_id, option_key, text, is_correct, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertOpt.run(uuidv4(), approvedQuestionId, 'A', '3', 0, 0);
    insertOpt.run(uuidv4(), approvedQuestionId, 'B', '4', 1, 1);
  });

  // 1. Course-exam linking upon creation
  it('1. should allow creating an exam linked to an authorized course', async () => {
    const res = await makeRequest('POST', '/api/exams', { Authorization: `Bearer ${instructor1Token}` }, {
      title: 'Course A Midterm Exam',
      durationMinutes: 45,
      totalMarks: 10,
      passMarks: 5,
      status: 'DRAFT',
      courseIds: [courseAId]
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const examId = res.body.examId;

    const mapping = db.prepare('SELECT * FROM course_exams WHERE exam_id = ? AND course_id = ?').get(examId, courseAId);
    expect(mapping).toBeDefined();
  });

  // 2. Multiple exams per course
  it('2. should support multiple exams linked to a single course', async () => {
    const res1 = await makeRequest('POST', '/api/exams', { Authorization: `Bearer ${instructor1Token}` }, {
      title: 'Course A Quiz 1',
      durationMinutes: 15,
      totalMarks: 5,
      passMarks: 2,
      status: 'DRAFT',
      courseIds: [courseAId]
    });
    const res2 = await makeRequest('POST', '/api/exams', { Authorization: `Bearer ${instructor1Token}` }, {
      title: 'Course A Final Exam',
      durationMinutes: 60,
      totalMarks: 20,
      passMarks: 10,
      status: 'DRAFT',
      courseIds: [courseAId]
    });

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);

    const rows = db.prepare('SELECT * FROM course_exams WHERE course_id = ?').all(courseAId);
    expect(rows.length).toBe(2);
  });

  // 3. Multiple authorized courses per exam
  it('3. should allow linking one exam to multiple authorized courses', async () => {
    const res = await makeRequest('POST', '/api/exams', { Authorization: `Bearer ${instructor1Token}` }, {
      title: 'Shared Math Exam',
      durationMinutes: 30,
      totalMarks: 10,
      passMarks: 5,
      status: 'DRAFT',
      courseIds: [courseAId, courseBId]
    });

    expect(res.status).toBe(201);
    const rows = db.prepare('SELECT * FROM course_exams WHERE exam_id = ?').all(res.body.examId);
    expect(rows.length).toBe(2);
  });

  // 4. Standalone Global Mock Exams
  it('4. should create a standalone Global Mock Exam when courseIds is omitted or empty', async () => {
    const res = await makeRequest('POST', '/api/exams', { Authorization: `Bearer ${instructor1Token}` }, {
      title: 'Standalone Grand Model Test',
      durationMinutes: 60,
      totalMarks: 100,
      passMarks: 40,
      status: 'DRAFT'
    });

    expect(res.status).toBe(201);
    const rows = db.prepare('SELECT * FROM course_exams WHERE exam_id = ?').all(res.body.examId);
    expect(rows.length).toBe(0);
  });

  // 5. Student DRAFT protection
  it('5. should shield DRAFT course exams from students while showing to instructors', async () => {
    const createRes = await makeRequest('POST', '/api/exams', { Authorization: `Bearer ${instructor1Token}` }, {
      title: 'Draft Course Exam',
      durationMinutes: 30,
      totalMarks: 10,
      passMarks: 5,
      status: 'DRAFT',
      courseIds: [courseAId]
    });
    expect(createRes.status).toBe(201);

    // Instructor views course exams
    const instRes = await makeRequest('GET', `/api/courses/${courseAId}/exams`, { Authorization: `Bearer ${instructor1Token}` });
    expect(instRes.status).toBe(200);
    expect(instRes.body.exams.some((e: any) => e.id === createRes.body.examId)).toBe(true);

    // Student views course exams
    const stuRes = await makeRequest('GET', `/api/courses/${courseAId}/exams`, { Authorization: `Bearer ${studentToken}` });
    expect(stuRes.status).toBe(200);
    expect(stuRes.body.exams.some((e: any) => e.id === createRes.body.examId)).toBe(false);
  });

  // 6. Instructor course ownership enforcement
  it('6. should reject an instructor linking an exam to another instructor course with 403', async () => {
    const res = await makeRequest('POST', '/api/exams', { Authorization: `Bearer ${instructor1Token}` }, {
      title: 'Unauthorized Course Link Attempt',
      durationMinutes: 30,
      totalMarks: 10,
      passMarks: 5,
      status: 'DRAFT',
      courseIds: [courseOtherInstructorId]
    });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Unauthorized: You cannot link an exam to course');
  });

  // 7. Instructor exam ownership enforcement
  it('7. should reject an instructor modifying an exam created by another instructor', async () => {
    // Instructor 2 creates exam
    const examRes = await makeRequest('POST', '/api/exams', { Authorization: `Bearer ${instructor2Token}` }, {
      title: 'Instructor 2 Private Exam',
      durationMinutes: 30,
      totalMarks: 10,
      passMarks: 5,
      status: 'DRAFT'
    });
    expect(examRes.status).toBe(201);
    const examId = examRes.body.examId;

    // Instructor 1 attempts to update it
    const updateRes = await makeRequest('PUT', `/api/exams/${examId}`, { Authorization: `Bearer ${instructor1Token}` }, {
      title: 'Hacked Title'
    });
    expect(updateRes.status).toBe(403);
  });

  // 8. Missing or null ownership cannot bypass authorization
  it('8. should reject course linking when course does not exist (404)', async () => {
    const fakeCourseId = uuidv4();
    const res = await makeRequest('POST', '/api/exams', { Authorization: `Bearer ${instructor1Token}` }, {
      title: 'Invalid Course Exam',
      durationMinutes: 30,
      totalMarks: 10,
      passMarks: 5,
      status: 'DRAFT',
      courseIds: [fakeCourseId]
    });
    expect(res.status).toBe(404);
  });

  // 9. Atomic rollback on invalid associations
  it('9. should perform atomic rollback if one courseId is invalid in a batch', async () => {
    const fakeCourseId = uuidv4();
    const res = await makeRequest('POST', '/api/exams', { Authorization: `Bearer ${instructor1Token}` }, {
      title: 'Batch Mixed Validity Exam',
      durationMinutes: 30,
      totalMarks: 10,
      passMarks: 5,
      status: 'DRAFT',
      courseIds: [courseAId, fakeCourseId]
    });

    expect(res.status).toBe(404);
    // Verify no exam was inserted with this title
    const exam = db.prepare("SELECT * FROM exams WHERE title = 'Batch Mixed Validity Exam'").get();
    expect(exam).toBeUndefined();
  });

  // 10. Preserving mappings when courseIds is omitted in PUT
  it('10. should preserve existing course mappings when courseIds is omitted in PUT update', async () => {
    const createRes = await makeRequest('POST', '/api/exams', { Authorization: `Bearer ${instructor1Token}` }, {
      title: 'Persistent Mapping Exam',
      durationMinutes: 30,
      totalMarks: 10,
      passMarks: 5,
      status: 'DRAFT',
      courseIds: [courseAId]
    });
    const examId = createRes.body.examId;

    // Update only title and duration, omit courseIds
    const putRes = await makeRequest('PUT', `/api/exams/${examId}`, { Authorization: `Bearer ${instructor1Token}` }, {
      title: 'Updated Persistent Mapping Exam',
      durationMinutes: 45
    });
    expect(putRes.status).toBe(200);

    const mapping = db.prepare('SELECT * FROM course_exams WHERE exam_id = ? AND course_id = ?').get(examId, courseAId);
    expect(mapping).toBeDefined();
  });

  // 11. Unlinking without historical data loss
  it('11. should safely unlink exam from course without deleting exam, questions, attempts, or results', async () => {
    const createRes = await makeRequest('POST', '/api/exams', { Authorization: `Bearer ${instructor1Token}` }, {
      title: 'Unlinking Test Exam',
      durationMinutes: 30,
      totalMarks: 10,
      passMarks: 5,
      status: 'DRAFT',
      courseIds: [courseAId]
    });
    const examId = createRes.body.examId;

    // Add a simulated student attempt and result
    const attemptId = uuidv4();
    db.prepare(`
      INSERT INTO attempts (id, exam_id, user_id, started_at, expires_at, status)
      VALUES (?, ?, ?, '2026-10-31T00:00:00.000Z', '2026-10-31T01:00:00.000Z', 'GRADED')
    `).run(attemptId, examId, studentId);

    const resultId = uuidv4();
    db.prepare(`
      INSERT INTO exam_results (id, exam_id, attempt_id, user_id, score, total_marks, correct_count, wrong_count, skipped_count, accuracy_percentage, time_spent_seconds, is_passed)
      VALUES (?, ?, ?, ?, 8, 10, 8, 2, 0, 80.0, 1200, 1)
    `).run(resultId, examId, attemptId, studentId);

    // Unlink exam by passing courseIds: []
    const unlinkRes = await makeRequest('PUT', `/api/exams/${examId}`, { Authorization: `Bearer ${instructor1Token}` }, {
      courseIds: []
    });
    expect(unlinkRes.status).toBe(200);

    // Verify course_exams mapping removed
    const mapping = db.prepare('SELECT * FROM course_exams WHERE exam_id = ?').all(examId);
    expect(mapping.length).toBe(0);

    // Verify exam, attempt, and result 100% intact
    const examRow = db.prepare('SELECT * FROM exams WHERE id = ?').get(examId);
    expect(examRow).toBeDefined();

    const attemptRow = db.prepare('SELECT * FROM attempts WHERE id = ?').get(attemptId);
    expect(attemptRow).toBeDefined();

    const resultRow = db.prepare('SELECT * FROM exam_results WHERE id = ?').get(resultId);
    expect(resultRow).toBeDefined();
  });

  // 12. Correct exam selection when switching courses
  it('12. should return only exams associated with the queried course', async () => {
    const exam1 = await makeRequest('POST', '/api/exams', { Authorization: `Bearer ${instructor1Token}` }, {
      title: 'Course A Exclusive Exam',
      durationMinutes: 20,
      totalMarks: 5,
      passMarks: 2,
      status: 'DRAFT',
      courseIds: [courseAId]
    });
    const exam2 = await makeRequest('POST', '/api/exams', { Authorization: `Bearer ${instructor1Token}` }, {
      title: 'Course B Exclusive Exam',
      durationMinutes: 20,
      totalMarks: 5,
      passMarks: 2,
      status: 'DRAFT',
      courseIds: [courseBId]
    });

    const resA = await makeRequest('GET', `/api/courses/${courseAId}/exams`, { Authorization: `Bearer ${instructor1Token}` });
    const resB = await makeRequest('GET', `/api/courses/${courseBId}/exams`, { Authorization: `Bearer ${instructor1Token}` });

    expect(resA.body.exams.some((e: any) => e.id === exam1.body.examId)).toBe(true);
    expect(resA.body.exams.some((e: any) => e.id === exam2.body.examId)).toBe(false);

    expect(resB.body.exams.some((e: any) => e.id === exam2.body.examId)).toBe(true);
    expect(resB.body.exams.some((e: any) => e.id === exam1.body.examId)).toBe(false);
  });

  // 13. No unrelated exam fallback
  it('13. should return empty array for a course with zero linked exams without fallback', async () => {
    const emptyCourseId = uuidv4();
    db.prepare(`
      INSERT INTO courses (id, category_id, title, slug, instructor_id, status, is_archived)
      VALUES (?, ?, 'Empty Course', ?, ?, 'PUBLISHED', 0)
    `).run(emptyCourseId, categoryId, `empty-course-${emptyCourseId}`, instructor1Id);

    const res = await makeRequest('GET', `/api/courses/${emptyCourseId}/exams`, { Authorization: `Bearer ${studentToken}` });
    expect(res.status).toBe(200);
    expect(res.body.exams).toEqual([]);
    expect(res.body.count).toBe(0);
  });

  // 14. Admin cross-ownership authority
  it('14. should allow Admin to associate an exam with any course', async () => {
    const res = await makeRequest('POST', '/api/exams', { Authorization: `Bearer ${adminToken}` }, {
      title: 'Admin Universal Exam',
      durationMinutes: 30,
      totalMarks: 10,
      passMarks: 5,
      status: 'DRAFT',
      courseIds: [courseOtherInstructorId]
    });
    expect(res.status).toBe(201);
  });

  // 15. Publishing to LIVE with approved question check
  it('15. should allow publishing course-linked exam to LIVE when question is approved', async () => {
    const res = await makeRequest('POST', '/api/exams', { Authorization: `Bearer ${instructor1Token}` }, {
      title: 'Live Course Assessment',
      durationMinutes: 30,
      totalMarks: 1,
      passMarks: 1,
      status: 'DRAFT',
      questionIds: [approvedQuestionId],
      courseIds: [courseAId]
    });
    expect(res.status).toBe(201);
    const examId = res.body.examId;

    const pubRes = await makeRequest('PUT', `/api/exams/${examId}`, { Authorization: `Bearer ${instructor1Token}` }, {
      status: 'LIVE'
    });
    expect(pubRes.status).toBe(200);

    // Student can now see it in course exams
    const stuRes = await makeRequest('GET', `/api/courses/${courseAId}/exams`, { Authorization: `Bearer ${studentToken}` });
    expect(stuRes.body.exams.some((e: any) => e.id === examId)).toBe(true);
  });
});

