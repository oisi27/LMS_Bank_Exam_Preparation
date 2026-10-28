import { describe, it, expect, beforeAll } from 'vitest';
import http from 'http';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db, initDatabase } from '../db/schema';
import { authRouter } from '../routes/auth';
import { dashboardRouter } from '../routes/dashboard';
import { config } from '../config/env';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRouter);
app.use('/api/dashboard', dashboardRouter);

let serverPort: number;

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

function generateToken(userId: string, role: string = 'STUDENT') {
  return jwt.sign(
    { id: userId, email: `${userId}@test.local`, role, name: `Student ${userId}` },
    config.JWT_SECRET || 'test_jwt_secret_bank_lms_super_secure_key_fall_2026',
    { expiresIn: '1h' }
  );
}

describe('Phase 1: Personalized Student Preparation Goal Suite', () => {
  const student1Id = `stud_goal_1_${Date.now()}`;
  const student2Id = `stud_goal_2_${Date.now()}`;
  const instructorId = `inst_goal_${Date.now()}`;

  let student1Token: string;
  let student2Token: string;
  let instructorToken: string;

  beforeAll(async () => {
    initDatabase();

    await new Promise<void>((resolve) => {
      const server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        serverPort = addr.port;
        resolve();
      });
    });

    // Seed test users in test database
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, is_active, target_exam, target_date)
      VALUES (?, ?, 'hash', 'Student One', 'STUDENT', 1, 'Bangladesh Bank Assistant Director', '2026-12-31')
    `).run(student1Id, `${student1Id}@test.local`);

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, is_active)
      VALUES (?, ?, 'hash', 'Student Two', 'STUDENT', 1)
    `).run(student2Id, `${student2Id}@test.local`);

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, is_active)
      VALUES (?, ?, 'hash', 'Instructor One', 'INSTRUCTOR', 1)
    `).run(instructorId, `${instructorId}@test.local`);

    student1Token = generateToken(student1Id, 'STUDENT');
    student2Token = generateToken(student2Id, 'STUDENT');
    instructorToken = generateToken(instructorId, 'INSTRUCTOR');
  });

  it('1. Rejects goal updates from non-student accounts (INSTRUCTOR/ADMIN)', async () => {
    const res = await makeRequest(
      'PUT',
      '/api/auth/goal',
      { targetBank: 'Bangladesh Bank', targetPosition: 'Assistant Director' },
      { Authorization: `Bearer ${instructorToken}` }
    );
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('student candidate accounts');
  });

  it('2. Validates target bank and position requirements', async () => {
    const resEmptyBank = await makeRequest(
      'PUT',
      '/api/auth/goal',
      { targetBank: '', targetPosition: 'Assistant Director' },
      { Authorization: `Bearer ${student2Token}` }
    );
    expect(resEmptyBank.status).toBe(400);
    expect(resEmptyBank.body.success).toBe(false);

    const resEmptyPos = await makeRequest(
      'PUT',
      '/api/auth/goal',
      { targetBank: 'Sonali Bank', targetPosition: ' ' },
      { Authorization: `Bearer ${student2Token}` }
    );
    expect(resEmptyPos.status).toBe(400);
    expect(resEmptyPos.body.success).toBe(false);

    const resInvalidDate = await makeRequest(
      'PUT',
      '/api/auth/goal',
      { targetBank: 'Sonali Bank', targetPosition: 'Officer Cash', targetDate: '12-31-2026' },
      { Authorization: `Bearer ${student2Token}` }
    );
    expect(resInvalidDate.status).toBe(400);
    expect(resInvalidDate.body.success).toBe(false);
  });

  it('3. Successfully saves and updates student goal with custom institution and position', async () => {
    const res = await makeRequest(
      'PUT',
      '/api/auth/goal',
      {
        targetBank: 'Agrani Bank',
        targetPosition: 'Senior Officer',
        targetDate: '2026-11-20'
      },
      { Authorization: `Bearer ${student2Token}` }
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.goal.targetBank).toBe('Agrani Bank');
    expect(res.body.goal.targetPosition).toBe('Senior Officer');
    expect(res.body.goal.targetExam).toBe('Agrani Bank Senior Officer');
    expect(res.body.goal.targetDate).toBe('2026-11-20');
    expect(typeof res.body.goal.daysRemaining).toBe('number');
  });

  it('4. Confirms two students have completely independent goal data', async () => {
    // Set Student 1 to Bangladesh Bank AD
    await makeRequest(
      'PUT',
      '/api/auth/goal',
      {
        targetBank: 'Bangladesh Bank',
        targetPosition: 'Assistant Director',
        targetDate: '2026-12-15'
      },
      { Authorization: `Bearer ${student1Token}` }
    );

    // Fetch student 1 summary
    const summary1 = await makeRequest(
      'GET',
      '/api/dashboard/student-summary',
      undefined,
      { Authorization: `Bearer ${student1Token}` }
    );

    // Fetch student 2 summary
    const summary2 = await makeRequest(
      'GET',
      '/api/dashboard/student-summary',
      undefined,
      { Authorization: `Bearer ${student2Token}` }
    );

    expect(summary1.status).toBe(200);
    expect(summary2.status).toBe(200);

    expect(summary1.body.goal.targetBank).toBe('Bangladesh Bank');
    expect(summary1.body.goal.targetPosition).toBe('Assistant Director');
    expect(summary1.body.goal.targetDate).toBe('2026-12-15');

    expect(summary2.body.goal.targetBank).toBe('Agrani Bank');
    expect(summary2.body.goal.targetPosition).toBe('Senior Officer');
    expect(summary2.body.goal.targetDate).toBe('2026-11-20');
  });

  it('5. Confirms persistence across /me endpoint and database reloads', async () => {
    const meRes = await makeRequest(
      'GET',
      '/api/auth/me',
      undefined,
      { Authorization: `Bearer ${student1Token}` }
    );

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.targetBank).toBe('Bangladesh Bank');
    expect(meRes.body.user.targetPosition).toBe('Assistant Director');
    expect(meRes.body.user.targetDate).toBe('2026-12-15');

    // Verify directly from SQLite
    const row: any = db.prepare('SELECT target_bank, target_position, target_date, target_exam FROM users WHERE id = ?').get(student1Id);
    expect(row.target_bank).toBe('Bangladesh Bank');
    expect(row.target_position).toBe('Assistant Director');
    expect(row.target_date).toBe('2026-12-15');
    expect(row.target_exam).toBe('Bangladesh Bank Assistant Director');
  });

  it('6. Backward compatibility: Fallback parsing for legacy students without target_bank', async () => {
    const legacyStudentId = `legacy_stud_${Date.now()}`;
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, is_active, target_exam, target_date)
      VALUES (?, ?, 'hash', 'Legacy Student', 'STUDENT', 1, 'Bangladesh Bank Assistant Director', '2026-10-30')
    `).run(legacyStudentId, `${legacyStudentId}@test.local`);

    const legacyToken = generateToken(legacyStudentId, 'STUDENT');

    const summary = await makeRequest(
      'GET',
      '/api/dashboard/student-summary',
      undefined,
      { Authorization: `Bearer ${legacyToken}` }
    );

    expect(summary.status).toBe(200);
    expect(summary.body.goal.targetBank).toBe('Bangladesh Bank');
    expect(summary.body.goal.targetPosition).toBe('Assistant Director');
    expect(summary.body.goal.targetDate).toBe('2026-10-30');
    expect(typeof summary.body.goal.daysRemaining).toBe('number');
  });

  it('7. Onboarding completion: Allows authenticated student to set target bank, position, and exam date', async () => {
    const onboardStudentId = `onboard_stud_${Date.now()}`;
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, is_active)
      VALUES (?, ?, 'hash', 'Onboard Student', 'STUDENT', 1)
    `).run(onboardStudentId, `${onboardStudentId}@test.local`);

    const onboardToken = generateToken(onboardStudentId, 'STUDENT');

    const onboardRes = await makeRequest(
      'POST',
      '/api/auth/onboarding',
      {
        targetBank: 'Sonali Bank',
        targetPosition: 'Officer (General)',
        targetDate: '2026-12-25'
      },
      { Authorization: `Bearer ${onboardToken}` }
    );

    expect(onboardRes.status).toBe(200);
    expect(onboardRes.body.success).toBe(true);
    expect(onboardRes.body.user.targetBank).toBe('Sonali Bank');
    expect(onboardRes.body.user.targetPosition).toBe('Officer (General)');
    expect(onboardRes.body.user.targetDate).toBe('2026-12-25');
    expect(onboardRes.body.user.targetExam).toBe('Sonali Bank Officer (General)');

    // Verify database row
    const row: any = db.prepare('SELECT target_bank, target_position, target_date, target_exam FROM users WHERE id = ?').get(onboardStudentId);
    expect(row.target_bank).toBe('Sonali Bank');
    expect(row.target_position).toBe('Officer (General)');
    expect(row.target_date).toBe('2026-12-25');
  });
});
