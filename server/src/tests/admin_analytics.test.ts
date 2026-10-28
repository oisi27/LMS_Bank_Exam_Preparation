import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db, initDatabase } from '../db/schema';
import { adminRouter } from '../routes/admin';
import { dashboardRouter } from '../routes/dashboard';
import { config } from '../config/env';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/admin', adminRouter);
app.use('/api/dashboard', dashboardRouter);

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

describe('Proposal Gap Fix Step 3: Admin Platform-wide Average Score & Analytics Tests', () => {
  const adminId = `admin_analytics_${Date.now()}`;
  const instructorId = `inst_analytics_${Date.now()}`;
  const studentId = `stud_analytics_${Date.now()}`;

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

    // Insert test users
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, is_active)
      VALUES (?, ?, 'hash', 'Super Admin', 'ADMIN', 1)
      ON CONFLICT(id) DO UPDATE SET email = excluded.email, role = excluded.role, is_active = 1
    `).run(adminId, adminEmail);

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, is_active)
      VALUES (?, ?, 'hash', 'Instructor Ian', 'INSTRUCTOR', 1)
      ON CONFLICT(id) DO UPDATE SET email = excluded.email, role = excluded.role, is_active = 1
    `).run(instructorId, instructorEmail);

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, is_active)
      VALUES (?, ?, 'hash', 'Student Sam', 'STUDENT', 1)
      ON CONFLICT(id) DO UPDATE SET email = excluded.email, role = excluded.role, is_active = 1
    `).run(studentId, studentEmail);

    adminToken = generateToken(adminId, 'ADMIN', adminEmail);
    instructorToken = generateToken(instructorId, 'INSTRUCTOR', instructorEmail);
    studentToken = generateToken(studentId, 'STUDENT', studentEmail);
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('1. Admin can access platform-wide analytics via GET /api/admin/analytics with marks unit and correct metrics', async () => {
    const res = await makeRequest('GET', '/api/admin/analytics', {
      Authorization: `Bearer ${adminToken}`
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.analytics).toBeDefined();
    expect(res.body.analytics.scoreUnit).toBe('marks');
    expect(typeof res.body.analytics.averageScore).toBe('number');
    expect(typeof res.body.analytics.totalGradedResults).toBe('number');
    expect(typeof res.body.analytics.averageAccuracy).toBe('number');
    expect(typeof res.body.analytics.passRatePercentage).toBe('number');
  });

  it('2. Admin overview GET /api/dashboard/admin-overview includes performanceAnalytics with platform-wide average score', async () => {
    const res = await makeRequest('GET', '/api/dashboard/admin-overview', {
      Authorization: `Bearer ${adminToken}`
    });

    expect(res.status).toBe(200);
    expect(res.body.performanceAnalytics).toBeDefined();
    expect(res.body.performanceAnalytics.scoreUnit).toBe('marks');
    expect(typeof res.body.performanceAnalytics.averageScore).toBe('number');
    expect(typeof res.body.performanceAnalytics.totalGradedResults).toBe('number');
    expect(res.body.activeAttempts).toBeDefined();
    expect(res.body.recentViolations).toBeDefined();
  });

  it('3. GET /api/admin/analytics enforces ADMIN role (STUDENT and INSTRUCTOR are rejected with 403)', async () => {
    const studentRes = await makeRequest('GET', '/api/admin/analytics', {
      Authorization: `Bearer ${studentToken}`
    });
    expect(studentRes.status).toBe(403);

    const instructorRes = await makeRequest('GET', '/api/admin/analytics', {
      Authorization: `Bearer ${instructorToken}`
    });
    expect(instructorRes.status).toBe(403);
  });

  it('4. GET /api/admin/analytics rejects unauthenticated requests with 401', async () => {
    const res = await makeRequest('GET', '/api/admin/analytics');
    expect(res.status).toBe(401);
  });

  it('5. Correctly handles average calculation and score precision', async () => {
    // Read current raw values from database to verify formula match
    const raw: any = db.prepare(`
      SELECT COUNT(*) as c, AVG(score) as avgS FROM exam_results
    `).get();

    const res = await makeRequest('GET', '/api/admin/analytics', {
      Authorization: `Bearer ${adminToken}`
    });

    expect(res.status).toBe(200);
    if (raw.c > 0) {
      expect(res.body.analytics.totalGradedResults).toBe(raw.c);
      expect(res.body.analytics.averageScore).toBe(Number(Number(raw.avgS).toFixed(2)));
    } else {
      expect(res.body.analytics.totalGradedResults).toBe(0);
      expect(res.body.analytics.averageScore).toBe(0);
    }
  });

  it('6. GET /api/admin/platform-stats returns platform counters for ADMIN', async () => {
    const res = await makeRequest('GET', '/api/admin/platform-stats', {
      Authorization: `Bearer ${adminToken}`
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.stats).toBeDefined();
    expect(typeof res.body.stats.totalUsers).toBe('number');
    expect(typeof res.body.stats.totalStudents).toBe('number');
    expect(typeof res.body.stats.totalInstructors).toBe('number');
    expect(typeof res.body.stats.totalAdmins).toBe('number');
    expect(typeof res.body.stats.totalCourses).toBe('number');
    expect(typeof res.body.stats.pendingCourseApprovals).toBe('number');
    expect(typeof res.body.stats.totalExams).toBe('number');
    expect(typeof res.body.stats.activeExamAttempts).toBe('number');
    expect(res.body.stats.totalUsers).toBeGreaterThanOrEqual(
      res.body.stats.totalStudents + res.body.stats.totalInstructors + res.body.stats.totalAdmins
    );
  });

  it('7. GET /api/admin/platform-stats enforces ADMIN role (STUDENT and INSTRUCTOR are rejected)', async () => {
    const studentRes = await makeRequest('GET', '/api/admin/platform-stats', {
      Authorization: `Bearer ${studentToken}`
    });
    expect(studentRes.status).toBe(403);

    const instructorRes = await makeRequest('GET', '/api/admin/platform-stats', {
      Authorization: `Bearer ${instructorToken}`
    });
    expect(instructorRes.status).toBe(403);

    const unauthRes = await makeRequest('GET', '/api/admin/platform-stats');
    expect(unauthRes.status).toBe(401);
  });
});

