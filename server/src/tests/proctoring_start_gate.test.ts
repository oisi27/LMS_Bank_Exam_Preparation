import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import express from 'express';
import { db, initDatabase } from '../db/schema';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { v4 as uuidv4 } from 'uuid';
import { examsRouter } from '../routes/exams';
import { ensureActiveDemoExam, DEMO_CORRECTED_EXAM_ID, DEMO_ACTIVE_EXAM_ID } from '../db/seed';

const app = express();
app.use(express.json());
app.use('/api/exams', examsRouter);

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

describe('Pre-Exam Rules, Fullscreen Gate & Proctoring Verification Tests', () => {
  let studentId: string;
  let studentToken: string;

  beforeAll(async () => {
    initDatabase();
    ensureActiveDemoExam();

    studentId = uuidv4();
    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role)
      VALUES (?, ?, ?, 'hash123', 'STUDENT')
    `).run(studentId, 'Proctoring Gate Student', `proctoring_student_${Date.now()}@example.com`);

    studentToken = jwt.sign(
      { id: studentId, email: `proctoring_student_${Date.now()}@example.com`, role: 'STUDENT', name: 'Proctoring Gate Student' },
      config.JWT_SECRET
    );

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        serverPort = addr.port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (studentId) {
      db.prepare('DELETE FROM exam_violations WHERE attempt_id IN (SELECT id FROM attempts WHERE user_id = ?)').run(studentId);
      db.prepare('DELETE FROM attempt_answers WHERE attempt_id IN (SELECT id FROM attempts WHERE user_id = ?)').run(studentId);
      db.prepare('DELETE FROM exam_results WHERE user_id = ?').run(studentId);
      db.prepare('DELETE FROM attempts WHERE user_id = ?').run(studentId);
      db.prepare('DELETE FROM users WHERE id = ?').run(studentId);
    }
  });

  it('1. Opening pre-exam warning (fetching exam metadata) does not create an attempt', async () => {
    const attemptsBefore = (db.prepare('SELECT COUNT(*) as c FROM attempts WHERE user_id = ?').get(studentId) as any).c;

    const res = await makeRequest('GET', `/api/exams/${DEMO_CORRECTED_EXAM_ID}`, {
      Authorization: `Bearer ${studentToken}`
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.exam).toBeDefined();
    expect(res.body.exam.title).toBeDefined();

    const attemptsAfter = (db.prepare('SELECT COUNT(*) as c FROM attempts WHERE user_id = ?').get(studentId) as any).c;
    expect(attemptsAfter).toBe(attemptsBefore);
  });

  it('2. Cancelling from pre-exam screen does not create an attempt', async () => {
    // When the user clicks Cancel, the client simply returns to the dashboard without hitting /start
    const attempts = (db.prepare('SELECT COUNT(*) as c FROM attempts WHERE user_id = ?').get(studentId) as any).c;
    expect(attempts).toBe(0);
  });

  it('3. Successful confirmation starts the exam and creates exactly one attempt', async () => {
    const res = await makeRequest('POST', `/api/exams/${DEMO_CORRECTED_EXAM_ID}/start`, {
      Authorization: `Bearer ${studentToken}`
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.attemptId).toBeDefined();
    expect(res.body.expiresAt).toBeDefined();
    expect(res.body.questions).toBeDefined();

    const attempts = (db.prepare('SELECT COUNT(*) as c FROM attempts WHERE user_id = ?').get(studentId) as any).c;
    expect(attempts).toBe(1);
  });

  it('4. Repeated confirmation resumes active in-progress attempt without creating duplicates', async () => {
    const attemptsBefore = (db.prepare('SELECT COUNT(*) as c FROM attempts WHERE user_id = ?').get(studentId) as any).c;

    const res2 = await makeRequest('POST', `/api/exams/${DEMO_CORRECTED_EXAM_ID}/start`, {
      Authorization: `Bearer ${studentToken}`
    });

    expect(res2.status).toBe(200);
    expect(res2.body.success).toBe(true);

    const attemptsAfter = (db.prepare('SELECT COUNT(*) as c FROM attempts WHERE user_id = ?').get(studentId) as any).c;
    expect(attemptsAfter).toBe(attemptsBefore);
  });

  it('5. Timer remains server-authoritative and does not reset or extend on resume', async () => {
    const activeAttempt: any = db.prepare(`
      SELECT started_at, expires_at FROM attempts WHERE user_id = ? AND status = 'IN_PROGRESS'
    `).get(studentId);

    const res = await makeRequest('POST', `/api/exams/${DEMO_CORRECTED_EXAM_ID}/start`, {
      Authorization: `Bearer ${studentToken}`
    });

    expect(res.status).toBe(200);
    expect(res.body.expiresAt).toBe(activeAttempt.expires_at);
  });

  it('6. One TAB_SWITCH and one FULLSCREEN_EXIT occurring together count as one strike', async () => {
    const activeAttempt: any = db.prepare(`
      SELECT id FROM attempts WHERE user_id = ? AND status = 'IN_PROGRESS'
    `).get(studentId);

    // First event: FULLSCREEN_EXIT
    const res1 = await makeRequest('POST', '/api/exams/violations', {
      Authorization: `Bearer ${studentToken}`
    }, {
      attemptId: activeAttempt.id,
      violationType: 'FULLSCREEN_EXIT',
      details: { reason: 'Exited exam fullscreen mode.' }
    });

    expect(res1.status).toBe(200);
    expect(res1.body.success).toBe(true);
    expect(res1.body.logged).toBe(true);
    expect(res1.body.totalViolations).toBe(1);

    // Companion event within 3 seconds: TAB_SWITCH
    const res2 = await makeRequest('POST', '/api/exams/violations', {
      Authorization: `Bearer ${studentToken}`
    }, {
      attemptId: activeAttempt.id,
      violationType: 'TAB_SWITCH',
      details: { reason: 'Switched away to another browser tab.' }
    });

    expect(res2.status).toBe(200);
    expect(res2.body.success).toBe(true);
    expect(res2.body.correlated).toBe(true);
    // Strike count remains 1, not 2
    expect(res2.body.totalViolations).toBe(1);

    // Verify both are present in the audit log for forensic transparency
    const violations = db.prepare(`
      SELECT * FROM exam_violations WHERE attempt_id = ?
    `).all(activeAttempt.id) as any[];
    expect(violations.length).toBe(2);
  });

  it('7. Same-type duplicates within 2 seconds are not double-counted', async () => {
    const activeAttempt: any = db.prepare(`
      SELECT id FROM attempts WHERE user_id = ? AND status = 'IN_PROGRESS'
    `).get(studentId);

    // Repeated TAB_SWITCH within 2s
    const res = await makeRequest('POST', '/api/exams/violations', {
      Authorization: `Bearer ${studentToken}`
    }, {
      attemptId: activeAttempt.id,
      violationType: 'TAB_SWITCH',
      details: { reason: 'Switched away again rapidly.' }
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.logged).toBe(false);
    expect(res.body.totalViolations).toBe(1);
  });

  it('8. Genuine separate violations count independently and trigger AUTO_SUBMITTED at threshold', async () => {
    const activeAttempt: any = db.prepare(`
      SELECT id FROM attempts WHERE user_id = ? AND status = 'IN_PROGRESS'
    `).get(studentId);

    // Strike 2: Disallowed shortcut attempt (distinct non-navigation type)
    const res2 = await makeRequest('POST', '/api/exams/violations', {
      Authorization: `Bearer ${studentToken}`
    }, {
      attemptId: activeAttempt.id,
      violationType: 'SHORTCUT_ATTEMPT',
      details: { reason: 'Unauthorized shortcut blocked (Ctrl+C).' }
    });

    expect(res2.status).toBe(200);
    expect(res2.body.logged).toBe(true);
    expect(res2.body.totalViolations).toBe(2);
    expect(res2.body.isTerminated).toBe(false);

    // Strike 3: Right-click context menu (distinct non-navigation type) meeting max limit 3
    const res3 = await makeRequest('POST', '/api/exams/violations', {
      Authorization: `Bearer ${studentToken}`
    }, {
      attemptId: activeAttempt.id,
      violationType: 'CONTEXT_MENU',
      details: { reason: 'Attempted right-click during live exam.' }
    });

    expect(res3.status).toBe(200);
    expect(res3.body.logged).toBe(true);
    expect(res3.body.totalViolations).toBe(3);
    expect(res3.body.isTerminated).toBe(true);

    const updatedAttempt: any = db.prepare('SELECT status FROM attempts WHERE id = ?').get(activeAttempt.id);
    expect(updatedAttempt.status).toBe('AUTO_SUBMITTED');
  });

  it('8b. Concurrent violation requests are handled safely by db.transaction without exceeding or double-submitting', async () => {
    const concurrentUserId = uuidv4();
    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role)
      VALUES (?, ?, ?, 'hash', 'STUDENT')
    `).run(concurrentUserId, 'Concurrent Student', `concurrent_${Date.now()}@example.com`);

    const concurrentToken = jwt.sign(
      { id: concurrentUserId, email: `concurrent_${Date.now()}@example.com`, role: 'STUDENT' },
      config.JWT_SECRET
    );

    const startRes = await makeRequest('POST', `/api/exams/${DEMO_CORRECTED_EXAM_ID}/start`, {
      Authorization: `Bearer ${concurrentToken}`
    });
    const cAttemptId = startRes.body.attemptId;

    // Send 3 concurrent violations simultaneously
    const promises = [
      makeRequest('POST', '/api/exams/violations', { Authorization: `Bearer ${concurrentToken}` }, { attemptId: cAttemptId, violationType: 'FULLSCREEN_EXIT', details: { reason: 'Concurrent exit' } }),
      makeRequest('POST', '/api/exams/violations', { Authorization: `Bearer ${concurrentToken}` }, { attemptId: cAttemptId, violationType: 'TAB_SWITCH', details: { reason: 'Concurrent tab' } }),
      makeRequest('POST', '/api/exams/violations', { Authorization: `Bearer ${concurrentToken}` }, { attemptId: cAttemptId, violationType: 'SHORTCUT_ATTEMPT', details: { reason: 'Concurrent shortcut' } })
    ];

    const results = await Promise.all(promises);
    for (const r of results) {
      expect(r.status).toBe(200);
      expect(r.body.success).toBe(true);
    }

    // Co-navigation FULLSCREEN_EXIT + TAB_SWITCH should count as 1, plus SHORTCUT_ATTEMPT = 2 strikes total
    const latestAttempt: any = db.prepare('SELECT status FROM attempts WHERE id = ?').get(cAttemptId);
    expect(latestAttempt.status).toBe('IN_PROGRESS'); // 2 strikes < 3 limit

    // Clean up concurrent user
    db.prepare('DELETE FROM exam_violations WHERE attempt_id = ?').run(cAttemptId);
    db.prepare('DELETE FROM attempts WHERE id = ?').run(cAttemptId);
    db.prepare('DELETE FROM users WHERE id = ?').run(concurrentUserId);
  });

  it('9. Existing answer selection, submit, and results remain fully functional', async () => {
    // Start a clean attempt for submission verification
    const freshUserId = uuidv4();
    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role)
      VALUES (?, ?, ?, 'hash', 'STUDENT')
    `).run(freshUserId, 'Fresh Candidate', `fresh_candidate_${Date.now()}@example.com`);

    const freshToken = jwt.sign(
      { id: freshUserId, email: `fresh_candidate_${Date.now()}@example.com`, role: 'STUDENT' },
      config.JWT_SECRET
    );

    const startRes = await makeRequest('POST', `/api/exams/${DEMO_CORRECTED_EXAM_ID}/start`, {
      Authorization: `Bearer ${freshToken}`
    });
    expect(startRes.status).toBe(200);
    const freshAttemptId = startRes.body.attemptId;
    const firstQ = startRes.body.questions[0];

    // Autosave answer
    const autosaveRes = await makeRequest('POST', '/api/exams/autosave', {
      Authorization: `Bearer ${freshToken}`
    }, {
      attemptId: freshAttemptId,
      questionId: firstQ.id,
      selectedOptionIds: [firstQ.options[0].id],
      isMarkedForReview: false,
      clientSequence: 1
    });
    expect(autosaveRes.status).toBe(200);

    // Submit attempt
    const submitRes = await makeRequest('POST', `/api/exams/${freshAttemptId}/submit`, {
      Authorization: `Bearer ${freshToken}`
    });
    expect(submitRes.status).toBe(200);
    expect(submitRes.body.success).toBe(true);
    expect(submitRes.body.grade).toBeDefined();

    // Verify result saved in exam_results
    const savedResult = db.prepare('SELECT * FROM exam_results WHERE attempt_id = ?').get(freshAttemptId) as any;
    expect(savedResult).toBeDefined();
    expect(savedResult.score).toBeDefined();

    // Clean up fresh test user
    db.prepare('DELETE FROM exam_violations WHERE attempt_id = ?').run(freshAttemptId);
    db.prepare('DELETE FROM attempt_answers WHERE attempt_id = ?').run(freshAttemptId);
    db.prepare('DELETE FROM exam_results WHERE attempt_id = ?').run(freshAttemptId);
    db.prepare('DELETE FROM attempts WHERE id = ?').run(freshAttemptId);
    db.prepare('DELETE FROM users WHERE id = ?').run(freshUserId);
  });
});
