import { describe, it, expect, beforeEach } from 'vitest';
import { db, initDatabase } from '../db/schema';
import { v4 as uuidv4 } from 'uuid';

describe('Phase 4 Exam Delivery & Server Timer Tests', () => {
  let testExamId: string;
  let testUserId: string;
  let testQuestionId: string;

  beforeEach(() => {
    initDatabase();
    testExamId = uuidv4();
    testUserId = uuidv4();
    testQuestionId = uuidv4();

    // 1. Insert test user
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (?, ?, 'hash', 'Exam Candidate', 'STUDENT')
    `).run(testUserId, `candidate_${Date.now()}@banklms.ac.bd`);

    // 2. Insert test question
    db.prepare(`
      INSERT INTO questions (id, subject, chapter, topic, difficulty, type, prompt)
      VALUES (?, 'Math', 'Interest', 'Simple Interest', 'EASY', 'SINGLE_MCQ', 'What is simple interest formula?')
    `).run(testQuestionId);

    // 3. Insert question options
    const insertOpt = db.prepare(`
      INSERT INTO question_options (id, question_id, option_key, text, is_correct, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertOpt.run(uuidv4(), testQuestionId, 'A', 'PTR/100', 1, 0);
    insertOpt.run(uuidv4(), testQuestionId, 'B', 'P(1+r)^n', 0, 1);

    // 4. Insert exam scheduled with 60 min duration
    const now = new Date();
    const startsAt = new Date(now.getTime() - 5 * 60 * 1000).toISOString(); // Started 5 mins ago
    const endsAt = new Date(now.getTime() + 120 * 60 * 1000).toISOString(); // Ends in 2 hours

    db.prepare(`
      INSERT INTO exams (
        id, title, category, type, duration_minutes, total_marks, pass_marks, negative_marking_rate,
        allowed_attempts, starts_at, ends_at, status
      ) VALUES (?, 'Model Test 01', 'BANK_RECRUITMENT', 'MODEL_TEST', 60, 100.0, 40.0, 0.25, 1, ?, ?, 'LIVE')
    `).run(testExamId, startsAt, endsAt);

    // 5. Connect exam to question
    db.prepare(`
      INSERT INTO exam_questions (id, exam_id, question_id, section_name, marks, negative_marks, order_index)
      VALUES (?, ?, ?, 'Math', 1.0, 0.25, 0)
    `).run(uuidv4(), testExamId, testQuestionId);
  });

  it('should enforce attempt limit and compute server authoritative expiration', () => {
    const now = new Date();
    const exam: any = db.prepare('SELECT * FROM exams WHERE id = ?').get(testExamId);

    // Authoritative expiration calculation: min(now + duration, exam.ends_at)
    const durationEnd = new Date(now.getTime() + exam.duration_minutes * 60 * 1000);
    const windowEnd = new Date(exam.ends_at);
    const expectedExpiresAt = durationEnd < windowEnd ? durationEnd : windowEnd;

    const attemptId = uuidv4();
    db.prepare(`
      INSERT INTO attempts (id, exam_id, user_id, started_at, expires_at, status)
      VALUES (?, ?, ?, ?, ?, 'IN_PROGRESS')
    `).run(attemptId, testExamId, testUserId, now.toISOString(), expectedExpiresAt.toISOString());

    // Verify attempt recorded
    const pastAttempts: any = db.prepare(`
      SELECT COUNT(*) as count FROM attempts WHERE exam_id = ? AND user_id = ?
    `).get(testExamId, testUserId);

    expect(pastAttempts.count).toBe(1);

    // Attempt limit check: Second attempt should be rejected if allowed_attempts = 1
    const allowed = pastAttempts.count < exam.allowed_attempts;
    expect(allowed).toBe(false);
  });

  it('should perform idempotent answer autosaving and reject stale sequences', () => {
    const attemptId = uuidv4();
    db.prepare(`
      INSERT INTO attempts (id, exam_id, user_id, started_at, expires_at, status)
      VALUES (?, ?, ?, (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')), (strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+60 minutes')), 'IN_PROGRESS')
    `).run(attemptId, testExamId, testUserId);

    const saveAnswer = (seq: number, optionKey: string) => {
      const existing: any = db.prepare(`
        SELECT client_sequence FROM attempt_answers WHERE attempt_id = ? AND question_id = ?
      `).get(attemptId, testQuestionId);

      if (existing && existing.client_sequence > seq) {
        return false; // Discard stale
      }

      db.prepare(`
        INSERT INTO attempt_answers (id, attempt_id, question_id, selected_option_ids, client_sequence)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(attempt_id, question_id) DO UPDATE SET
          selected_option_ids = excluded.selected_option_ids,
          client_sequence = excluded.client_sequence
      `).run(uuidv4(), attemptId, testQuestionId, JSON.stringify([optionKey]), seq);
      return true;
    };

    // First write sequence 1
    const write1 = saveAnswer(1, 'A');
    expect(write1).toBe(true);

    // Second write fresher sequence 2
    const write2 = saveAnswer(2, 'B');
    expect(write2).toBe(true);

    const savedRecord: any = db.prepare('SELECT selected_option_ids, client_sequence FROM attempt_answers WHERE attempt_id = ?').get(attemptId);
    expect(JSON.parse(savedRecord.selected_option_ids)).toEqual(['B']);
    expect(savedRecord.client_sequence).toBe(2);

    // Stale write sequence 1 should be safely discarded
    const staleWrite = saveAnswer(1, 'A');
    expect(staleWrite).toBe(false);
  });

  it('should prevent double submission using atomic status transition', () => {
    const attemptId = uuidv4();
    db.prepare(`
      INSERT INTO attempts (id, exam_id, user_id, started_at, expires_at, status)
      VALUES (?, ?, ?, (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')), (strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+60 minutes')), 'IN_PROGRESS')
    `).run(attemptId, testExamId, testUserId);

    // First submission
    const result1 = db.prepare(`
      UPDATE attempts
      SET status = 'SUBMITTED', submitted_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      WHERE id = ? AND status = 'IN_PROGRESS'
    `).run(attemptId);

    expect(result1.changes).toBe(1);

    // Second accidental submit click (should match 0 rows)
    const result2 = db.prepare(`
      UPDATE attempts
      SET status = 'SUBMITTED', submitted_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      WHERE id = ? AND status = 'IN_PROGRESS'
    `).run(attemptId);

    expect(result2.changes).toBe(0);
  });

  it('should mark attempt AUTO_SUBMITTED when server detects expiration', () => {
    const attemptId = uuidv4();
    const expiredTimestamp = new Date(Date.now() - 1000).toISOString(); // Expired 1 second ago

    db.prepare(`
      INSERT INTO attempts (id, exam_id, user_id, started_at, expires_at, status)
      VALUES (?, ?, ?, (strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-60 minutes')), ?, 'IN_PROGRESS')
    `).run(attemptId, testExamId, testUserId, expiredTimestamp);

    const attempt: any = db.prepare('SELECT expires_at, status FROM attempts WHERE id = ?').get(attemptId);
    const now = new Date();

    if (now > new Date(attempt.expires_at) && attempt.status === 'IN_PROGRESS') {
      db.prepare(`UPDATE attempts SET status = 'AUTO_SUBMITTED' WHERE id = ?`).run(attemptId);
    }

    const updated: any = db.prepare('SELECT status FROM attempts WHERE id = ?').get(attemptId);
    expect(updated.status).toBe('AUTO_SUBMITTED');
  });
});
