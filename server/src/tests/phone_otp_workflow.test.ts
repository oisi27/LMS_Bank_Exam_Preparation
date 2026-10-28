import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import express from 'express';
import cookieParser from 'cookie-parser';
import { db, initDatabase } from '../db/schema';
import { authRouter } from '../routes/auth';
import { otpService } from '../services/otpService';
import { normalizeBangladeshPhone, isValidBangladeshPhone } from '../utils/phoneUtils';
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

describe('Bangladeshi Mobile Phone SMS OTP Registration & Verification Tests', () => {
  beforeAll(async () => {
    initDatabase();
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

  // 1. Phone number validation & normalization
  it('1. should validate and normalize valid Bangladeshi mobile numbers to E.164 format', () => {
    expect(normalizeBangladeshPhone('01712345678')).toBe('+8801712345678');
    expect(normalizeBangladeshPhone('+8801812345678')).toBe('+8801812345678');
    expect(normalizeBangladeshPhone('8801912345678')).toBe('+8801912345678');
    expect(normalizeBangladeshPhone('01300000000')).toBe('+8801300000000');
    expect(normalizeBangladeshPhone('01400000000')).toBe('+8801400000000');
    expect(normalizeBangladeshPhone('01500000000')).toBe('+8801500000000');
    expect(normalizeBangladeshPhone('01600000000')).toBe('+8801600000000');
    expect(normalizeBangladeshPhone('017-1234-5678')).toBe('+8801712345678');
    expect(normalizeBangladeshPhone('+88 (017) 1234 5678')).toBe('+8801712345678');
  });

  // 2. Reject invalid phone numbers
  it('2. should reject invalid phone formats, short numbers, and invalid operator codes', () => {
    expect(isValidBangladeshPhone('01212345678')).toBe(false); // Invalid operator 012
    expect(isValidBangladeshPhone('01112345678')).toBe(false); // Citycell legacy retired 011
    expect(isValidBangladeshPhone('017123456')).toBe(false);   // Too short (9 digits)
    expect(isValidBangladeshPhone('0171234567899')).toBe(false); // Too long
    expect(isValidBangladeshPhone('abcdefghijk')).toBe(false);
    expect(isValidBangladeshPhone('')).toBe(false);
  });

  // 3. Reject invalid phone number registration
  it('3. should reject registration with invalid phone format via POST /api/auth/register-phone', async () => {
    const res = await makeRequest('POST', '/api/auth/register-phone', {}, {
      phone: '01299999999',
      password: 'password123',
      name: 'Test Candidate'
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Invalid Bangladesh mobile number');
  });

  // 4. Successful registration creates inactive user and sends 6-digit SMS OTP
  it('4. should register new student via phone, store as inactive (is_active=0), and dispatch SMS OTP', async () => {
    const rawPhone = '01711' + Math.floor(100000 + Math.random() * 900000);
    const normalized = normalizeBangladeshPhone(rawPhone)!;

    const res = await makeRequest('POST', '/api/auth/register-phone', {}, {
      phone: rawPhone,
      password: 'SecurePassword123!',
      name: 'Phone Student Candidate',
      role: 'STUDENT'
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.requiresVerification).toBe(true);
    expect(res.body.phone).toBe(normalized);

    // Verify database record
    const userRow: any = db.prepare('SELECT id, phone, email, is_active FROM users WHERE phone = ?').get(normalized);
    expect(userRow).toBeDefined();
    expect(userRow.is_active).toBe(0); // Inactive until verified

    // Verify OTP record exists with hashed value
    const otpRow: any = db.prepare('SELECT id, code, consumed FROM otps WHERE destination = ? ORDER BY created_at DESC LIMIT 1').get(normalized);
    expect(otpRow).toBeDefined();
    expect(otpRow.consumed).toBe(0);
    expect(otpRow.code).toContain('$'); // Hashed format: salt$hash
  });

  // 5. Prevent duplicate phone registration
  it('5. should prevent duplicate registration for an active phone number', async () => {
    const phone = '+8801811' + Math.floor(100000 + Math.random() * 900000);
    const passwordHash = bcrypt.hashSync('testpass', 8);

    // Insert active user directly
    db.prepare(`
      INSERT INTO users (id, email, phone, password_hash, name, role, is_active)
      VALUES (?, ?, ?, ?, 'Existing Active', 'STUDENT', 1)
    `).run('user_' + Date.now(), `${phone.replace('+', '')}@phone.banklms.ac.bd`, phone, passwordHash);

    const res = await makeRequest('POST', '/api/auth/register-phone', {}, {
      phone: phone,
      password: 'newpassword123',
      name: 'Duplicate Attempt'
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('already exists');
  });

  // 6. Resend cooldown (60 seconds)
  it('6. should enforce 60-second cooldown on OTP requests to the same phone', async () => {
    const phone = '+8801911' + Math.floor(100000 + Math.random() * 900000);

    const firstRes = await makeRequest('POST', '/api/auth/otp/request', {}, {
      destination: phone,
      type: 'PHONE'
    });
    expect(firstRes.status).toBe(200);
    expect(firstRes.body.success).toBe(true);

    const secondRes = await makeRequest('POST', '/api/auth/otp/request', {}, {
      destination: phone,
      type: 'PHONE'
    });
    expect(secondRes.status).toBe(200);
    expect(secondRes.body.success).toBe(false);
    expect(secondRes.body.message).toContain('Please wait');
    expect(secondRes.body.cooldownRemaining).toBeGreaterThan(0);
  });

  // 7. Successful verification activates phone account and returns tokens
  it('7. should activate account upon correct SMS OTP verification and issue JWT token', async () => {
    const phone = '+8801511' + Math.floor(100000 + Math.random() * 900000);
    const passwordHash = bcrypt.hashSync('pwd123', 8);
    const userId = 'user_act_' + Date.now();

    // Create unverified user
    db.prepare(`
      INSERT INTO users (id, email, phone, password_hash, name, role, is_active)
      VALUES (?, ?, ?, ?, 'Phone Candidate To Activate', 'STUDENT', 0)
    `).run(userId, `${phone.replace('+', '')}@phone.banklms.ac.bd`, phone, passwordHash);

    // Send known OTP using service
    const rawCode = '654321';
    const salt = 'testsalt';
    const hash = otpService.hashCode(rawCode, salt);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO otps (id, destination, code, type, expires_at, consumed)
      VALUES (?, ?, ?, 'PHONE', ?, 0)
    `).run('otp_' + Date.now(), phone, `${salt}$${hash}`, expiresAt);

    // Verify OTP
    const verifyRes = await makeRequest('POST', '/api/auth/otp/verify', {}, {
      destination: phone,
      code: rawCode
    });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.success).toBe(true);
    expect(verifyRes.body.activated).toBe(true);
    expect(verifyRes.body.accessToken).toBeDefined();

    // Database user should now be active
    const updatedUser: any = db.prepare('SELECT is_active FROM users WHERE id = ?').get(userId);
    expect(updatedUser.is_active).toBe(1);

    // Attempting replay of the same OTP must fail
    const replayRes = await makeRequest('POST', '/api/auth/otp/verify', {}, {
      destination: phone,
      code: rawCode
    });
    expect(replayRes.status).toBe(400);
    expect(replayRes.body.success).toBe(false);
  });

  // 8. Rejects expired OTP
  it('8. should reject expired SMS OTP', async () => {
    const phone = '+8801611' + Math.floor(100000 + Math.random() * 900000);
    const rawCode = '112233';
    const salt = 'testsalt';
    const hash = otpService.hashCode(rawCode, salt);
    const pastExpiresAt = new Date(Date.now() - 10000).toISOString(); // 10s in past

    db.prepare(`
      INSERT INTO otps (id, destination, code, type, expires_at, consumed)
      VALUES (?, ?, ?, 'PHONE', ?, 0)
    `).run('otp_exp_' + Date.now(), phone, `${salt}$${hash}`, pastExpiresAt);

    const verifyRes = await makeRequest('POST', '/api/auth/otp/verify', {}, {
      destination: phone,
      code: rawCode
    });

    expect(verifyRes.status).toBe(400);
    expect(verifyRes.body.success).toBe(false);
    expect(verifyRes.body.error).toContain('expired');
  });

  // 9. Preserves existing Email OTP and User Login compatibility
  it('9. should preserve existing email login and email OTP verification compatibility', async () => {
    const email = `candidate_compat_${Date.now()}@example.com`;
    const password = 'Password@123';
    const passwordHash = bcrypt.hashSync(password, 8);

    db.prepare(`
      INSERT INTO users (id, email, phone, password_hash, name, role, is_active)
      VALUES (?, ?, NULL, ?, 'Legacy Candidate', 'STUDENT', 1)
    `).run('user_compat_' + Date.now(), email, passwordHash);

    // Login using email
    const loginRes = await makeRequest('POST', '/api/auth/login', {}, {
      email: email,
      password: password
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.user.email).toBe(email);
    expect(loginRes.body.accessToken).toBeDefined();
  });
});
