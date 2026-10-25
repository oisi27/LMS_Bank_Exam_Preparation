import { Router, Request, Response } from 'express';
import { db } from '../db/schema';
import { authenticateToken } from '../middleware/auth';

export const dashboardRouter = Router();

// Student Analytics & Progress Dashboard
dashboardRouter.get('/student-summary', authenticateToken, (req: Request, res: Response) => {
  const userId = req.user!.id;

  // Recent Exam Results
  const recentResults = db.prepare(`
    SELECT r.*, e.title as exam_title, e.category
    FROM exam_results r
    JOIN exams e ON e.id = r.exam_id
    WHERE r.user_id = ?
    ORDER BY r.created_at DESC
    LIMIT 5
  `).all(userId);

  // Aggregated Overall Performance
  const stats: any = db.prepare(`
    SELECT 
      COUNT(*) as total_exams_taken,
      COALESCE(AVG(score), 0) as average_score,
      COALESCE(AVG(accuracy_percentage), 0) as average_accuracy,
      COALESCE(SUM(correct_count), 0) as total_correct,
      COALESCE(SUM(wrong_count), 0) as total_wrong
    FROM exam_results
    WHERE user_id = ?
  `).get(userId);

  // Detailed Topic & Chapter Accuracy Analytics (Phase 7 Milestone 1 Step 4)
  // Queries all questions associated with finalized attempts for the student
  const finalizedAttemptsQuestions = db.prepare(`
    SELECT 
      a.id as attempt_id,
      q.id as question_id,
      q.subject,
      q.chapter,
      q.topic,
      q.type,
      q.correct_numeric,
      q.numeric_tolerance,
      q.correct_text,
      aa.selected_option_ids,
      aa.numeric_answer,
      aa.text_answer
    FROM attempts a
    JOIN exam_questions eq ON eq.exam_id = a.exam_id
    JOIN questions q ON q.id = eq.question_id
    LEFT JOIN attempt_answers aa ON aa.attempt_id = a.id AND aa.question_id = q.id
    WHERE a.user_id = ? AND a.status IN ('GRADED', 'SUBMITTED', 'AUTO_SUBMITTED')
  `).all(userId) as any[];

  // Retrieve correct options for any relevant MCQ/Multi-select/True-False questions
  const correctOptionsRows = db.prepare(`
    SELECT question_id, id FROM question_options WHERE is_correct = 1
  `).all() as any[];

  const correctOptionsMap = new Map<string, Set<string>>();
  for (const opt of correctOptionsRows) {
    if (!correctOptionsMap.has(opt.question_id)) {
      correctOptionsMap.set(opt.question_id, new Set<string>());
    }
    correctOptionsMap.get(opt.question_id)!.add(opt.id);
  }

  // Topic metrics map: key = subject ::: chapter ::: topic
  const topicMap = new Map<string, {
    subject: string;
    chapter: string;
    topic: string;
    totalQuestions: number;
    attemptedCount: number;
    correctCount: number;
    wrongCount: number;
    skippedCount: number;
  }>();

  for (const row of finalizedAttemptsQuestions) {
    const subject = (row.subject && row.subject.trim()) || 'General Aptitude';
    const chapter = (row.chapter && row.chapter.trim()) || 'Core Chapter';
    const topic = (row.topic && row.topic.trim()) || chapter || 'Key Concepts';
    const key = `${subject}:::${chapter}:::${topic}`;

    if (!topicMap.has(key)) {
      topicMap.set(key, {
        subject,
        chapter,
        topic,
        totalQuestions: 0,
        attemptedCount: 0,
        correctCount: 0,
        wrongCount: 0,
        skippedCount: 0
      });
    }

    const t = topicMap.get(key)!;
    t.totalQuestions++;

    let isSkipped = false;
    let isCorrect = false;

    let selectedIds: string[] = [];
    if (row.selected_option_ids) {
      try {
        selectedIds = JSON.parse(row.selected_option_ids);
      } catch {
        selectedIds = [];
      }
    }

    if (row.type === 'SINGLE_MCQ' || row.type === 'MULTI_SELECT' || row.type === 'TRUE_FALSE') {
      if (!selectedIds || selectedIds.length === 0) {
        isSkipped = true;
      } else {
        const correctSet = correctOptionsMap.get(row.question_id) || new Set<string>();
        if (row.type === 'MULTI_SELECT') {
          isCorrect = selectedIds.length === correctSet.size && selectedIds.every(id => correctSet.has(id));
        } else {
          isCorrect = selectedIds.length === 1 && correctSet.has(selectedIds[0]);
        }
      }
    } else if (row.type === 'NUMERIC') {
      if (row.numeric_answer === null || row.numeric_answer === undefined) {
        isSkipped = true;
      } else {
        const expected = row.correct_numeric;
        const tol = row.numeric_tolerance ?? 0.0;
        isCorrect = expected !== null && expected !== undefined && Math.abs(Number(row.numeric_answer) - Number(expected)) <= tol;
      }
    } else if (row.type === 'FILL_BLANK') {
      if (!row.text_answer || row.text_answer.trim() === '') {
        isSkipped = true;
      } else {
        const normGiven = row.text_answer.trim().replace(/\s+/g, ' ').toLowerCase();
        const normExpected = (row.correct_text || '').trim().replace(/\s+/g, ' ').toLowerCase();
        isCorrect = normExpected !== '' && normGiven === normExpected;
      }
    } else {
      isSkipped = true;
    }

    if (isSkipped) {
      t.skippedCount++;
    } else if (isCorrect) {
      t.attemptedCount++;
      t.correctCount++;
    } else {
      t.attemptedCount++;
      t.wrongCount++;
    }
  }

  // Build aggregated topicAnalytics array
  const topicAnalytics = Array.from(topicMap.values()).map(t => {
    // Accuracy percentage based on attempted (answered) questions; 0 if none attempted
    const accuracy = t.attemptedCount > 0 ? Math.round((t.correctCount / t.attemptedCount) * 100) : 0;
    // Mark as weak topic if student answered at least 1 question and accuracy < 50%
    const isWeak = t.attemptedCount >= 1 && accuracy < 50;
    return {
      subject: t.subject,
      chapter: t.chapter,
      topic: t.topic,
      totalQuestions: t.totalQuestions,
      attemptedCount: t.attemptedCount,
      correctCount: t.correctCount,
      wrongCount: t.wrongCount,
      skippedCount: t.skippedCount,
      accuracyPercentage: accuracy,
      isWeak
    };
  });

  // Weak topics list: prioritize lowest accuracy and highest attempted count
  const weakTopics = topicAnalytics
    .filter(t => t.isWeak)
    .sort((a, b) => a.accuracyPercentage - b.accuracyPercentage || b.attemptedCount - a.attemptedCount);

  // Subject-wise accuracy breakdown
  const subjectMap = new Map<string, { totalQuestions: number; attempted: number; correct: number }>();
  for (const t of topicAnalytics) {
    if (!subjectMap.has(t.subject)) {
      subjectMap.set(t.subject, { totalQuestions: 0, attempted: 0, correct: 0 });
    }
    const s = subjectMap.get(t.subject)!;
    s.totalQuestions += t.totalQuestions;
    s.attempted += t.attemptedCount;
    s.correct += t.correctCount;
  }

  const subjectAccuracy = Array.from(subjectMap.entries()).map(([subject, data]) => ({
    subject,
    totalQuestions: data.totalQuestions,
    attemptedCount: data.attempted,
    correctCount: data.correct,
    accuracyPercentage: data.attempted > 0 ? Math.round((data.correct / data.attempted) * 100) : 0
  })).sort((a, b) => b.attemptedCount - a.attemptedCount);

  // Scheduled & Active Mock Tests with dynamic server-authoritative availability
  const serverNow = new Date();
  const rawExams = db.prepare(`
    SELECT id, title, title_bangla, duration_minutes, total_marks, starts_at, ends_at, status
    FROM exams
    WHERE status IN ('SCHEDULED', 'LIVE', 'CLOSED')
    ORDER BY starts_at ASC
  `).all();

  const upcomingExams = rawExams
    .map((e: any) => {
      const examStart = new Date(e.starts_at);
      const examEnd = new Date(e.ends_at);

      let calculatedStatus: 'LIVE' | 'UPCOMING' | 'ENDED' = 'ENDED';
      let isAvailable = false;

      if (e.status === 'CLOSED' || serverNow > examEnd) {
        calculatedStatus = 'ENDED';
        isAvailable = false;
      } else if (serverNow < examStart) {
        calculatedStatus = 'UPCOMING';
        isAvailable = false;
      } else if (serverNow >= examStart && serverNow <= examEnd && e.status === 'LIVE') {
        calculatedStatus = 'LIVE';
        isAvailable = true;
      } else {
        calculatedStatus = 'UPCOMING';
        isAvailable = false;
      }

      // Generate human-friendly session tag and short unique session code (e.g., #d867)
      const sessionCode = e.id.slice(0, 8);
      const startDateFormatted = e.starts_at ? e.starts_at.split('T')[0] : '';
      const sessionTag = startDateFormatted ? `Session ${startDateFormatted} (${sessionCode})` : `Session #${sessionCode}`;

      return {
        id: e.id,
        title: e.title,
        title_bangla: e.title_bangla,
        duration_minutes: e.duration_minutes,
        total_marks: e.total_marks,
        starts_at: e.starts_at,
        ends_at: e.ends_at,
        calculatedStatus,
        isAvailable,
        sessionCode,
        sessionTag
      };
    })
    .sort((a: any, b: any) => {
      // Prioritize LIVE (0) > UPCOMING (1) > ENDED (2)
      const priority: Record<string, number> = { LIVE: 0, UPCOMING: 1, ENDED: 2 };
      const diff = (priority[a.calculatedStatus] ?? 2) - (priority[b.calculatedStatus] ?? 2);
      if (diff !== 0) return diff;
      return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
    });

  // Student Learning Progress Across Published Courses (Phase 7 Milestone 1 Step 3)
  const rawCourseProgress = db.prepare(`
    SELECT 
      c.id as course_id,
      c.title,
      c.title_bangla,
      c.slug,
      COUNT(DISTINCT l.id) as total_lessons,
      COUNT(DISTINCT lp.lesson_id) as completed_lessons
    FROM courses c
    LEFT JOIN course_modules m ON m.course_id = c.id
    LEFT JOIN lessons l ON l.module_id = m.id
    LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = ?
    WHERE c.status = 'PUBLISHED'
    GROUP BY c.id
    ORDER BY c.created_at ASC
  `).all(userId) as any[];

  const courseProgress = rawCourseProgress.map((cp: any) => {
    const total = cp.total_lessons || 0;
    const completed = cp.completed_lessons || 0;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return {
      courseId: cp.course_id,
      title: cp.title,
      titleBangla: cp.title_bangla,
      slug: cp.slug,
      totalLessons: total,
      completedLessons: completed,
      progressPercentage: percentage
    };
  });

  // Retrieve Student Personalized Preparation Goal (Phase 1)
  const studentUser: any = db.prepare(`
    SELECT id, name, email, target_exam, target_date, target_bank, target_position
    FROM users
    WHERE id = ?
  `).get(userId);

  let targetBank = studentUser?.target_bank || null;
  let targetPosition = studentUser?.target_position || null;
  const targetDate = studentUser?.target_date || null;
  const targetExam = studentUser?.target_exam || null;

  // Fallback parsing for existing users whose target_exam was previously stored as a combined string
  if (!targetBank && targetExam) {
    if (targetExam.toLowerCase().includes('bangladesh bank')) {
      targetBank = 'Bangladesh Bank';
      if (targetExam.toLowerCase().includes('assistant director') || targetExam.toLowerCase().includes('ad')) {
        targetPosition = targetPosition || 'Assistant Director';
      } else if (targetExam.toLowerCase().includes('officer')) {
        targetPosition = targetPosition || 'Officer';
      }
    } else if (targetExam.toLowerCase().includes('sonali') || targetExam.toLowerCase().includes('janata')) {
      targetBank = 'Sonali Bank';
      targetPosition = targetPosition || 'Officer Cash';
    } else if (targetExam.toLowerCase().includes('agrani') || targetExam.toLowerCase().includes('rupali')) {
      targetBank = 'Agrani Bank';
      targetPosition = targetPosition || 'Officer';
    } else if (targetExam.toLowerCase().includes('combined 8')) {
      targetBank = 'Combined 8 Banks';
      targetPosition = targetPosition || 'Senior Officer';
    } else {
      targetBank = targetExam;
      targetPosition = targetPosition || 'Officer';
    }
  }

  // Calculate Days Remaining using Asia/Dhaka calendar dates (UTC+6)
  let daysRemaining: number | null = null;
  if (targetDate) {
    try {
      // Current date formatted in Asia/Dhaka
      const dhakaDateString = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Dhaka',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date());

      // Compare targetDate (YYYY-MM-DD) with dhakaDateString (YYYY-MM-DD)
      const [tYear, tMonth, tDay] = targetDate.split('T')[0].split('-').map(Number);
      const [cYear, cMonth, cDay] = dhakaDateString.split('-').map(Number);

      const targetUtcMidnight = Date.UTC(tYear, tMonth - 1, tDay);
      const currentUtcMidnight = Date.UTC(cYear, cMonth - 1, cDay);

      const diffMs = targetUtcMidnight - currentUtcMidnight;
      daysRemaining = Math.round(diffMs / (1000 * 60 * 60 * 24));
    } catch {
      daysRemaining = null;
    }
  }

  res.json({
    stats: {
      totalExamsTaken: stats.total_exams_taken,
      averageScore: Math.round(stats.average_score * 100) / 100,
      averageAccuracy: Math.round(stats.average_accuracy * 100) / 100,
      totalCorrect: stats.total_correct,
      totalWrong: stats.total_wrong
    },
    goal: {
      targetBank: targetBank || null,
      targetPosition: targetPosition || null,
      targetExam: targetExam || (targetBank && targetPosition ? `${targetBank} ${targetPosition}` : null),
      targetDate,
      daysRemaining
    },
    recentResults,
    subjectBreakdown: subjectAccuracy,
    subjectAccuracy,
    topicAnalytics,
    weakTopics,
    upcomingExams,
    courseProgress
  });
});

// Admin Live Monitor and Overview
dashboardRouter.get('/admin-overview', authenticateToken, (req: Request, res: Response) => {
  const activeAttempts = db.prepare(`
    SELECT a.id, a.started_at, a.expires_at, u.name as user_name, u.email as user_email, e.title as exam_title
    FROM attempts a
    JOIN users u ON u.id = a.user_id
    JOIN exams e ON e.id = a.exam_id
    WHERE a.status = 'IN_PROGRESS'
    ORDER BY a.started_at DESC
  `).all();

  const recentViolations = db.prepare(`
    SELECT id, attempt_id, violation_type, details, occurred_at
    FROM exam_violations
    ORDER BY occurred_at DESC
    LIMIT 20
  `).all();

  const users = db.prepare(`
    SELECT id, name, email, role, target_exam
    FROM users
    ORDER BY created_at DESC
  `).all();

  const stats: any = db.prepare(`
    SELECT 
      COUNT(*) as total_graded_results,
      COUNT(DISTINCT user_id) as total_candidates,
      COALESCE(AVG(score), 0) as average_score,
      COALESCE(AVG(accuracy_percentage), 0) as average_accuracy,
      COALESCE(MIN(score), 0) as min_score,
      COALESCE(MAX(score), 0) as max_score,
      COALESCE(SUM(CASE WHEN is_passed = 1 THEN 1 ELSE 0 END), 0) as total_passed
    FROM exam_results
  `).get();

  const totalGraded = stats ? stats.total_graded_results : 0;
  const averageScore = stats && totalGraded > 0 ? Number(Number(stats.average_score).toFixed(2)) : 0;
  const averageAccuracy = stats && totalGraded > 0 ? Number(Number(stats.average_accuracy).toFixed(2)) : 0;
  const totalPassed = stats ? stats.total_passed : 0;
  const passRatePercentage = totalGraded > 0 ? Math.round((totalPassed / totalGraded) * 100) : 0;

  res.json({
    activeAttempts,
    recentViolations,
    users,
    performanceAnalytics: {
      totalGradedResults: totalGraded,
      totalCandidates: stats ? stats.total_candidates : 0,
      averageScore,
      scoreUnit: 'marks',
      averageAccuracy,
      accuracyUnit: '%',
      minScore: stats && totalGraded > 0 ? Number(Number(stats.min_score).toFixed(2)) : 0,
      maxScore: stats && totalGraded > 0 ? Number(Number(stats.max_score).toFixed(2)) : 0,
      passRatePercentage
    }
  });
});
