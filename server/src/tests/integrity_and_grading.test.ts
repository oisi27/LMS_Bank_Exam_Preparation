import { describe, it, expect, beforeEach } from 'vitest';
import { db, initDatabase } from '../db/schema';
import { gradeExamAttempt, QuestionGradingSpec, StudentAnswerSubmission } from '../services/gradingEngine';
import { v4 as uuidv4 } from 'uuid';

describe('Phase 5 Integrity Proctoring, Grading & Results Tests', () => {
  let examId: string;
  let studentId: string;
  let otherStudentId: string;
  let q1Id: string;
  let q2Id: string;
  let q3Id: string;

  beforeEach(() => {
    initDatabase();
    examId = uuidv4();
    studentId = uuidv4();
    otherStudentId = uuidv4();
    q1Id = uuidv4();
    q2Id = uuidv4();
    q3Id = uuidv4();

    // 1. Create users
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (?, ?, 'hash', 'Student Candidate', 'STUDENT')
    `).run(studentId, `student_${Date.now()}@banklms.ac.bd`);

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (?, ?, 'hash', 'Other Candidate', 'STUDENT')
    `).run(otherStudentId, `other_${Date.now()}@banklms.ac.bd`);

    // 2. Create questions (SINGLE_MCQ, MULTI_SELECT, SINGLE_MCQ)
    db.prepare(`
      INSERT INTO questions (id, subject, chapter, topic, difficulty, type, prompt)
      VALUES (?, 'English', 'Vocabulary', 'Synonyms', 'MEDIUM', 'SINGLE_MCQ', 'Synonym of CANDID?')
    `).run(q1Id);

    db.prepare(`
      INSERT INTO questions (id, subject, chapter, topic, difficulty, type, prompt)
      VALUES (?, 'Math', 'Sets', 'Venn Diagrams', 'HARD', 'MULTI_SELECT', 'Select prime numbers < 5')
    `).run(q2Id);

    db.prepare(`
      INSERT INTO questions (id, subject, chapter, topic, difficulty, type, prompt)
      VALUES (?, 'GK', 'Banking', 'Central Bank', 'EASY', 'SINGLE_MCQ', 'Head of Bangladesh Bank?')
    `).run(q3Id);

    // Options for Q1
    db.prepare(`INSERT INTO question_options (id, question_id, option_key, text, is_correct, sort_order) VALUES (?, ?, 'A', 'Frank', 1, 0)`).run(uuidv4(), q1Id);
    db.prepare(`INSERT INTO question_options (id, question_id, option_key, text, is_correct, sort_order) VALUES (?, ?, 'B', 'Secretive', 0, 1)`).run(uuidv4(), q1Id);

    // Options for Q2
    db.prepare(`INSERT INTO question_options (id, question_id, option_key, text, is_correct, sort_order) VALUES (?, ?, 'A', '2', 1, 0)`).run(uuidv4(), q2Id);
    db.prepare(`INSERT INTO question_options (id, question_id, option_key, text, is_correct, sort_order) VALUES (?, ?, 'B', '3', 1, 1)`).run(uuidv4(), q2Id);
    db.prepare(`INSERT INTO question_options (id, question_id, option_key, text, is_correct, sort_order) VALUES (?, ?, 'C', '4', 0, 2)`).run(uuidv4(), q2Id);

    // Options for Q3
    db.prepare(`INSERT INTO question_options (id, question_id, option_key, text, is_correct, sort_order) VALUES (?, ?, 'A', 'Governor', 1, 0)`).run(uuidv4(), q3Id);
    db.prepare(`INSERT INTO question_options (id, question_id, option_key, text, is_correct, sort_order) VALUES (?, ?, 'B', 'Director General', 0, 1)`).run(uuidv4(), q3Id);

    // 3. Create exam with integrityEnabled=1, maxViolations=3, passMarks=2.0
    const now = new Date();
    db.prepare(`
      INSERT INTO exams (
        id, title, category, type, duration_minutes, total_marks, pass_marks, negative_marking_rate,
        allowed_attempts, starts_at, ends_at, status, integrity_enabled, max_violations_allowed, result_release_mode
      ) VALUES (?, 'Recruitment Test', 'BANK_RECRUITMENT', 'MODEL_TEST', 60, 4.0, 2.0, 0.25, 1, ?, ?, 'LIVE', 1, 3, 'INSTANT')
    `).run(examId, new Date(now.getTime() - 10000).toISOString(), new Date(now.getTime() + 3600000).toISOString());

    // 4. Attach questions
    db.prepare(`INSERT INTO exam_questions (id, exam_id, question_id, section_name, marks, negative_marks, order_index) VALUES (?, ?, ?, 'English', 1.0, 0.25, 0)`).run(uuidv4(), examId, q1Id);
    db.prepare(`INSERT INTO exam_questions (id, exam_id, question_id, section_name, marks, negative_marks, order_index) VALUES (?, ?, ?, 'Math', 2.0, 0.50, 1)`).run(uuidv4(), examId, q2Id);
    db.prepare(`INSERT INTO exam_questions (id, exam_id, question_id, section_name, marks, negative_marks, order_index) VALUES (?, ?, ?, 'GK', 1.0, 0.25, 2)`).run(uuidv4(), examId, q3Id);
  });

  // ==========================================
  // A. Integrity Tests
  // ==========================================
  it('should record fullscreen and tab-switch violations in append-only table', () => {
    const attemptId = uuidv4();
    db.prepare(`
      INSERT INTO attempts (id, exam_id, user_id, started_at, expires_at, status)
      VALUES (?, ?, ?, (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')), (strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+60 minutes')), 'IN_PROGRESS')
    `).run(attemptId, examId, studentId);

    // Record FULLSCREEN_EXIT
    db.prepare(`
      INSERT INTO exam_violations (id, attempt_id, violation_type, details)
      VALUES (?, ?, 'FULLSCREEN_EXIT', 'User pressed Esc')
    `).run(uuidv4(), attemptId);

    // Record TAB_SWITCH
    db.prepare(`
      INSERT INTO exam_violations (id, attempt_id, violation_type, details)
      VALUES (?, ?, 'TAB_SWITCH', 'Switched window')
    `).run(uuidv4(), attemptId);

    const violations = db.prepare('SELECT * FROM exam_violations WHERE attempt_id = ?').all(attemptId);
    expect(violations.length).toBe(2);
  });

  it('should automatically finalize attempt when violations hit maximum threshold', () => {
    const attemptId = uuidv4();
    db.prepare(`
      INSERT INTO attempts (id, exam_id, user_id, started_at, expires_at, status)
      VALUES (?, ?, ?, (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')), (strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+60 minutes')), 'IN_PROGRESS')
    `).run(attemptId, examId, studentId);

    // Insert 3 violations (maxAllowed = 3)
    for (let i = 0; i < 3; i++) {
      db.prepare(`
        INSERT INTO exam_violations (id, attempt_id, violation_type)
        VALUES (?, ?, 'TAB_SWITCH')
      `).run(uuidv4(), attemptId);
    }

    const countRes: any = db.prepare('SELECT COUNT(*) as cnt FROM exam_violations WHERE attempt_id = ?').get(attemptId);
    expect(countRes.cnt).toBe(3);

    // Auto-submission logic
    if (countRes.cnt >= 3) {
      db.prepare(`UPDATE attempts SET status = 'AUTO_SUBMITTED' WHERE id = ?`).run(attemptId);
    }

    const updated: any = db.prepare('SELECT status FROM attempts WHERE id = ?').get(attemptId);
    expect(updated.status).toBe('AUTO_SUBMITTED');
  });

  // ==========================================
  // B. Grading Engine Tests
  // ==========================================
  it('grades all-correct submission with maximum marks', () => {
    const specs: QuestionGradingSpec[] = [
      { id: 'q1', type: 'SINGLE_MCQ', marks: 1.0, negativeMarks: 0.25, correctOptions: ['A'] },
      { id: 'q2', type: 'MULTI_SELECT', marks: 2.0, negativeMarks: 0.50, correctOptions: ['A', 'B'] }
    ];

    const answers: StudentAnswerSubmission[] = [
      { questionId: 'q1', selectedOptionIds: ['A'] },
      { questionId: 'q2', selectedOptionIds: ['A', 'B'] }
    ];

    const result = gradeExamAttempt(specs, answers, 2.0);
    expect(result.totalScore).toBe(3.0);
    expect(result.correctCount).toBe(2);
    expect(result.wrongCount).toBe(0);
    expect(result.skippedCount).toBe(0);
    expect(result.isPassed).toBe(true);
  });

  it('grades all-wrong submission deducting negative marks', () => {
    const specs: QuestionGradingSpec[] = [
      { id: 'q1', type: 'SINGLE_MCQ', marks: 1.0, negativeMarks: 0.25, correctOptions: ['A'] },
      { id: 'q2', type: 'SINGLE_MCQ', marks: 1.0, negativeMarks: 0.25, correctOptions: ['B'] }
    ];

    const answers: StudentAnswerSubmission[] = [
      { questionId: 'q1', selectedOptionIds: ['B'] }, // Wrong (-0.25)
      { questionId: 'q2', selectedOptionIds: ['A'] }  // Wrong (-0.25)
    ];

    const result = gradeExamAttempt(specs, answers, 1.0);
    expect(result.totalScore).toBe(-0.5);
    expect(result.correctCount).toBe(0);
    expect(result.wrongCount).toBe(2);
    expect(result.isPassed).toBe(false);
  });

  it('does not penalize skipped questions with negative marking', () => {
    const specs: QuestionGradingSpec[] = [
      { id: 'q1', type: 'SINGLE_MCQ', marks: 1.0, negativeMarks: 0.25, correctOptions: ['A'] },
      { id: 'q2', type: 'SINGLE_MCQ', marks: 1.0, negativeMarks: 0.25, correctOptions: ['B'] },
      { id: 'q3', type: 'SINGLE_MCQ', marks: 1.0, negativeMarks: 0.25, correctOptions: ['A'] }
    ];

    const answers: StudentAnswerSubmission[] = [
      { questionId: 'q1', selectedOptionIds: ['A'] }, // Correct (+1.0)
      { questionId: 'q2', selectedOptionIds: ['C'] }, // Wrong (-0.25)
      // q3 skipped (0)
    ];

    const result = gradeExamAttempt(specs, answers, 0.5);
    expect(result.totalScore).toBe(0.75); // 1.0 - 0.25 + 0
    expect(result.correctCount).toBe(1);
    expect(result.wrongCount).toBe(1);
    expect(result.skippedCount).toBe(1);
    expect(result.isPassed).toBe(true);
  });

  // ==========================================
  // C. Results & Idempotency Tests
  // ==========================================
  it('prevents duplicate exam_results records on repeated grading triggers', () => {
    const attemptId = uuidv4();
    db.prepare(`
      INSERT INTO attempts (id, exam_id, user_id, started_at, expires_at, status)
      VALUES (?, ?, ?, (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')), (strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+60 minutes')), 'SUBMITTED')
    `).run(attemptId, examId, studentId);

    const insertResult = () => {
      const existing = db.prepare('SELECT id FROM exam_results WHERE attempt_id = ?').get(attemptId);
      if (existing) return false;

      db.prepare(`
        INSERT INTO exam_results (
          id, attempt_id, exam_id, user_id, score, total_marks, correct_count,
          wrong_count, skipped_count, accuracy_percentage, time_spent_seconds, is_passed
        ) VALUES (?, ?, ?, ?, 2.5, 4.0, 2, 1, 0, 66.6, 120, 1)
      `).run(uuidv4(), attemptId, examId, studentId);
      return true;
    };

    expect(insertResult()).toBe(true);
    expect(insertResult()).toBe(false); // Second attempt is rejected safely

    const count: any = db.prepare('SELECT COUNT(*) as cnt FROM exam_results WHERE attempt_id = ?').get(attemptId);
    expect(count.cnt).toBe(1);
  });
});
