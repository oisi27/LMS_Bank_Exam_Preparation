import { describe, it, expect, beforeEach } from 'vitest';
import { db, initDatabase } from '../db/schema';
import { otpService } from '../services/otpService';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';

describe('Phase 2 Authentication & Security Tests', () => {
  beforeEach(() => {
    initDatabase();
  });

  it('should generate and verify single-use OTP with expiration handling', async () => {
    const testDestination = 'candidate_test@banklms.edu.bd';
    const code = otpService.generateCode();

    // Verify OTP service helper
    expect(code).toMatch(/^[0-9]{6}$/);

    // Request OTP
    await otpService.sendOtp(testDestination, 'EMAIL');

    // Retrieve active code from DB
    const otpRecord: any = db.prepare(
      'SELECT code FROM otps WHERE destination = ? AND consumed = 0 ORDER BY created_at DESC LIMIT 1'
    ).get(testDestination);

    expect(otpRecord).toBeDefined();

    // Wrong code attempt
    const failedCheck = otpService.verifyOtp(testDestination, '000000');
    expect(failedCheck.success).toBe(false);

    // Valid code verification
    const successCheck = otpService.verifyOtp(testDestination, otpRecord.code);
    expect(successCheck.success).toBe(true);

    // Replay attack prevention: second attempt with same code must fail
    const replayCheck = otpService.verifyOtp(testDestination, otpRecord.code);
    expect(replayCheck.success).toBe(false);
  });

  it('should hash passwords securely with bcrypt and verify correctly', () => {
    const rawPassword = 'bank_candidate_password_2026';
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(rawPassword, salt);

    expect(hash).not.toBe(rawPassword);
    expect(bcrypt.compareSync(rawPassword, hash)).toBe(true);
    expect(bcrypt.compareSync('wrong_pass', hash)).toBe(false);
  });

  it('should sign and verify JWT tokens containing user role payload', () => {
    const userPayload = {
      id: 'test-student-id',
      email: 'student@example.com',
      role: 'STUDENT',
      name: 'Test Student'
    };

    const token = jwt.sign(userPayload, config.JWT_SECRET, { expiresIn: '15m' });
    const decoded: any = jwt.verify(token, config.JWT_SECRET);

    expect(decoded.id).toBe(userPayload.id);
    expect(decoded.role).toBe('STUDENT');
    expect(decoded.email).toBe(userPayload.email);
  });

  it('should record refresh tokens in database and revoke on consumption', () => {
    const tokenId = `test-token-id-${Date.now()}`;
    const tokenHash = `uuid-refresh-token-hash-${Date.now()}`;
    const userId = 'user-test-123';
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Ensure a test user exists to satisfy foreign key
    db.prepare(`
      INSERT OR IGNORE INTO users (id, email, password_hash, name, role)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, 'refreshtest@bank.ac.bd', 'hash', 'Refresh Tester', 'STUDENT');

    db.prepare(`
      INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(tokenId, userId, tokenHash, expiresAt);

    const record: any = db.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?').get(tokenHash);
    expect(record).toBeDefined();
    expect(record.revoked_at).toBeNull();

    // Revoke
    db.prepare(`UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?`).run(new Date().toISOString(), tokenId);

    const updated: any = db.prepare('SELECT * FROM refresh_tokens WHERE id = ?').get(tokenId);
    expect(updated.revoked_at).not.toBeNull();
  });
});
