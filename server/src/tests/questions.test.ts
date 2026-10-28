import { describe, it, expect, beforeEach } from 'vitest';
import { db, initDatabase } from '../db/schema';
import { v4 as uuidv4 } from 'uuid';

describe('Phase 3 Question Bank & Bilingual Content Tests', () => {
  beforeEach(() => {
    initDatabase();
  });

  it('should store and retrieve bilingual Bangla and English question content intact', () => {
    const questionId = uuidv4();
    const englishPrompt = 'If $x^2 + 5x + 6 = 0$, what are the roots of the equation?';
    const banglaPrompt = 'যদি $x^2 + 5x + 6 = 0$ হয়, তবে সমীকরণটির মূলদ্বয় কত?';
    const banglaExplanation = 'উৎপাদকে বিশ্লেষণ: $(x + 2)(x + 3) = 0 \\implies x = -2, -3$';

    db.prepare(`
      INSERT INTO questions (
        id, subject, chapter, topic, difficulty, type,
        prompt, prompt_bangla, explanation, explanation_bangla,
        default_marks, default_negative_marks, is_approved
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      questionId,
      'Quantitative Aptitude',
      'Algebra',
      'Quadratic Equations',
      'MEDIUM',
      'SINGLE_MCQ',
      englishPrompt,
      banglaPrompt,
      'Factoring gives (x+2)(x+3)=0 so roots are -2 and -3',
      banglaExplanation,
      1.0,
      0.25,
      1
    );

    const retrieved: any = db.prepare('SELECT * FROM questions WHERE id = ?').get(questionId);

    expect(retrieved).toBeDefined();
    expect(retrieved.prompt).toBe(englishPrompt);
    expect(retrieved.prompt_bangla).toBe(banglaPrompt);
    expect(retrieved.explanation_bangla).toBe(banglaExplanation);
  });

  it('should insert question options with sort order and correctness flag', () => {
    const questionId = uuidv4();
    db.prepare(`
      INSERT INTO questions (id, subject, chapter, topic, difficulty, type, prompt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(questionId, 'English', 'Grammar', 'Prepositions', 'EASY', 'SINGLE_MCQ', 'He is proficient ___ English.');

    const insertOpt = db.prepare(`
      INSERT INTO question_options (id, question_id, option_key, text, is_correct, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertOpt.run(uuidv4(), questionId, 'A', 'at', 0, 0);
    insertOpt.run(uuidv4(), questionId, 'B', 'in', 1, 1);
    insertOpt.run(uuidv4(), questionId, 'C', 'with', 0, 2);
    insertOpt.run(uuidv4(), questionId, 'D', 'on', 0, 3);

    const options = db.prepare('SELECT * FROM question_options WHERE question_id = ? ORDER BY sort_order ASC').all(questionId);

    expect(options.length).toBe(4);
    const correctOpt: any = options.find((o: any) => o.is_correct === 1);
    expect(correctOpt).toBeDefined();
    expect(correctOpt.option_key).toBe('B');
    expect(correctOpt.text).toBe('in');
  });

  it('should enforce cascade deletion when question is removed', () => {
    const questionId = uuidv4();
    db.prepare(`
      INSERT INTO questions (id, subject, chapter, topic, difficulty, type, prompt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(questionId, 'Bangla', 'ব্যাকরণ', 'সন্ধি', 'EASY', 'SINGLE_MCQ', 'বিদ্যালয় শব্দের সন্ধি বিচ্ছেদ কোনটি?');

    db.prepare(`
      INSERT INTO question_options (id, question_id, option_key, text, is_correct, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), questionId, 'A', 'বিদ্যা + আলয়', 1, 0);

    // Verify option exists
    const beforeOpts = db.prepare('SELECT * FROM question_options WHERE question_id = ?').all(questionId);
    expect(beforeOpts.length).toBe(1);

    // Delete question
    db.prepare('DELETE FROM questions WHERE id = ?').run(questionId);

    // Verify cascaded deletion
    const afterOpts = db.prepare('SELECT * FROM question_options WHERE question_id = ?').all(questionId);
    expect(afterOpts.length).toBe(0);
  });
});
