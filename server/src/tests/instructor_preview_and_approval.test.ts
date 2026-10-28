import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db, initDatabase } from '../db/schema';
import { adminRouter } from '../routes/admin';
import { examsRouter } from '../routes/exams';
import { authRouter } from '../routes/auth';
import { config } from '../config/env';
import bcrypt from 'bcryptjs';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/admin', adminRouter);
app.use('/api/exams', examsRouter);
app.use('/api/auth', authRouter);

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
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = data ? JSON.parse(data) : {};
            resolve({ status: res.statusCode || 500, body: parsed });
          } catch {
            resolve({ status: res.statusCode || 500, body: data });
          }
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

describe('Instructor Approval Governance & Student-View Exam Preview Tests', () => {
  let adminId: string;
  let adminToken: string;
  let instructorId: string;
  let instructorToken: string;
  let studentId: string;
  let studentToken: string;

  beforeAll(async () => {
    initDatabase();

    adminId = uuidv4();
    instructorId = uuidv4();
    studentId = uuidv4();

    const pwdHash = bcrypt.hashSync('testpass123', 8);

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, is_active)
      VALUES (?, ?, ?, 'Super Admin', 'ADMIN', 1)
    `).run(adminId, `admin_gov_${Date.now()}@example.com`, pwdHash);

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, is_active)
      VALUES (?, ?, ?, 'Approved Instructor', 'INSTRUCTOR', 1)
    `).run(instructorId, `inst_gov_${Date.now()}@example.com`, pwdHash);

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, is_active)
      VALUES (?, ?, ?, 'Standard Student', 'STUDENT', 1)
    `).run(studentId, `stud_gov_${Date.now()}@example.com`, pwdHash);

    adminToken = jwt.sign(
      { id: adminId, email: `admin_gov_${Date.now()}@example.com`, role: 'ADMIN', name: 'Super Admin' },
      config.JWT_SECRET
    );

    instructorToken = jwt.sign(
      { id: instructorId, email: `inst_gov_${Date.now()}@example.com`, role: 'INSTRUCTOR', name: 'Approved Instructor' },
      config.JWT_SECRET
    );

    studentToken = jwt.sign(
      { id: studentId, email: `stud_gov_${Date.now()}@example.com`, role: 'STUDENT', name: 'Standard Student' },
      config.JWT_SECRET
    );

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        serverPort = (server.address() as any).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(resolve));
    }
  });

  // ==========================================
  // TASK A: INSTRUCTOR APPROVAL & GOVERNANCE
  // ==========================================
  it('1. Admin can search and filter pending / suspended instructors', async () => {
    const unapprovedInstId = uuidv4();
    const unapprovedEmail = `pending_inst_${Date.now()}@example.com`;
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, is_active)
      VALUES (?, ?, 'hash', 'Pending Instructor', 'INSTRUCTOR', 0)
    `).run(unapprovedInstId, unapprovedEmail);

    const res = await makeRequest(
      'GET',
      '/api/admin/users?role=INSTRUCTOR&status=suspended',
      { Authorization: `Bearer ${adminToken}` }
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.some((u: any) => u.id === unapprovedInstId)).toBe(true);
  });

  it('2. Admin can approve/activate an instructor account and record audit log', async () => {
    const pendingInstId = uuidv4();
    const pendingEmail = `to_approve_inst_${Date.now()}@example.com`;
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, is_active)
      VALUES (?, ?, 'hash', 'To Approve Instructor', 'INSTRUCTOR', 0)
    `).run(pendingInstId, pendingEmail);

    const activateRes = await makeRequest(
      'PATCH',
      `/api/admin/users/${pendingInstId}/status`,
      { Authorization: `Bearer ${adminToken}` },
      { isActive: true }
    );

    expect(activateRes.status).toBe(200);
    expect(activateRes.body.success).toBe(true);
    expect(activateRes.body.user.is_active).toBe(1);

    // Verify database record
    const userRow: any = db.prepare('SELECT is_active FROM users WHERE id = ?').get(pendingInstId);
    expect(userRow.is_active).toBe(1);

    // Verify audit log entry
    const auditRow: any = db.prepare(`
      SELECT action, resource, resource_id FROM audit_logs
      WHERE resource_id = ? AND action = 'USER_ACTIVATED'
    `).get(pendingInstId);
    expect(auditRow).toBeDefined();
    expect(auditRow.action).toBe('USER_ACTIVATED');
  });

  it('3. Unapproved instructor (is_active = 0) is forbidden from accessing instructor features', async () => {
    const suspendedInstId = uuidv4();
    const suspendedEmail = `suspended_inst_${Date.now()}@example.com`;
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, is_active)
      VALUES (?, ?, 'hash', 'Suspended Instructor', 'INSTRUCTOR', 0)
    `).run(suspendedInstId, suspendedEmail);

    const suspendedToken = jwt.sign(
      { id: suspendedInstId, email: suspendedEmail, role: 'INSTRUCTOR', name: 'Suspended Instructor' },
      config.JWT_SECRET
    );

    // Attempt to access instructor courses
    const res = await makeRequest(
      'GET',
      '/api/exams?mine=true',
      { Authorization: `Bearer ${suspendedToken}` }
    );

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('deactivated');
  });

  it('4. Ordinary student cannot access admin user management or promote accounts', async () => {
    const res = await makeRequest(
      'GET',
      '/api/admin/users',
      { Authorization: `Bearer ${studentToken}` }
    );

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);

    // Attempt to promote self
    const promoteRes = await makeRequest(
      'PATCH',
      `/api/admin/users/${studentId}/role`,
      { Authorization: `Bearer ${studentToken}` },
      { role: 'INSTRUCTOR' }
    );

    expect(promoteRes.status).toBe(403);
    expect(promoteRes.body.success).toBe(false);
  });

  // ==========================================
  // TASK B: STUDENT-VIEW EXAM PREVIEW (SAFE READ-ONLY)
  // ==========================================
  it('5. Instructor can retrieve exam metadata and questions with hydrated options for preview', async () => {
    const examId = uuidv4();
    const qId1 = uuidv4();
    const qId2 = uuidv4();

    // Create draft exam
    db.prepare(`
      INSERT INTO exams (id, title, description, category, type, status, duration_minutes, total_marks, pass_marks, negative_marking_rate, allowed_attempts, starts_at, ends_at, created_by)
      VALUES (?, 'Demo Draft Exam for Preview', 'Preview description', 'BANK_RECRUITMENT', 'MODEL_TEST', 'DRAFT', 45, 50, 20, 0.25, 1, '2026-01-01', '2026-12-31', ?)
    `).run(examId, instructorId);

    // Insert questions
    db.prepare(`
      INSERT INTO questions (id, subject, chapter, topic, difficulty, type, prompt, prompt_bangla, default_marks, default_negative_marks, is_approved)
      VALUES (?, 'Mathematics', 'Arithmetic', 'Percentages', 'MEDIUM', 'SINGLE_MCQ', 'What is 20% of 150?', '১৫০ এর ২০% কত?', 1, 0.25, 1)
    `).run(qId1);

    db.prepare(`
      INSERT INTO questions (id, subject, chapter, topic, difficulty, type, prompt, prompt_bangla, default_marks, default_negative_marks, is_approved)
      VALUES (?, 'English', 'Grammar', 'Prepositions', 'EASY', 'SINGLE_MCQ', 'He is good ___ math.', 'সে গণিতে দক্ষ।', 1, 0.25, 1)
    `).run(qId2);

    // Insert options
    db.prepare(`
      INSERT INTO question_options (id, question_id, option_key, text, is_correct, sort_order)
      VALUES (?, ?, 'A', '30', 1, 1), (?, ?, 'B', '25', 0, 2)
    `).run(uuidv4(), qId1, uuidv4(), qId1);

    db.prepare(`
      INSERT INTO question_options (id, question_id, option_key, text, is_correct, sort_order)
      VALUES (?, ?, 'A', 'at', 1, 1), (?, ?, 'B', 'in', 0, 2)
    `).run(uuidv4(), qId2, uuidv4(), qId2);

    // Link questions to exam
    db.prepare(`
      INSERT INTO exam_questions (id, exam_id, question_id, section_name, marks, negative_marks, order_index)
      VALUES (?, ?, ?, 'Math Section', 1, 0.25, 0), (?, ?, ?, 'English Section', 1, 0.25, 1)
    `).run(uuidv4(), examId, qId1, uuidv4(), examId, qId2);

    // Call GET /api/exams/:id
    const res = await makeRequest('GET', `/api/exams/${examId}`, {
      Authorization: `Bearer ${instructorToken}`
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.exam.title).toBe('Demo Draft Exam for Preview');
    expect(res.body.exam.durationMinutes).toBe(45);
    expect(res.body.exam.questions.length).toBe(2);
    expect(res.body.exam.questions[0].options).toBeDefined();
    expect(res.body.exam.questions[0].options.length).toBe(2);
  });

  it('6. Preview mode does not create any records in attempts, results, or violations', async () => {
    const examId = uuidv4();
    db.prepare(`
      INSERT INTO exams (id, title, category, type, status, duration_minutes, total_marks, pass_marks, starts_at, ends_at, created_by)
      VALUES (?, 'Zero Attempt Check Exam', 'BANK_RECRUITMENT', 'MODEL_TEST', 'DRAFT', 30, 20, 8, '2026-01-01', '2026-12-31', ?)
    `).run(examId, instructorId);

    // Baseline count
    const attemptCountBefore = (db.prepare('SELECT COUNT(*) as c FROM attempts WHERE exam_id = ?').get(examId) as any).c;
    const resultCountBefore = (db.prepare('SELECT COUNT(*) as c FROM exam_results WHERE exam_id = ?').get(examId) as any).c;
    const violationCountBefore = (db.prepare('SELECT COUNT(*) as c FROM exam_violations').get() as any).c;

    // View exam details
    const res = await makeRequest('GET', `/api/exams/${examId}`, {
      Authorization: `Bearer ${instructorToken}`
    });
    expect(res.status).toBe(200);

    // Ensure database remains completely untouched
    const attemptCountAfter = (db.prepare('SELECT COUNT(*) as c FROM attempts WHERE exam_id = ?').get(examId) as any).c;
    const resultCountAfter = (db.prepare('SELECT COUNT(*) as c FROM exam_results WHERE exam_id = ?').get(examId) as any).c;
    const violationCountAfter = (db.prepare('SELECT COUNT(*) as c FROM exam_violations').get() as any).c;

    expect(attemptCountAfter).toBe(attemptCountBefore);
    expect(resultCountAfter).toBe(resultCountBefore);
    expect(violationCountAfter).toBe(violationCountBefore);
  });
});
