export interface QuestionGradingSpec {
  id: string;
  type: 'SINGLE_MCQ' | 'MULTI_SELECT' | 'TRUE_FALSE' | 'NUMERIC' | 'FILL_BLANK';
  marks: number;
  negativeMarks: number;
  correctOptions: string[];
  correctNumeric?: number;
  numericTolerance?: number;
  correctText?: string;
}

export interface StudentAnswerSubmission {
  questionId: string;
  selectedOptionIds?: string[];
  numericAnswer?: number;
  textAnswer?: string;
}

export interface QuestionGradeResult {
  questionId: string;
  isCorrect: boolean;
  isSkipped: boolean;
  isWrong: boolean;
  marksAwarded: number;
}

export interface ExamGradingOutput {
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  totalScore: number;
  maximumMarks: number;
  accuracyPercentage: number;
  isPassed: boolean;
  breakdown: QuestionGradeResult[];
}

/**
 * Pure function grading engine.
 * Never mutates state, adheres strictly to negative marking configuration,
 * handles numeric precision tolerances and multi-select edge cases.
 */
export function gradeExamAttempt(
  questions: QuestionGradingSpec[],
  answers: StudentAnswerSubmission[],
  passMarks: number
): ExamGradingOutput {
  const answerMap = new Map<string, StudentAnswerSubmission>();
  for (const ans of answers) {
    answerMap.set(ans.questionId, ans);
  }

  let correctCount = 0;
  let wrongCount = 0;
  let skippedCount = 0;
  let totalScore = 0;
  let maximumMarks = 0;
  const breakdown: QuestionGradeResult[] = [];

  for (const q of questions) {
    maximumMarks += q.marks;
    const sub = answerMap.get(q.id);

    // Determine if skipped
    let isSkipped = false;
    if (!sub) {
      isSkipped = true;
    } else if (
      (q.type === 'SINGLE_MCQ' || q.type === 'MULTI_SELECT' || q.type === 'TRUE_FALSE') &&
      (!sub.selectedOptionIds || sub.selectedOptionIds.length === 0)
    ) {
      isSkipped = true;
    } else if (q.type === 'NUMERIC' && (sub.numericAnswer === undefined || sub.numericAnswer === null)) {
      isSkipped = true;
    } else if (q.type === 'FILL_BLANK' && (!sub.textAnswer || sub.textAnswer.trim() === '')) {
      isSkipped = true;
    }

    if (isSkipped) {
      skippedCount++;
      breakdown.push({
        questionId: q.id,
        isCorrect: false,
        isSkipped: true,
        isWrong: false,
        marksAwarded: 0
      });
      continue;
    }

    // Evaluate answer correctness
    let isCorrect = false;
    if (q.type === 'SINGLE_MCQ' || q.type === 'TRUE_FALSE') {
      const selected = sub!.selectedOptionIds?.[0];
      const correct = q.correctOptions[0];
      if (selected && selected === correct) {
        isCorrect = true;
      }
    } else if (q.type === 'MULTI_SELECT') {
      const selected = new Set(sub!.selectedOptionIds || []);
      const correct = new Set(q.correctOptions);
      if (selected.size === correct.size && [...selected].every((id) => correct.has(id))) {
        isCorrect = true;
      }
    } else if (q.type === 'NUMERIC') {
      const given = sub!.numericAnswer!;
      if (q.correctNumeric === undefined || q.correctNumeric === null) {
        // Missing metadata: cannot award correct
        isCorrect = false;
      } else {
        const expected = q.correctNumeric;
        const tolerance = q.numericTolerance !== undefined && q.numericTolerance !== null ? q.numericTolerance : 0.0;
        if (Math.abs(given - expected) <= tolerance) {
          isCorrect = true;
        }
      }
    } else if (q.type === 'FILL_BLANK') {
      const given = (sub!.textAnswer || '').trim().replace(/\s+/g, ' ').toLowerCase();
      if (!q.correctText || q.correctText.trim() === '') {
        // Missing metadata: cannot award correct
        isCorrect = false;
      } else {
        const expected = q.correctText.trim().replace(/\s+/g, ' ').toLowerCase();
        if (given === expected) {
          isCorrect = true;
        }
      }
    }

    if (isCorrect) {
      correctCount++;
      totalScore += q.marks;
      breakdown.push({
        questionId: q.id,
        isCorrect: true,
        isSkipped: false,
        isWrong: false,
        marksAwarded: q.marks
      });
    } else {
      wrongCount++;
      totalScore -= q.negativeMarks;
      breakdown.push({
        questionId: q.id,
        isCorrect: false,
        isSkipped: false,
        isWrong: true,
        marksAwarded: -q.negativeMarks
      });
    }
  }

  // Prevent floating point anomalies (e.g. 1.2500000000000002)
  const normalizedScore = Math.round(totalScore * 100) / 100;
  const answeredCount = correctCount + wrongCount;
  const accuracyPercentage = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 10000) / 100 : 0;

  return {
    totalQuestions: questions.length,
    answeredCount,
    correctCount,
    wrongCount,
    skippedCount,
    totalScore: normalizedScore,
    maximumMarks: Math.round(maximumMarks * 100) / 100,
    accuracyPercentage,
    isPassed: normalizedScore >= passMarks,
    breakdown
  };
}
