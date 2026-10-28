import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';
import { db, dbPath } from '../db/schema';

describe('Test Database Isolation & Development Database Immutability Safeguard', () => {
  const realDevDbPath = path.resolve(__dirname, '../../bank_exam.db');
  const isolatedTestDbPath = path.resolve(__dirname, '../../bank_exam_test.db');

  it('active test database MUST NOT be the real development database', () => {
    const currentPath = path.resolve(dbPath);
    expect(currentPath).not.toBe(realDevDbPath);
    expect(currentPath).toBe(isolatedTestDbPath);
  });

  it('NODE_ENV or VITEST environment variable MUST be set to test', () => {
    expect(process.env.NODE_ENV === 'test' || process.env.VITEST === 'true').toBe(true);
  });

  it('writing to test database inserts into isolated test db and leaves real dev db completely untouched', () => {
    // Record real dev db size / stat
    const realStatBefore = fs.statSync(realDevDbPath);

    // Read record count in test db
    const testCountBefore: any = db.prepare('SELECT count(*) as count FROM users').get();

    // Perform an insert in test db
    const testId = `test_guard_${Date.now()}`;
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (?, ?, 'hash', 'Test Guard User', 'STUDENT')
    `).run(testId, `${testId}@isolation-test.local`);

    // Verify record exists in test db
    const testRecord: any = db.prepare('SELECT id FROM users WHERE id = ?').get(testId);
    expect(testRecord).toBeDefined();

    // Verify record DOES NOT exist in real development database
    // Directly query real dev database file via separate connection
    const Database = require('better-sqlite3');
    const realDb = new Database(realDevDbPath, { readonly: true });
    const realCheck = realDb.prepare('SELECT id FROM users WHERE id = ?').get(testId);
    realDb.close();

    expect(realCheck).toBeUndefined();
  });
});
