import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'http';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db, initDatabase } from '../db/schema';
import { questionsRouter } from '../routes/questions';
import { examsRouter } from '../routes/exams';
import { config } from '../config/env';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/questions', questionsRouter);
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
          resolve({ status: res.statusCode || 500, body: parsed });
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

describe('Proposal Gap Fix: Question Approval Workflow & Live Exam Protection Tests', () => {
  let adminToken: string;
  let instructorToken: string;

  const adminId = 'a0000000-0000-4000-8000-000000000099';
  const instructorId = 'b0000000-0000-4000-8000-000000000099';

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
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

    // Upsert test users
    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
      ON CONFLICT(id) DO UPDATE SET role = excluded.role, is_active = 1
    `).run(adminId, 'Admin Auditor', 'admin_audit@banklms.edu.bd', 'hash', 'ADMIN');

    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
      ON CONFLICT(id) DO UPDATE SET role = excluded.role, is_active = 1
    `).run(instructorId, 'Instructor Author', 'instructor_author@banklms.edu.bd', 'hash', 'INSTRUCTOR');

    adminToken = generateToken(adminId, 'ADMIN', 'admin_audit@banklms.edu.bd');
    instructorToken = generateToken(instructorId, 'INSTRUCTOR', 'instructor_author@banklms.edu.bd');
  });

  it('should mark instructor created questions as UNAPPROVED (is_approved=0) by default', async () => {
    const res = await makeRequest(
      'POST',
      '/api/questions',
      { Authorization: `Bearer ${instructorToken}` },
      {
        subject: 'General Knowledge & Bangladesh Affairs',
        chapter: 'Liberation War',
        topic: 'Mujibnagar Government',
        difficulty: 'MEDIUM',
        type: 'SINGLE_MCQ',
        prompt: 'Who was the Prime Minister of the Mujibnagar Government in 1971?',
        options: [
          { optionKey: 'A', text: 'Tajuddin Ahmad', isCorrect: true },
          { optionKey: 'B', text: 'Syed Nazrul Islam', isCorrect: false }
        ]
      }
    );

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const createdId = res.body.questionId;

    const row: any = db.prepare('SELECT is_approved FROM questions WHERE id = ?').get(createdId);
    expect(row.is_approved).toBe(0); // Unapproved by default for instructor
  });

  it('should allow ADMIN to approve and unapprove questions via PATCH /api/questions/:id/status', async () => {
    const questionId = uuidv4();
    db.prepare(`
      INSERT INTO questions (id, subject, chapter, topic, difficulty, type, prompt, is_approved, author_id)
      VALUES (?, 'Math', 'Algebra', 'Linear', 'EASY', 'SINGLE_MCQ', 'Solve x: x + 2 = 5', 0, ?)
    `).run(questionId, instructorId);

    // Instructor cannot toggle approval status
    const forbiddenRes = await makeRequest(
      'PATCH',
      `/api/questions/${questionId}/status`,
      { Authorization: `Bearer ${instructorToken}` },
      { isApproved: true }
    );
    expect(forbiddenRes.status).toBe(403);

    // Admin can approve
    const approveRes = await makeRequest(
      'PATCH',
      `/api/questions/${questionId}/status`,
      { Authorization: `Bearer ${adminToken}` },
      { isApproved: true }
    );
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.isApproved).toBe(true);

    const approvedRow: any = db.prepare('SELECT is_approved FROM questions WHERE id = ?').get(questionId);
    expect(approvedRow.is_approved).toBe(1);

    // Admin can unapprove
    const unapproveRes = await makeRequest(
      'PATCH',
      `/api/questions/${questionId}/status`,
      { Authorization: `Bearer ${adminToken}` },
      { isApproved: false }
    );
    expect(unapproveRes.status).toBe(200);
    expect(unapproveRes.body.isApproved).toBe(false);

    const unapprovedRow: any = db.prepare('SELECT is_approved FROM questions WHERE id = ?').get(questionId);
    expect(unapprovedRow.is_approved).toBe(0);
  });

  it('should reject creating a LIVE exam that includes unapproved questions', async () => {
    const unapprovedQId = uuidv4();
    db.prepare(`
      INSERT INTO questions (id, subject, chapter, topic, difficulty, type, prompt, is_approved, author_id)
      VALUES (?, 'Math', 'Geometry', 'Circles', 'MEDIUM', 'SINGLE_MCQ', 'Find radius of circle with area 49pi', 0, ?)
    `).run(unapprovedQId, instructorId);

    db.prepare(`
      INSERT INTO question_options (id, question_id, option_key, text, is_correct, sort_order)
      VALUES (?, ?, 'A', '7', 1, 0), (?, ?, 'B', '14', 0, 1)
    `).run(uuidv4(), unapprovedQId, uuidv4(), unapprovedQId);

    const res = await makeRequest(
      'POST',
      '/api/exams',
      { Authorization: `Bearer ${instructorToken}` },
      {
        title: 'Live Exam with Unapproved Question Test',
        category: 'BANK_RECRUITMENT',
        type: 'MODEL_TEST',
        status: 'LIVE',
        durationMinutes: 30,
        totalMarks: 10,
        passMarks: 4,
        negativeMarkingRate: 0.25,
        allowedAttempts: 1,
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 86400000).toISOString(),
        questionIds: [unapprovedQId]
      }
    );

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('unapproved question');
  });

  it('should allow assigning unapproved questions in DRAFT exams, but block publishing to LIVE until approved', async () => {
    const unapprovedQId = uuidv4();
    db.prepare(`
      INSERT INTO questions (id, subject, chapter, topic, difficulty, type, prompt, is_approved, author_id)
      VALUES (?, 'English', 'Vocab', 'Synonyms', 'EASY', 'SINGLE_MCQ', 'Synonym of candid?', 0, ?)
    `).run(unapprovedQId, instructorId);

    db.prepare(`
      INSERT INTO question_options (id, question_id, option_key, text, is_correct, sort_order)
      VALUES (?, ?, 'A', 'Frank', 1, 0), (?, ?, 'B', 'Deceitful', 0, 1)
    `).run(uuidv4(), unapprovedQId, uuidv4(), unapprovedQId);

    // 1. Can create exam as DRAFT
    const createDraftRes = await makeRequest(
      'POST',
      '/api/exams',
      { Authorization: `Bearer ${instructorToken}` },
      {
        title: 'Draft Exam Assignment Test',
        category: 'BANK_RECRUITMENT',
        type: 'CHAPTER_QUIZ',
        status: 'DRAFT',
        durationMinutes: 15,
        totalMarks: 5,
        passMarks: 2,
        negativeMarkingRate: 0.25,
        allowedAttempts: 1,
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 86400000).toISOString(),
        questionIds: [unapprovedQId]
      }
    );

    expect(createDraftRes.status).toBe(201);
    const examId = createDraftRes.body.examId;

    // 2. Cannot publish DRAFT to LIVE while question is unapproved
    const publishAttemptRes = await makeRequest(
      'PUT',
      `/api/exams/${examId}`,
      { Authorization: `Bearer ${instructorToken}` },
      { status: 'LIVE' }
    );

    expect(publishAttemptRes.status).toBe(400);
    expect(publishAttemptRes.body.error).toContain('is not approved');

    // 3. Admin approves question
    const approveRes = await makeRequest(
      'PATCH',
      `/api/questions/${unapprovedQId}/status`,
      { Authorization: `Bearer ${adminToken}` },
      { isApproved: true }
    );
    expect(approveRes.status).toBe(200);

    // 4. Now publishing to LIVE succeeds
    const publishSuccessRes = await makeRequest(
      'PUT',
      `/api/exams/${examId}`,
      { Authorization: `Bearer ${instructorToken}` },
      { status: 'LIVE' }
    );

    expect(publishSuccessRes.status).toBe(200);
    expect(publishSuccessRes.body.success).toBe(true);

    const examRow: any = db.prepare('SELECT status FROM exams WHERE id = ?').get(examId);
    expect(examRow.status).toBe('LIVE');
  });

  it('should record QUESTION_APPROVED and QUESTION_UNAPPROVED audit logs with actor, resource, and status details', async () => {
    const qId = uuidv4();
    db.prepare(`
      INSERT INTO questions (id, subject, chapter, topic, difficulty, type, prompt, is_approved, author_id)
      VALUES (?, 'Math', 'Percentages', 'Profit', 'EASY', 'SINGLE_MCQ', 'Sample Profit Question', 0, ?)
    `).run(qId, instructorId);

    // Initial audit count for this question
    const initialLogs: any = db.prepare('SELECT COUNT(*) as count FROM audit_logs WHERE resource_id = ?').get(qId);
    expect(initialLogs.count).toBe(0);

    // 1. Admin approves the question -> Should create 1 QUESTION_APPROVED audit log
    const approveRes = await makeRequest(
      'PATCH',
      `/api/questions/${qId}/status`,
      { Authorization: `Bearer ${adminToken}` },
      { isApproved: true }
    );
    expect(approveRes.status).toBe(200);

    const afterApproveLogs: any[] = db.prepare(`
      SELECT * FROM audit_logs WHERE resource_id = ? ORDER BY created_at DESC
    `).all(qId);
    expect(afterApproveLogs.length).toBe(1);
    expect(afterApproveLogs[0].action).toBe('QUESTION_APPROVED');
    expect(afterApproveLogs[0].actor_id).toBe(adminId);
    expect(afterApproveLogs[0].actor_role).toBe('ADMIN');
    expect(afterApproveLogs[0].resource).toBe('QUESTION');

    const approveDetails = JSON.parse(afterApproveLogs[0].details);
    expect(approveDetails.previousApprovalStatus).toBe(false);
    expect(approveDetails.newApprovalStatus).toBe(true);

    // 2. Redundant approval (status unchanged) -> Should NOT create an additional audit log
    const redundantRes = await makeRequest(
      'PATCH',
      `/api/questions/${qId}/status`,
      { Authorization: `Bearer ${adminToken}` },
      { isApproved: true }
    );
    expect(redundantRes.status).toBe(200);
    expect(redundantRes.body.unchanged).toBe(true);

    const afterRedundantLogs: any[] = db.prepare(`
      SELECT * FROM audit_logs WHERE resource_id = ?
    `).all(qId);
    expect(afterRedundantLogs.length).toBe(1);

    // 3. Unauthorized request from instructor -> 403 Forbidden, no new audit log
    const unauthRes = await makeRequest(
      'PATCH',
      `/api/questions/${qId}/status`,
      { Authorization: `Bearer ${instructorToken}` },
      { isApproved: false }
    );
    expect(unauthRes.status).toBe(403);

    const afterUnauthLogs: any[] = db.prepare(`
      SELECT * FROM audit_logs WHERE resource_id = ?
    `).all(qId);
    expect(afterUnauthLogs.length).toBe(1);

    // 4. Invalid validation payload (missing/invalid boolean) -> 400 Bad Request, no new audit log
    const invalidRes = await makeRequest(
      'PATCH',
      `/api/questions/${qId}/status`,
      { Authorization: `Bearer ${adminToken}` },
      { isApproved: 'not_a_boolean' }
    );
    expect(invalidRes.status).toBe(400);

    const afterInvalidLogs: any[] = db.prepare(`
      SELECT * FROM audit_logs WHERE resource_id = ?
    `).all(qId);
    expect(afterInvalidLogs.length).toBe(1);

    // 5. Admin unapproves the question -> Should create 1 QUESTION_UNAPPROVED audit log
    const unapproveRes = await makeRequest(
      'PATCH',
      `/api/questions/${qId}/status`,
      { Authorization: `Bearer ${adminToken}` },
      { isApproved: false }
    );
    expect(unapproveRes.status).toBe(200);

    const finalLogs: any[] = db.prepare(`
      SELECT * FROM audit_logs WHERE resource_id = ? ORDER BY created_at ASC
    `).all(qId);
    expect(finalLogs.length).toBe(2);
    expect(finalLogs[1].action).toBe('QUESTION_UNAPPROVED');
    expect(finalLogs[1].actor_id).toBe(adminId);
    expect(finalLogs[1].actor_role).toBe('ADMIN');

    const unapproveDetails = JSON.parse(finalLogs[1].details);
    expect(unapproveDetails.previousApprovalStatus).toBe(true);
    expect(unapproveDetails.newApprovalStatus).toBe(false);
  });
});

