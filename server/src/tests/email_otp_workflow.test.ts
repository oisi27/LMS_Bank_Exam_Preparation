import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'http';
import express from 'express';
import cookieParser from 'cookie-parser';
import { db, initDatabase } from '../db/schema';
import { authRouter } from '../routes/auth';
import { OtpService, ConsoleMockProvider } from '../services/otpService';
import bcrypt from 'bcryptjs';

const app = express();
app.use(express.json());
app.use(cookieParser());
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

describe('Email OTP Registration, Verification & Activation Tests', () => {
  beforeAll(async () => {
    initDatabase();
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        serverPort = addr.port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('1. New student registration creates an UNVERIFIED (is_active=0) account and dispatches OTP', async () => {
    const testEmail = `new_student_${Date.now()}@test.ac.bd`;
    const res = await makeRequest('POST', '/api/auth/register', {}, {
      email: testEmail,
      password: 'securepassword123',
      name: 'New Candidate',
      role: 'STUDENT'
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.requiresVerification).toBe(true);
    expect(res.body.accessToken).toBeUndefined(); // MUST NOT issue tokens to unverified account

    // Verify in DB that is_active = 0
    const userRow: any = db.prepare('SELECT is_active FROM users WHERE email = ?').get(testEmail);
    expect(userRow).toBeDefined();
    expect(userRow.is_active).toBe(0);

    // Verify an OTP record was stored with hashed code (contains '$')
    const otpRow: any = db.prepare('SELECT code, consumed FROM otps WHERE destination = ?').get(testEmail);
    expect(otpRow).toBeDefined();
    expect(otpRow.consumed).toBe(0);
    expect(otpRow.code).toContain('$'); // Hashed format: salt$hash
  });

  it('2. Unverified student account CANNOT log in until verified', async () => {
    const unverifiedEmail = `unverified_${Date.now()}@test.ac.bd`;
    const rawPass = 'studentpass123';
    const hash = bcrypt.hashSync(rawPass, 10);

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, is_active)
      VALUES (?, ?, ?, ?, 'STUDENT', 0)
    `).run(`unverified-id-${Date.now()}`, unverifiedEmail, hash, 'Unverified Student');

    db.prepare(`
      INSERT INTO otps (id, destination, code, type, expires_at, consumed)
      VALUES (?, ?, 'mockcode', 'EMAIL', ?, 0)
    `).run(`unverified-otp-${Date.now()}`, unverifiedEmail, new Date(Date.now() + 5 * 60 * 1000).toISOString());

    const res = await makeRequest('POST', '/api/auth/login', {}, {
      email: unverifiedEmail,
      password: rawPass
    });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.requiresVerification).toBe(true);
    expect(res.body.error).toContain('Account is unverified');
  });

  it('3. Successful OTP verification activates account (is_active=1) and issues session tokens', async () => {
    const candidateEmail = `verify_me_${Date.now()}@test.ac.bd`;
    const rawPass = 'studentpass123';
    const hash = bcrypt.hashSync(rawPass, 10);
    const userId = `uid-verify-${Date.now()}`;

    // Register as unverified
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, is_active)
      VALUES (?, ?, ?, ?, 'STUDENT', 0)
    `).run(userId, candidateEmail, hash, 'Verification Candidate');

    // Create a known OTP code
    const testOtpService = new OtpService(new ConsoleMockProvider());
    const code = '753951';
    const salt = 'testsalt123';
    const hashedCode = `${salt}$${testOtpService.hashCode(code, salt)}`;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO otps (id, destination, code, type, expires_at, consumed)
      VALUES (?, ?, ?, 'EMAIL', ?, 0)
    `).run(`otp-id-${Date.now()}`, candidateEmail, hashedCode, expiresAt);

    // Verify OTP via API
    const res = await makeRequest('POST', '/api/auth/otp/verify', {}, {
      destination: candidateEmail,
      code: '753951'
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.activated).toBe(true);
    expect(res.body.accessToken).toBeDefined();

    // Verify DB update: is_active is now 1
    const userRow: any = db.prepare('SELECT is_active FROM users WHERE id = ?').get(userId);
    expect(userRow.is_active).toBe(1);

    // Now login succeeds
    const loginRes = await makeRequest('POST', '/api/auth/login', {}, {
      email: candidateEmail,
      password: rawPass
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.accessToken).toBeDefined();
  });

  it('4. Rejects invalid OTP code', async () => {
    const candidateEmail = `wrong_otp_${Date.now()}@test.ac.bd`;
    const testOtpService = new OtpService(new ConsoleMockProvider());
    const correctCode = '123456';
    const salt = 'salt1';
    const hashed = `${salt}$${testOtpService.hashCode(correctCode, salt)}`;

    db.prepare(`
      INSERT INTO otps (id, destination, code, type, expires_at, consumed)
      VALUES (?, ?, ?, 'EMAIL', ?, 0)
    `).run(`otp-w-${Date.now()}`, candidateEmail, hashed, new Date(Date.now() + 5 * 60 * 1000).toISOString());

    const res = await makeRequest('POST', '/api/auth/otp/verify', {}, {
      destination: candidateEmail,
      code: '999999' // Wrong code
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Incorrect verification code');
  });

  it('5. Rejects expired OTP code', async () => {
    const candidateEmail = `expired_otp_${Date.now()}@test.ac.bd`;
    const testOtpService = new OtpService(new ConsoleMockProvider());
    const code = '456789';
    const salt = 'salt2';
    const hashed = `${salt}$${testOtpService.hashCode(code, salt)}`;
    // Expired 10 minutes ago
    const expiredAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO otps (id, destination, code, type, expires_at, consumed)
      VALUES (?, ?, ?, 'EMAIL', ?, 0)
    `).run(`otp-exp-${Date.now()}`, candidateEmail, hashed, expiredAt);

    const res = await makeRequest('POST', '/api/auth/otp/verify', {}, {
      destination: candidateEmail,
      code: '456789'
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('expired');
  });

  it('6. Enforces resend cooldown (60 seconds)', async () => {
    const testOtpService = new OtpService(new ConsoleMockProvider());
    const dest = `cooldown_${Date.now()}@test.ac.bd`;

    // First send: succeeds
    const firstSend = await testOtpService.sendOtp(dest, 'EMAIL');
    expect(firstSend.success).toBe(true);

    // Immediate second send: blocked by cooldown
    const secondSend = await testOtpService.sendOtp(dest, 'EMAIL');
    expect(secondSend.success).toBe(false);
    expect(secondSend.message).toContain('Please wait');
    expect(secondSend.cooldownRemaining).toBeGreaterThan(0);
  });

  it('7. Existing active user login compatibility is 100% preserved', async () => {
    const existingEmail = `existing_student_${Date.now()}@test.ac.bd`;
    const rawPass = 'bankpass123';
    const hash = bcrypt.hashSync(rawPass, 10);

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, is_active)
      VALUES (?, ?, ?, ?, 'STUDENT', 1)
    `).run(`existing-id-${Date.now()}`, existingEmail, hash, 'Existing Student');

    const res = await makeRequest('POST', '/api/auth/login', {}, {
      email: existingEmail,
      password: rawPass
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe(existingEmail);
  });
});
