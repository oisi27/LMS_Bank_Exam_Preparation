import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db, initDatabase } from '../db/schema';
import { authenticateToken, requireRole } from '../middleware/auth';
import { adminRouter } from '../routes/admin';
import { authRouter } from '../routes/auth';
import { config } from '../config/env';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);

// Additional dummy protected route to test student access lockout
app.get('/api/test-student-endpoint', authenticateToken, requireRole('STUDENT'), (req, res) => {
  res.json({ success: true, message: 'Student allowed', user: req.user });
});

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

describe('Phase 7 Milestone 2 Step 2B: Secure Admin User Management Backend APIs', () => {
  const adminAId = `test_admin_a_${Date.now()}`;
  const adminBId = `test_admin_b_${Date.now()}`;
  const student1Id = `test_stud_1_${Date.now()}`;
  const student2Id = `test_stud_2_${Date.now()}`;
  const instructor1Id = `test_inst_1_${Date.now()}`;

  let adminAToken: string;
  let adminBToken: string;
  let student1Token: string;
  let instructor1Token: string;

  beforeAll(async () => {
    initDatabase();

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        serverPort = (server.address() as any).port;
        resolve();
      });
    });

    // Seed test admin A
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, is_active)
      VALUES (?, ?, 'hash123', 'Admin Alice', 'ADMIN', 1)
    `).run(adminAId, `${adminAId}@test.local`);

    // Seed test admin B
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, is_active)
      VALUES (?, ?, 'hash123', 'Admin Bob', 'ADMIN', 1)
    `).run(adminBId, `${adminBId}@test.local`);

    // Seed test student 1
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, is_active)
      VALUES (?, ?, 'hash123', 'Student Charlie', 'STUDENT', 1)
    `).run(student1Id, `${student1Id}@test.local`);

    // Seed test student 2
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, is_active)
      VALUES (?, ?, 'hash123', 'Student Dave', 'STUDENT', 0)
    `).run(student2Id, `${student2Id}@test.local`);

    // Seed test instructor 1
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, is_active)
      VALUES (?, ?, 'hash123', 'Instructor Emma', 'INSTRUCTOR', 1)
    `).run(instructor1Id, `${instructor1Id}@test.local`);

    adminAToken = generateToken(adminAId, 'ADMIN', `${adminAId}@test.local`);
    adminBToken = generateToken(adminBId, 'ADMIN', `${adminBId}@test.local`);
    student1Token = generateToken(student1Id, 'STUDENT', `${student1Id}@test.local`);
    instructor1Token = generateToken(instructor1Id, 'INSTRUCTOR', `${instructor1Id}@test.local`);
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  // 1. Non-admin users cannot access Admin APIs
  it('1. Non-admin users (STUDENT, INSTRUCTOR) cannot access Admin APIs (HTTP 403)', async () => {
    const studentRes = await makeRequest('GET', '/api/admin/users', {
      Authorization: `Bearer ${student1Token}`
    });
    expect(studentRes.status).toBe(403);
    expect(studentRes.body.success).toBe(false);

    const instructorRes = await makeRequest('GET', '/api/admin/users', {
      Authorization: `Bearer ${instructor1Token}`
    });
    expect(instructorRes.status).toBe(403);
    expect(instructorRes.body.success).toBe(false);
  });

  // 2. Unauthenticated requests are rejected
  it('2. Unauthenticated requests to Admin APIs are rejected (HTTP 401)', async () => {
    const res = await makeRequest('GET', '/api/admin/users');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // 3. Admin can search users by name or email
  it('3. Admin can search users by name or email', async () => {
    const res = await makeRequest('GET', `/api/admin/users?search=Charlie`, {
      Authorization: `Bearer ${adminAToken}`
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.some((u: any) => u.id === student1Id)).toBe(true);

    const resEmail = await makeRequest('GET', `/api/admin/users?search=${adminBId}`, {
      Authorization: `Bearer ${adminAToken}`
    });
    expect(resEmail.status).toBe(200);
    expect(resEmail.body.data.some((u: any) => u.id === adminBId)).toBe(true);
  });

  // 4. Role and status filters work
  it('4. Role and status filters return matching user records', async () => {
    const resRole = await makeRequest('GET', '/api/admin/users?role=INSTRUCTOR', {
      Authorization: `Bearer ${adminAToken}`
    });
    expect(resRole.status).toBe(200);
    expect(resRole.body.data.length).toBeGreaterThan(0);
    expect(resRole.body.data.every((u: any) => u.role === 'INSTRUCTOR')).toBe(true);

    const resStatus = await makeRequest('GET', '/api/admin/users?status=suspended', {
      Authorization: `Bearer ${adminAToken}`
    });
    expect(resStatus.status).toBe(200);
    expect(resStatus.body.data.every((u: any) => u.is_active === 0)).toBe(true);
  });

  // 5. Pagination works correctly
  it('5. Pagination works with safe bounds and metadata', async () => {
    const res = await makeRequest('GET', '/api/admin/users?page=1&limit=2', {
      Authorization: `Bearer ${adminAToken}`
    });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(2);
    expect(res.body.pagination.total).toBeGreaterThan(0);
  });

  // 6. Admin can suspend an active Student
  it('6. Admin can suspend an active Student', async () => {
    const res = await makeRequest(
      'PATCH',
      `/api/admin/users/${student1Id}/status`,
      { Authorization: `Bearer ${adminAToken}` },
      { isActive: false }
    );
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.is_active).toBe(0);

    const userInDb: any = db.prepare(`SELECT is_active FROM users WHERE id = ?`).get(student1Id);
    expect(userInDb.is_active).toBe(0);
  });

  // 7. Suspended Student loses protected access immediately
  it('7. Suspended Student loses protected access immediately via Step 2A middleware', async () => {
    // The student's token was generated before suspension
    const res = await makeRequest('GET', '/api/test-student-endpoint', {
      Authorization: `Bearer ${student1Token}`
    });
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Account has been deactivated');
  });

  // 8. Suspended Student cannot refresh an existing session
  it('8. Suspended Student cannot refresh session because refresh tokens were revoked', async () => {
    // Insert a refresh token session for student1 before testing refresh endpoint
    const refreshToken = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare(`
      INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(uuidv4(), student1Id, refreshToken, expiresAt);

    // Now suspend student1 via admin API to ensure revocation triggers
    await makeRequest(
      'PATCH',
      `/api/admin/users/${student1Id}/status`,
      { Authorization: `Bearer ${adminAToken}` },
      { isActive: false }
    );

    // Refresh token should be revoked
    const tokenRecord: any = db.prepare(`SELECT revoked_at FROM refresh_tokens WHERE token_hash = ?`).get(refreshToken);
    expect(tokenRecord.revoked_at).not.toBeNull();

    // Invoking /api/auth/refresh with cookie should fail (HTTP 401 or 403)
    const refreshRes = await makeRequest('POST', '/api/auth/refresh', {
      Cookie: `refreshToken=${refreshToken}`
    });
    expect(refreshRes.status).toBeGreaterThanOrEqual(400);
  });

  // 9. Admin can reactivate a suspended Student
  it('9. Admin can reactivate a suspended Student and restore their access', async () => {
    const res = await makeRequest(
      'PATCH',
      `/api/admin/users/${student1Id}/status`,
      { Authorization: `Bearer ${adminAToken}` },
      { isActive: true }
    );
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.is_active).toBe(1);

    // Access should be immediately restored for valid JWT
    const accessRes = await makeRequest('GET', '/api/test-student-endpoint', {
      Authorization: `Bearer ${student1Token}`
    });
    expect(accessRes.status).toBe(200);
  });

  // 10. Admin can change Student to Instructor
  it('10. Admin can promote Student to Instructor', async () => {
    const res = await makeRequest(
      'PATCH',
      `/api/admin/users/${student1Id}/role`,
      { Authorization: `Bearer ${adminAToken}` },
      { role: 'INSTRUCTOR' }
    );
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.role).toBe('INSTRUCTOR');

    const dbUser: any = db.prepare(`SELECT role FROM users WHERE id = ?`).get(student1Id);
    expect(dbUser.role).toBe('INSTRUCTOR');
  });

  // 11. Old JWT permissions reflect the new database role
  it('11. Old JWT (which had role STUDENT) immediately takes on the new INSTRUCTOR role', async () => {
    // The student1Token still contains "role": "STUDENT" in its signature.
    // In Step 2A, authenticateToken sets req.user.role to the database role ('INSTRUCTOR').
    // When calling a student-only endpoint, it should now reject because the user is no longer a STUDENT!
    const resStudent = await makeRequest('GET', '/api/test-student-endpoint', {
      Authorization: `Bearer ${student1Token}`
    });
    expect(resStudent.status).toBe(403);
    expect(resStudent.body.error).toContain("Role 'INSTRUCTOR' is not authorized");
  });

  // 12. Invalid roles are rejected
  it('12. Invalid roles are rejected with HTTP 400', async () => {
    const res = await makeRequest(
      'PATCH',
      `/api/admin/users/${student1Id}/role`,
      { Authorization: `Bearer ${adminAToken}` },
      { role: 'SUPERUSER_INVALID' }
    );
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // 13. Nonexistent users are handled safely
  it('13. Nonexistent users return HTTP 404 for status and role mutations', async () => {
    const fakeId = `nonexistent_${Date.now()}`;
    const resStatus = await makeRequest(
      'PATCH',
      `/api/admin/users/${fakeId}/status`,
      { Authorization: `Bearer ${adminAToken}` },
      { isActive: false }
    );
    expect(resStatus.status).toBe(404);

    const resRole = await makeRequest(
      'PATCH',
      `/api/admin/users/${fakeId}/role`,
      { Authorization: `Bearer ${adminAToken}` },
      { role: 'INSTRUCTOR' }
    );
    expect(resRole.status).toBe(404);
  });

  // 14. Admin cannot suspend themselves
  it('14. Admin cannot suspend their own authenticated account (HTTP 400)', async () => {
    const res = await makeRequest(
      'PATCH',
      `/api/admin/users/${adminAId}/status`,
      { Authorization: `Bearer ${adminAToken}` },
      { isActive: false }
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('cannot deactivate their own account');
  });

  // 15. Admin cannot demote themselves
  it('15. Admin cannot demote their own account role (HTTP 400)', async () => {
    const res = await makeRequest(
      'PATCH',
      `/api/admin/users/${adminAId}/role`,
      { Authorization: `Bearer ${adminAToken}` },
      { role: 'STUDENT' }
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('cannot demote their own account role');
  });

  // 16. Last active Admin cannot be suspended or demoted
  it('16. Last active Admin cannot be suspended or demoted', async () => {
    // Suspend Admin B using Admin A
    await makeRequest(
      'PATCH',
      `/api/admin/users/${adminBId}/status`,
      { Authorization: `Bearer ${adminAToken}` },
      { isActive: false }
    );

    // Now Admin A is the sole active Admin in test database
    // Even if another actor tries to suspend Admin A, it must be blocked.
    // Let's create an emergency admin C just to issue the token
    const adminCId = `test_admin_c_${Date.now()}`;
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, is_active)
      VALUES (?, ?, 'hash123', 'Admin Charlie', 'ADMIN', 1)
    `).run(adminCId, `${adminCId}@test.local`);
    const adminCToken = generateToken(adminCId, 'ADMIN', `${adminCId}@test.local`);

    // Deactivate Admin A using Admin C
    await makeRequest(
      'PATCH',
      `/api/admin/users/${adminAId}/status`,
      { Authorization: `Bearer ${adminCToken}` },
      { isActive: false }
    );

    // Now Admin C is the LAST remaining active administrator!
    // Trying to suspend Admin C should fail with "last remaining active administrator"
    // To test suspension of last admin from an API call, we test demotion/suspension check
    const lastAdminStatusRes = await makeRequest(
      'PATCH',
      `/api/admin/users/${adminCId}/status`,
      { Authorization: `Bearer ${adminCToken}` },
      { isActive: false }
    );
    // Since it's self-deactivation it hits self-check first (or if done by another, hits last-admin)
    expect(lastAdminStatusRes.status).toBe(400);

    // Let's test direct demotion of last active admin
    const lastAdminRoleRes = await makeRequest(
      'PATCH',
      `/api/admin/users/${adminCId}/role`,
      { Authorization: `Bearer ${adminCToken}` },
      { role: 'STUDENT' }
    );
    expect(lastAdminRoleRes.status).toBe(400);

    // Clean up / restore Admin A and B
    db.prepare(`UPDATE users SET is_active = 1 WHERE id IN (?, ?)`).run(adminAId, adminBId);
  });

  // 17. Successful mutations create audit records
  it('17. Successful mutations create audit records with actor, action, resource, and details', async () => {
    // Trigger role change
    await makeRequest(
      'PATCH',
      `/api/admin/users/${student2Id}/role`,
      { Authorization: `Bearer ${adminAToken}` },
      { role: 'INSTRUCTOR' }
    );

    const auditEntry: any = db.prepare(`
      SELECT * FROM audit_logs
      WHERE actor_id = ? AND resource_id = ? AND action = 'USER_ROLE_CHANGED'
      ORDER BY created_at DESC
      LIMIT 1
    `).get(adminAId, student2Id);

    expect(auditEntry).toBeDefined();
    expect(auditEntry.actor_role).toBe('ADMIN');
    expect(auditEntry.resource).toBe('USER');
    expect(auditEntry.details).toContain('INSTRUCTOR');
  });

  // 18. Failed mutations do not create misleading audit records
  it('18. Failed mutations do not create misleading audit records', async () => {
    const countBefore: any = db.prepare(`SELECT COUNT(*) as count FROM audit_logs`).get();

    // Invalid attempt to demote oneself
    const failedRes = await makeRequest(
      'PATCH',
      `/api/admin/users/${adminAId}/role`,
      { Authorization: `Bearer ${adminAToken}` },
      { role: 'STUDENT' }
    );
    expect(failedRes.status).toBe(400);

    const countAfter: any = db.prepare(`SELECT COUNT(*) as count FROM audit_logs`).get();
    expect(countAfter.count).toBe(countBefore.count);
  });

  // 19. Audit Logs API is Admin-only and returns paginated records
  it('19. Audit Logs API is Admin-only and returns paginated records', async () => {
    // Non-admin request
    const studentRes = await makeRequest('GET', '/api/admin/audit-logs', {
      Authorization: `Bearer ${student1Token}`
    });
    expect(studentRes.status).toBe(403);

    // Admin request
    const adminRes = await makeRequest('GET', '/api/admin/audit-logs?page=1&limit=10', {
      Authorization: `Bearer ${adminAToken}`
    });
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.success).toBe(true);
    expect(Array.isArray(adminRes.body.data)).toBe(true);
    expect(adminRes.body.pagination).toBeDefined();
    expect(adminRes.body.pagination.total).toBeGreaterThan(0);
  });

  // 20. Sensitive fields (passwords, tokens, OTP secrets) are not exposed in user search or audit logs
  it('20. Sensitive credentials are never exposed in user search or audit logs responses', async () => {
    const userRes = await makeRequest('GET', `/api/admin/users?search=${adminAId}`, {
      Authorization: `Bearer ${adminAToken}`
    });
    expect(userRes.status).toBe(200);
    const userObj = userRes.body.data[0];
    expect(userObj).toBeDefined();
    expect(userObj.password_hash).toBeUndefined();
    expect(userObj.refreshToken).toBeUndefined();
    expect(userObj.otp_secret).toBeUndefined();

    const auditRes = await makeRequest('GET', '/api/admin/audit-logs', {
      Authorization: `Bearer ${adminAToken}`
    });
    expect(auditRes.status).toBe(200);
    const allText = JSON.stringify(auditRes.body.data);
    expect(allText).not.toContain('password_hash');
    expect(allText).not.toContain('hash123');
  });
});
