import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { db, dbPath, initDatabase } from '../db/schema';
import { coursesRouter } from '../routes/courses';
import { config } from '../config/env';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/courses', coursesRouter);

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

describe('Phase 7 Milestone 1: Student Lesson Progress Tracking Backend Tests', () => {
  let studentToken: string;
  let instructorToken: string;
  let studentId: string;
  let instructorId: string;
  let publishedCourseId: string;
  let draftCourseId: string;
  let publishedLessonId1: string;
  let publishedLessonId2: string;
  let draftLessonId: string;

  beforeAll(async () => {
    // 1. Strict Isolation Check
    const realDevDbPath = path.resolve(__dirname, '../../bank_exam.db');
    if (path.resolve(dbPath) === realDevDbPath) {
      throw new Error(`[FATAL SAFETY VIOLATION]: Test ran against REAL database: ${realDevDbPath}`);
    }

    // Ensure database initialized with lesson_progress
    initDatabase();

    // Start ephemeral HTTP server
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          serverPort = addr.port;
        }
        resolve();
      });
    });

    studentId = uuidv4();
    instructorId = uuidv4();

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (?, ?, ?, ?, ?)
    `).run(studentId, `student_progress_${Date.now()}@bank.ac.bd`, 'hash123', 'Student Test Candidate', 'STUDENT');

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (?, ?, ?, ?, ?)
    `).run(instructorId, `inst_progress_${Date.now()}@bank.ac.bd`, 'hash123', 'Instructor Test', 'INSTRUCTOR');

    studentToken = jwt.sign(
      { id: studentId, email: 'student_progress@bank.ac.bd', role: 'STUDENT', name: 'Student Test Candidate' },
      config.JWT_SECRET,
      { expiresIn: '1h' }
    );

    instructorToken = jwt.sign(
      { id: instructorId, email: 'inst_progress@bank.ac.bd', role: 'INSTRUCTOR', name: 'Instructor Test' },
      config.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Create a Category
    const catId = uuidv4();
    db.prepare(`
      INSERT INTO categories (id, name, slug, sort_order)
      VALUES (?, ?, ?, ?)
    `).run(catId, 'Progress Test Category', `cat-prog-${Date.now()}`, 1);

    // Create a Published Course
    publishedCourseId = uuidv4();
    db.prepare(`
      INSERT INTO courses (id, category_id, title, slug, status, instructor_id)
      VALUES (?, ?, ?, ?, 'PUBLISHED', ?)
    `).run(publishedCourseId, catId, 'Published Progress Course', `pub-prog-${Date.now()}`, instructorId);

    // Create a Draft Course
    draftCourseId = uuidv4();
    db.prepare(`
      INSERT INTO courses (id, category_id, title, slug, status, instructor_id)
      VALUES (?, ?, ?, ?, 'DRAFT', ?)
    `).run(draftCourseId, catId, 'Draft Progress Course', `draft-prog-${Date.now()}`, instructorId);

    // Create Modules
    const mod1 = uuidv4();
    db.prepare(`
      INSERT INTO course_modules (id, course_id, title, sort_order)
      VALUES (?, ?, ?, 1)
    `).run(mod1, publishedCourseId, 'Module 1');

    const modDraft = uuidv4();
    db.prepare(`
      INSERT INTO course_modules (id, course_id, title, sort_order)
      VALUES (?, ?, ?, 1)
    `).run(modDraft, draftCourseId, 'Draft Module');

    // Create Lessons
    publishedLessonId1 = uuidv4();
    publishedLessonId2 = uuidv4();
    db.prepare(`
      INSERT INTO lessons (id, module_id, title, duration_minutes, sort_order)
      VALUES (?, ?, ?, 20, 1)
    `).run(publishedLessonId1, mod1, 'Published Lesson 1');

    db.prepare(`
      INSERT INTO lessons (id, module_id, title, duration_minutes, sort_order)
      VALUES (?, ?, ?, 30, 2)
    `).run(publishedLessonId2, mod1, 'Published Lesson 2');

    draftLessonId = uuidv4();
    db.prepare(`
      INSERT INTO lessons (id, module_id, title, duration_minutes, sort_order)
      VALUES (?, ?, ?, 15, 1)
    `).run(draftLessonId, modDraft, 'Draft Lesson');
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('should return 0% progress initially for a published course', async () => {
    const res = await makeRequest(
      'GET',
      `/api/courses/${publishedCourseId}/progress`,
      { Authorization: `Bearer ${studentToken}` }
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.totalLessons).toBe(2);
    expect(res.body.completedCount).toBe(0);
    expect(res.body.progressPercentage).toBe(0);
    expect(res.body.completedLessonIds).toEqual([]);
  });

  it('should mark a lesson completed and calculate 50% course progress', async () => {
    const markRes = await makeRequest(
      'POST',
      `/api/courses/lessons/${publishedLessonId1}/complete`,
      { Authorization: `Bearer ${studentToken}` }
    );

    expect(markRes.status).toBe(201);
    expect(markRes.body.success).toBe(true);
    expect(markRes.body.completed).toBe(true);
    expect(markRes.body.completedAt).toBeDefined();

    // Verify course progress updated to 50% (1 of 2 lessons)
    const progRes = await makeRequest(
      'GET',
      `/api/courses/${publishedCourseId}/progress`,
      { Authorization: `Bearer ${studentToken}` }
    );

    expect(progRes.status).toBe(200);
    expect(progRes.body.completedCount).toBe(1);
    expect(progRes.body.progressPercentage).toBe(50);
    expect(progRes.body.completedLessonIds).toContain(publishedLessonId1);
  });

  it('should be idempotent and prevent duplicate completion records', async () => {
    // Calling complete on the already completed lesson
    const dupRes = await makeRequest(
      'POST',
      `/api/courses/lessons/${publishedLessonId1}/complete`,
      { Authorization: `Bearer ${studentToken}` }
    );

    expect(dupRes.status).toBe(200);
    expect(dupRes.body.success).toBe(true);
    expect(dupRes.body.message).toContain('already marked as completed');

    // Confirm database has exactly 1 record for this user and lesson
    const count: any = db.prepare(`
      SELECT COUNT(*) as c FROM lesson_progress WHERE user_id = ? AND lesson_id = ?
    `).get(studentId, publishedLessonId1);
    expect(count.c).toBe(1);
  });

  it('should mark second lesson completed and reach 100% course progress', async () => {
    const markRes2 = await makeRequest(
      'POST',
      `/api/courses/lessons/${publishedLessonId2}/complete`,
      { Authorization: `Bearer ${studentToken}` }
    );

    expect(markRes2.status).toBe(201);

    const progRes = await makeRequest(
      'GET',
      `/api/courses/${publishedCourseId}/progress`,
      { Authorization: `Bearer ${studentToken}` }
    );

    expect(progRes.status).toBe(200);
    expect(progRes.body.completedCount).toBe(2);
    expect(progRes.body.progressPercentage).toBe(100);
    expect(progRes.body.completedLessonIds).toContain(publishedLessonId1);
    expect(progRes.body.completedLessonIds).toContain(publishedLessonId2);
  });

  it('should undo lesson completion and recalculate progress', async () => {
    const undoRes = await makeRequest(
      'DELETE',
      `/api/courses/lessons/${publishedLessonId1}/complete`,
      { Authorization: `Bearer ${studentToken}` }
    );

    expect(undoRes.status).toBe(200);
    expect(undoRes.body.success).toBe(true);
    expect(undoRes.body.completed).toBe(false);

    // Verify course progress dropped back to 50%
    const progRes = await makeRequest(
      'GET',
      `/api/courses/${publishedCourseId}/progress`,
      { Authorization: `Bearer ${studentToken}` }
    );

    expect(progRes.status).toBe(200);
    expect(progRes.body.completedCount).toBe(1);
    expect(progRes.body.progressPercentage).toBe(50);
    expect(progRes.body.completedLessonIds).not.toContain(publishedLessonId1);
    expect(progRes.body.completedLessonIds).toContain(publishedLessonId2);
  });

  it('should reject student completing a lesson in a DRAFT course with 403', async () => {
    const res = await makeRequest(
      'POST',
      `/api/courses/lessons/${draftLessonId}/complete`,
      { Authorization: `Bearer ${studentToken}` }
    );

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('unpublished course');
  });

  it('should reject unauthenticated request with 401', async () => {
    const res = await makeRequest(
      'POST',
      `/api/courses/lessons/${publishedLessonId1}/complete`
    );

    expect(res.status).toBe(401);
  });

  it('should return 404 for non-existent lesson', async () => {
    const res = await makeRequest(
      'POST',
      '/api/courses/lessons/non-existent-id/complete',
      { Authorization: `Bearer ${studentToken}` }
    );

    expect(res.status).toBe(404);
  });
});
