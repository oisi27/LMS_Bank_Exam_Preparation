import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import http from 'http';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db, initDatabase } from '../db/schema';
import { coursesRouter } from '../routes/courses';
import { examsRouter } from '../routes/exams';
import { dashboardRouter } from '../routes/dashboard';
import { config } from '../config/env';

const app = express();
app.use(express.json());
app.use('/api/courses', coursesRouter);
app.use('/api/exams', examsRouter);
app.use('/api/dashboard', dashboardRouter);

describe('Phase 2: Course & Practice Material Search and Filtering Tests', () => {
  let server: http.Server;
  let serverPort: number;
  let studentToken: string;
  let studentId: string;
  let instructorToken: string;
  let instructorId: string;

  let mathCategoryId: string;
  let englishCategoryId: string;
  let course1MathId: string;
  let course2EnglishId: string;
  let course3BanglaId: string;
  let exam1Id: string;
  let exam2Id: string;

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

  beforeAll(async () => {
    initDatabase();

    studentId = uuidv4();
    instructorId = uuidv4();
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (?, ?, 'hash', 'Search Test Student', 'STUDENT')
    `).run(studentId, `student_search_${uniqueSuffix}@banklms.ac.bd`);

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (?, ?, 'hash', 'Search Test Instructor', 'INSTRUCTOR')
    `).run(instructorId, `inst_search_${uniqueSuffix}@banklms.ac.bd`);

    studentToken = jwt.sign({ id: studentId, role: 'STUDENT', email: `student_search_${uniqueSuffix}@banklms.ac.bd` }, config.JWT_SECRET, { expiresIn: '1h' });
    instructorToken = jwt.sign({ id: instructorId, role: 'INSTRUCTOR', email: `inst_search_${uniqueSuffix}@banklms.ac.bd` }, config.JWT_SECRET, { expiresIn: '1h' });

    // Seed Categories
    mathCategoryId = uuidv4();
    englishCategoryId = uuidv4();
    db.prepare(`INSERT INTO categories (id, name, name_bangla, slug, sort_order) VALUES (?, 'Quantitative Mathematics', 'গণিত শাখা', ?, 1)`)
      .run(mathCategoryId, `math-cat-${uniqueSuffix}`);
    db.prepare(`INSERT INTO categories (id, name, name_bangla, slug, sort_order) VALUES (?, 'English Language Studies', 'ইংরেজি ভাষা', ?, 2)`)
      .run(englishCategoryId, `english-cat-${uniqueSuffix}`);

    // Seed Published Courses
    course1MathId = uuidv4();
    course2EnglishId = uuidv4();
    course3BanglaId = uuidv4();

    db.prepare(`
      INSERT INTO courses (id, category_id, title, title_bangla, slug, description, instructor_id, status)
      VALUES (?, ?, 'Advanced Commercial Arithmetic & Algebra', 'উচ্চতর বাণিজ্যিক গণিত', ?, 'Covers compound interest, profit loss, and work algebra.', ?, 'PUBLISHED')
    `).run(course1MathId, mathCategoryId, `math-course-${uniqueSuffix}`, instructorId);

    db.prepare(`
      INSERT INTO courses (id, category_id, title, title_bangla, slug, description, instructor_id, status)
      VALUES (?, ?, 'English Reading Comprehension & Analogy Masterclass', 'ইংরেজি কম্প্রিহেনশন ও অ্যানালজি', ?, 'Strategies for critical reading and vocabulary analogies.', ?, 'PUBLISHED')
    `).run(course2EnglishId, englishCategoryId, `english-course-${uniqueSuffix}`, instructorId);

    db.prepare(`
      INSERT INTO courses (id, category_id, title, title_bangla, slug, description, instructor_id, status)
      VALUES (?, ?, 'Bangla Grammar & Spelling Rules', 'প্রমিত বাংলা বানান ও ব্যাকরণ', ?, 'Bangla literature and grammar rules for competitive exams.', ?, 'PUBLISHED')
    `).run(course3BanglaId, mathCategoryId, `bangla-course-${uniqueSuffix}`, instructorId);

    // Seed Exams
    exam1Id = uuidv4();
    exam2Id = uuidv4();

    db.prepare(`
      INSERT INTO exams (id, title, title_bangla, category, type, status, duration_minutes, total_marks, pass_marks, starts_at, ends_at, created_by)
      VALUES (?, 'Bangladesh Bank AD Special Model Test', 'বাংলাদেশ ব্যাংক এডি মডেল টেস্ট', 'BANK_RECRUITMENT', 'MODEL_TEST', 'LIVE', 30, 50, 25, datetime('now', '-1 hour'), datetime('now', '+2 hours'), ?)
    `).run(exam1Id, instructorId);

    db.prepare(`
      INSERT INTO exams (id, title, title_bangla, category, type, status, duration_minutes, total_marks, pass_marks, starts_at, ends_at, created_by)
      VALUES (?, 'Combined 8 Banks Officer Mock Exam', 'সম্মিলিত ৮ ব্যাংক অফিসার মক', 'BANK_RECRUITMENT', 'MODEL_TEST', 'LIVE', 45, 100, 50, datetime('now', '-1 hour'), datetime('now', '+2 hours'), ?)
    `).run(exam2Id, instructorId);

    // Start ephemeral test server
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        serverPort = typeof addr === 'object' && addr ? addr.port : 0;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  // --------------------------------------------------------------------------
  // Test 1: Course Search by Keyword (Title / Description)
  // --------------------------------------------------------------------------
  it('1. GET /api/courses?search=Arithmetic returns matching math course', async () => {
    const res = await makeRequest('GET', '/api/courses?search=Arithmetic', undefined, {
      Authorization: `Bearer ${studentToken}`
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.courses).toBeDefined();

    const titles = res.body.courses.map((c: any) => c.title);
    expect(titles).toContain('Advanced Commercial Arithmetic & Algebra');
    expect(titles).not.toContain('English Reading Comprehension & Analogy Masterclass');
  });

  // --------------------------------------------------------------------------
  // Test 2: Course Search by Bengali Title
  // --------------------------------------------------------------------------
  it('2. GET /api/courses with Bengali keyword returns matching courses', async () => {
    const res = await makeRequest('GET', `/api/courses?search=${encodeURIComponent('বাংলা')}`, undefined, {
      Authorization: `Bearer ${studentToken}`
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const matchIds = res.body.courses.map((c: any) => c.id);
    expect(matchIds).toContain(course3BanglaId);
    expect(matchIds).not.toContain(course2EnglishId);
  });

  // --------------------------------------------------------------------------
  // Test 3: Course Filter by Category ID
  // --------------------------------------------------------------------------
  it('3. GET /api/courses?categoryId=... filters courses strictly to that subject category', async () => {
    const res = await makeRequest('GET', `/api/courses?categoryId=${englishCategoryId}`, undefined, {
      Authorization: `Bearer ${studentToken}`
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const ids = res.body.courses.map((c: any) => c.id);
    expect(ids).toContain(course2EnglishId);
    expect(ids).not.toContain(course1MathId);
  });

  // --------------------------------------------------------------------------
  // Test 4: Course Filter by Category + Search Combined
  // --------------------------------------------------------------------------
  it('4. GET /api/courses with combined categoryId and search query', async () => {
    // Both mathCategoryId and search for 'Arithmetic'
    const res = await makeRequest('GET', `/api/courses?categoryId=${mathCategoryId}&search=Arithmetic`, undefined, {
      Authorization: `Bearer ${studentToken}`
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const ids = res.body.courses.map((c: any) => c.id);
    expect(ids).toContain(course1MathId);
    expect(ids).not.toContain(course3BanglaId); // In same category, but does not match 'Arithmetic'
  });

  // --------------------------------------------------------------------------
  // Test 5: Backward Compatibility: Default without query returns all courses
  // --------------------------------------------------------------------------
  it('5. GET /api/courses without query parameters returns all published courses', async () => {
    const res = await makeRequest('GET', '/api/courses', undefined, {
      Authorization: `Bearer ${studentToken}`
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.courses.length).toBeGreaterThanOrEqual(3);

    const ids = res.body.courses.map((c: any) => c.id);
    expect(ids).toContain(course1MathId);
    expect(ids).toContain(course2EnglishId);
    expect(ids).toContain(course3BanglaId);
  });

  // --------------------------------------------------------------------------
  // Test 6: Safe Empty Result when no courses match
  // --------------------------------------------------------------------------
  it('6. GET /api/courses with non-matching search term returns empty array safely', async () => {
    const res = await makeRequest('GET', '/api/courses?search=NonExistentSubjectXYZ99999', undefined, {
      Authorization: `Bearer ${studentToken}`
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.courses).toEqual([]);
    expect(res.body.count).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Test 7: SQL Injection Resistance
  // --------------------------------------------------------------------------
  it('7. SQL Injection Safety: Special characters are safely escaped as literal search tokens', async () => {
    const res = await makeRequest('GET', `/api/courses?search=${encodeURIComponent("' OR '1'='1")}`, undefined, {
      Authorization: `Bearer ${studentToken}`
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Should treat it literally and not dump all database courses bypass
    expect(res.body.courses).toEqual([]);
  });

  // --------------------------------------------------------------------------
  // Test 8: Exam Search by Title Keyword
  // --------------------------------------------------------------------------
  it('8. GET /api/exams?search=Special returns Bangladesh Bank AD Special Model Test', async () => {
    const res = await makeRequest('GET', '/api/exams?search=Special', undefined, {
      Authorization: `Bearer ${studentToken}`
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const ids = res.body.exams.map((e: any) => e.id);
    expect(ids).toContain(exam1Id);
    expect(ids).not.toContain(exam2Id);
  });

  // --------------------------------------------------------------------------
  // Test 9: Exam Filter by Category
  // --------------------------------------------------------------------------
  it('9. GET /api/exams?category=BANK_RECRUITMENT filters exams by category', async () => {
    const res = await makeRequest('GET', '/api/exams?category=BANK_RECRUITMENT', undefined, {
      Authorization: `Bearer ${studentToken}`
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.exams.length).toBeGreaterThanOrEqual(2);
  });

  // --------------------------------------------------------------------------
  // Test 10: Student Summary API includes category & type in upcomingExams
  // --------------------------------------------------------------------------
  it('10. GET /api/dashboard/student-summary provides category and type metadata in upcomingExams', async () => {
    const res = await makeRequest('GET', '/api/dashboard/student-summary', undefined, {
      Authorization: `Bearer ${studentToken}`
    });

    expect(res.status).toBe(200);
    expect(res.body.upcomingExams).toBeDefined();

    const targetExam = res.body.upcomingExams.find((e: any) => e.id === exam1Id);
    expect(targetExam).toBeDefined();
    expect(targetExam.category).toBe('BANK_RECRUITMENT');
    expect(targetExam.type).toBe('MODEL_TEST');
  });
});
