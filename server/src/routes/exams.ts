import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { db } from '../db/schema';
import { authenticateToken, requireRole } from '../middleware/auth';
import { gradeExamAttempt, QuestionGradingSpec } from '../services/gradingEngine';

export const examsRouter = Router();

// ==========================================
// Zod Validation Schemas
// ==========================================
const examCreateSchema = z.object({
  title: z.string().min(3, 'Exam title is required (min 3 chars)'),
  titleBangla: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  category: z.string().default('BANK_RECRUITMENT'),
  type: z.enum(['CHAPTER_QUIZ', 'MODEL_TEST']).default('MODEL_TEST'),
  status: z.enum(['DRAFT', 'SCHEDULED', 'LIVE', 'CLOSED', 'RESULTS_PUBLISHED']).default('LIVE'),
  durationMinutes: z.number().int().min(1, 'Duration must be at least 1 minute'),
  totalMarks: z.number().min(1, 'Total marks must be positive'),
  passMarks: z.number().min(0, 'Pass marks must be non-negative'),
  negativeMarkingRate: z.number().min(0).default(0.25),
  allowedAttempts: z.number().int().min(1).default(1),
  startsAt: z.string().datetime({ offset: true }).or(z.string().min(10)),
  endsAt: z.string().datetime({ offset: true }).or(z.string().min(10)),
  resultReleaseMode: z.enum(['INSTANT', 'SCHEDULED', 'MANUAL']).default('INSTANT'),
  integrityEnabled: z.boolean().default(true),
  maxViolationsAllowed: z.number().int().min(1).default(3),
  questionIds: z.array(z.string()).optional(),
  sections: z.array(z.object({
    sectionName: z.string(),
    questionIds: z.array(z.string()),
    marksPerQuestion: z.number().default(1.0),
    negativeMarks: z.number().default(0.25)
  })).optional()
});

const examUpdateSchema = examCreateSchema.partial();

const autosaveSchema = z.object({
  attemptId: z.string().min(1),
  questionId: z.string().min(1),
  selectedOptionIds: z.array(z.string()).optional(),
  numericAnswer: z.number().optional().nullable(),
  textAnswer: z.string().optional().nullable(),
  isMarkedForReview: z.boolean().optional(),
  clientSequence: z.number().default(0)
});

// ==========================================
// 1. GET /api/exams - List Available Exams
// ==========================================
examsRouter.get('/', authenticateToken, (req: Request, res: Response) => {
  const isPrivileged = req.user?.role === 'INSTRUCTOR' || req.user?.role === 'ADMIN';
  const isMine = req.query.mine === 'true';

  let query = `
    SELECT e.id, e.title, e.title_bangla as titleBangla, e.description,
           e.category, e.type, e.status, e.duration_minutes as durationMinutes,
           e.total_marks as totalMarks, e.pass_marks as passMarks,
           e.negative_marking_rate as negativeMarkingRate,
           e.allowed_attempts as allowedAttempts,
           e.starts_at as startsAt, e.ends_at as endsAt,
           e.result_release_mode as resultReleaseMode,
           e.integrity_enabled as integrityEnabled,
           e.max_violations_allowed as maxViolationsAllowed,
           e.created_by as createdBy, e.created_at as createdAt,
           (SELECT COUNT(*) FROM exam_questions eq WHERE eq.exam_id = e.id) as questionCount
    FROM exams e
  `;
  const params: any[] = [];

  if (isMine && isPrivileged) {
    // Instructor / Admin in Builder mode filtering by their own exams
    query += ` WHERE e.created_by = ?`;
    params.push(req.user!.id);
  } else if (!isPrivileged) {
    // Normal students only see published / live / scheduled / closed exams
    query += ` WHERE e.status IN ('LIVE', 'SCHEDULED', 'CLOSED')`;
  }

  query += ` ORDER BY e.created_at DESC`;

  const exams = db.prepare(query).all(...params).map((e: any) => ({
    ...e,
    integrityEnabled: Boolean(e.integrityEnabled)
  }));

  res.json({ success: true, count: exams.length, exams });
});

// ==========================================
// 2. GET /api/exams/:id - Detailed Exam Metadata
// ==========================================
examsRouter.get('/:id', authenticateToken, (req: Request, res: Response) => {
  const exam: any = db.prepare(`
    SELECT e.id, e.title, e.title_bangla as titleBangla, e.description,
           e.category, e.type, e.status, e.duration_minutes as durationMinutes,
           e.total_marks as totalMarks, e.pass_marks as passMarks,
           e.negative_marking_rate as negativeMarkingRate,
           e.allowed_attempts as allowedAttempts,
           e.starts_at as startsAt, e.ends_at as endsAt,
           e.result_release_mode as resultReleaseMode,
           e.integrity_enabled as integrityEnabled,
           e.max_violations_allowed as maxViolationsAllowed,
           e.created_by as createdBy, e.created_at as createdAt
    FROM exams e
    WHERE e.id = ?
  `).get(req.params.id);

  if (!exam) {
    return res.status(404).json({ success: false, error: 'Exam not found' });
  }

  const isPrivileged = req.user?.role === 'INSTRUCTOR' || req.user?.role === 'ADMIN';

  // Fetch associated questions with options for preview & inspection
  const rawQuestions = db.prepare(`
    SELECT q.id as questionId, q.prompt, q.prompt_bangla as promptBangla, q.type,
           q.subject, q.chapter, q.topic, q.difficulty,
           eq.section_name as sectionName, eq.marks, eq.negative_marks as negativeMarks,
           eq.order_index as orderIndex
    FROM exam_questions eq
    JOIN questions q ON q.id = eq.question_id
    WHERE eq.exam_id = ?
    ORDER BY eq.order_index ASC
  `).all(exam.id);

  const questions = rawQuestions.map((q: any) => {
    const options = db.prepare(`
      SELECT id, option_key as optionKey, text, text_bangla as textBangla,
             is_correct as isCorrect, sort_order as sortOrder
      FROM question_options
      WHERE question_id = ?
      ORDER BY sort_order ASC
    `).all(q.questionId);

    return {
      ...q,
      options: options.map((opt: any) => ({
        id: opt.id,
        optionKey: opt.optionKey,
        text: opt.text,
        textBangla: opt.textBangla,
        ...(isPrivileged ? { isCorrect: Boolean(opt.isCorrect) } : {})
      }))
    };
  });

  const questionsSumMarks = questions.reduce((sum: number, q: any) => sum + (Number(q.marks) || 0), 0);

  res.json({
    success: true,
    exam: {
      ...exam,
      integrityEnabled: Boolean(exam.integrityEnabled),
      questionsSumMarks,
      questions
    }
  });
});

// ==========================================
// 2B. GET /api/exams/:examId/leaderboard - Competitive Leaderboard & Student Ranking
// ==========================================
examsRouter.get('/:examId/leaderboard', authenticateToken, (req: Request, res: Response) => {
  const { examId } = req.params;
  const currentUserId = req.user!.id;
  const isPrivileged = req.user?.role === 'INSTRUCTOR' || req.user?.role === 'ADMIN';

  // 1. Fetch exam configuration and result release mode
  const exam: any = db.prepare(`
    SELECT id, title, title_bangla, total_marks, pass_marks, negative_marking_rate,
           status, result_release_mode, ends_at, created_by
    FROM exams
    WHERE id = ?
  `).get(examId);

  if (!exam) {
    return res.status(404).json({ success: false, error: 'Exam not found' });
  }

  // 2. Result release enforcement
  // Instructors/Admins or exam owners can always view leaderboards.
  // For students, check result_release_mode:
  // - INSTANT: Always accessible once submitted.
  // - SCHEDULED: Accessible only after ends_at has passed.
  // - MANUAL: Accessible only when exam status is RESULTS_PUBLISHED or CLOSED.
  if (!isPrivileged && exam.created_by !== currentUserId) {
    const now = new Date();
    if (exam.result_release_mode === 'SCHEDULED' && now < new Date(exam.ends_at)) {
      return res.status(403).json({
        success: false,
        error: `Results and leaderboard are scheduled to be published after the exam window ends on ${exam.ends_at}.`
      });
    }

    if (exam.result_release_mode === 'MANUAL' && exam.status !== 'RESULTS_PUBLISHED' && exam.status !== 'CLOSED') {
      return res.status(403).json({
        success: false,
        error: 'Leaderboard results for this exam have not been published by the instructor yet.'
      });
    }
  }

  // 3. Query all best attempts per student with fair tie-breaking:
  // Tie-breaker order:
  // - score DESC
  // - wrong_count ASC (fewer errors penalized by negative marking wins)
  // - time_spent_seconds ASC (faster completion wins)
  // - created_at ASC (earliest submission wins)
  const rankedRows: any[] = db.prepare(`
    WITH RankedAttempts AS (
      SELECT r.id as result_id, r.attempt_id, r.exam_id, r.user_id, r.score, r.total_marks,
             r.correct_count, r.wrong_count, r.skipped_count, r.accuracy_percentage,
             r.time_spent_seconds, r.is_passed, r.created_at,
             u.name as student_name,
             ROW_NUMBER() OVER (
               PARTITION BY r.user_id
               ORDER BY r.score DESC, r.wrong_count ASC, r.time_spent_seconds ASC, r.created_at ASC
             ) as attempt_num
      FROM exam_results r
      JOIN users u ON u.id = r.user_id
      WHERE r.exam_id = ?
    )
    SELECT *
    FROM RankedAttempts
    WHERE attempt_num = 1
    ORDER BY score DESC, wrong_count ASC, time_spent_seconds ASC, created_at ASC
  `).all(examId);

  const totalParticipants = rankedRows.length;

  // 4. Compute explicit ranks, currentUser data, and top 10
  let currentUserRank: number | null = null;
  let currentUserResult: any = null;

  const leaderboard = rankedRows.map((row, index) => {
    const rank = index + 1;
    const isCurrentUser = row.user_id === currentUserId;

    const entry = {
      rank,
      userId: row.user_id,
      studentName: row.student_name || 'Anonymous Candidate',
      score: row.score,
      totalMarks: row.total_marks,
      accuracyPercentage: row.accuracy_percentage,
      correctCount: row.correct_count,
      wrongCount: row.wrong_count,
      skippedCount: row.skippedCount || row.skipped_count,
      timeSpentSeconds: row.time_spent_seconds,
      isPassed: Boolean(row.is_passed),
      submittedAt: row.created_at,
      isCurrentUser
    };

    if (isCurrentUser) {
      currentUserRank = rank;
      currentUserResult = entry;
    }

    return entry;
  });

  // Calculate percentile: (totalParticipants - rank) / totalParticipants * 100
  let currentUserPercentile: number | null = null;
  if (currentUserRank && totalParticipants > 0) {
    currentUserPercentile = totalParticipants === 1
      ? 100
      : Math.round(((totalParticipants - currentUserRank) / (totalParticipants - 1)) * 100);
  }

  // Slice top 10 for the general public view
  const top10 = leaderboard.slice(0, 10);

  // Compute exam aggregate stats for comparison
  let averageScore = 0;
  let highestScore = 0;
  let averageAccuracy = 0;

  if (totalParticipants > 0) {
    const totalScoreSum = leaderboard.reduce((acc, curr) => acc + curr.score, 0);
    const totalAccuracySum = leaderboard.reduce((acc, curr) => acc + curr.accuracyPercentage, 0);
    averageScore = Number((totalScoreSum / totalParticipants).toFixed(2));
    highestScore = leaderboard[0].score;
    averageAccuracy = Number((totalAccuracySum / totalParticipants).toFixed(1));
  }

  res.json({
    success: true,
    exam: {
      id: exam.id,
      title: exam.title,
      titleBangla: exam.title_bangla,
      totalMarks: exam.total_marks,
      passMarks: exam.pass_marks,
      negativeMarkingRate: exam.negative_marking_rate,
      resultReleaseMode: exam.result_release_mode
    },
    analytics: {
      totalParticipants,
      averageScore,
      highestScore,
      averageAccuracy
    },
    currentUser: currentUserResult
      ? {
          ...currentUserResult,
          percentile: currentUserPercentile
        }
      : null,
    top10,
    leaderboard: isPrivileged ? leaderboard : top10
  });
});

// ==========================================
// 3. POST /api/exams - Create Exam (Instructor/Admin)
// ==========================================
examsRouter.post('/', authenticateToken, requireRole('INSTRUCTOR', 'ADMIN'), (req: Request, res: Response) => {
  const validation = examCreateSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: validation.error.errors[0]?.message || 'Invalid exam configuration',
      details: validation.error.format()
    });
  }

  const data = validation.data;

  // Gather all target question IDs to validate before exam creation
  const targetQIds: string[] = [];
  if (data.sections && data.sections.length > 0) {
    for (const sec of data.sections) {
      if (sec.questionIds) targetQIds.push(...sec.questionIds);
    }
  } else if (data.questionIds && data.questionIds.length > 0) {
    targetQIds.push(...data.questionIds);
  }

  // Reject duplicate question assignments
  const seenQIds = new Set<string>();
  for (const qId of targetQIds) {
    if (seenQIds.has(qId)) {
      return res.status(400).json({ success: false, error: `Duplicate question assignment detected: ${qId}` });
    }
    seenQIds.add(qId);
  }

  // Validate that any MCQ/TRUE_FALSE/MULTI_SELECT questions have at least 2 options and required correct answers
  // Also enforce: Unapproved questions CANNOT appear in a LIVE exam
  for (const qId of targetQIds) {
    const q: any = db.prepare('SELECT id, type, prompt, correct_numeric, correct_text, is_approved FROM questions WHERE id = ?').get(qId);
    if (!q) {
      return res.status(400).json({ success: false, error: `Referenced question does not exist: ${qId}` });
    }

    if (data.status === 'LIVE' && !q.is_approved) {
      return res.status(400).json({
        success: false,
        error: `Cannot publish or start LIVE exam with unapproved question: "${q.prompt.substring(0, 40)}...". Question must be approved first.`
      });
    }

    if (q.type === 'SINGLE_MCQ' || q.type === 'MULTI_SELECT' || q.type === 'TRUE_FALSE') {
      const opts = db.prepare('SELECT id, is_correct FROM question_options WHERE question_id = ?').all(qId) as any[];
      if (opts.length < 2) {
        return res.status(400).json({
          success: false,
          error: `Cannot assign invalid question "${q.prompt.substring(0, 40)}...": Question type ${q.type} must have at least 2 options.`
        });
      }
      const correctOpts = opts.filter((o) => o.is_correct === 1);
      if (q.type === 'SINGLE_MCQ' || q.type === 'TRUE_FALSE') {
        if (correctOpts.length !== 1) {
          return res.status(400).json({
            success: false,
            error: `Cannot assign invalid question "${q.prompt.substring(0, 40)}...": ${q.type} must have exactly 1 correct answer.`
          });
        }
      } else if (q.type === 'MULTI_SELECT') {
        if (correctOpts.length < 1) {
          return res.status(400).json({
            success: false,
            error: `Cannot assign invalid question "${q.prompt.substring(0, 40)}...": MULTI_SELECT must have at least 1 correct answer.`
          });
        }
      }
    }
  }

  const examId = uuidv4();

  try {
    db.transaction(() => {
      db.prepare(`
        INSERT INTO exams (
          id, title, title_bangla, description, category, type, status,
          duration_minutes, total_marks, pass_marks, negative_marking_rate,
          allowed_attempts, starts_at, ends_at, result_release_mode,
          integrity_enabled, max_violations_allowed, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        examId,
        data.title,
        data.titleBangla || null,
        data.description || null,
        data.category,
        data.type,
        data.status,
        data.durationMinutes,
        data.totalMarks,
        data.passMarks,
        data.negativeMarkingRate,
        data.allowedAttempts,
        data.startsAt,
        data.endsAt,
        data.resultReleaseMode,
        data.integrityEnabled ? 1 : 0,
        data.maxViolationsAllowed,
        req.user!.id
      );

      const insertEq = db.prepare(`
        INSERT INTO exam_questions (id, exam_id, question_id, section_name, marks, negative_marks, order_index)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      let orderIndex = 0;

      // Handle sections if provided
      if (data.sections && data.sections.length > 0) {
        for (const sec of data.sections) {
          for (const qId of sec.questionIds) {
            insertEq.run(
              uuidv4(),
              examId,
              qId,
              sec.sectionName,
              sec.marksPerQuestion,
              sec.negativeMarks,
              orderIndex++
            );
          }
        }
      } else if (data.questionIds && data.questionIds.length > 0) {
        // Fallback to flat question list
        for (const qId of data.questionIds) {
          insertEq.run(
            uuidv4(),
            examId,
            qId,
            'General',
            1.0,
            data.negativeMarkingRate,
            orderIndex++
          );
        }
      }
    })();

    res.status(201).json({
      success: true,
      message: 'Exam created successfully.',
      examId
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 4. PUT /api/exams/:id - Update Exam (Instructor/Admin)
// ==========================================
examsRouter.put('/:id', authenticateToken, requireRole('INSTRUCTOR', 'ADMIN'), (req: Request, res: Response) => {
  const existing: any = db.prepare('SELECT id, status, created_by, negative_marking_rate FROM exams WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, error: 'Exam not found' });
  }

  if (req.user?.role === 'INSTRUCTOR' && existing.created_by && existing.created_by !== req.user.id) {
    return res.status(403).json({ success: false, error: 'Instructors can only edit exams they created' });
  }

  const validation = examUpdateSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: validation.error.errors[0]?.message || 'Invalid exam update'
    });
  }

  const data = validation.data;
  const hasQuestionUpdates = (data.sections !== undefined && data.sections.length >= 0) || (data.questionIds !== undefined && data.questionIds.length >= 0);

  if (hasQuestionUpdates) {
    // Safety check 1: Reject question reassignment if status is not DRAFT
    if (existing.status !== 'DRAFT') {
      return res.status(400).json({
        success: false,
        error: `Cannot modify questions on exam with status '${existing.status}'. Only DRAFT exams allow question modification.`
      });
    }

    // Safety check 2: Reject question reassignment if ANY attempt already exists for this exam
    const attemptCount: any = db.prepare('SELECT COUNT(*) as count FROM attempts WHERE exam_id = ?').get(req.params.id);
    if (attemptCount && attemptCount.count > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot modify questions because ${attemptCount.count} student attempt(s) already exist for this exam.`
      });
    }

    // Gather and validate target question IDs
    const targetQIds: string[] = [];
    if (data.sections && data.sections.length > 0) {
      for (const sec of data.sections) {
        if (sec.questionIds) targetQIds.push(...sec.questionIds);
      }
    } else if (data.questionIds && data.questionIds.length > 0) {
      targetQIds.push(...data.questionIds);
    }

    // Reject duplicate question assignments
    const seenQIds = new Set<string>();
    for (const qId of targetQIds) {
      if (seenQIds.has(qId)) {
        return res.status(400).json({ success: false, error: `Duplicate question assignment detected: ${qId}` });
      }
      seenQIds.add(qId);
    }

    // Validate questions exist and meet format requirements
    // Also enforce: Unapproved questions CANNOT appear in a LIVE exam
    const effectiveStatus = data.status || existing.status;
    for (const qId of targetQIds) {
      const q: any = db.prepare('SELECT id, type, prompt, is_approved FROM questions WHERE id = ?').get(qId);
      if (!q) {
        return res.status(400).json({ success: false, error: `Referenced question does not exist: ${qId}` });
      }

      if (effectiveStatus === 'LIVE' && !q.is_approved) {
        return res.status(400).json({
          success: false,
          error: `Cannot assign unapproved question "${q.prompt.substring(0, 40)}..." to a LIVE exam. Question must be approved first.`
        });
      }

      if (q.type === 'SINGLE_MCQ' || q.type === 'MULTI_SELECT' || q.type === 'TRUE_FALSE') {
        const opts = db.prepare('SELECT id, is_correct FROM question_options WHERE question_id = ?').all(qId) as any[];
        if (opts.length < 2) {
          return res.status(400).json({
            success: false,
            error: `Cannot assign invalid question "${q.prompt.substring(0, 40)}...": Question type ${q.type} must have at least 2 options.`
          });
        }
        const correctOpts = opts.filter((o) => o.is_correct === 1);
        if (q.type === 'SINGLE_MCQ' || q.type === 'TRUE_FALSE') {
          if (correctOpts.length !== 1) {
            return res.status(400).json({
              success: false,
              error: `Cannot assign invalid question "${q.prompt.substring(0, 40)}...": ${q.type} must have exactly 1 correct answer.`
            });
          }
        } else if (q.type === 'MULTI_SELECT') {
          if (correctOpts.length < 1) {
            return res.status(400).json({
              success: false,
              error: `Cannot assign invalid question "${q.prompt.substring(0, 40)}...": MULTI_SELECT must have at least 1 correct answer.`
            });
          }
        }
      }
    }
  }

  // Safety check 3: If status is being transitioned to LIVE without modifying questions, verify all assigned questions are approved
  if (data.status === 'LIVE' && existing.status !== 'LIVE') {
    const unapprovedRow: any = db.prepare(`
      SELECT q.id, q.prompt 
      FROM exam_questions eq 
      JOIN questions q ON q.id = eq.question_id 
      WHERE eq.exam_id = ? AND (q.is_approved = 0 OR q.is_approved IS NULL)
      LIMIT 1
    `).get(req.params.id);

    if (unapprovedRow) {
      return res.status(400).json({
        success: false,
        error: `Cannot publish exam to LIVE because assigned question "${unapprovedRow.prompt.substring(0, 40)}..." is not approved.`
      });
    }
  }

  try {
    const updateTx = db.transaction(() => {
      // 1. Update exams table metadata
      db.prepare(`
        UPDATE exams SET
          title = COALESCE(?, title),
          title_bangla = COALESCE(?, title_bangla),
          description = COALESCE(?, description),
          duration_minutes = COALESCE(?, duration_minutes),
          total_marks = COALESCE(?, total_marks),
          pass_marks = COALESCE(?, pass_marks),
          negative_marking_rate = COALESCE(?, negative_marking_rate),
          allowed_attempts = COALESCE(?, allowed_attempts),
          starts_at = COALESCE(?, starts_at),
          ends_at = COALESCE(?, ends_at),
          status = COALESCE(?, status),
          result_release_mode = COALESCE(?, result_release_mode),
          integrity_enabled = COALESCE(?, integrity_enabled),
          max_violations_allowed = COALESCE(?, max_violations_allowed)
        WHERE id = ?
      `).run(
        data.title,
        data.titleBangla,
        data.description,
        data.durationMinutes,
        data.totalMarks,
        data.passMarks,
        data.negativeMarkingRate,
        data.allowedAttempts,
        data.startsAt,
        data.endsAt,
        data.status,
        data.resultReleaseMode,
        data.integrityEnabled !== undefined ? (data.integrityEnabled ? 1 : 0) : null,
        data.maxViolationsAllowed,
        req.params.id
      );

      // 2. If question assignments provided, replace atomically
      if (hasQuestionUpdates) {
        db.prepare('DELETE FROM exam_questions WHERE exam_id = ?').run(req.params.id);

        const insertEq = db.prepare(`
          INSERT INTO exam_questions (id, exam_id, question_id, section_name, marks, negative_marks, order_index)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        let orderIndex = 0;
        const negRate = data.negativeMarkingRate !== undefined ? data.negativeMarkingRate : (existing.negative_marking_rate ?? 0.25);

        if (data.sections && data.sections.length > 0) {
          for (const sec of data.sections) {
            for (const qId of sec.questionIds) {
              insertEq.run(
                uuidv4(),
                req.params.id,
                qId,
                sec.sectionName,
                sec.marksPerQuestion,
                sec.negativeMarks,
                orderIndex++
              );
            }
          }
        } else if (data.questionIds && data.questionIds.length > 0) {
          for (const qId of data.questionIds) {
            insertEq.run(
              uuidv4(),
              req.params.id,
              qId,
              'General',
              1.0,
              negRate,
              orderIndex++
            );
          }
        }

        // Synchronize exams.total_marks with question sum if questions were updated and totalMarks was not explicitly overridden
        if (data.totalMarks === undefined) {
          const sumRow: any = db.prepare('SELECT COALESCE(SUM(marks), 0) as total FROM exam_questions WHERE exam_id = ?').get(req.params.id);
          if (sumRow && sumRow.total > 0) {
            db.prepare('UPDATE exams SET total_marks = ? WHERE id = ?').run(sumRow.total, req.params.id);
          }
        }
      }
    });

    updateTx();

    res.json({ success: true, message: 'Exam configuration updated.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 5. POST /api/exams/:examId/start - Start Attempt (Authoritative Timer)
// ==========================================
examsRouter.post('/:examId/start', authenticateToken, (req: Request, res: Response) => {
  const { examId } = req.params;
  const userId = req.user!.id;

  const exam: any = db.prepare('SELECT * FROM exams WHERE id = ?').get(examId);
  if (!exam) {
    return res.status(404).json({ success: false, error: 'Exam not found.' });
  }

  const now = new Date();
  const examStart = new Date(exam.starts_at);
  const examEnd = new Date(exam.ends_at);

  // Scheduling checks
  if (now < examStart) {
    return res.status(400).json({
      success: false,
      error: `Exam has not opened yet. Starts at ${exam.starts_at}.`
    });
  }

  if (now > examEnd) {
    return res.status(400).json({
      success: false,
      error: 'Exam window has ended.'
    });
  }

  // Check for existing IN_PROGRESS attempt to support reconnect/refresh without duplicate attempts or expiry extension
  const existingActiveAttempt: any = db.prepare(`
    SELECT * FROM attempts
    WHERE exam_id = ? AND user_id = ? AND status = 'IN_PROGRESS'
    ORDER BY started_at DESC LIMIT 1
  `).get(examId, userId);

  let attemptId: string;
  let authoritativeExpiresAt: string;
  let sessionToken: string;

  if (existingActiveAttempt) {
    if (now > new Date(existingActiveAttempt.expires_at)) {
      db.prepare(`UPDATE attempts SET status = 'AUTO_SUBMITTED', submitted_at = ? WHERE id = ?`)
        .run(now.toISOString(), existingActiveAttempt.id);
      return res.status(403).json({ success: false, error: 'Exam timer has expired. Attempt auto-submitted.' });
    }
    attemptId = existingActiveAttempt.id;
    authoritativeExpiresAt = existingActiveAttempt.expires_at;
    sessionToken = existingActiveAttempt.active_session_token || uuidv4();
  } else {
    // Check attempt limit in transaction for new attempts
    const pastAttempts: any = db.prepare(`
      SELECT COUNT(*) as count FROM attempts WHERE exam_id = ? AND user_id = ?
    `).get(examId, userId);

    if (pastAttempts.count >= exam.allowed_attempts) {
      return res.status(400).json({
        success: false,
        error: `You have reached the maximum allowed attempts (${exam.allowed_attempts}) for this exam.`
      });
    }

    // Authoritative ends_at = min(now + duration, exam.ends_at)
    const durationEnd = new Date(now.getTime() + exam.duration_minutes * 60 * 1000);
    authoritativeExpiresAt = (durationEnd < examEnd ? durationEnd : examEnd).toISOString();

    attemptId = uuidv4();
    sessionToken = uuidv4();

    db.prepare(`
      INSERT INTO attempts (id, exam_id, user_id, started_at, expires_at, status, active_session_token)
      VALUES (?, ?, ?, ?, ?, 'IN_PROGRESS', ?)
    `).run(attemptId, examId, userId, now.toISOString(), authoritativeExpiresAt, sessionToken);
  }

  // Retrieve questions safely WITHOUT correct answers or explanations (Zero Leak)
  const examQuestions = db.prepare(`
    SELECT q.id, q.subject, q.chapter, q.topic, q.difficulty, q.type,
           q.prompt, q.prompt_bangla as promptBangla,
           eq.section_name as sectionName, eq.marks, eq.negative_marks as negativeMarks,
           eq.order_index as orderIndex
    FROM exam_questions eq
    JOIN questions q ON q.id = eq.question_id
    WHERE eq.exam_id = ?
    ORDER BY eq.order_index ASC
  `).all(examId);

  const sanitizedQuestions = examQuestions.map((q: any, idx: number) => {
    const options = db.prepare(`
      SELECT id, option_key as optionKey, text, text_bangla as textBangla
      FROM question_options
      WHERE question_id = ?
      ORDER BY sort_order ASC
    `).all(q.id);

    return {
      id: q.id,
      questionNumber: idx + 1,
      sectionName: q.sectionName,
      subject: q.subject,
      chapter: q.chapter,
      topic: q.topic,
      difficulty: q.difficulty,
      type: q.type,
      prompt: q.prompt,
      promptBangla: q.promptBangla,
      marks: q.marks,
      negativeMarks: q.negativeMarks,
      options
    };
  });

  res.json({
    success: true,
    attemptId,
    examId,
    examTitle: exam.title,
    sessionToken,
    serverNow: now.toISOString(),
    expiresAt: authoritativeExpiresAt,
    durationMinutes: exam.duration_minutes,
    totalMarks: exam.total_marks,
    negativeMarkingRate: exam.negative_marking_rate,
    integrityConfig: {
      enabled: Boolean(exam.integrity_enabled),
      maxViolations: exam.max_violations_allowed
    },
    questions: sanitizedQuestions
  });
});

// ==========================================
// 6. GET /api/exams/attempts/:attemptId - Active Attempt State (Resume)
// ==========================================
examsRouter.get('/attempts/:attemptId', authenticateToken, (req: Request, res: Response) => {
  const { attemptId } = req.params;
  const userId = req.user!.id;

  const attempt: any = db.prepare(`
    SELECT a.*, e.title as exam_title, e.duration_minutes, e.integrity_enabled, e.max_violations_allowed
    FROM attempts a
    JOIN exams e ON e.id = a.exam_id
    WHERE a.id = ?
  `).get(attemptId);

  if (!attempt) {
    return res.status(404).json({ success: false, error: 'Attempt not found.' });
  }

  if (attempt.user_id !== userId && req.user!.role === 'STUDENT') {
    return res.status(403).json({ success: false, error: 'Unauthorized attempt access.' });
  }

  // Check if server timer expired
  const now = new Date();
  if (attempt.status === 'IN_PROGRESS' && now > new Date(attempt.expires_at)) {
    db.prepare(`UPDATE attempts SET status = 'AUTO_SUBMITTED', submitted_at = ? WHERE id = ?`).run(now.toISOString(), attemptId);
    attempt.status = 'AUTO_SUBMITTED';
  }

  // Retrieve saved answers for reconnect resume
  const answers = db.prepare(`
    SELECT question_id as questionId, selected_option_ids as selectedOptionIds,
           numeric_answer as numericAnswer, text_answer as textAnswer,
           is_marked_for_review as isMarkedForReview, client_sequence as clientSequence
    FROM attempt_answers
    WHERE attempt_id = ?
  `).all(attemptId).map((a: any) => ({
    ...a,
    selectedOptionIds: a.selectedOptionIds ? JSON.parse(a.selectedOptionIds) : [],
    isMarkedForReview: Boolean(a.isMarkedForReview)
  }));

  res.json({
    success: true,
    attempt: {
      id: attempt.id,
      examId: attempt.exam_id,
      examTitle: attempt.exam_title,
      status: attempt.status,
      startedAt: attempt.started_at,
      expiresAt: attempt.expires_at,
      serverNow: now.toISOString(),
      answers
    }
  });
});

// ==========================================
// 7. POST /api/exams/autosave - Idempotent Answer Autosave
// ==========================================
examsRouter.post('/autosave', authenticateToken, (req: Request, res: Response) => {
  const validation = autosaveSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: validation.error.errors[0]?.message || 'Invalid autosave format'
    });
  }

  const data = validation.data;

  const attempt: any = db.prepare('SELECT status, expires_at FROM attempts WHERE id = ?').get(data.attemptId);
  if (!attempt || attempt.status !== 'IN_PROGRESS') {
    return res.status(400).json({ success: false, error: 'Attempt is not active or has already ended.' });
  }

  // Authoritative server timer check
  if (new Date() > new Date(attempt.expires_at)) {
    try {
      finalizeAndGradeAttempt(data.attemptId, 'AUTO_SUBMITTED');
    } catch {
      db.prepare(`UPDATE attempts SET status = 'AUTO_SUBMITTED', submitted_at = ? WHERE id = ?`)
        .run(new Date().toISOString(), data.attemptId);
    }
    return res.status(403).json({ success: false, error: 'Exam timer has expired. Attempt auto-submitted.' });
  }

  // Check sequence freshness
  const existing: any = db.prepare(`
    SELECT client_sequence FROM attempt_answers WHERE attempt_id = ? AND question_id = ?
  `).get(data.attemptId, data.questionId);

  if (existing && existing.client_sequence > data.clientSequence) {
    return res.json({ success: true, saved: false, reason: 'Stale sequence discarded' });
  }

  const selectedJson = data.selectedOptionIds ? JSON.stringify(data.selectedOptionIds) : null;

  db.prepare(`
    INSERT INTO attempt_answers (
      id, attempt_id, question_id, selected_option_ids, numeric_answer,
      text_answer, is_marked_for_review, client_sequence, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')))
    ON CONFLICT(attempt_id, question_id) DO UPDATE SET
      selected_option_ids = excluded.selected_option_ids,
      numeric_answer = excluded.numeric_answer,
      text_answer = excluded.text_answer,
      is_marked_for_review = excluded.is_marked_for_review,
      client_sequence = excluded.client_sequence,
      updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  `).run(
    uuidv4(),
    data.attemptId,
    data.questionId,
    selectedJson,
    data.numericAnswer ?? null,
    data.textAnswer ?? null,
    data.isMarkedForReview ? 1 : 0,
    data.clientSequence
  );

  res.json({
    success: true,
    saved: true,
    expiresAt: attempt.expires_at,
    timestamp: new Date().toISOString()
  });
});

// ==========================================
// Shared Attempt Finalization & Grading Helper
// ==========================================
export function finalizeAndGradeAttempt(
  attemptId: string,
  preferredStatus?: 'SUBMITTED' | 'AUTO_SUBMITTED',
  idempotencyKey?: string
) {
  const attempt: any = db.prepare('SELECT * FROM attempts WHERE id = ?').get(attemptId);
  if (!attempt) {
    throw new Error('Attempt not found');
  }

  // Check if an exam_results row already exists (prevent duplicate results)
  const existingResult: any = db.prepare('SELECT * FROM exam_results WHERE attempt_id = ?').get(attemptId);
  if (existingResult) {
    return {
      success: true,
      alreadySubmitted: true,
      attemptId,
      status: attempt.status,
      result: existingResult,
      grade: {
        score: existingResult.score,
        maximumMarks: existingResult.total_marks,
        correctCount: existingResult.correct_count,
        wrongCount: existingResult.wrong_count,
        skippedCount: existingResult.skipped_count,
        accuracyPercentage: existingResult.accuracy_percentage,
        isPassed: Boolean(existingResult.is_passed),
        timeSpentSeconds: existingResult.time_spent_seconds
      }
    };
  }

  const now = new Date();
  const isAutoExpired = now > new Date(attempt.expires_at);
  const targetFinalStatus = preferredStatus || (isAutoExpired ? 'AUTO_SUBMITTED' : 'SUBMITTED');

  // Perform grading calculation
  const questionsRaw = db.prepare(`
    SELECT q.id, q.type, q.correct_numeric, q.numeric_tolerance, q.correct_text,
           eq.marks, eq.negative_marks
    FROM exam_questions eq
    JOIN questions q ON q.id = eq.question_id
    WHERE eq.exam_id = ?
  `).all(attempt.exam_id);

  const gradingSpecs: QuestionGradingSpec[] = questionsRaw.map((q: any) => {
    const correctOptions = db.prepare(`
      SELECT id FROM question_options WHERE question_id = ? AND is_correct = 1
    `).all(q.id).map((opt: any) => opt.id);

    return {
      id: q.id,
      type: q.type,
      marks: q.marks,
      negativeMarks: q.negative_marks,
      correctOptions,
      correctNumeric: q.correct_numeric !== null && q.correct_numeric !== undefined ? Number(q.correct_numeric) : undefined,
      numericTolerance: q.numeric_tolerance !== null && q.numeric_tolerance !== undefined ? Number(q.numeric_tolerance) : 0.0,
      correctText: q.correct_text ?? undefined
    };
  });

  const answersRaw = db.prepare(`
    SELECT question_id, selected_option_ids, numeric_answer, text_answer
    FROM attempt_answers
    WHERE attempt_id = ?
  `).all(attemptId);

  const answers = answersRaw.map((a: any) => ({
    questionId: a.question_id,
    selectedOptionIds: a.selected_option_ids ? JSON.parse(a.selected_option_ids) : [],
    numericAnswer: a.numeric_answer,
    textAnswer: a.text_answer
  }));

  const exam: any = db.prepare('SELECT pass_marks FROM exams WHERE id = ?').get(attempt.exam_id);
  const grade = gradeExamAttempt(gradingSpecs, answers, exam ? exam.pass_marks : 40.0);

  const startedMs = new Date(attempt.started_at).getTime();
  const endedMs = attempt.submitted_at ? new Date(attempt.submitted_at).getTime() : now.getTime();
  const timeSpentSeconds = Math.max(0, Math.floor((endedMs - startedMs) / 1000));

  const resultId = uuidv4();
  db.prepare(`
    INSERT INTO exam_results (
      id, attempt_id, exam_id, user_id, score, total_marks,
      correct_count, wrong_count, skipped_count, accuracy_percentage,
      time_spent_seconds, is_passed
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    resultId,
    attemptId,
    attempt.exam_id,
    attempt.user_id,
    grade.totalScore,
    grade.maximumMarks,
    grade.correctCount,
    grade.wrongCount,
    grade.skippedCount,
    grade.accuracyPercentage,
    timeSpentSeconds,
    grade.isPassed ? 1 : 0
  );

  // Update attempt status to GRADED and record submission time if missing
  const existingKey = attempt.idempotency_key || idempotencyKey || uuidv4();
  db.prepare(`
    UPDATE attempts
    SET status = 'GRADED',
        submitted_at = COALESCE(submitted_at, ?),
        idempotency_key = COALESCE(idempotency_key, ?)
    WHERE id = ?
  `).run(now.toISOString(), existingKey, attemptId);

  return {
    success: true,
    alreadySubmitted: false,
    attemptId,
    status: 'GRADED',
    grade: {
      score: grade.totalScore,
      maximumMarks: grade.maximumMarks,
      correctCount: grade.correctCount,
      wrongCount: grade.wrongCount,
      skippedCount: grade.skippedCount,
      accuracyPercentage: grade.accuracyPercentage,
      isPassed: grade.isPassed,
      timeSpentSeconds
    }
  };
}

// ==========================================
// 8. POST /api/exams/:attemptId/submit - Safe Transaction Submit (No Double-Submit)
// ==========================================
examsRouter.post('/:attemptId/submit', authenticateToken, async (req: Request, res: Response) => {
  const { attemptId } = req.params;
  const idempotencyKey = req.headers['x-idempotency-key'] as string;

  try {
    const executeSubmitTx = db.transaction(() => {
      const attempt: any = db.prepare('SELECT * FROM attempts WHERE id = ?').get(attemptId);
      if (!attempt) {
        throw new Error('Attempt not found');
      }

      // If already graded and result exists, return harmless idempotent response
      const existingResult = db.prepare('SELECT * FROM exam_results WHERE attempt_id = ?').get(attemptId);
      if (existingResult) {
        return {
          success: true,
          alreadySubmitted: true,
          status: attempt.status,
          attemptId,
          result: existingResult,
          grade: {
            score: (existingResult as any).score,
            maximumMarks: (existingResult as any).total_marks,
            correctCount: (existingResult as any).correct_count,
            wrongCount: (existingResult as any).wrong_count,
            skippedCount: (existingResult as any).skipped_count,
            accuracyPercentage: (existingResult as any).accuracy_percentage,
            isPassed: Boolean((existingResult as any).is_passed),
            timeSpentSeconds: (existingResult as any).time_spent_seconds
          }
        };
      }

      const now = new Date();
      const isAutoExpired = now > new Date(attempt.expires_at);
      const finalStatus = isAutoExpired ? 'AUTO_SUBMITTED' : 'SUBMITTED';
      const keyToUse = idempotencyKey || attempt.idempotency_key || uuidv4();

      // Atomic lock
      db.prepare(`
        UPDATE attempts
        SET status = ?, submitted_at = COALESCE(submitted_at, ?), idempotency_key = COALESCE(idempotency_key, ?)
        WHERE id = ?
      `).run(finalStatus, now.toISOString(), keyToUse, attemptId);

      return finalizeAndGradeAttempt(attemptId, finalStatus, keyToUse);
    });

    let result: any;
    let retries = 5;
    while (retries > 0) {
      try {
        result = executeSubmitTx.immediate();
        break;
      } catch (e: any) {
        if ((e.code === 'SQLITE_BUSY' || e.code === 'SQLITE_BUSY_SNAPSHOT') && retries > 1) {
          retries--;
          await new Promise((r) => setTimeout(r, 25));
        } else {
          throw e;
        }
      }
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 9. Post-Exam Question Review (Existing review endpoint preserved)
// ==========================================
examsRouter.get('/:attemptId/review', authenticateToken, (req: Request, res: Response) => {
  const { attemptId } = req.params;
  const userId = req.user!.id;

  const attempt: any = db.prepare(`
    SELECT a.*, e.title as exam_title, e.title_bangla as exam_title_bangla,
           e.pass_marks, e.negative_marking_rate, e.result_release_mode, e.status as exam_status, e.ends_at
    FROM attempts a
    JOIN exams e ON e.id = a.exam_id
    WHERE a.id = ?
  `).get(attemptId);

  if (!attempt) {
    return res.status(404).json({ success: false, error: 'Attempt not found.' });
  }

  const isPrivileged = req.user!.role === 'INSTRUCTOR' || req.user!.role === 'ADMIN';

  if (attempt.user_id !== userId && !isPrivileged) {
    return res.status(403).json({ success: false, error: 'Unauthorized review access.' });
  }

  // Result release policy enforcement for students:
  // If MANUAL: Only release if exam_status is 'RESULTS_PUBLISHED'
  // If SCHEDULED: Only release if exam window has ended or status is 'RESULTS_PUBLISHED'
  if (!isPrivileged) {
    const now = new Date();
    if (attempt.result_release_mode === 'MANUAL' && attempt.exam_status !== 'RESULTS_PUBLISHED') {
      return res.status(403).json({
        success: false,
        error: 'Results for this exam have not been published by the instructor yet.'
      });
    }

    if (attempt.result_release_mode === 'SCHEDULED' && attempt.exam_status !== 'RESULTS_PUBLISHED') {
      if (attempt.ends_at && now < new Date(attempt.ends_at)) {
        return res.status(403).json({
          success: false,
          error: `Results for this exam are scheduled to be released after the exam window ends on ${attempt.ends_at}.`
        });
      }
    }
  }

  const result: any = db.prepare('SELECT * FROM exam_results WHERE attempt_id = ?').get(attemptId);

  const examQuestions = db.prepare(`
    SELECT q.id, q.subject, q.chapter, q.topic, q.difficulty, q.type,
           q.prompt, q.prompt_bangla, q.explanation, q.explanation_bangla,
           q.correct_numeric, q.numeric_tolerance, q.correct_text,
           eq.section_name, eq.marks, eq.negative_marks, eq.order_index
    FROM exam_questions eq
    JOIN questions q ON q.id = eq.question_id
    WHERE eq.exam_id = ?
    ORDER BY eq.order_index ASC
  `).all(attempt.exam_id);

  const answersRaw = db.prepare(`
    SELECT question_id, selected_option_ids, numeric_answer, text_answer
    FROM attempt_answers
    WHERE attempt_id = ?
  `).all(attemptId);

  const answerMap = new Map();
  answersRaw.forEach((a: any) => {
    answerMap.set(a.question_id, {
      selectedOptionIds: a.selected_option_ids ? JSON.parse(a.selected_option_ids) : [],
      numericAnswer: a.numeric_answer,
      textAnswer: a.text_answer
    });
  });

  const reviewItems = examQuestions.map((q: any) => {
    const options = db.prepare(`
      SELECT id, option_key, text, text_bangla, is_correct
      FROM question_options
      WHERE question_id = ?
      ORDER BY sort_order ASC
    `).all(q.id);

    const studentAns = answerMap.get(q.id);
    const selectedIds = studentAns ? studentAns.selectedOptionIds : [];
    const correctIds = options.filter((o: any) => o.is_correct === 1).map((o: any) => o.id);

    let status: 'CORRECT' | 'WRONG' | 'SKIPPED' = 'SKIPPED';
    let marksAwarded = 0;

    if (q.type === 'NUMERIC') {
      const studentNum = studentAns?.numericAnswer;
      if (studentNum === undefined || studentNum === null) {
        status = 'SKIPPED';
        marksAwarded = 0;
      } else {
        const expected = q.correct_numeric;
        const tol = q.numeric_tolerance ?? 0.0;
        if (expected !== undefined && expected !== null && Math.abs(studentNum - expected) <= tol) {
          status = 'CORRECT';
          marksAwarded = q.marks;
        } else {
          status = 'WRONG';
          marksAwarded = -q.negative_marks;
        }
      }
    } else if (q.type === 'FILL_BLANK') {
      const studentTxt = studentAns?.textAnswer;
      if (!studentTxt || studentTxt.trim() === '') {
        status = 'SKIPPED';
        marksAwarded = 0;
      } else {
        const normGiven = studentTxt.trim().replace(/\s+/g, ' ').toLowerCase();
        const normExpected = (q.correct_text || '').trim().replace(/\s+/g, ' ').toLowerCase();
        if (normExpected !== '' && normGiven === normExpected) {
          status = 'CORRECT';
          marksAwarded = q.marks;
        } else {
          status = 'WRONG';
          marksAwarded = -q.negative_marks;
        }
      }
    } else {
      // SINGLE_MCQ, MULTI_SELECT, TRUE_FALSE
      if (!selectedIds || selectedIds.length === 0) {
        status = 'SKIPPED';
        marksAwarded = 0;
      } else {
        let isCorrect = false;
        if (q.type === 'MULTI_SELECT') {
          isCorrect = (selectedIds.length === correctIds.length) &&
            selectedIds.every((id: string) => correctIds.includes(id));
        } else {
          // SINGLE_MCQ / TRUE_FALSE
          isCorrect = selectedIds.length === 1 && selectedIds[0] === correctIds[0];
        }

        if (isCorrect) {
          status = 'CORRECT';
          marksAwarded = q.marks;
        } else {
          status = 'WRONG';
          marksAwarded = -q.negative_marks;
        }
      }
    }

    return {
      id: q.id,
      orderIndex: q.order_index,
      subject: q.subject,
      chapter: q.chapter,
      topic: q.topic,
      difficulty: q.difficulty,
      type: q.type,
      prompt: q.prompt,
      promptBangla: q.prompt_bangla,
      explanation: q.explanation,
      explanationBangla: q.explanation_bangla,
      marks: q.marks,
      negativeMarks: q.negative_marks,
      options,
      studentSelectedIds: selectedIds,
      studentNumericAnswer: studentAns?.numericAnswer ?? null,
      studentTextAnswer: studentAns?.textAnswer ?? null,
      correctNumeric: q.correct_numeric ?? null,
      numericTolerance: q.numeric_tolerance ?? 0.0,
      correctText: q.correct_text ?? null,
      status,
      marksAwarded
    };
  });

  res.json({
    success: true,
    attemptId,
    examTitle: attempt.exam_title,
    examTitleBangla: attempt.exam_title_bangla,
    result,
    reviewItems
  });
});

// ==========================================
// 10. POST /api/exams/violations - Secure Integrity Violation Reporter
// ==========================================
examsRouter.post('/violations', authenticateToken, async (req: Request, res: Response) => {
  const { attemptId, violationType, details } = req.body;
  const userId = req.user!.id;

  if (!attemptId || !violationType) {
    return res.status(400).json({ success: false, error: 'Missing attemptId or violationType.' });
  }

  // Verify attempt exists, belongs to caller, and is active
  const attempt: any = db.prepare(`
    SELECT a.*, e.integrity_enabled, e.max_violations_allowed
    FROM attempts a
    JOIN exams e ON e.id = a.exam_id
    WHERE a.id = ?
  `).get(attemptId);

  if (!attempt) {
    return res.status(404).json({ success: false, error: 'Attempt not found.' });
  }

  if (attempt.user_id !== userId && req.user!.role === 'STUDENT') {
    return res.status(403).json({ success: false, error: 'Forbidden. You do not own this attempt.' });
  }

  if (attempt.status !== 'IN_PROGRESS') {
    return res.status(400).json({ success: false, error: 'Attempt is not currently active.' });
  }

  // If exam integrity is disabled, ignore violation recording
  if (attempt.integrity_enabled === 0) {
    return res.json({ success: true, logged: false, reason: 'Integrity monitoring disabled for this exam.' });
  }

  try {
    const executeViolationTx = db.transaction(() => {
      // Prevent same-type duplicates within 2 seconds
      const sameTypeDuplicate: any = db.prepare(`
        SELECT id FROM exam_violations
        WHERE attempt_id = ? AND violation_type = ?
          AND (strftime('%s', 'now') - strftime('%s', occurred_at)) < 2
      `).get(attemptId, violationType);

      // Check for correlated navigation companion event (TAB_SWITCH <-> FULLSCREEN_EXIT within 3 seconds)
      let companionDuplicate: any = null;
      if (violationType === 'FULLSCREEN_EXIT' || violationType === 'TAB_SWITCH') {
        const companionType = violationType === 'FULLSCREEN_EXIT' ? 'TAB_SWITCH' : 'FULLSCREEN_EXIT';
        companionDuplicate = db.prepare(`
          SELECT id, occurred_at FROM exam_violations
          WHERE attempt_id = ? AND violation_type = ?
            AND (strftime('%s', 'now') - strftime('%s', occurred_at)) < 3
          ORDER BY occurred_at DESC LIMIT 1
        `).get(attemptId, companionType);
      }

      let wasLogged = false;
      let correlatedToId: string | null = null;

      if (!sameTypeDuplicate && !companionDuplicate) {
        // Genuine new violation strike
        const id = uuidv4();
        db.prepare(`
          INSERT INTO exam_violations (id, attempt_id, violation_type, details)
          VALUES (?, ?, ?, ?)
        `).run(id, attemptId, violationType, typeof details === 'object' ? JSON.stringify(details) : details || null);
        wasLogged = true;
      } else if (companionDuplicate && !sameTypeDuplicate) {
        // Record companion event into audit trail for forensic transparency with correlation tag without incrementing separate strike
        // Marked in details as correlated navigation event
        correlatedToId = companionDuplicate.id;
        const id = uuidv4();
        const parsedDetails = typeof details === 'object' ? { ...details, correlatedEventId: companionDuplicate.id, note: 'Co-navigation companion event (not double-struck)' } : { raw: details, correlatedEventId: companionDuplicate.id, note: 'Co-navigation companion event' };
        db.prepare(`
          INSERT INTO exam_violations (id, attempt_id, violation_type, details)
          VALUES (?, ?, ?, ?)
        `).run(id, attemptId, violationType, JSON.stringify(parsedDetails));
        wasLogged = false;
      }

      // Count distinct violation strikes:
      // A FULLSCREEN_EXIT / TAB_SWITCH pair within 3s counts as 1 strike.
      // We calculate effective strikes: total non-correlated strikes
      const allViolations: any[] = db.prepare(`
        SELECT id, violation_type, details, occurred_at
        FROM exam_violations
        WHERE attempt_id = ?
        ORDER BY occurred_at ASC
      `).all(attemptId);

      let effectiveStrikes = 0;
      let lastNavEventTime = 0;

      for (const v of allViolations) {
        // Check if details indicate correlated companion event
        let isCorrelated = false;
        try {
          if (v.details) {
            const parsed = JSON.parse(v.details);
            if (parsed.correlatedEventId) isCorrelated = true;
          }
        } catch {}

        if (isCorrelated) {
          // Companion event recorded for audit without adding strike
          continue;
        }

        const occurredSeconds = Math.floor(new Date(v.occurred_at).getTime() / 1000);
        if (v.violation_type === 'TAB_SWITCH' || v.violation_type === 'FULLSCREEN_EXIT') {
          if (lastNavEventTime > 0 && Math.abs(occurredSeconds - lastNavEventTime) < 3) {
            // Within 3-second window of another navigation strike
            continue;
          }
          lastNavEventTime = occurredSeconds;
        }
        effectiveStrikes++;
      }

      const maxAllowed = attempt.max_violations_allowed || 3;
      const exceeded = effectiveStrikes >= maxAllowed;

      if (exceeded) {
        // Automatically finalize attempt due to violation limit breach
        db.prepare(`
          UPDATE attempts
          SET status = 'AUTO_SUBMITTED', submitted_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
          WHERE id = ? AND status = 'IN_PROGRESS'
        `).run(attemptId);
      }

      return {
        logged: wasLogged,
        totalViolations: effectiveStrikes,
        maxAllowed,
        isTerminated: exceeded,
        correlated: Boolean(correlatedToId)
      };
    });

    let violationResult: any;
    let retries = 5;
    while (retries > 0) {
      try {
        violationResult = executeViolationTx.immediate();
        break;
      } catch (e: any) {
        if ((e.code === 'SQLITE_BUSY' || e.code === 'SQLITE_BUSY_SNAPSHOT') && retries > 1) {
          retries--;
          await new Promise(r => setTimeout(r, 20));
        } else {
          throw e;
        }
      }
    }

    res.json({
      success: true,
      logged: violationResult.logged,
      totalViolations: violationResult.totalViolations,
      maxAllowed: violationResult.maxAllowed,
      isTerminated: violationResult.isTerminated,
      correlated: violationResult.correlated,
      message: violationResult.isTerminated ? 'Maximum integrity violations exceeded. Attempt auto-submitted.' : undefined
    });
  } catch (err: any) {
    console.error('[VIOLATIONS ROUTE ERROR]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 12. GET /api/exams/:id/submissions - Instructor/Admin Student Results & Integrity Review
// ==========================================
examsRouter.get('/:id/submissions', authenticateToken, requireRole('INSTRUCTOR', 'ADMIN'), (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUserId = req.user!.id;
  const isAdmin = req.user?.role === 'ADMIN';

  // 1. Fetch exam metadata and verify ownership
  const exam: any = db.prepare(`
    SELECT id, title, title_bangla, total_marks, pass_marks, negative_marking_rate,
           status, result_release_mode, ends_at, created_by
    FROM exams
    WHERE id = ?
  `).get(id);

  if (!exam) {
    return res.status(404).json({ success: false, error: 'Exam not found' });
  }

  // Server-side ownership check: Instructors can only view submissions for exams they created
  if (!isAdmin && exam.created_by && exam.created_by !== currentUserId) {
    return res.status(403).json({
      success: false,
      error: 'Access denied: You can only view student submissions and integrity logs for exams you created.'
    });
  }

  // 2. Fetch all student submissions/attempts for this exam
  const submissions = db.prepare(`
    SELECT a.id as attempt_id, a.user_id, a.status as attempt_status,
           a.started_at, a.submitted_at, r.time_spent_seconds as attempt_time_spent,
           u.name as student_name,
           r.id as result_id, r.score, r.total_marks, r.correct_count, r.wrong_count,
           r.skipped_count, r.accuracy_percentage, r.is_passed, r.created_at as graded_at,
           (SELECT COUNT(*) FROM exam_violations ev WHERE ev.attempt_id = a.id) as violation_count
    FROM attempts a
    JOIN users u ON u.id = a.user_id
    LEFT JOIN exam_results r ON r.attempt_id = a.id
    WHERE a.exam_id = ?
    ORDER BY a.started_at DESC
  `).all(id);

  // 3. Fetch all recorded integrity violations for this exam
  const violations = db.prepare(`
    SELECT ev.id, ev.attempt_id, ev.violation_type, ev.details, ev.occurred_at,
           u.name as student_name, a.user_id
    FROM exam_violations ev
    JOIN attempts a ON a.id = ev.attempt_id
    JOIN users u ON u.id = a.user_id
    WHERE a.exam_id = ?
    ORDER BY ev.occurred_at DESC
  `).all(id);

  // 4. Compute aggregate statistics
  const totalAttempts = submissions.length;
  const gradedAttempts = submissions.filter((s: any) => s.result_id);
  const totalViolations = violations.length;

  let averageScore = 0;
  let highestScore = 0;
  let passCount = 0;

  if (gradedAttempts.length > 0) {
    const totalScore = gradedAttempts.reduce((acc: number, curr: any) => acc + (curr.score || 0), 0);
    averageScore = Number((totalScore / gradedAttempts.length).toFixed(2));
    highestScore = Math.max(...gradedAttempts.map((g: any) => g.score || 0));
    passCount = gradedAttempts.filter((g: any) => Boolean(g.is_passed)).length;
  }

  res.json({
    success: true,
    exam: {
      id: exam.id,
      title: exam.title,
      titleBangla: exam.title_bangla,
      totalMarks: exam.total_marks,
      passMarks: exam.pass_marks,
      status: exam.status,
      resultReleaseMode: exam.result_release_mode,
      createdBy: exam.created_by
    },
    analytics: {
      totalAttempts,
      gradedCount: gradedAttempts.length,
      averageScore,
      highestScore,
      passCount,
      passRatePercentage: gradedAttempts.length > 0 ? Math.round((passCount / gradedAttempts.length) * 100) : 0,
      totalViolations
    },
    submissions: submissions.map((s: any) => ({
      attemptId: s.attempt_id,
      userId: s.user_id,
      studentName: s.student_name || 'Anonymous Student',
      attemptStatus: s.attempt_status,
      startedAt: s.started_at,
      submittedAt: s.submitted_at,
      timeSpentSeconds: s.attempt_time_spent,
      resultId: s.result_id,
      score: s.score,
      totalMarks: s.total_marks,
      correctCount: s.correct_count,
      wrongCount: s.wrong_count,
      skippedCount: s.skipped_count,
      accuracyPercentage: s.accuracy_percentage,
      isPassed: Boolean(s.is_passed),
      gradedAt: s.graded_at,
      violationCount: s.violation_count
    })),
    violations: violations.map((v: any) => {
      let parsedDetails = v.details;
      try {
        if (typeof v.details === 'string') parsedDetails = JSON.parse(v.details);
      } catch {}
      return {
        id: v.id,
        attemptId: v.attempt_id,
        userId: v.user_id,
        studentName: v.student_name,
        violationType: v.violation_type,
        details: parsedDetails,
        occurredAt: v.occurred_at
      };
    })
  });
});
