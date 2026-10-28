import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import http from 'http';
import express from 'express';
import { db, initDatabase } from '../db/schema';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { v4 as uuidv4 } from 'uuid';
import { coursesRouter } from '../routes/courses';
import fs from 'fs';
import path from 'path';

// Setup test express server without third-party test dependencies
const app = express();
app.use(express.json());
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
    const isBuffer = Buffer.isBuffer(body);
    const postData = isBuffer ? body : (body ? JSON.stringify(body) : null);

    const reqHeaders: Record<string, string | number> = { ...headers };
    if (postData && !reqHeaders['Content-Type'] && !reqHeaders['content-type']) {
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

// Multipart helper
function buildMultipartBody(fields: Record<string, string>, file: { fieldname: string; filename: string; contentType: string; content: Buffer }) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).slice(2);
  const parts: Buffer[] = [];

  for (const [key, val] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`));
  }

  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${file.fieldname}"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`
  ));
  parts.push(file.content);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

  return {
    contentType: `multipart/form-data; boundary=${boundary}`,
    body: Buffer.concat(parts)
  };
}

describe('Phase 6 Completion: Real Uploads, Reordering & Security Access Tests', () => {
  let categoryId: string;
  let instructorAId: string;
  let instructorBId: string;
  let studentId: string;

  let instructorAToken: string;
  let instructorBToken: string;
  let studentToken: string;

  let courseAId: string;
  let courseBId: string;
  let module1Id: string;
  let module2Id: string;
  let module3Id: string;
  let lesson1Id: string;
  let lesson2Id: string;
  let lesson3Id: string;

  beforeEach(async () => {
    initDatabase();

    if (!server) {
      await new Promise<void>((resolve) => {
        server = app.listen(0, '127.0.0.1', () => {
          const addr = server.address() as any;
          serverPort = addr.port;
          resolve();
        });
      });
    }

    const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    categoryId = uuidv4();
    instructorAId = uuidv4();
    instructorBId = uuidv4();
    studentId = uuidv4();

    courseAId = uuidv4();
    courseBId = uuidv4();
    module1Id = uuidv4();
    module2Id = uuidv4();
    module3Id = uuidv4();
    lesson1Id = uuidv4();
    lesson2Id = uuidv4();
    lesson3Id = uuidv4();

    // Insert Users with guaranteed unique emails
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (?, ?, 'hash', 'Instructor Alice', 'INSTRUCTOR')
    `).run(instructorAId, `inst_a_${unique}@banklms.edu.bd`);

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (?, ?, 'hash', 'Instructor Bob', 'INSTRUCTOR')
    `).run(instructorBId, `inst_b_${unique}@banklms.edu.bd`);

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (?, ?, 'hash', 'Student Charlie', 'STUDENT')
    `).run(studentId, `student_${unique}@banklms.edu.bd`);

    // Generate valid Auth Tokens
    instructorAToken = jwt.sign(
      { id: instructorAId, email: `alice_${unique}@banklms.edu.bd`, role: 'INSTRUCTOR', name: 'Instructor Alice' },
      config.JWT_SECRET
    );

    instructorBToken = jwt.sign(
      { id: instructorBId, email: `bob_${unique}@banklms.edu.bd`, role: 'INSTRUCTOR', name: 'Instructor Bob' },
      config.JWT_SECRET
    );

    studentToken = jwt.sign(
      { id: studentId, email: `charlie_${unique}@banklms.edu.bd`, role: 'STUDENT', name: 'Student Charlie' },
      config.JWT_SECRET
    );

    // Insert Category
    db.prepare(`
      INSERT INTO categories (id, name, slug, sort_order)
      VALUES (?, 'Bank Recruitment Math', ?, 1)
    `).run(categoryId, `category-math-${unique}`);

    // Insert Course A owned by Instructor Alice (DRAFT)
    db.prepare(`
      INSERT INTO courses (id, category_id, title, slug, instructor_id, status)
      VALUES (?, ?, 'Alice Course', ?, ?, 'DRAFT')
    `).run(courseAId, categoryId, `alice-course-${unique}`, instructorAId);

    // Insert Course B owned by Instructor Bob (DRAFT)
    db.prepare(`
      INSERT INTO courses (id, category_id, title, slug, instructor_id, status)
      VALUES (?, ?, 'Bob Course', ?, ?, 'DRAFT')
    `).run(courseBId, categoryId, `bob-course-${unique}`, instructorBId);

    // Insert Modules for Course A
    db.prepare('INSERT INTO course_modules (id, course_id, title, sort_order) VALUES (?, ?, ?, ?)').run(module1Id, courseAId, 'Module 1', 1);
    db.prepare('INSERT INTO course_modules (id, course_id, title, sort_order) VALUES (?, ?, ?, ?)').run(module2Id, courseAId, 'Module 2', 2);
    db.prepare('INSERT INTO course_modules (id, course_id, title, sort_order) VALUES (?, ?, ?, ?)').run(module3Id, courseAId, 'Module 3', 3);

    // Insert Lessons for Module 1
    db.prepare('INSERT INTO lessons (id, module_id, title, duration_minutes, sort_order) VALUES (?, ?, ?, ?, ?)').run(lesson1Id, module1Id, 'Lesson 1', 15, 1);
    db.prepare('INSERT INTO lessons (id, module_id, title, duration_minutes, sort_order) VALUES (?, ?, ?, ?, ?)').run(lesson2Id, module1Id, 'Lesson 2', 20, 2);
    db.prepare('INSERT INTO lessons (id, module_id, title, duration_minutes, sort_order) VALUES (?, ?, ?, ?, ?)').run(lesson3Id, module1Id, 'Lesson 3', 25, 3);
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  // ----------------------------------------------------
  // TEST 1: Course and Content Ownership Security
  // ----------------------------------------------------
  it('should prevent an instructor from editing or adding modules to another instructor’s course', async () => {
    // Instructor Bob tries to add module to Alice's course A
    const res = await makeRequest(
      'POST',
      `/api/courses/${courseAId}/modules`,
      { Authorization: `Bearer ${instructorBToken}` },
      { title: 'Malicious Module', sortOrder: 4 }
    );

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('not authorized');

    // Students are rejected by role
    const studentRes = await makeRequest(
      'POST',
      `/api/courses/${courseAId}/modules`,
      { Authorization: `Bearer ${studentToken}` },
      { title: 'Student Module', sortOrder: 4 }
    );

    expect(studentRes.status).toBe(403);
  });

  // ----------------------------------------------------
  // TEST 2: Module and Lesson Reordering with Ownership & Validation
  // ----------------------------------------------------
  it('should reorder modules atomically and reject invalid/foreign IDs', async () => {
    // 1. Bob cannot reorder Alice's modules
    const unauthRes = await makeRequest(
      'PATCH',
      `/api/courses/${courseAId}/modules/reorder`,
      { Authorization: `Bearer ${instructorBToken}` },
      { ids: [module3Id, module1Id, module2Id] }
    );
    expect(unauthRes.status).toBe(403);

    // 2. Alice cannot supply a foreign module ID
    const foreignRes = await makeRequest(
      'PATCH',
      `/api/courses/${courseAId}/modules/reorder`,
      { Authorization: `Bearer ${instructorAToken}` },
      { ids: [module3Id, uuidv4(), module2Id] }
    );
    expect(foreignRes.status).toBe(400);

    // 3. Valid reordering by Alice: Module 3 first, then 1, then 2
    const successRes = await makeRequest(
      'PATCH',
      `/api/courses/${courseAId}/modules/reorder`,
      { Authorization: `Bearer ${instructorAToken}` },
      { ids: [module3Id, module1Id, module2Id] }
    );

    expect(successRes.status).toBe(200);
    expect(successRes.body.success).toBe(true);

    // Verify sort_order in database
    const m3: any = db.prepare('SELECT sort_order FROM course_modules WHERE id = ?').get(module3Id);
    const m1: any = db.prepare('SELECT sort_order FROM course_modules WHERE id = ?').get(module1Id);
    const m2: any = db.prepare('SELECT sort_order FROM course_modules WHERE id = ?').get(module2Id);

    expect(m3.sort_order).toBe(1);
    expect(m1.sort_order).toBe(2);
    expect(m2.sort_order).toBe(3);
  });

  it('should reorder lessons within a module correctly', async () => {
    // Valid reordering: Lesson 2, Lesson 3, Lesson 1
    const res = await makeRequest(
      'PATCH',
      `/api/courses/modules/${module1Id}/lessons/reorder`,
      { Authorization: `Bearer ${instructorAToken}` },
      { ids: [lesson2Id, lesson3Id, lesson1Id] }
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const l2: any = db.prepare('SELECT sort_order FROM lessons WHERE id = ?').get(lesson2Id);
    const l3: any = db.prepare('SELECT sort_order FROM lessons WHERE id = ?').get(lesson3Id);
    const l1: any = db.prepare('SELECT sort_order FROM lessons WHERE id = ?').get(lesson1Id);

    expect(l2.sort_order).toBe(1);
    expect(l3.sort_order).toBe(2);
    expect(l1.sort_order).toBe(3);
  });

  // ----------------------------------------------------
  // TEST 3: Real Multipart Resource File Upload & Validation
  // ----------------------------------------------------
  it('should upload valid multipart PDF and reject unauthorized users or invalid extensions', async () => {
    const validPdfBuffer = Buffer.from('%PDF-1.4 sample content for bank exam');

    // Unauthorized student cannot upload
    const studentMultipart = buildMultipartBody({}, {
      fieldname: 'file',
      filename: 'notes.pdf',
      contentType: 'application/pdf',
      content: validPdfBuffer
    });
    const studentUpload = await makeRequest(
      'POST',
      `/api/courses/lessons/${lesson1Id}/resources/upload`,
      {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': studentMultipart.contentType
      },
      studentMultipart.body
    );
    expect(studentUpload.status).toBe(403);

    // Another instructor cannot upload to Alice's lesson
    const bobMultipart = buildMultipartBody({}, {
      fieldname: 'file',
      filename: 'notes.pdf',
      contentType: 'application/pdf',
      content: validPdfBuffer
    });
    const bobUpload = await makeRequest(
      'POST',
      `/api/courses/lessons/${lesson1Id}/resources/upload`,
      {
        Authorization: `Bearer ${instructorBToken}`,
        'Content-Type': bobMultipart.contentType
      },
      bobMultipart.body
    );
    expect(bobUpload.status).toBe(403);

    // Invalid extension (.exe) rejected
    const badExtMultipart = buildMultipartBody({}, {
      fieldname: 'file',
      filename: 'hack.exe',
      contentType: 'application/octet-stream',
      content: Buffer.from('malicious payload')
    });
    const badExtUpload = await makeRequest(
      'POST',
      `/api/courses/lessons/${lesson1Id}/resources/upload`,
      {
        Authorization: `Bearer ${instructorAToken}`,
        'Content-Type': badExtMultipart.contentType
      },
      badExtMultipart.body
    );
    expect(badExtUpload.status).toBe(400);

    // Valid PDF upload by Alice
    const validMultipart = buildMultipartBody(
      { title: 'Lecture Handout 1' },
      {
        fieldname: 'file',
        filename: 'lecture_notes.pdf',
        contentType: 'application/pdf',
        content: validPdfBuffer
      }
    );
    const validUpload = await makeRequest(
      'POST',
      `/api/courses/lessons/${lesson1Id}/resources/upload`,
      {
        Authorization: `Bearer ${instructorAToken}`,
        'Content-Type': validMultipart.contentType
      },
      validMultipart.body
    );

    expect(validUpload.status).toBe(201);
    expect(validUpload.body.success).toBe(true);
    expect(validUpload.body.resource.title).toBe('Lecture Handout 1');
    expect(validUpload.body.resource.fileType).toBe('PDF');

    const resourceId = validUpload.body.resource.id;
    const dbRecord: any = db.prepare('SELECT * FROM lesson_resources WHERE id = ?').get(resourceId);
    expect(dbRecord).toBeDefined();
    expect(fs.existsSync(dbRecord.file_path)).toBe(true);

    // Ensure safe server-side filename and path traversal prevention
    expect(dbRecord.file_path).not.toContain('..');
    expect(path.basename(dbRecord.file_path)).toMatch(/^res_\d+_[a-f0-9]+\.pdf$/);

    // Clean up test file
    if (fs.existsSync(dbRecord.file_path)) {
      fs.unlinkSync(dbRecord.file_path);
    }
  });

  // ----------------------------------------------------
  // TEST 4: Expiring Signed Token Download & Resource Cleanup
  // ----------------------------------------------------
  it('should stream uploaded file via signed token and clean up disk on resource delete', async () => {
    // 1. Upload a real file
    const fileContent = '%PDF-1.4 Official Bangladesh Bank Formula Sheet 2026';
    const multipart = buildMultipartBody(
      { title: 'Math Formula Sheet' },
      {
        fieldname: 'file',
        filename: 'formulas.pdf',
        contentType: 'application/pdf',
        content: Buffer.from(fileContent)
      }
    );

    const uploadRes = await makeRequest(
      'POST',
      `/api/courses/lessons/${lesson1Id}/resources/upload`,
      {
        Authorization: `Bearer ${instructorAToken}`,
        'Content-Type': multipart.contentType
      },
      multipart.body
    );

    expect(uploadRes.status).toBe(201);
    const resourceId = uploadRes.body.resource.id;

    // 2. Instructor Alice requests signed link (Course A is in DRAFT)
    const linkRes = await makeRequest(
      'GET',
      `/api/courses/resources/${resourceId}/signed-link`,
      { Authorization: `Bearer ${instructorAToken}` }
    );

    expect(linkRes.status).toBe(200);
    expect(linkRes.body.signedUrl).toBeDefined();

    const signedUrl = linkRes.body.signedUrl;
    const token = new URL(signedUrl).searchParams.get('token')!;

    // 3. Download using token
    const downloadRes = await makeRequest('GET', `/api/courses/resources/download?token=${token}`);

    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers['content-type']).toContain('application/pdf');
    expect(downloadRes.text).toContain('Bangladesh Bank Formula Sheet 2026');

    // 4. Forged / Expired token is rejected
    const fakeToken = jwt.sign({ resourceId, userId: studentId }, 'wrong_secret');
    const forgedRes = await makeRequest('GET', `/api/courses/resources/download?token=${fakeToken}`);
    expect(forgedRes.status).toBe(403);

    // 5. Delete resource cleans up DB and disk file
    const dbRecordBefore: any = db.prepare('SELECT file_path FROM lesson_resources WHERE id = ?').get(resourceId);
    expect(fs.existsSync(dbRecordBefore.file_path)).toBe(true);

    const deleteRes = await makeRequest(
      'DELETE',
      `/api/courses/resources/${resourceId}`,
      { Authorization: `Bearer ${instructorAToken}` }
    );

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);

    const dbRecordAfter: any = db.prepare('SELECT * FROM lesson_resources WHERE id = ?').get(resourceId);
    expect(dbRecordAfter).toBeUndefined();
    expect(fs.existsSync(dbRecordBefore.file_path)).toBe(false);
  });
});
