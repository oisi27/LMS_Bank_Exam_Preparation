import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db, initDatabase } from '../db/schema';
import { coursesRouter } from '../routes/courses';
import { adminRouter } from '../routes/admin';
import { config } from '../config/env';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/courses', coursesRouter);
app.use('/api/admin', adminRouter);

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

function generateToken(userId: string, role: string, email: string = 'test@example.com') {
  return jwt.sign(
    { id: userId, email, role, name: 'Test User' },
    config.JWT_SECRET || 'test_jwt_secret_bank_lms_super_secure_key_fall_2026',
    { expiresIn: '15m' }
  );
}

describe('Phase 7 Milestone 3 Step 2A: Safe Backend Course Moderation Implementation', () => {
  const adminId = `mod_admin_${Date.now()}`;
  const instructor1Id = `mod_inst1_${Date.now()}`;
  const instructor2Id = `mod_inst2_${Date.now()}`;
  const studentId = `mod_stud_${Date.now()}`;

  let adminToken: string;
  let instructor1Token: string;
  let instructor2Token: string;
  let studentToken: string;

  let categoryId: string;
  let course1Id: string;
  let course2Id: string;

  beforeAll(async () => {
    initDatabase();

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        serverPort = (server.address() as any).port;
        resolve();
      });
    });

    // Seed test users
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, is_active)
      VALUES (?, ?, 'hash123', 'Moderation Admin', 'ADMIN', 1)
    `).run(adminId, `${adminId}@test.local`);

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, is_active)
      VALUES (?, ?, 'hash123', 'Instructor One', 'INSTRUCTOR', 1)
    `).run(instructor1Id, `${instructor1Id}@test.local`);

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, is_active)
      VALUES (?, ?, 'hash123', 'Instructor Two', 'INSTRUCTOR', 1)
    `).run(instructor2Id, `${instructor2Id}@test.local`);

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, is_active)
      VALUES (?, ?, 'hash123', 'Student Candidate', 'STUDENT', 1)
    `).run(studentId, `${studentId}@test.local`);

    adminToken = generateToken(adminId, 'ADMIN', `${adminId}@test.local`);
    instructor1Token = generateToken(instructor1Id, 'INSTRUCTOR', `${instructor1Id}@test.local`);
    instructor2Token = generateToken(instructor2Id, 'INSTRUCTOR', `${instructor2Id}@test.local`);
    studentToken = generateToken(studentId, 'STUDENT', `${studentId}@test.local`);

    // Seed category
    categoryId = uuidv4();
    db.prepare(`
      INSERT INTO categories (id, name, slug)
      VALUES (?, 'Moderation Category', ?)
    `).run(categoryId, `mod-cat-${Date.now()}`);

    // Create Course 1 owned by Instructor 1 (DRAFT)
    course1Id = uuidv4();
    db.prepare(`
      INSERT INTO courses (id, category_id, title, slug, instructor_id, status)
      VALUES (?, ?, 'Advanced Banking Arithmetic', ?, ?, 'DRAFT')
    `).run(course1Id, categoryId, `adv-math-${Date.now()}`, instructor1Id);

    // Create Course 2 owned by Instructor 2 (DRAFT)
    course2Id = uuidv4();
    db.prepare(`
      INSERT INTO courses (id, category_id, title, slug, instructor_id, status)
      VALUES (?, ?, 'Banking Monetary Principles', ?, ?, 'DRAFT')
    `).run(course2Id, categoryId, `monetary-${Date.now()}`, instructor2Id);
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  // 1. Instructor submission and ownership
  it('1. Owning instructor can submit a DRAFT course for review (DRAFT -> PENDING_REVIEW)', async () => {
    const res = await makeRequest(
      'POST',
      `/api/courses/${course1Id}/submit`,
      { Authorization: `Bearer ${instructor1Token}` }
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.course.status).toBe('PENDING_REVIEW');

    const courseInDb: any = db.prepare('SELECT status, rejection_reason FROM courses WHERE id = ?').get(course1Id);
    expect(courseInDb.status).toBe('PENDING_REVIEW');
    expect(courseInDb.rejection_reason).toBeNull();
  });

  // 2. Non-owner instructor cannot submit another instructor\'s course
  it('2. Another instructor cannot submit a course they do not own (HTTP 403)', async () => {
    const res = await makeRequest(
      'POST',
      `/api/courses/${course2Id}/submit`,
      { Authorization: `Bearer ${instructor1Token}` }
    );

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  // 3. Instructor cannot directly self-publish via POST or PUT
  it('3. Standard instructor cannot directly self-publish via POST or PUT requests', async () => {
    // Attempting to create a course with status: 'PUBLISHED' as Instructor
    const postRes = await makeRequest(
      'POST',
      '/api/courses',
      { Authorization: `Bearer ${instructor2Token}` },
      {
        categoryId,
        title: 'Bypass Course Create',
        slug: `bypass-create-${Date.now()}`,
        status: 'PUBLISHED'
      }
    );
    expect(postRes.status).toBe(201);
    expect(postRes.body.status).toBe('DRAFT'); // Must be forced to DRAFT

    // Attempting to PUT status: 'PUBLISHED' directly on Course 2
    const putRes = await makeRequest(
      'PUT',
      `/api/courses/${course2Id}`,
      { Authorization: `Bearer ${instructor2Token}` },
      { status: 'PUBLISHED' }
    );
    expect(putRes.status).toBe(403);
    expect(putRes.body.error).toContain('Instructors cannot directly publish courses');

    const dbCourse2: any = db.prepare('SELECT status FROM courses WHERE id = ?').get(course2Id);
    expect(dbCourse2.status).toBe('DRAFT');
  });

  // 4. Student cannot access pending/rejected courses
  it('4. Students cannot access PENDING_REVIEW or REJECTED courses in catalog or details', async () => {
    // In catalog GET /api/courses
    const catalogRes = await makeRequest(
      'GET',
      '/api/courses',
      { Authorization: `Bearer ${studentToken}` }
    );
    expect(catalogRes.status).toBe(200);
    const publishedIds = catalogRes.body.courses.map((c: any) => c.id);
    expect(publishedIds).not.toContain(course1Id); // course1 is PENDING_REVIEW
    expect(publishedIds).not.toContain(course2Id); // course2 is DRAFT

    // Direct detail GET /api/courses/:courseId
    const detailRes = await makeRequest(
      'GET',
      `/api/courses/${course1Id}`,
      { Authorization: `Bearer ${studentToken}` }
    );
    expect(detailRes.status).toBe(403);
    expect(detailRes.body.error).toContain('not published');
  });

  // 5. Non-admin cannot access moderation APIs
  it('5. Non-admin users (STUDENT, INSTRUCTOR) cannot access Admin moderation APIs (HTTP 403)', async () => {
    const studentRes = await makeRequest(
      'GET',
      '/api/admin/courses/pending',
      { Authorization: `Bearer ${studentToken}` }
    );
    expect(studentRes.status).toBe(403);

    const instructorRes = await makeRequest(
      'PATCH',
      `/api/admin/courses/${course1Id}/approve`,
      { Authorization: `Bearer ${instructor1Token}` }
    );
    expect(instructorRes.status).toBe(403);
  });

  // 6. Admin pending course listing
  it('6. Admin can retrieve all courses awaiting approval via GET /api/admin/courses/pending', async () => {
    const res = await makeRequest(
      'GET',
      '/api/admin/courses/pending',
      { Authorization: `Bearer ${adminToken}` }
    );
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.courses)).toBe(true);
    expect(res.body.courses.some((c: any) => c.id === course1Id)).toBe(true);
  });

  // 7. Admin rejection with required reason and audit logging
  it('7. Admin can reject a submitted course with a valid reason, creating a COURSE_REJECTED audit log', async () => {
    // Attempt rejection without reason
    const emptyRejectRes = await makeRequest(
      'PATCH',
      `/api/admin/courses/${course1Id}/reject`,
      { Authorization: `Bearer ${adminToken}` },
      { reason: '   ' }
    );
    expect(emptyRejectRes.status).toBe(400);

    // Valid rejection
    const rejectRes = await makeRequest(
      'PATCH',
      `/api/admin/courses/${course1Id}/reject`,
      { Authorization: `Bearer ${adminToken}` },
      { reason: 'Please attach at least two lesson PDF handouts before approval.' }
    );
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.course.status).toBe('REJECTED');
    expect(rejectRes.body.course.rejection_reason).toContain('lesson PDF handouts');

    // Confirm audit log
    const auditRecord: any = db.prepare(`
      SELECT * FROM audit_logs
      WHERE resource = 'COURSE' AND resource_id = ? AND action = 'COURSE_REJECTED'
      ORDER BY created_at DESC LIMIT 1
    `).get(course1Id);

    expect(auditRecord).toBeDefined();
    expect(auditRecord.actor_id).toBe(adminId);
    expect(auditRecord.details).toContain('lesson PDF handouts');
  });

  // 8. Rejected course resubmission
  it('8. Instructor can edit and re-submit a REJECTED course for review, clearing rejection reason', async () => {
    const resubmitRes = await makeRequest(
      'POST',
      `/api/courses/${course1Id}/submit`,
      { Authorization: `Bearer ${instructor1Token}` }
    );

    expect(resubmitRes.status).toBe(200);
    expect(resubmitRes.body.course.status).toBe('PENDING_REVIEW');
    expect(resubmitRes.body.course.rejection_reason).toBeNull();

    const dbCheck: any = db.prepare('SELECT status, rejection_reason FROM courses WHERE id = ?').get(course1Id);
    expect(dbCheck.status).toBe('PENDING_REVIEW');
    expect(dbCheck.rejection_reason).toBeNull();
  });

  // 9. Admin approval and audit logging
  it('9. Admin can approve a PENDING_REVIEW course, transitioning it to PUBLISHED with COURSE_APPROVED audit log', async () => {
    const approveRes = await makeRequest(
      'PATCH',
      `/api/admin/courses/${course1Id}/approve`,
      { Authorization: `Bearer ${adminToken}` }
    );

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.course.status).toBe('PUBLISHED');

    const dbCheck: any = db.prepare('SELECT status FROM courses WHERE id = ?').get(course1Id);
    expect(dbCheck.status).toBe('PUBLISHED');

    // Confirm audit log
    const auditRecord: any = db.prepare(`
      SELECT * FROM audit_logs
      WHERE resource = 'COURSE' AND resource_id = ? AND action = 'COURSE_APPROVED'
      ORDER BY created_at DESC LIMIT 1
    `).get(course1Id);

    expect(auditRecord).toBeDefined();
    expect(auditRecord.actor_id).toBe(adminId);

    // Now student CAN see the course in catalog
    const studentCatalog = await makeRequest(
      'GET',
      '/api/courses',
      { Authorization: `Bearer ${studentToken}` }
    );
    expect(studentCatalog.body.courses.some((c: any) => c.id === course1Id)).toBe(true);
  });

  // 10. Invalid transitions and unauthorized actions
  it('10. Invalid state transitions are rejected with HTTP 400', async () => {
    // Attempting to approve a course that is already PUBLISHED
    const reApproveRes = await makeRequest(
      'PATCH',
      `/api/admin/courses/${course1Id}/approve`,
      { Authorization: `Bearer ${adminToken}` }
    );
    expect(reApproveRes.status).toBe(400);
    expect(reApproveRes.body.error).toContain('Cannot approve course with status');

    // Attempting to submit a course that is already PUBLISHED
    const reSubmitRes = await makeRequest(
      'POST',
      `/api/courses/${course1Id}/submit`,
      { Authorization: `Bearer ${instructor1Token}` }
    );
    expect(reSubmitRes.status).toBe(400);
    expect(reSubmitRes.body.error).toContain('Cannot submit course with status');
  });
});
