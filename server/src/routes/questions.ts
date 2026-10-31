import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { db } from '../db/schema';
import { authenticateToken, requireRole } from '../middleware/auth';
import { recordAuditLog } from '../services/auditService';

export const questionsRouter = Router();

// ==========================================
// Zod Validation Schemas
// ==========================================
const optionSchema = z.object({
  optionKey: z.string().min(1, 'Option key is required (e.g. A, B, C, D)'),
  text: z.string().min(1, 'Option text is required'),
  textBangla: z.string().optional().nullable(),
  isCorrect: z.boolean().default(false)
});

const questionCoreSchema = z.object({
  subject: z.string().min(1, 'Subject is required (e.g. English, Mathematics, Bangla, GK)'),
  chapter: z.string().min(1, 'Chapter is required'),
  topic: z.string().min(1, 'Topic is required'),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).default('MEDIUM'),
  type: z.enum(['SINGLE_MCQ', 'MULTI_SELECT', 'TRUE_FALSE', 'NUMERIC', 'FILL_BLANK']).default('SINGLE_MCQ'),
  prompt: z.string().min(1, 'Question prompt is required'),
  promptBangla: z.string().optional().nullable(),
  explanation: z.string().optional().nullable(),
  explanationBangla: z.string().optional().nullable(),
  defaultMarks: z.number().min(0.1).default(1.0),
  defaultNegativeMarks: z.number().min(0).default(0.25),
  correctNumeric: z.number().optional().nullable(),
  numericTolerance: z.number().min(0).default(0.0).optional().nullable(),
  correctText: z.string().optional().nullable(),
  isApproved: z.boolean().default(true),
  options: z.array(optionSchema).default([])
});

const questionCreateSchema = questionCoreSchema.superRefine((data, ctx) => {
  if (data.type === 'SINGLE_MCQ') {
    if (!data.options || data.options.length < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'SINGLE_MCQ must have at least 2 options' });
    }
    const correctCount = (data.options || []).filter((o) => o.isCorrect).length;
    if (correctCount !== 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'SINGLE_MCQ must have exactly 1 correct answer' });
    }
  } else if (data.type === 'TRUE_FALSE') {
    if (!data.options || data.options.length < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'TRUE_FALSE must have at least 2 options' });
    }
    const correctCount = (data.options || []).filter((o) => o.isCorrect).length;
    if (correctCount !== 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'TRUE_FALSE must have exactly 1 correct answer' });
    }
  } else if (data.type === 'MULTI_SELECT') {
    if (!data.options || data.options.length < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'MULTI_SELECT must have at least 2 options' });
    }
    const correctCount = (data.options || []).filter((o) => o.isCorrect).length;
    if (correctCount < 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'MULTI_SELECT must have at least 1 correct answer' });
    }
  } else if (data.type === 'NUMERIC') {
    if (data.correctNumeric === undefined || data.correctNumeric === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'NUMERIC questions require a valid correctNumeric answer' });
    }
  } else if (data.type === 'FILL_BLANK') {
    if (!data.correctText || data.correctText.trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'FILL_BLANK questions require a non-empty correctText answer' });
    }
  }
});

const questionUpdateSchema = questionCoreSchema.partial();

// Canonical Subject Category Mapping for Bank Exam Preparation
// Maps frontend Category Labels to the actual database subject strings
const SUBJECT_CANONICAL_MAP: Record<string, string[]> = {
  // Quantitative Mathematics UI Categories
  'quantitative mathematics': ['Mathematics', 'Math', 'Quantitative Aptitude', 'Quantitative Aptitude & Mathematics'],
  'mathematics & analytical ability': ['Mathematics', 'Math', 'Quantitative Aptitude', 'Quantitative Aptitude & Mathematics', 'Analytical Reasoning'],

  // English Language UI Category
  'english language': ['English', 'English Language & Literature'],

  // Bangla Language UI Category
  'bangla language': ['Bangla', 'Bangla Language & Literature'],

  // General Knowledge UI Category
  'general knowledge': ['General Knowledge', 'GK', 'General Knowledge & Banking Affairs', 'General'],
  'general knowledge & bangladesh affairs': ['General Knowledge', 'GK', 'General Knowledge & Banking Affairs', 'General'],
  'bangladesh & global affairs': ['General Knowledge', 'GK', 'General Knowledge & Banking Affairs', 'General'],

  // Banking & ICT UI Category
  'banking & ict': ['Banking and Finance', 'Computer and ICT', 'Computer & Information Technology'],
  'banking & financial sector': ['Banking and Finance', 'Computer and ICT', 'Computer & Information Technology'],
  'banking, finance & economy': ['Banking and Finance', 'Computer and ICT', 'Computer & Information Technology'],

  // Analytical Ability UI Category
  'analytical reasoning': ['Analytical Reasoning'],
  'analytical ability': ['Analytical Reasoning']
};

export function resolveSubjectFilter(subjectQuery: string): string[] {
  const normalized = subjectQuery.trim().toLowerCase();
  if (SUBJECT_CANONICAL_MAP[normalized]) {
    return SUBJECT_CANONICAL_MAP[normalized];
  }
  // When an exact database subject string is queried (e.g. 'Quantitative Aptitude & Mathematics', 'Math', 'English', etc.), query it directly
  return [subjectQuery.trim()];
}

// ==========================================
// 1. GET /api/questions - List with Search & Filtering & Pagination
// ==========================================
questionsRouter.get('/', authenticateToken, (req: Request, res: Response) => {
  const { subject, chapter, topic, difficulty, type, search, isApproved, page, pageSize } = req.query;

  // Pagination parameters with fallback and safety limits
  const parsedPage = parseInt(page as string, 10);
  const parsedPageSize = parseInt(pageSize as string, 10);

  const currentPage = !isNaN(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  // If pageSize is not provided, default to 25. Allow up to 150 per page.
  const limit = !isNaN(parsedPageSize) && parsedPageSize > 0 
    ? Math.min(parsedPageSize, 150) 
    : 25;
  const offset = (currentPage - 1) * limit;

  let whereClause = ' WHERE 1=1';
  const params: any[] = [];

  if (subject && typeof subject === 'string' && subject.trim() !== '') {
    const matchedSubjects = resolveSubjectFilter(subject);
    if (matchedSubjects.length === 1) {
      whereClause += ' AND subject = ?';
      params.push(matchedSubjects[0]);
    } else {
      const placeholders = matchedSubjects.map(() => '?').join(', ');
      whereClause += ` AND subject IN (${placeholders})`;
      params.push(...matchedSubjects);
    }
  }
  if (chapter) {
    whereClause += ' AND chapter = ?';
    params.push(chapter);
  }
  if (topic) {
    whereClause += ' AND topic = ?';
    params.push(topic);
  }
  if (difficulty) {
    whereClause += ' AND difficulty = ?';
    params.push(difficulty);
  }
  if (type) {
    whereClause += ' AND type = ?';
    params.push(type);
  }
  if (isApproved !== undefined) {
    whereClause += ' AND is_approved = ?';
    params.push(isApproved === 'true' || isApproved === '1' ? 1 : 0);
  }
  if (search) {
    whereClause += ' AND (prompt LIKE ? OR prompt_bangla LIKE ? OR topic LIKE ? OR chapter LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  // Count total matching items for pagination metadata
  const countRow = db.prepare(`SELECT COUNT(*) as total FROM questions${whereClause}`).get(...params) as { total: number };
  const totalItems = countRow ? countRow.total : 0;
  const totalPages = Math.ceil(totalItems / limit) || (totalItems === 0 ? 0 : 1);

  // Paginated query
  const query = `SELECT * FROM questions${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  const questions = db.prepare(query).all(...params, limit, offset);

  const isPrivileged = req.user?.role === 'INSTRUCTOR' || req.user?.role === 'ADMIN';

  // Attach options for each question
  const fullQuestions = questions.map((q: any) => {
    const options = db.prepare(
      'SELECT id, option_key as optionKey, text, text_bangla as textBangla, is_correct as isCorrect, sort_order as sortOrder FROM question_options WHERE question_id = ? ORDER BY sort_order ASC'
    ).all(q.id);

    // Student safety rule: mask is_correct for students
    const sanitizedOptions = options.map((opt: any) => ({
      id: opt.id,
      optionKey: opt.optionKey,
      text: opt.text,
      textBangla: opt.textBangla,
      ...(isPrivileged ? { isCorrect: Boolean(opt.isCorrect) } : {})
    }));

    return {
      id: q.id,
      subject: q.subject,
      chapter: q.chapter,
      topic: q.topic,
      difficulty: q.difficulty,
      type: q.type,
      prompt: q.prompt,
      promptBangla: q.prompt_bangla,
      explanation: isPrivileged ? q.explanation : undefined,
      explanationBangla: isPrivileged ? q.explanation_bangla : undefined,
      defaultMarks: q.default_marks,
      defaultNegativeMarks: q.default_negative_marks,
      correctNumeric: isPrivileged ? q.correct_numeric : undefined,
      numericTolerance: isPrivileged ? q.numeric_tolerance : undefined,
      correctText: isPrivileged ? q.correct_text : undefined,
      isApproved: Boolean(q.is_approved),
      authorId: q.author_id,
      createdAt: q.created_at,
      options: sanitizedOptions
    };
  });

  res.json({
    success: true,
    count: fullQuestions.length,
    totalItems,
    totalPages,
    page: currentPage,
    pageSize: limit,
    questions: fullQuestions
  });
});

// ==========================================
// 2. GET /api/questions/:id - Single Question Details
// ==========================================
questionsRouter.get('/:id', authenticateToken, (req: Request, res: Response) => {
  const q: any = db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.id);
  if (!q) {
    return res.status(404).json({ success: false, error: 'Question not found' });
  }

  const isPrivileged = req.user?.role === 'INSTRUCTOR' || req.user?.role === 'ADMIN';
  const options = db.prepare(
    'SELECT id, option_key as optionKey, text, text_bangla as textBangla, is_correct as isCorrect, sort_order as sortOrder FROM question_options WHERE question_id = ? ORDER BY sort_order ASC'
  ).all(q.id);

  const sanitizedOptions = options.map((opt: any) => ({
    id: opt.id,
    optionKey: opt.optionKey,
    text: opt.text,
    textBangla: opt.textBangla,
    ...(isPrivileged ? { isCorrect: Boolean(opt.isCorrect) } : {})
  }));

  res.json({
    success: true,
    question: {
      id: q.id,
      subject: q.subject,
      chapter: q.chapter,
      topic: q.topic,
      difficulty: q.difficulty,
      type: q.type,
      prompt: q.prompt,
      promptBangla: q.prompt_bangla,
      explanation: isPrivileged ? q.explanation : undefined,
      explanationBangla: isPrivileged ? q.explanation_bangla : undefined,
      defaultMarks: q.default_marks,
      defaultNegativeMarks: q.default_negative_marks,
      correctNumeric: isPrivileged ? q.correct_numeric : undefined,
      numericTolerance: isPrivileged ? q.numeric_tolerance : undefined,
      correctText: isPrivileged ? q.correct_text : undefined,
      isApproved: Boolean(q.is_approved),
      options: sanitizedOptions
    }
  });
});

// ==========================================
// 3. POST /api/questions - Create Question (Instructor/Admin)
// ==========================================
questionsRouter.post('/', authenticateToken, requireRole('INSTRUCTOR', 'ADMIN'), (req: Request, res: Response) => {
  const validation = questionCreateSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: validation.error.errors[0]?.message || 'Invalid question data',
      details: validation.error.format()
    });
  }

  const data = validation.data;
  const questionId = uuidv4();
  // Role-based approval: Admins can approve immediately; Instructors submit as unapproved (pending review)
  const isApproved = req.user?.role === 'ADMIN' ? (data.isApproved ?? true) : false;

  try {
    db.transaction(() => {
      db.prepare(`
        INSERT INTO questions (
          id, subject, chapter, topic, difficulty, type,
          prompt, prompt_bangla, explanation, explanation_bangla,
          default_marks, default_negative_marks,
          correct_numeric, numeric_tolerance, correct_text,
          is_approved, author_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        questionId,
        data.subject,
        data.chapter,
        data.topic,
        data.difficulty,
        data.type,
        data.prompt,
        data.promptBangla || null,
        data.explanation || null,
        data.explanationBangla || null,
        data.defaultMarks,
        data.defaultNegativeMarks,
        data.correctNumeric !== undefined && data.correctNumeric !== null ? Number(data.correctNumeric) : null,
        data.numericTolerance !== undefined && data.numericTolerance !== null ? Number(data.numericTolerance) : 0.0,
        data.correctText ?? null,
        isApproved ? 1 : 0,
        req.user!.id
      );

      const insertOpt = db.prepare(`
        INSERT INTO question_options (id, question_id, option_key, text, text_bangla, is_correct, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      data.options.forEach((opt, idx) => {
        insertOpt.run(
          uuidv4(),
          questionId,
          opt.optionKey,
          opt.text,
          opt.textBangla || null,
          opt.isCorrect ? 1 : 0,
          idx
        );
      });
    })();

    res.status(201).json({
      success: true,
      message: 'Question created successfully in bank.',
      questionId
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 4. PUT /api/questions/:id - Update Question (Instructor/Admin)
// ==========================================
questionsRouter.put('/:id', authenticateToken, requireRole('INSTRUCTOR', 'ADMIN'), (req: Request, res: Response) => {
  const existing: any = db.prepare('SELECT id, author_id FROM questions WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, error: 'Question not found' });
  }

  // Instructor ownership check (Admins can edit any question)
  if (req.user?.role === 'INSTRUCTOR' && existing.author_id && existing.author_id !== req.user.id) {
    return res.status(403).json({ success: false, error: 'Instructors can only update questions they authored.' });
  }

  const validation = questionUpdateSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: validation.error.errors[0]?.message || 'Invalid update data'
    });
  }

  const data = validation.data;

  try {
    db.transaction(() => {
      // Update primary question record
      db.prepare(`
        UPDATE questions SET
          subject = COALESCE(?, subject),
          chapter = COALESCE(?, chapter),
          topic = COALESCE(?, topic),
          difficulty = COALESCE(?, difficulty),
          type = COALESCE(?, type),
          prompt = COALESCE(?, prompt),
          prompt_bangla = COALESCE(?, prompt_bangla),
          explanation = COALESCE(?, explanation),
          explanation_bangla = COALESCE(?, explanation_bangla),
          default_marks = COALESCE(?, default_marks),
          default_negative_marks = COALESCE(?, default_negative_marks),
          correct_numeric = COALESCE(?, correct_numeric),
          numeric_tolerance = COALESCE(?, numeric_tolerance),
          correct_text = COALESCE(?, correct_text),
          is_approved = COALESCE(?, is_approved)
        WHERE id = ?
      `).run(
        data.subject,
        data.chapter,
        data.topic,
        data.difficulty,
        data.type,
        data.prompt,
        data.promptBangla,
        data.explanation,
        data.explanationBangla,
        data.defaultMarks,
        data.defaultNegativeMarks,
        data.correctNumeric !== undefined ? data.correctNumeric : null,
        data.numericTolerance !== undefined ? data.numericTolerance : null,
        data.correctText !== undefined ? data.correctText : null,
        req.user?.role === 'ADMIN' && data.isApproved !== undefined ? (data.isApproved ? 1 : 0) : null,
        req.params.id
      );

      // If options were supplied, update them cleanly
      if (data.options && data.options.length > 0) {
        db.prepare('DELETE FROM question_options WHERE question_id = ?').run(req.params.id);
        const insertOpt = db.prepare(`
          INSERT INTO question_options (id, question_id, option_key, text, text_bangla, is_correct, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        data.options.forEach((opt: any, idx: number) => {
          insertOpt.run(
            uuidv4(),
            req.params.id,
            opt.optionKey,
            opt.text,
            opt.textBangla || null,
            opt.isCorrect ? 1 : 0,
            idx
          );
        });
      }
    })();

    res.json({ success: true, message: 'Question updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 4B. PATCH /api/questions/:id/status - Approve or Unapprove Question (Admin or Reviewer)
// ==========================================
questionsRouter.patch('/:id/status', authenticateToken, requireRole('ADMIN'), (req: Request, res: Response) => {
  const existing: any = db.prepare('SELECT id, is_approved FROM questions WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, error: 'Question not found' });
  }

  const { isApproved } = req.body;
  if (typeof isApproved !== 'boolean') {
    return res.status(400).json({ success: false, error: 'isApproved boolean is required.' });
  }

  // Safety rule: Cannot unapprove a question that is already part of a LIVE exam
  if (!isApproved) {
    const liveUsage: any = db.prepare(`
      SELECT e.id, e.title 
      FROM exam_questions eq 
      JOIN exams e ON e.id = eq.exam_id 
      WHERE eq.question_id = ? AND e.status = 'LIVE'
    `).get(req.params.id);

    if (liveUsage) {
      return res.status(400).json({
        success: false,
        error: `Cannot unapprove question because it is currently assigned to LIVE exam "${liveUsage.title}".`
      });
    }
  }

  const currentApproved = Boolean(existing.is_approved);

  // If status is unchanged, return current state without creating redundant audit log
  if (currentApproved === isApproved) {
    return res.json({
      success: true,
      message: isApproved ? 'Question is already approved.' : 'Question is already unapproved.',
      isApproved,
      unchanged: true
    });
  }

  // Atomic update and audit log recording inside transaction
  const adminActor = req.user!;
  const actionType = isApproved ? 'QUESTION_APPROVED' : 'QUESTION_UNAPPROVED';

  const updateTx = db.transaction(() => {
    db.prepare('UPDATE questions SET is_approved = ? WHERE id = ?').run(isApproved ? 1 : 0, req.params.id);

    recordAuditLog({
      actorId: adminActor.id,
      actorRole: adminActor.role,
      action: actionType,
      resource: 'QUESTION',
      resourceId: req.params.id,
      details: {
        previousApprovalStatus: currentApproved,
        newApprovalStatus: isApproved
      }
    });
  });

  updateTx();

  res.json({
    success: true,
    message: isApproved ? 'Question approved successfully.' : 'Question unapproved successfully.',
    isApproved
  });
});

// ==========================================
// 5. DELETE /api/questions/:id - Delete Question (Admin or Author Instructor)
// ==========================================
questionsRouter.delete('/:id', authenticateToken, requireRole('INSTRUCTOR', 'ADMIN'), (req: Request, res: Response) => {
  const existing: any = db.prepare('SELECT id, author_id FROM questions WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, error: 'Question not found' });
  }

  if (req.user?.role === 'INSTRUCTOR' && existing.author_id && existing.author_id !== req.user.id) {
    return res.status(403).json({ success: false, error: 'Instructors can only delete questions they authored.' });
  }

  db.prepare('DELETE FROM questions WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: 'Question deleted from question bank.' });
});

// ==========================================
// 6. POST /api/questions/import-csv - Atomic Bulk CSV Importer
// ==========================================
questionsRouter.post('/import-csv', authenticateToken, requireRole('INSTRUCTOR', 'ADMIN'), (req: Request, res: Response) => {
  const { csvData, allowPartial } = req.body;
  if (!csvData || typeof csvData !== 'string') {
    return res.status(400).json({ success: false, error: 'Valid csvData string is required.' });
  }

  const lines = csvData.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return res.status(400).json({
      success: false,
      error: 'CSV must contain a header row and at least one question record.'
    });
  }

  // Header format:
  // subject,chapter,topic,difficulty,type,prompt,promptBangla,optA,optB,optC,optD,correctOpt,explanation
  const errors: { row: number; error: string }[] = [];
  const validRows: any[] = [];
  const batchPrompts = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    // CSV parser accounting for quoted commas and escaped quotes
    const regex = /(?:^|,)(\"(?:[^\"]+|\"\")*\"|[^,]*)/g;
    const matches: string[] = [];
    let match;
    while ((match = regex.exec(rawLine)) !== null) {
      let val = match[1] || '';
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1).replace(/""/g, '"');
      }
      matches.push(val.trim());
      if (regex.lastIndex >= rawLine.length) break;
    }

    if (matches.length < 12) {
      errors.push({ row: i + 1, error: `Incomplete column count (${matches.length} found, expected at least 12)` });
      continue;
    }

    const [
      subject, chapter, topic, difficulty, type,
      prompt, promptBangla, optA, optB, optC, optD,
      correctOpt, explanation
    ] = matches;

    if (!subject || !chapter || !prompt || !optA || !optB || !correctOpt) {
      errors.push({ row: i + 1, error: 'Missing mandatory fields (subject, chapter, prompt, optA, optB, correctOpt)' });
      continue;
    }

    const normalizedDiff = ['EASY', 'MEDIUM', 'HARD'].includes(difficulty?.toUpperCase()) ? difficulty.toUpperCase() : 'MEDIUM';
    const normalizedType = ['SINGLE_MCQ', 'MULTI_SELECT', 'TRUE_FALSE'].includes(type?.toUpperCase()) ? type.toUpperCase() : 'SINGLE_MCQ';
    const validCorrectKeys = correctOpt.toUpperCase().split('|').map((k) => k.trim());

    // Validate that correct answer key exists among provided options
    const optionMap: Record<string, string> = { A: optA, B: optB };
    if (optC) optionMap.A = optA;
    if (optC) optionMap.C = optC;
    if (optD) optionMap.D = optD;

    const invalidCorrectKeys = validCorrectKeys.filter((k) => !optionMap[k] || optionMap[k].trim() === '');
    if (invalidCorrectKeys.length > 0) {
      errors.push({ row: i + 1, error: `Correct option key "${invalidCorrectKeys.join(', ')}" refers to an empty or missing option choice.` });
      continue;
    }

    if (normalizedType === 'SINGLE_MCQ' || normalizedType === 'TRUE_FALSE') {
      if (validCorrectKeys.length !== 1) {
        errors.push({ row: i + 1, error: `${normalizedType} must have exactly 1 correct answer (found ${validCorrectKeys.length}: ${correctOpt}).` });
        continue;
      }
    } else if (normalizedType === 'MULTI_SELECT') {
      if (validCorrectKeys.length < 1) {
        errors.push({ row: i + 1, error: 'MULTI_SELECT must have at least 1 correct answer.' });
        continue;
      }
    }

    // Check for internal duplicate within this CSV batch
    const normalizedPrompt = prompt.trim();
    if (batchPrompts.has(normalizedPrompt)) {
      errors.push({ row: i + 1, error: `Duplicate question prompt in CSV batch: "${prompt.substring(0, 40)}..."` });
      continue;
    }
    batchPrompts.add(normalizedPrompt);

    validRows.push({
      subject,
      chapter,
      topic: topic || 'General',
      difficulty: normalizedDiff,
      type: normalizedType,
      prompt: normalizedPrompt,
      promptBangla: promptBangla || null,
      explanation: explanation || null,
      options: [
        { key: 'A', text: optA, isCorrect: validCorrectKeys.includes('A') },
        { key: 'B', text: optB, isCorrect: validCorrectKeys.includes('B') },
        ...(optC ? [{ key: 'C', text: optC, isCorrect: validCorrectKeys.includes('C') }] : []),
        ...(optD ? [{ key: 'D', text: optD, isCorrect: validCorrectKeys.includes('D') }] : [])
      ]
    });
  }

  // Strict mode: if allowPartial is false and there are errors, reject entire batch atomically
  if (allowPartial !== true && errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: `CSV validation failed with ${errors.length} error(s). Please review and correct the file.`,
      validationErrors: errors,
      validRowCount: validRows.length
    });
  }

  if (validRows.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No valid rows found in CSV.',
      validationErrors: errors
    });
  }

  // Admin approval governance:
  // Admins get auto-approved questions (is_approved = 1)
  // Instructors get questions marked PENDING APPROVAL (is_approved = 0)
  const isApproved = req.user?.role === 'ADMIN' ? 1 : 0;
  const importedQuestionIds: string[] = [];

  // Atomic batch insertion via SQLite Transaction
  try {
    let newlyCreatedCount = 0;
    let reusedCount = 0;

    db.transaction(() => {
      const insertQ = db.prepare(`
        INSERT INTO questions (
          id, subject, chapter, topic, difficulty, type,
          prompt, prompt_bangla, explanation, default_marks, default_negative_marks, is_approved, author_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1.0, 0.25, ?, ?)
      `);

      const insertOpt = db.prepare(`
        INSERT INTO question_options (id, question_id, option_key, text, is_correct, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const row of validRows) {
        // Privacy & Ownership Safeguard:
        // Only reuse if the question with this exact prompt was authored by the CURRENT user.
        // Never reuse or link to an unapproved question authored by another instructor.
        const existingOwnQuestion: any = db.prepare(`
          SELECT id FROM questions 
          WHERE prompt = ? AND author_id = ?
        `).get(row.prompt, req.user!.id);

        if (existingOwnQuestion) {
          importedQuestionIds.push(existingOwnQuestion.id);
          reusedCount++;
          continue;
        }

        const qId = uuidv4();
        insertQ.run(
          qId,
          row.subject,
          row.chapter,
          row.topic,
          row.difficulty,
          row.type,
          row.prompt,
          row.promptBangla,
          row.explanation,
          isApproved,
          req.user!.id
        );

        row.options.forEach((opt: any, idx: number) => {
          insertOpt.run(uuidv4(), qId, opt.key, opt.text, opt.isCorrect ? 1 : 0, idx);
        });

        importedQuestionIds.push(qId);
        newlyCreatedCount++;
      }
    })();

    res.json({
      success: true,
      message: `Successfully processed ${validRows.length} questions (${newlyCreatedCount} new, ${reusedCount} existing).`,
      importedCount: validRows.length,
      newlyCreatedCount,
      reusedCount,
      importedQuestionIds,
      isApproved: Boolean(isApproved),
      skippedErrors: errors.length > 0 ? errors : undefined
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
