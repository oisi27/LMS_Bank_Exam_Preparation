import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db, initDatabase } from '../db/schema';
import { adminRouter } from '../routes/admin';
import { examsRouter } from '../routes/exams';
import { config } from '../config/env';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/admin', adminRouter);
app.use('/api/exams', examsRouter);

let server: http.Server;
let serverPort: number;

function makeRequest(
  method: string,
  urlPath: string,
  headers: Record<string, string> = {},
  body?: any
): Promise<{ status: number; body: any; headers: http.IncomingHttpHeaders }> {
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
          resolve({ status: res.statusCode || 0, body: parsed, headers: res.headers });
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

describe('Module 10 Admin Governance: Grade Override & Exam Time Extension Integration Tests', () => {
  const timestamp = Date.now();
  const adminId = `admin_gov_${timestamp}`;
  const instructorId = `inst_gov_${timestamp}`;
  const studentId = `stud_gov_${timestamp}`;

  const examId = `exam_gov_${timestamp}`;
  const attemptGradedId = `att_graded_${timestamp}`;
  const resultGradedId = `res_graded_${timestamp}`;

  const attemptActiveId = `att_active_${timestamp}`;
  const attemptExpiredId = `att_expired_${timestamp}`;

  let adminToken: string;
  let instructorToken: string;
  let studentToken: string;

  beforeAll(async () => {
    initDatabase();

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        serverPort = (server.address() as any).port;
        resolve();
      });
    });

    const adminEmail = `${adminId}@banklms.edu.bd`;
    const instructorEmail = `${instructorId}@banklms.edu.bd`;
    const studentEmail = `${studentId}@banklms.edu.bd`;

    // 1. Insert test users
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, is_active)
      VALUES (?, ?, 'hash', 'Super Admin Governance', 'ADMIN', 1)
    `).run(adminId, adminEmail);

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, is_active)
      VALUES (?, ?, 'hash', 'Instructor Governance', 'INSTRUCTOR', 1)
    `).run(instructorId, instructorEmail);

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, is_active)
      VALUES (?, ?, 'hash', 'Student Governance', 'STUDENT', 1)
    `).run(studentId, studentEmail);

    adminToken = generateToken(adminId, 'ADMIN', adminEmail);
    instructorToken = generateToken(instructorId, 'INSTRUCTOR', instructorEmail);
    studentToken = generateToken(studentId, 'STUDENT', studentEmail);

    // 2. Insert test exam
    const nowIso = new Date().toISOString();
    const futureIso = new Date(Date.now() + 3600000).toISOString();
    db.prepare(`
      INSERT INTO exams (
        id, title, category, type, status, duration_minutes,
        total_marks, pass_marks, negative_marking_rate,
        starts_at, ends_at, result_release_mode, created_by
      ) VALUES (?, 'Governance Certification Exam', 'BANK_RECRUITMENT', 'MODEL_TEST', 'LIVE', 60, 100.0, 50.0, 0.25, ?, ?, 'INSTANT', ?)
    `).run(examId, nowIso, futureIso, instructorId);

    // 3. Insert graded attempt and result (Original score: 45.0, FAILED)
    db.prepare(`
      INSERT INTO attempts (id, exam_id, user_id, status, started_at, submitted_at, expires_at, time_extended_minutes)
      VALUES (?, ?, ?, 'GRADED', ?, ?, ?, 0)
    `).run(attemptGradedId, examId, studentId, nowIso, nowIso, futureIso);

    db.prepare(`
      INSERT INTO exam_results (
        id, attempt_id, exam_id, user_id, score, total_marks,
        correct_count, wrong_count, skipped_count, accuracy_percentage,
        time_spent_seconds, is_passed, is_overridden, original_score, override_reason
      ) VALUES (?, ?, ?, ?, 45.0, 100.0, 45, 10, 5, 45, 1800, 0, 0, NULL, NULL)
    `).run(resultGradedId, attemptGradedId, examId, studentId);

    // 4. Insert active attempt (IN_PROGRESS, expires in 30 minutes)
    const activeExpiresAt = new Date(Date.now() + 1800000).toISOString();
    db.prepare(`
      INSERT INTO attempts (id, exam_id, user_id, status, started_at, expires_at, time_extended_minutes)
      VALUES (?, ?, ?, 'IN_PROGRESS', ?, ?, 0)
    `).run(attemptActiveId, examId, studentId, nowIso, activeExpiresAt);

    // 5. Insert expired attempt (ended 1 hour ago)
    const pastStarted = new Date(Date.now() - 7200000).toISOString();
    const pastExpires = new Date(Date.now() - 3600000).toISOString();
    db.prepare(`
      INSERT INTO attempts (id, exam_id, user_id, status, started_at, expires_at, time_extended_minutes)
      VALUES (?, ?, ?, 'AUTO_SUBMITTED', ?, ?, 0)
    `).run(attemptExpiredId, examId, studentId, pastStarted, pastExpires);
  });

  afterAll(async () => {
    // Clean up test records
    try {
      db.prepare('DELETE FROM audit_logs WHERE actor_id = ?').run(adminId);
      db.prepare('DELETE FROM exam_results WHERE id = ?').run(resultGradedId);
      db.prepare('DELETE FROM attempts WHERE id IN (?, ?, ?)').run(attemptGradedId, attemptActiveId, attemptExpiredId);
      db.prepare('DELETE FROM exams WHERE id = ?').run(examId);
      db.prepare('DELETE FROM users WHERE id IN (?, ?, ?)').run(adminId, instructorId, studentId);
    } catch {}

    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  // ==========================================
  // Task A: Admin Grade Override Tests
  // ==========================================

  it('1. GET /api/admin/grade-override/attempts: Admin retrieves graded attempts with full metadata', async () => {
    const res = await makeRequest('GET', `/api/admin/grade-override/attempts?examId=${examId}`, {
      Authorization: `Bearer ${adminToken}`
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    const found = res.body.data.find((r: any) => r.attempt_id === attemptGradedId);
    expect(found).toBeDefined();
    expect(found.student_id).toBe(studentId);
    expect(found.current_score).toBe(45.0);
    expect(found.is_overridden).toBe(0);
    expect(found.is_passed).toBe(0);
  });

  it('2. POST /api/admin/grade-override: Rejects unauthenticated or non-admin users', async () => {
    // Unauthenticated
    const unauthRes = await makeRequest('POST', '/api/admin/grade-override', {}, {
      attemptId: attemptGradedId,
      correctedScore: 55.0,
      reason: 'Should fail unauthenticated'
    });
    expect(unauthRes.status).toBe(401);

    // Student role
    const studentRes = await makeRequest('POST', '/api/admin/grade-override', {
      Authorization: `Bearer ${studentToken}`
    }, {
      attemptId: attemptGradedId,
      correctedScore: 55.0,
      reason: 'Student override attempt'
    });
    expect(studentRes.status).toBe(403);

    // Instructor role
    const instructorRes = await makeRequest('POST', '/api/admin/grade-override', {
      Authorization: `Bearer ${instructorToken}`
    }, {
      attemptId: attemptGradedId,
      correctedScore: 55.0,
      reason: 'Instructor override attempt'
    });
    expect(instructorRes.status).toBe(403);
  });

  it('3. POST /api/admin/grade-override: Validates score range and mandatory reason', async () => {
    // Negative score
    const negativeRes = await makeRequest('POST', '/api/admin/grade-override', {
      Authorization: `Bearer ${adminToken}`
    }, {
      attemptId: attemptGradedId,
      correctedScore: -5.0,
      reason: 'Valid justification reason'
    });
    expect(negativeRes.status).toBe(400);

    // Score above total marks (100)
    const overScoreRes = await makeRequest('POST', '/api/admin/grade-override', {
      Authorization: `Bearer ${adminToken}`
    }, {
      attemptId: attemptGradedId,
      correctedScore: 105.0,
      reason: 'Valid justification reason'
    });
    expect(overScoreRes.status).toBe(400);

    // Reason too short (< 5 chars)
    const shortReasonRes = await makeRequest('POST', '/api/admin/grade-override', {
      Authorization: `Bearer ${adminToken}`
    }, {
      attemptId: attemptGradedId,
      correctedScore: 55.0,
      reason: 'bad'
    });
    expect(shortReasonRes.status).toBe(400);
  });

  it('4. POST /api/admin/grade-override: Successfully overrides grade, preserves original machine score, updates pass status, and logs audit', async () => {
    const overrideRes = await makeRequest('POST', '/api/admin/grade-override', {
      Authorization: `Bearer ${adminToken}`
    }, {
      attemptId: attemptGradedId,
      correctedScore: 55.0,
      reason: 'Awarded 10 compensation marks for contested question #3'
    });

    expect(overrideRes.status).toBe(200);
    expect(overrideRes.body.success).toBe(true);
    expect(overrideRes.body.result.score).toBe(55.0);
    expect(overrideRes.body.result.originalScore).toBe(45.0);
    expect(overrideRes.body.result.isOverridden).toBe(true);
    expect(overrideRes.body.result.isPassed).toBe(true); // 55 >= pass_marks 50
    expect(overrideRes.body.result.overrideReason).toBe('Awarded 10 compensation marks for contested question #3');

    // Verify database record
    const dbRow: any = db.prepare('SELECT * FROM exam_results WHERE attempt_id = ?').get(attemptGradedId);
    expect(dbRow.score).toBe(55.0);
    expect(dbRow.original_score).toBe(45.0);
    expect(dbRow.is_overridden).toBe(1);
    expect(dbRow.is_passed).toBe(1);

    // Verify audit log entry
    const auditRow: any = db.prepare(`
      SELECT * FROM audit_logs WHERE action = 'GRADE_OVERRIDE' AND resource_id = ?
    `).get(resultGradedId);
    expect(auditRow).toBeDefined();
    expect(auditRow.actor_id).toBe(adminId);
    const details = JSON.parse(auditRow.details);
    expect(details.originalMachineScore).toBe(45.0);
    expect(details.newCorrectedScore).toBe(55.0);
    expect(details.reason).toContain('Awarded 10 compensation marks');
  });

  it('5. POST /api/admin/grade-override: Consecutive override updates effective score while retaining the initial machine score', async () => {
    const secondOverrideRes = await makeRequest('POST', '/api/admin/grade-override', {
      Authorization: `Bearer ${adminToken}`
    }, {
      attemptId: attemptGradedId,
      correctedScore: 52.0,
      reason: 'Recalibrated marks after committee consultation'
    });

    expect(secondOverrideRes.status).toBe(200);
    expect(secondOverrideRes.body.result.score).toBe(52.0);
    expect(secondOverrideRes.body.result.originalScore).toBe(45.0); // original score remains 45.0!

    const dbRow: any = db.prepare('SELECT * FROM exam_results WHERE attempt_id = ?').get(attemptGradedId);
    expect(dbRow.score).toBe(52.0);
    expect(dbRow.original_score).toBe(45.0);
  });

  // ==========================================
  // Task B: Admin Exam Time Extension Tests
  // ==========================================

  it('6. POST /api/admin/time-extension: Rejects unauthenticated, student, and instructor roles', async () => {
    // Unauthenticated
    const unauthRes = await makeRequest('POST', '/api/admin/time-extension', {}, {
      attemptId: attemptActiveId,
      additionalMinutes: 15,
      reason: 'Extra time granted'
    });
    expect(unauthRes.status).toBe(401);

    // Student
    const studentRes = await makeRequest('POST', '/api/admin/time-extension', {
      Authorization: `Bearer ${studentToken}`
    }, {
      attemptId: attemptActiveId,
      additionalMinutes: 15,
      reason: 'Extra time granted'
    });
    expect(studentRes.status).toBe(403);

    // Instructor
    const instRes = await makeRequest('POST', '/api/admin/time-extension', {
      Authorization: `Bearer ${instructorToken}`
    }, {
      attemptId: attemptActiveId,
      additionalMinutes: 15,
      reason: 'Extra time granted'
    });
    expect(instRes.status).toBe(403);
  });

  it('7. POST /api/admin/time-extension: Rejects non-active (SUBMITTED/AUTO_SUBMITTED) attempts', async () => {
    const expiredRes = await makeRequest('POST', '/api/admin/time-extension', {
      Authorization: `Bearer ${adminToken}`
    }, {
      attemptId: attemptExpiredId,
      additionalMinutes: 15,
      reason: 'Attempting to extend closed attempt'
    });

    expect(expiredRes.status).toBe(400);
    expect(expiredRes.body.error).toContain("not 'IN_PROGRESS'");
  });

  it('8. POST /api/admin/time-extension: Successfully extends active attempt expiry, increments time_extended_minutes, and records audit trail', async () => {
    const beforeAttempt: any = db.prepare('SELECT expires_at, time_extended_minutes FROM attempts WHERE id = ?').get(attemptActiveId);
    const beforeExpiryMs = new Date(beforeAttempt.expires_at).getTime();

    const extendRes = await makeRequest('POST', '/api/admin/time-extension', {
      Authorization: `Bearer ${adminToken}`
    }, {
      attemptId: attemptActiveId,
      additionalMinutes: 20,
      reason: 'Power outage compensation during live exam'
    });

    expect(extendRes.status).toBe(200);
    expect(extendRes.body.success).toBe(true);
    expect(extendRes.body.data.additionalMinutes).toBe(20);
    expect(extendRes.body.data.totalExtendedMinutes).toBe(20);

    const afterAttempt: any = db.prepare('SELECT expires_at, time_extended_minutes FROM attempts WHERE id = ?').get(attemptActiveId);
    const afterExpiryMs = new Date(afterAttempt.expires_at).getTime();

    // Verify expiry was pushed by approximately 20 minutes (1,200,000 ms)
    const diffMs = afterExpiryMs - beforeExpiryMs;
    expect(diffMs).toBeGreaterThanOrEqual(1199000);
    expect(diffMs).toBeLessThanOrEqual(1201000);
    expect(afterAttempt.time_extended_minutes).toBe(20);

    // Verify audit log
    const auditRow: any = db.prepare(`
      SELECT * FROM audit_logs WHERE action = 'EXAM_TIME_EXTENDED' AND resource_id = ?
    `).get(attemptActiveId);
    expect(auditRow).toBeDefined();
    expect(auditRow.actor_id).toBe(adminId);
    const details = JSON.parse(auditRow.details);
    expect(details.additionalMinutes).toBe(20);
    expect(details.reason).toContain('Power outage compensation');
  });

  it('9. GET /api/exams/attempts/:attemptId: Student endpoint returns updated authoritative expiry', async () => {
    const studentAttemptRes = await makeRequest('GET', `/api/exams/attempts/${attemptActiveId}`, {
      Authorization: `Bearer ${studentToken}`
    });

    expect(studentAttemptRes.status).toBe(200);
    expect(studentAttemptRes.body.success).toBe(true);
    expect(studentAttemptRes.body.attempt.status).toBe('IN_PROGRESS');
    expect(studentAttemptRes.body.attempt.expiresAt).toBeDefined();

    const dbAttempt: any = db.prepare('SELECT expires_at FROM attempts WHERE id = ?').get(attemptActiveId);
    expect(studentAttemptRes.body.attempt.expiresAt).toBe(dbAttempt.expires_at);
  });
});
