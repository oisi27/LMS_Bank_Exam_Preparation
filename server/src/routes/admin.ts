import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/schema';
import { authenticateToken, requireRole } from '../middleware/auth';
import { recordAuditLog } from '../services/auditService';

export const adminRouter = Router();

// Secure all admin endpoints: require valid authentication and ADMIN role from current database state
adminRouter.use(authenticateToken, requireRole('ADMIN'));

// ==========================================
// Zod Validation Schemas
// ==========================================
const userSearchSchema = z.object({
  search: z.string().optional(),
  role: z.enum(['STUDENT', 'INSTRUCTOR', 'ADMIN']).optional(),
  status: z.enum(['active', 'suspended']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

const userStatusSchema = z.object({
  isActive: z.boolean({ required_error: 'isActive boolean flag is required' })
});

const userRoleSchema = z.object({
  role: z.enum(['STUDENT', 'INSTRUCTOR', 'ADMIN'], {
    errorMap: () => ({ message: "Role must be one of 'STUDENT', 'INSTRUCTOR', or 'ADMIN'" })
  })
});

const auditLogsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  action: z.string().optional(),
  resource: z.string().optional()
});

// ==========================================
// 1. GET /api/admin/users - Search, filter, and paginate users
// ==========================================
adminRouter.get('/users', (req: Request, res: Response) => {
  const validation = userSearchSchema.safeParse(req.query);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: validation.error.errors[0]?.message || 'Invalid search parameters'
    });
  }

  const { search, role, status, page, limit } = validation.data;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: any[] = [];

  if (search && search.trim() !== '') {
    conditions.push('(name LIKE ? OR email LIKE ?)');
    const term = `%${search.trim()}%`;
    params.push(term, term);
  }

  if (role) {
    conditions.push('role = ?');
    params.push(role);
  }

  if (status) {
    conditions.push('is_active = ?');
    params.push(status === 'active' ? 1 : 0);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count total records matching criteria
  const countRow: any = db.prepare(`
    SELECT COUNT(*) as total FROM users ${whereClause}
  `).get(...params);

  const total = countRow ? countRow.total : 0;
  const totalPages = Math.ceil(total / limit) || 1;

  // Retrieve paginated records with safe non-sensitive columns
  const users = db.prepare(`
    SELECT id, name, email, phone, role, is_active, target_exam, target_date, created_at, updated_at
    FROM users
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  res.json({
    success: true,
    data: users,
    pagination: {
      page,
      limit,
      total,
      totalPages
    }
  });
});

// ==========================================
// 2. PATCH /api/admin/users/:userId/status - Suspend or Activate Account
// ==========================================
adminRouter.patch('/users/:userId/status', (req: Request, res: Response) => {
  const { userId } = req.params;
  const adminActor = req.user!;

  const validation = userStatusSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: validation.error.errors[0]?.message || 'Invalid status body'
    });
  }

  const { isActive } = validation.data;
  const newActiveValue = isActive ? 1 : 0;

  // Verify target user exists
  const targetUser: any = db.prepare(`
    SELECT id, name, email, role, is_active FROM users WHERE id = ?
  `).get(userId);

  if (!targetUser) {
    return res.status(404).json({
      success: false,
      error: 'User not found.'
    });
  }

  // Safety Protection 1: Admin cannot suspend their own account
  if (adminActor.id === userId && !isActive) {
    return res.status(400).json({
      success: false,
      error: 'Administrators cannot deactivate their own account.'
    });
  }

  // Safety Protection 2: Prevent deactivating the last active Admin
  if (targetUser.role === 'ADMIN' && !isActive) {
    const activeAdminCount: any = db.prepare(`
      SELECT COUNT(*) as count FROM users WHERE role = 'ADMIN' AND is_active = 1
    `).get();

    if (activeAdminCount && activeAdminCount.count <= 1) {
      return res.status(400).json({
        success: false,
        error: 'Cannot deactivate the last remaining active administrator.'
      });
    }
  }

  // Execute status change, session revocation, and audit logging atomically in transaction
  try {
    const updateTx = db.transaction(() => {
      // 1. Update user account status
      db.prepare(`
        UPDATE users
        SET is_active = ?, updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        WHERE id = ?
      `).run(newActiveValue, userId);

      // 2. If suspending user, revoke all existing refresh token sessions immediately
      if (!isActive) {
        db.prepare(`
          UPDATE refresh_tokens
          SET revoked_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
          WHERE user_id = ? AND revoked_at IS NULL
        `).run(userId);
      }

      // 3. Record audit log
      recordAuditLog({
        actorId: adminActor.id,
        actorRole: adminActor.role,
        action: isActive ? 'USER_ACTIVATED' : 'USER_SUSPENDED',
        resource: 'USER',
        resourceId: userId,
        details: {
          targetEmail: targetUser.email,
          targetRole: targetUser.role,
          previousStatus: targetUser.is_active === 1 ? 'active' : 'suspended',
          newStatus: isActive ? 'active' : 'suspended'
        }
      });
    });

    updateTx();

    const updatedUser: any = db.prepare(`
      SELECT id, name, email, role, is_active, updated_at FROM users WHERE id = ?
    `).get(userId);

    res.json({
      success: true,
      message: isActive ? 'User account activated successfully.' : 'User account suspended successfully.',
      user: updatedUser
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to update account status.'
    });
  }
});

// ==========================================
// 3. PATCH /api/admin/users/:userId/role - Change User Role
// ==========================================
adminRouter.patch('/users/:userId/role', (req: Request, res: Response) => {
  const { userId } = req.params;
  const adminActor = req.user!;

  const validation = userRoleSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: validation.error.errors[0]?.message || 'Invalid role specified'
    });
  }

  const { role: newRole } = validation.data;

  // Verify target user exists
  const targetUser: any = db.prepare(`
    SELECT id, name, email, role, is_active FROM users WHERE id = ?
  `).get(userId);

  if (!targetUser) {
    return res.status(404).json({
      success: false,
      error: 'User not found.'
    });
  }

  // Safety Protection 1: Admin cannot demote themselves
  if (adminActor.id === userId && newRole !== 'ADMIN') {
    return res.status(400).json({
      success: false,
      error: 'Administrators cannot demote their own account role.'
    });
  }

  // Safety Protection 2: Prevent demoting the last active Admin
  if (targetUser.role === 'ADMIN' && newRole !== 'ADMIN') {
    const activeAdminCount: any = db.prepare(`
      SELECT COUNT(*) as count FROM users WHERE role = 'ADMIN' AND is_active = 1
    `).get();

    if (activeAdminCount && activeAdminCount.count <= 1) {
      return res.status(400).json({
        success: false,
        error: 'Cannot demote the last remaining active administrator.'
      });
    }
  }

  // No-op if already has the role
  if (targetUser.role === newRole) {
    return res.json({
      success: true,
      message: `User already has role '${newRole}'.`,
      user: targetUser
    });
  }

  // Execute role change, token revocation, and audit logging atomically
  try {
    const updateTx = db.transaction(() => {
      // 1. Update user role
      db.prepare(`
        UPDATE users
        SET role = ?, updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        WHERE id = ?
      `).run(newRole, userId);

      // 2. Revoke active refresh tokens so new login/refresh issues refreshed claims
      db.prepare(`
        UPDATE refresh_tokens
        SET revoked_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        WHERE user_id = ? AND revoked_at IS NULL
      `).run(userId);

      // 3. Record audit log
      recordAuditLog({
        actorId: adminActor.id,
        actorRole: adminActor.role,
        action: 'USER_ROLE_CHANGED',
        resource: 'USER',
        resourceId: userId,
        details: {
          targetEmail: targetUser.email,
          previousRole: targetUser.role,
          newRole
        }
      });
    });

    updateTx();

    const updatedUser: any = db.prepare(`
      SELECT id, name, email, role, is_active, updated_at FROM users WHERE id = ?
    `).get(userId);

    res.json({
      success: true,
      message: `User role changed successfully to '${newRole}'.`,
      user: updatedUser
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to update user role.'
    });
  }
});

// ==========================================
// 4. GET /api/admin/audit-logs - Query Tamper-Proof Audit Trail
// ==========================================
adminRouter.get('/audit-logs', (req: Request, res: Response) => {
  const validation = auditLogsQuerySchema.safeParse(req.query);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: validation.error.errors[0]?.message || 'Invalid audit log query'
    });
  }

  const { page, limit, action, resource } = validation.data;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: any[] = [];

  if (action) {
    conditions.push('a.action = ?');
    params.push(action);
  }

  if (resource) {
    conditions.push('a.resource = ?');
    params.push(resource);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRow: any = db.prepare(`
    SELECT COUNT(*) as total FROM audit_logs a ${whereClause}
  `).get(...params);

  const total = countRow ? countRow.total : 0;
  const totalPages = Math.ceil(total / limit) || 1;

  const logs = db.prepare(`
    SELECT a.id, a.actor_id, a.actor_role, a.action, a.resource, a.resource_id, a.details, a.created_at,
           u.name as actor_name, u.email as actor_email
    FROM audit_logs a
    LEFT JOIN users u ON u.id = a.actor_id
    ${whereClause}
    ORDER BY a.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  // Parse JSON details if stored as JSON string
  const formattedLogs = logs.map((log: any) => {
    let parsedDetails = log.details;
    if (typeof log.details === 'string') {
      try {
        parsedDetails = JSON.parse(log.details);
      } catch {
        parsedDetails = log.details;
      }
    }
    return {
      ...log,
      details: parsedDetails
    };
  });

  res.json({
    success: true,
    data: formattedLogs,
    pagination: {
      page,
      limit,
      total,
      totalPages
    }
  });
});

// ==========================================
// 5. COURSE MODERATION APIS (Phase 7 Milestone 3)
// ==========================================

const courseRejectSchema = z.object({
  reason: z.string({ required_error: 'Rejection reason is required' }).trim().min(5, 'Rejection reason must be at least 5 characters')
});

/**
 * 5A. GET /api/admin/courses/pending - List courses awaiting moderation review
 */
adminRouter.get('/courses/pending', (req: Request, res: Response) => {
  const pendingCourses = db.prepare(`
    SELECT c.*, cat.name as category_name, cat.name_bangla as category_name_bangla,
           u.name as instructor_name, u.email as instructor_email,
           (SELECT COUNT(*) FROM course_modules m WHERE m.course_id = c.id) as module_count,
           (SELECT COUNT(*) FROM lessons l JOIN course_modules m ON m.id = l.module_id WHERE m.course_id = c.id) as lesson_count,
           (SELECT COUNT(*) FROM lesson_resources r JOIN lessons l ON l.id = r.lesson_id JOIN course_modules m ON m.id = l.module_id WHERE m.course_id = c.id) as resource_count
    FROM courses c
    JOIN categories cat ON cat.id = c.category_id
    LEFT JOIN users u ON u.id = c.instructor_id
    WHERE c.status = 'PENDING_REVIEW'
    ORDER BY c.updated_at ASC
  `).all();

  res.json({
    success: true,
    count: pendingCourses.length,
    courses: pendingCourses
  });
});

/**
 * 5B. PATCH /api/admin/courses/:courseId/approve - Approve submitted course for publication
 */
adminRouter.patch('/courses/:courseId/approve', (req: Request, res: Response) => {
  const { courseId } = req.params;
  const adminActor = req.user!;

  const course: any = db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId);
  if (!course) {
    return res.status(404).json({ success: false, error: 'Course not found.' });
  }

  // Only courses in PENDING_REVIEW can be approved
  if (course.status !== 'PENDING_REVIEW') {
    return res.status(400).json({
      success: false,
      error: `Cannot approve course with status '${course.status}'. Only courses in 'PENDING_REVIEW' can be approved.`
    });
  }

  try {
    const approveTx = db.transaction(() => {
      // 1. Transition status to PUBLISHED and clear any rejection reason
      db.prepare(`
        UPDATE courses
        SET status = 'PUBLISHED',
            rejection_reason = NULL,
            updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        WHERE id = ?
      `).run(courseId);

      // 2. Record audit log
      recordAuditLog({
        actorId: adminActor.id,
        actorRole: adminActor.role,
        action: 'COURSE_APPROVED',
        resource: 'COURSE',
        resourceId: courseId,
        details: {
          title: course.title,
          instructorId: course.instructor_id,
          previousStatus: course.status,
          newStatus: 'PUBLISHED'
        }
      });
    });

    approveTx();

    const updatedCourse: any = db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId);

    res.json({
      success: true,
      message: `Course '${course.title}' approved and published successfully.`,
      course: updatedCourse
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to approve course.' });
  }
});

/**
 * 5C. PATCH /api/admin/courses/:courseId/reject - Reject submitted course with feedback reason
 */
adminRouter.patch('/courses/:courseId/reject', (req: Request, res: Response) => {
  const { courseId } = req.params;
  const adminActor = req.user!;

  const validation = courseRejectSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: validation.error.errors[0]?.message || 'Valid rejection reason is required'
    });
  }

  const { reason } = validation.data;

  const course: any = db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId);
  if (!course) {
    return res.status(404).json({ success: false, error: 'Course not found.' });
  }

  // Only courses in PENDING_REVIEW can be rejected
  if (course.status !== 'PENDING_REVIEW') {
    return res.status(400).json({
      success: false,
      error: `Cannot reject course with status '${course.status}'. Only courses in 'PENDING_REVIEW' can be rejected.`
    });
  }

  try {
    const rejectTx = db.transaction(() => {
      // 1. Transition status to REJECTED and set rejection_reason
      db.prepare(`
        UPDATE courses
        SET status = 'REJECTED',
            rejection_reason = ?,
            updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        WHERE id = ?
      `).run(reason, courseId);

      // 2. Record audit log with rejection reason
      recordAuditLog({
        actorId: adminActor.id,
        actorRole: adminActor.role,
        action: 'COURSE_REJECTED',
        resource: 'COURSE',
        resourceId: courseId,
        details: {
          title: course.title,
          instructorId: course.instructor_id,
          previousStatus: course.status,
          newStatus: 'REJECTED',
          reason
        }
      });
    });

    rejectTx();

    const updatedCourse: any = db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId);

    res.json({
      success: true,
      message: `Course '${course.title}' rejected. Rejection reason recorded.`,
      course: updatedCourse
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to reject course.' });
  }
});

// ==========================================
// 6. GET /api/admin/analytics - Platform-Wide Academic Analytics
// ==========================================
adminRouter.get('/analytics', (req: Request, res: Response) => {
  try {
    const stats: any = db.prepare(`
      SELECT 
        COUNT(*) as total_graded_results,
        COUNT(DISTINCT user_id) as total_candidates,
        COUNT(DISTINCT exam_id) as total_exams_attempted,
        COALESCE(AVG(score), 0) as average_score,
        COALESCE(AVG(accuracy_percentage), 0) as average_accuracy,
        COALESCE(MIN(score), 0) as min_score,
        COALESCE(MAX(score), 0) as max_score,
        COALESCE(SUM(correct_count), 0) as total_correct,
        COALESCE(SUM(wrong_count), 0) as total_wrong,
        COALESCE(SUM(skipped_count), 0) as total_skipped,
        COALESCE(SUM(CASE WHEN is_passed = 1 THEN 1 ELSE 0 END), 0) as total_passed
      FROM exam_results
    `).get();

    const totalGraded = stats ? stats.total_graded_results : 0;
    const averageScore = stats && totalGraded > 0 ? Number(Number(stats.average_score).toFixed(2)) : 0;
    const averageAccuracy = stats && totalGraded > 0 ? Number(Number(stats.average_accuracy).toFixed(2)) : 0;
    const minScore = stats && totalGraded > 0 ? Number(Number(stats.min_score).toFixed(2)) : 0;
    const maxScore = stats && totalGraded > 0 ? Number(Number(stats.max_score).toFixed(2)) : 0;
    const totalPassed = stats ? stats.total_passed : 0;
    const passRatePercentage = totalGraded > 0 ? Math.round((totalPassed / totalGraded) * 100) : 0;

    res.json({
      success: true,
      analytics: {
        totalGradedResults: totalGraded,
        totalCandidates: stats ? stats.total_candidates : 0,
        totalExamsAttempted: stats ? stats.total_exams_attempted : 0,
        averageScore,
        scoreUnit: 'marks',
        averageAccuracy,
        accuracyUnit: '%',
        minScore,
        maxScore,
        totalPassed,
        passRatePercentage,
        totalCorrect: stats ? stats.total_correct : 0,
        totalWrong: stats ? stats.total_wrong : 0,
        totalSkipped: stats ? stats.total_skipped : 0
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to compute admin analytics.' });
  }
});

// ==========================================
// 6B. GET /api/admin/platform-stats - Platform Overview Counters
// ==========================================
adminRouter.get('/platform-stats', (req: Request, res: Response) => {
  try {
    const userStats: any = db.prepare(`
      SELECT 
        COUNT(*) as total_users,
        COALESCE(SUM(CASE WHEN role = 'STUDENT' THEN 1 ELSE 0 END), 0) as total_students,
        COALESCE(SUM(CASE WHEN role = 'INSTRUCTOR' THEN 1 ELSE 0 END), 0) as total_instructors,
        COALESCE(SUM(CASE WHEN role = 'ADMIN' THEN 1 ELSE 0 END), 0) as total_admins
      FROM users
    `).get();

    const courseStats: any = db.prepare(`
      SELECT 
        COUNT(*) as total_courses,
        COALESCE(SUM(CASE WHEN status = 'PENDING_REVIEW' THEN 1 ELSE 0 END), 0) as pending_course_approvals
      FROM courses
    `).get();

    const examStats: any = db.prepare(`
      SELECT COUNT(*) as total_exams FROM exams
    `).get();

    const attemptStats: any = db.prepare(`
      SELECT COUNT(*) as active_attempts FROM attempts WHERE status = 'IN_PROGRESS'
    `).get();

    res.json({
      success: true,
      stats: {
        totalUsers: userStats?.total_users || 0,
        totalStudents: userStats?.total_students || 0,
        totalInstructors: userStats?.total_instructors || 0,
        totalAdmins: userStats?.total_admins || 0,
        totalCourses: courseStats?.total_courses || 0,
        pendingCourseApprovals: courseStats?.pending_course_approvals || 0,
        totalExams: examStats?.total_exams || 0,
        activeExamAttempts: attemptStats?.active_attempts || 0
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to retrieve platform stats.' });
  }
});

// ==========================================
// 7. GET /api/admin/grade-override/attempts - Retrieve Graded Attempts for Override
// ==========================================
adminRouter.get('/grade-override/attempts', (req: Request, res: Response) => {
  try {
    const examId = req.query.examId as string | undefined;
    const search = req.query.search as string | undefined;
    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string || '20', 10)));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];

    if (examId && examId.trim() !== '') {
      conditions.push('r.exam_id = ?');
      params.push(examId.trim());
    }

    if (search && search.trim() !== '') {
      conditions.push('(u.name LIKE ? OR u.email LIKE ? OR e.title LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow: any = db.prepare(`
      SELECT COUNT(*) as total
      FROM exam_results r
      JOIN attempts a ON a.id = r.attempt_id
      JOIN users u ON u.id = r.user_id
      JOIN exams e ON e.id = r.exam_id
      ${whereClause}
    `).get(...params);

    const total = countRow ? countRow.total : 0;
    const totalPages = Math.ceil(total / limit) || 1;

    const gradedAttempts = db.prepare(`
      SELECT 
        r.id as result_id,
        r.attempt_id,
        r.exam_id,
        r.user_id as student_id,
        r.score as current_score,
        r.original_score,
        r.is_overridden,
        r.override_reason,
        r.total_marks,
        r.accuracy_percentage,
        r.is_passed,
        r.correct_count,
        r.wrong_count,
        r.skipped_count,
        r.time_spent_seconds,
        r.created_at as graded_at,
        u.name as student_name,
        u.email as student_email,
        e.title as exam_title,
        e.pass_marks,
        e.result_release_mode,
        e.status as exam_status,
        a.started_at,
        a.submitted_at,
        a.time_extended_minutes
      FROM exam_results r
      JOIN attempts a ON a.id = r.attempt_id
      JOIN users u ON u.id = r.user_id
      JOIN exams e ON e.id = r.exam_id
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    res.json({
      success: true,
      data: gradedAttempts,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to fetch graded attempts.' });
  }
});

// ==========================================
// 8. POST /api/admin/grade-override - Override Student's Graded Score
// ==========================================
const gradeOverrideSchema = z.object({
  attemptId: z.string().min(1, 'Attempt ID is required'),
  correctedScore: z.number({ required_error: 'Corrected score is required' }).finite('Score must be a finite number'),
  reason: z.string().min(5, 'A mandatory justification reason (min 5 characters) is required')
});

adminRouter.post('/grade-override', (req: Request, res: Response) => {
  const adminActor = req.user!;

  const validation = gradeOverrideSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: validation.error.errors[0]?.message || 'Invalid grade override input.'
    });
  }

  const { attemptId, correctedScore, reason } = validation.data;

  // Retrieve attempt and current exam result
  const attempt: any = db.prepare('SELECT * FROM attempts WHERE id = ?').get(attemptId);
  if (!attempt) {
    return res.status(404).json({ success: false, error: 'Exam attempt not found.' });
  }

  const result: any = db.prepare('SELECT * FROM exam_results WHERE attempt_id = ?').get(attemptId);
  if (!result) {
    return res.status(400).json({
      success: false,
      error: 'Cannot override grade: this attempt has not been graded yet.'
    });
  }

  const exam: any = db.prepare('SELECT * FROM exams WHERE id = ?').get(attempt.exam_id);
  if (!exam) {
    return res.status(404).json({ success: false, error: 'Associated exam not found.' });
  }

  // Bounds validation: correctedScore between 0 and total_marks
  const totalMarks = Number(result.total_marks);
  if (correctedScore < 0 || correctedScore > totalMarks) {
    return res.status(400).json({
      success: false,
      error: `Corrected score must be between 0 and maximum marks (${totalMarks}). Received: ${correctedScore}.`
    });
  }

  // Determine original machine score (immutable once set)
  // If original_score is NULL, this is the first override, so store the current score as original_score
  const originalScore = result.original_score !== null && result.original_score !== undefined
    ? Number(result.original_score)
    : Number(result.score);
  const previousEffectiveScore = Number(result.score);

  // Recalculate accuracy percentage and pass status based on correctedScore
  const passMarks = exam.pass_marks !== null && exam.pass_marks !== undefined ? Number(exam.pass_marks) : 40.0;
  const newIsPassed = correctedScore >= passMarks ? 1 : 0;
  const newAccuracyPercentage = totalMarks > 0 ? Math.round((correctedScore / totalMarks) * 100) : 0;

  try {
    const overrideTx = db.transaction(() => {
      // 1. Update exam_results with corrected effective score while preserving original_score
      db.prepare(`
        UPDATE exam_results
        SET score = ?,
            original_score = ?,
            is_overridden = 1,
            override_reason = ?,
            accuracy_percentage = ?,
            is_passed = ?
        WHERE id = ?
      `).run(
        correctedScore,
        originalScore,
        reason.trim(),
        newAccuracyPercentage,
        newIsPassed,
        result.id
      );

      // 2. Permanent audit trail recording in audit_logs
      recordAuditLog({
        actorId: adminActor.id,
        actorRole: adminActor.role,
        action: 'GRADE_OVERRIDE',
        resource: 'EXAM_RESULT',
        resourceId: result.id,
        details: {
          attemptId,
          examId: attempt.exam_id,
          studentId: attempt.user_id,
          originalMachineScore: originalScore,
          previousEffectiveScore,
          newCorrectedScore: correctedScore,
          totalMarks,
          isPassed: Boolean(newIsPassed),
          accuracyPercentage: newAccuracyPercentage,
          reason: reason.trim()
        }
      });
    });

    overrideTx();

    const updatedResult: any = db.prepare('SELECT * FROM exam_results WHERE id = ?').get(result.id);

    res.json({
      success: true,
      message: 'Grade override successfully applied and recorded in audit trail.',
      result: {
        id: updatedResult.id,
        attemptId: updatedResult.attempt_id,
        examId: updatedResult.exam_id,
        userId: updatedResult.user_id,
        score: updatedResult.score,
        originalScore: updatedResult.original_score,
        isOverridden: Boolean(updatedResult.is_overridden),
        overrideReason: updatedResult.override_reason,
        totalMarks: updatedResult.total_marks,
        accuracyPercentage: updatedResult.accuracy_percentage,
        isPassed: Boolean(updatedResult.is_passed)
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to apply grade override.' });
  }
});

// ==========================================
// 9. POST /api/admin/time-extension - Extend Authoritative Exam Time
// ==========================================
const timeExtensionSchema = z.object({
  attemptId: z.string().min(1, 'Attempt ID is required'),
  additionalMinutes: z.number().int().min(1, 'Extension must be at least 1 minute').max(180, 'Extension cannot exceed 180 minutes'),
  reason: z.string().min(5, 'A mandatory justification reason (min 5 characters) is required')
});

adminRouter.post('/time-extension', (req: Request, res: Response) => {
  const adminActor = req.user!;

  const validation = timeExtensionSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: validation.error.errors[0]?.message || 'Invalid time extension input.'
    });
  }

  const { attemptId, additionalMinutes, reason } = validation.data;

  try {
    let resultPayload: any = null;

    const extendTx = db.transaction(() => {
      // Lock and fetch attempt
      const attempt: any = db.prepare('SELECT * FROM attempts WHERE id = ?').get(attemptId);
      if (!attempt) {
        throw new Error('Exam attempt not found.');
      }

      if (attempt.status !== 'IN_PROGRESS') {
        throw new Error(`Cannot extend time: attempt status is '${attempt.status}', not 'IN_PROGRESS'.`);
      }

      const exam: any = db.prepare('SELECT * FROM exams WHERE id = ?').get(attempt.exam_id);
      if (!exam) {
        throw new Error('Associated exam not found.');
      }

      const now = new Date();
      const currentExpiry = new Date(attempt.expires_at);

      // Protect against extending attempts that are already expired past reasonable grace
      if (now.getTime() > currentExpiry.getTime() + 60000) {
        throw new Error('Cannot extend time: attempt has already expired.');
      }

      // Calculate new authoritative expiry time
      // If current expiry is in the past (e.g. within grace second), base new expiry on now
      const baseMs = Math.max(now.getTime(), currentExpiry.getTime());
      const newExpiryMs = baseMs + (additionalMinutes * 60 * 1000);
      const newExpiresAt = new Date(newExpiryMs).toISOString();

      const prevTimeExtended = Number(attempt.time_extended_minutes) || 0;
      const newTotalExtended = prevTimeExtended + additionalMinutes;

      // 1. Update attempt authoritative timer and tracking
      db.prepare(`
        UPDATE attempts
        SET expires_at = ?,
            time_extended_minutes = ?
        WHERE id = ?
      `).run(newExpiresAt, newTotalExtended, attemptId);

      // 2. Audit log
      recordAuditLog({
        actorId: adminActor.id,
        actorRole: adminActor.role,
        action: 'EXAM_TIME_EXTENDED',
        resource: 'EXAM_ATTEMPT',
        resourceId: attemptId,
        details: {
          examId: attempt.exam_id,
          studentId: attempt.user_id,
          previousExpiresAt: attempt.expires_at,
          newExpiresAt,
          additionalMinutes,
          totalExtendedMinutes: newTotalExtended,
          reason: reason.trim()
        }
      });

      resultPayload = {
        attemptId,
        previousExpiresAt: attempt.expires_at,
        newExpiresAt,
        additionalMinutes,
        totalExtendedMinutes: newTotalExtended
      };
    });

    extendTx();

    res.json({
      success: true,
      message: `Successfully extended attempt time by ${additionalMinutes} minute(s).`,
      data: resultPayload
    });
  } catch (err: any) {
    const isValidationError = err.message.includes('Cannot extend time') || err.message.includes('not found');
    res.status(isValidationError ? 400 : 500).json({
      success: false,
      error: err.message || 'Failed to extend exam time.'
    });
  }
});


