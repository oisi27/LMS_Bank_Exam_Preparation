import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db, initDatabase } from '../db/schema';
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

describe('Reversible Course Archival Workflow Tests', () => {
  let adminId: string;
  let instructorId: string;
  let studentId: string;
  let adminToken: string;
  let instructorToken: string;
  let studentToken: string;
  let categoryId: string;
  let testDraftCourseId: string;
  let testPublishedCourseId: string;

  beforeAll(async () => {
    initDatabase();

    const timestamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    adminId = uuidv4();
    instructorId = uuidv4();
    studentId = uuidv4();
    categoryId = uuidv4();
    testDraftCourseId = uuidv4();
    testPublishedCourseId = uuidv4();

    // Create Admin, Instructor, Student
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (?, ?, 'hash', 'Test Admin', 'ADMIN')
    `).run(adminId, `admin_${timestamp}@banklms.ac.bd`);

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (?, ?, 'hash', 'Test Instructor', 'INSTRUCTOR')
    `).run(instructorId, `inst_${timestamp}@banklms.ac.bd`);

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (?, ?, 'hash', 'Test Student', 'STUDENT')
    `).run(studentId, `student_${timestamp}@banklms.ac.bd`);

    const jwtSecret = config.JWT_SECRET || 'test_jwt_secret_bank_lms_super_secure_key_fall_2026';
    adminToken = jwt.sign({ id: adminId, email: `admin_${timestamp}@banklms.ac.bd`, role: 'ADMIN', name: 'Test Admin' }, jwtSecret);
    instructorToken = jwt.sign({ id: instructorId, email: `inst_${timestamp}@banklms.ac.bd`, role: 'INSTRUCTOR', name: 'Test Instructor' }, jwtSecret);
    studentToken = jwt.sign({ id: studentId, email: `student_${timestamp}@banklms.ac.bd`, role: 'STUDENT', name: 'Test Student' }, jwtSecret);

    // Create Category
    db.prepare(`
      INSERT INTO categories (id, name, name_bangla, slug, sort_order)
      VALUES (?, 'Archival Test Category', 'আর্কাইভ টেস্ট', ?, 1)
    `).run(categoryId, `archival-cat-${timestamp}`);

    // Create Draft Course and Published Course
    db.prepare(`
      INSERT INTO courses (id, category_id, title, title_bangla, slug, instructor_id, status, is_archived)
      VALUES (?, ?, 'Test Automated Draft Course', 'টেস্ট ড্রাফট কোর্স', ?, ?, 'DRAFT', 0)
    `).run(testDraftCourseId, categoryId, `auto-draft-${timestamp}`, instructorId);

    db.prepare(`
      INSERT INTO courses (id, category_id, title, title_bangla, slug, instructor_id, status, is_archived)
      VALUES (?, ?, 'Test Published Flagship Course', 'টেস্ট পাবলিশড কোর্স', ?, ?, 'PUBLISHED', 0)
    `).run(testPublishedCourseId, categoryId, `pub-course-${timestamp}`, instructorId);

    // Start server on dynamic port
    await new Promise<void>((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (typeof addr === 'object' && addr !== null) {
          serverPort = addr.port;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('1. Rejects archival attempts by non-admin users (INSTRUCTOR and STUDENT)', async () => {
    const instRes = await makeRequest('PUT', `/api/courses/${testDraftCourseId}/archive`, {
      Authorization: `Bearer ${instructorToken}`
    });
    expect(instRes.status).toBe(403);

    const studRes = await makeRequest('PUT', `/api/courses/${testDraftCourseId}/archive`, {
      Authorization: `Bearer ${studentToken}`
    });
    expect(studRes.status).toBe(403);
  });

  it('2. Prevents archiving a PUBLISHED course even if requested by ADMIN', async () => {
    const res = await makeRequest('PUT', `/api/courses/${testPublishedCourseId}/archive`, {
      Authorization: `Bearer ${adminToken}`
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Cannot archive a published course');

    const check: any = db.prepare('SELECT is_archived FROM courses WHERE id = ?').get(testPublishedCourseId);
    expect(check.is_archived).toBe(0);
  });

  it('3. Admin can safely archive a DRAFT course (soft archival)', async () => {
    const res = await makeRequest('PUT', `/api/courses/${testDraftCourseId}/archive`, {
      Authorization: `Bearer ${adminToken}`
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('archived successfully');

    const check: any = db.prepare('SELECT is_archived, archived_at, status FROM courses WHERE id = ?').get(testDraftCourseId);
    expect(check.is_archived).toBe(1);
    expect(check.archived_at).toBeTruthy();
    expect(check.status).toBe('DRAFT'); // status preserved intact
  });

  it('4. Students and Instructors do NOT see archived courses in standard catalog', async () => {
    const studRes = await makeRequest('GET', '/api/courses', {
      Authorization: `Bearer ${studentToken}`
    });
    expect(studRes.status).toBe(200);
    const studIds = studRes.body.courses.map((c: any) => c.id);
    expect(studIds).not.toContain(testDraftCourseId);

    const instRes = await makeRequest('GET', '/api/courses', {
      Authorization: `Bearer ${instructorToken}`
    });
    expect(instRes.status).toBe(200);
    const instIds = instRes.body.courses.map((c: any) => c.id);
    expect(instIds).not.toContain(testDraftCourseId);
  });

  it('5. Admin in Course Builder (mine=true) can see both active and archived courses', async () => {
    const adminRes = await makeRequest('GET', '/api/courses?mine=true', {
      Authorization: `Bearer ${adminToken}`
    });
    expect(adminRes.status).toBe(200);
    const adminCourses = adminRes.body.courses;
    const archivedCourse = adminCourses.find((c: any) => c.id === testDraftCourseId);
    expect(archivedCourse).toBeDefined();
    expect(archivedCourse.is_archived).toBe(1);
  });

  it('6. Admin can safely restore an archived course back to active draft', async () => {
    const res = await makeRequest('PUT', `/api/courses/${testDraftCourseId}/restore`, {
      Authorization: `Bearer ${adminToken}`
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('restored to active drafts successfully');

    const check: any = db.prepare('SELECT is_archived, archived_at, status FROM courses WHERE id = ?').get(testDraftCourseId);
    expect(check.is_archived).toBe(0);
    expect(check.archived_at).toBeNull();
    expect(check.status).toBe('DRAFT');
  });
});
