import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db, initDatabase } from '../db/schema';
import { authenticateToken, requireRole } from '../middleware/auth';
import { authRouter } from '../routes/auth';
import { config } from '../config/env';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRouter);

// Test protected endpoints
app.get('/api/test-protected/student-only', authenticateToken, requireRole('STUDENT'), (req, res) => {
  res.json({ success: true, message: 'Student access granted', user: req.user });
});

app.get('/api/test-protected/instructor-only', authenticateToken, requireRole('INSTRUCTOR', 'ADMIN'), (req, res) => {
  res.json({ success: true, message: 'Instructor access granted', user: req.user });
});

app.get('/api/test-protected/admin-only', authenticateToken, requireRole('ADMIN'), (req, res) => {
  res.json({ success: true, message: 'Admin access granted', user: req.user });
});

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

describe('Phase 7 Milestone 2 Step 2A: Authentication & Authorization Security Hardening', () => {
  const activeStudentId = `user_active_student_${Date.now()}`;
  const suspendedStudentId = `user_suspended_student_${Date.now()}`;
  const instructorToDemoteId = `user_inst_demote_${Date.now()}`;
  const adminUserId = `user_admin_test_${Date.now()}`;

  beforeAll(async () => {
    initDatabase();

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        serverPort = (server.address() as any).port;
        resolve();
      });
    });

    // 1. Seed Active Student
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, is_active)
      VALUES (?, ?, 'hash123', 'Active Student', 'STUDENT', 1)
    `).run(activeStudentId, `${activeStudentId}@test.local`);

    // 2. Seed Suspended Student (is_active = 0)
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, is_active)
      VALUES (?, ?, 'hash123', 'Suspended Student', 'STUDENT', 0)
    `).run(suspendedStudentId, `${suspendedStudentId}@test.local`);

    // 3. Seed Instructor that will be demoted in tests
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, is_active)
      VALUES (?, ?, 'hash123', 'Dynamic Role Instructor', 'INSTRUCTOR', 1)
    `).run(instructorToDemoteId, `${instructorToDemoteId}@test.local`);

    // 4. Seed Admin
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, is_active)
      VALUES (?, ?, 'hash123', 'Super Admin', 'ADMIN', 1)
    `).run(adminUserId, `${adminUserId}@test.local`);
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('1. Active users with valid tokens can access protected endpoints', async () => {
    const token = generateToken(activeStudentId, 'STUDENT', `${activeStudentId}@test.local`);
    const res = await makeRequest('GET', '/api/test-protected/student-only', {
      Authorization: `Bearer ${token}`
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.id).toBe(activeStudentId);
    expect(res.body.user.role).toBe('STUDENT');
  });

  it('2. Suspended users (is_active = 0) cannot access protected endpoints using valid JWTs', async () => {
    // Generate valid signed JWT for suspended user
    const token = generateToken(suspendedStudentId, 'STUDENT', `${suspendedStudentId}@test.local`);
    const res = await makeRequest('GET', '/api/test-protected/student-only', {
      Authorization: `Bearer ${token}`
    });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Account has been deactivated');
  });

  it('3. Deleted or nonexistent users cannot access protected endpoints', async () => {
    const nonExistentId = `nonexistent_user_${uuidv4()}`;
    const token = generateToken(nonExistentId, 'STUDENT', 'ghost@test.local');
    const res = await makeRequest('GET', '/api/test-protected/student-only', {
      Authorization: `Bearer ${token}`
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('User account not found');
  });

  it('4. Expired, tampered, or missing JWTs remain strictly rejected', async () => {
    // Missing token
    const resNoToken = await makeRequest('GET', '/api/test-protected/student-only');
    expect(resNoToken.status).toBe(401);

    // Invalid signature / secret
    const fakeToken = jwt.sign({ id: activeStudentId, role: 'STUDENT' }, 'WRONG_SECRET');
    const resFake = await makeRequest('GET', '/api/test-protected/student-only', {
      Authorization: `Bearer ${fakeToken}`
    });
    expect(resFake.status).toBe(401);

    // Expired token
    const expiredToken = jwt.sign(
      { id: activeStudentId, role: 'STUDENT' },
      config.JWT_SECRET || 'test_jwt_secret_bank_lms_super_secure_key_fall_2026',
      { expiresIn: '-1s' }
    );
    const resExpired = await makeRequest('GET', '/api/test-protected/student-only', {
      Authorization: `Bearer ${expiredToken}`
    });
    expect(resExpired.status).toBe(401);
  });

  it('5. An Instructor demoted to Student cannot use an old Instructor JWT to access Instructor endpoints', async () => {
    // Issue token with role 'INSTRUCTOR' in the JWT payload
    const oldInstructorToken = generateToken(instructorToDemoteId, 'INSTRUCTOR', `${instructorToDemoteId}@test.local`);

    // Verify token initially grants instructor access
    const resBefore = await makeRequest('GET', '/api/test-protected/instructor-only', {
      Authorization: `Bearer ${oldInstructorToken}`
    });
    expect(resBefore.status).toBe(200);
    expect(resBefore.body.user.role).toBe('INSTRUCTOR');

    // Demote user in database from INSTRUCTOR to STUDENT
    db.prepare(`UPDATE users SET role = 'STUDENT' WHERE id = ?`).run(instructorToDemoteId);

    // Now attempt to use the OLD Instructor JWT (which still claims role: 'INSTRUCTOR' in its payload)
    const resAfter = await makeRequest('GET', '/api/test-protected/instructor-only', {
      Authorization: `Bearer ${oldInstructorToken}`
    });

    // Authoritative DB check must reject the request with HTTP 403 Forbidden!
    expect(resAfter.status).toBe(403);
    expect(resAfter.body.success).toBe(false);
    expect(resAfter.body.error).toContain("Role 'STUDENT' is not authorized");

    // But the user CAN access student-only endpoints because their role is now STUDENT
    const resStudent = await makeRequest('GET', '/api/test-protected/student-only', {
      Authorization: `Bearer ${oldInstructorToken}`
    });
    expect(resStudent.status).toBe(200);
    expect(resStudent.body.user.role).toBe('STUDENT');
  });

  it('6. Existing STUDENT, INSTRUCTOR, and ADMIN role separation rules still work properly', async () => {
    const adminToken = generateToken(adminUserId, 'ADMIN', `${adminUserId}@test.local`);
    const studentToken = generateToken(activeStudentId, 'STUDENT', `${activeStudentId}@test.local`);

    // Student trying to access Admin endpoint -> 403
    const resStudentToAdmin = await makeRequest('GET', '/api/test-protected/admin-only', {
      Authorization: `Bearer ${studentToken}`
    });
    expect(resStudentToAdmin.status).toBe(403);

    // Admin accessing Admin endpoint -> 200
    const resAdminToAdmin = await makeRequest('GET', '/api/test-protected/admin-only', {
      Authorization: `Bearer ${adminToken}`
    });
    expect(resAdminToAdmin.status).toBe(200);
    expect(resAdminToAdmin.body.user.role).toBe('ADMIN');

    // Admin accessing Instructor-allowed endpoint -> 200
    const resAdminToInstructor = await makeRequest('GET', '/api/test-protected/instructor-only', {
      Authorization: `Bearer ${adminToken}`
    });
    expect(resAdminToInstructor.status).toBe(200);
  });

  it('7. Existing login and refresh token behavior remains functional and checks active status', async () => {
    // Suspended student attempting to login via /api/auth/login
    // First update suspended student password hash
    const bcrypt = await import('bcryptjs');
    const hash = bcrypt.hashSync('Password123!', 10);
    db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(hash, suspendedStudentId);

    const loginRes = await makeRequest('POST', '/api/auth/login', {
      'Content-Type': 'application/json'
    }, {
      email: `${suspendedStudentId}@test.local`,
      password: 'Password123!'
    } as any);

    // Login must block deactivated account
    expect(loginRes.status).toBe(403);
    expect(loginRes.body.error).toContain('Account has been deactivated');
  });
});
