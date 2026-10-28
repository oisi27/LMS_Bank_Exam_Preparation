import { beforeAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import { db, dbPath, initDatabase } from '../db/schema';
import { seedDatabase, ensureActiveDemoExam } from '../db/seed';

const realDevDbPath = path.resolve(__dirname, '../../bank_exam.db');
const isolatedTestDbPath = path.resolve(__dirname, '../../bank_exam_test.db');

beforeAll(() => {
  // CRITICAL SECURITY ASSERTION: Under no circumstances should test run on real development DB
  const resolvedDbPath = path.resolve(dbPath);
  if (resolvedDbPath === realDevDbPath) {
    throw new Error(`[FATAL SAFETY VIOLATION]: Automated test suite initialized against REAL development database: ${realDevDbPath}`);
  }

  // Ensure isolated test database schema and base seeds are present
  initDatabase();
  seedDatabase();
  ensureActiveDemoExam();
});
