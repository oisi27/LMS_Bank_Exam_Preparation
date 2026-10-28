import { describe, it, expect } from 'vitest';
import { db, initDatabase } from '../db/schema';
import { config } from '../config/env';

describe('Phase 1 Scaffolding & Database Foundation', () => {
  it('should initialize sqlite database with WAL mode', () => {
    initDatabase();
    const pragma = db.pragma('journal_mode');
    expect(pragma).toBeDefined();
  });

  it('should have required user roles and tables created', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((t: any) => t.name);
    
    expect(tables).toContain('users');
    expect(tables).toContain('questions');
    expect(tables).toContain('exams');
    expect(tables).toContain('attempts');
    expect(tables).toContain('courses');
    expect(tables).toContain('exam_violations');
    expect(tables).toContain('exam_results');
  });

  it('should load validated environment configuration', () => {
    expect(config.PORT).toBeGreaterThan(0);
    expect(config.NODE_ENV).toBeDefined();
    expect(config.CLIENT_ORIGIN).toBeDefined();
  });
});
