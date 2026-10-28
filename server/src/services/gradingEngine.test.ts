import { describe, it, expect } from 'vitest';
import { gradeExamAttempt, QuestionGradingSpec } from './gradingEngine';

describe('Exam Pure Auto-Grading Engine', () => {
  const sampleQuestions: QuestionGradingSpec[] = [
    {
      id: 'q1',
      type: 'SINGLE_MCQ',
      marks: 1.0,
      negativeMarks: 0.25,
      correctOptions: ['opt_a']
    },
    {
      id: 'q2',
      type: 'SINGLE_MCQ',
      marks: 1.0,
      negativeMarks: 0.25,
      correctOptions: ['opt_c']
    },
    {
      id: 'q3',
      type: 'MULTI_SELECT',
      marks: 2.0,
      negativeMarks: 0.5,
      correctOptions: ['opt_1', 'opt_3']
    },
    {
      id: 'q4',
      type: 'NUMERIC',
      marks: 1.0,
      negativeMarks: 0.25,
      correctOptions: [],
      correctNumeric: 14.5,
      numericTolerance: 0.05
    },
    {
      id: 'q5',
      type: 'FILL_BLANK',
      marks: 1.0,
      negativeMarks: 0.25,
      correctOptions: [],
      correctText: 'Bangladesh Bank'
    }
  ];

  it('calculates full marks for 100% correct answers', () => {
    const answers = [
      { questionId: 'q1', selectedOptionIds: ['opt_a'] },
      { questionId: 'q2', selectedOptionIds: ['opt_c'] },
      { questionId: 'q3', selectedOptionIds: ['opt_1', 'opt_3'] },
      { questionId: 'q4', numericAnswer: 14.52 },
      { questionId: 'q5', textAnswer: ' bangladesh bank ' }
    ];

    const result = gradeExamAttempt(sampleQuestions, answers, 4.0);
    expect(result.totalScore).toBe(6.0);
    expect(result.correctCount).toBe(5);
    expect(result.wrongCount).toBe(0);
    expect(result.skippedCount).toBe(0);
    expect(result.accuracyPercentage).toBe(100);
    expect(result.isPassed).toBe(true);
  });

  it('applies negative marking accurately for wrong answers without penalizing skipped questions', () => {
    const answers = [
      { questionId: 'q1', selectedOptionIds: ['opt_a'] }, // Correct (+1.0)
      { questionId: 'q2', selectedOptionIds: ['opt_b'] }, // Wrong (-0.25)
      // q3 skipped (0)
      { questionId: 'q4', numericAnswer: 20.0 }, // Wrong (-0.25)
      // q5 skipped (0)
    ];

    const result = gradeExamAttempt(sampleQuestions, answers, 1.0);
    // Score = 1.0 - 0.25 - 0.25 = 0.5
    expect(result.totalScore).toBe(0.5);
    expect(result.correctCount).toBe(1);
    expect(result.wrongCount).toBe(2);
    expect(result.skippedCount).toBe(2);
    expect(result.accuracyPercentage).toBe(33.33);
    expect(result.isPassed).toBe(false);
  });
});
