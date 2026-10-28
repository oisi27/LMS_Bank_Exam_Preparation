import Database from 'better-sqlite3';
import path from 'path';

// Determine database file path:
// In TEST mode (NODE_ENV=test or VITEST), NEVER use the production/development server/bank_exam.db.
// Fall back to a dedicated isolated test database file if DB_PATH is not explicitly provided.
const defaultDevDbPath = path.resolve(__dirname, '../../bank_exam.db');
const defaultTestDbPath = path.resolve(__dirname, '../../bank_exam_test.db');

export const dbPath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : (process.env.NODE_ENV === 'test' || process.env.VITEST ? defaultTestDbPath : defaultDevDbPath);

// Fail-safe protection: If running under Vitest/test environment, forbid pointing to defaultDevDbPath
if ((process.env.NODE_ENV === 'test' || process.env.VITEST) && path.resolve(dbPath) === path.resolve(defaultDevDbPath)) {
  throw new Error(`[CRITICAL SECURITY GUARD]: Automated test attempted to connect to real development database: ${defaultDevDbPath}`);
}

export const db = new Database(dbPath);

// Enable WAL mode for high concurrency
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    -- 1. Users Table
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('STUDENT', 'INSTRUCTOR', 'ADMIN')),
      is_active INTEGER NOT NULL DEFAULT 1,
      target_exam TEXT,
      target_date TEXT,
      target_bank TEXT,
      target_position TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    -- 2. Refresh Tokens Table (Rotating session token)
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    -- 3. OTP Verifications
    CREATE TABLE IF NOT EXISTS otps (
      id TEXT PRIMARY KEY,
      destination TEXT NOT NULL,
      code TEXT NOT NULL,
      type TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      consumed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    -- 4. Question Bank
    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      subject TEXT NOT NULL,
      chapter TEXT NOT NULL,
      topic TEXT NOT NULL,
      difficulty TEXT NOT NULL CHECK (difficulty IN ('EASY', 'MEDIUM', 'HARD')),
      type TEXT NOT NULL CHECK (type IN ('SINGLE_MCQ', 'MULTI_SELECT', 'TRUE_FALSE', 'NUMERIC', 'FILL_BLANK')),
      prompt TEXT NOT NULL,
      prompt_bangla TEXT,
      explanation TEXT,
      explanation_bangla TEXT,
      default_marks REAL NOT NULL DEFAULT 1.0,
      default_negative_marks REAL NOT NULL DEFAULT 0.25,
      correct_numeric REAL,
      numeric_tolerance REAL DEFAULT 0.0,
      correct_text TEXT,
      is_approved INTEGER NOT NULL DEFAULT 1,
      author_id TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    -- 5. Question Options
    CREATE TABLE IF NOT EXISTS question_options (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      option_key TEXT NOT NULL,
      text TEXT NOT NULL,
      text_bangla TEXT,
      is_correct INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    -- 6. Exams Table
    CREATE TABLE IF NOT EXISTS exams (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      title_bangla TEXT,
      description TEXT,
      category TEXT NOT NULL DEFAULT 'BANK_RECRUITMENT',
      type TEXT NOT NULL CHECK (type IN ('CHAPTER_QUIZ', 'MODEL_TEST')),
      status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SCHEDULED', 'LIVE', 'CLOSED', 'RESULTS_PUBLISHED')),
      duration_minutes INTEGER NOT NULL,
      total_marks REAL NOT NULL,
      pass_marks REAL NOT NULL,
      negative_marking_rate REAL NOT NULL DEFAULT 0.25,
      allowed_attempts INTEGER NOT NULL DEFAULT 1,
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      result_release_mode TEXT NOT NULL DEFAULT 'INSTANT' CHECK (result_release_mode IN ('INSTANT', 'SCHEDULED', 'MANUAL')),
      integrity_enabled INTEGER NOT NULL DEFAULT 1,
      max_violations_allowed INTEGER NOT NULL DEFAULT 3,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    -- 7. Exam Questions Junction
    CREATE TABLE IF NOT EXISTS exam_questions (
      id TEXT PRIMARY KEY,
      exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
      question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      section_name TEXT NOT NULL DEFAULT 'General',
      marks REAL NOT NULL DEFAULT 1.0,
      negative_marks REAL NOT NULL DEFAULT 0.25,
      order_index INTEGER NOT NULL DEFAULT 0,
      UNIQUE(exam_id, question_id)
    );

    -- 8. Attempts Table
    CREATE TABLE IF NOT EXISTS attempts (
      id TEXT PRIMARY KEY,
      exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      started_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      submitted_at TEXT,
      status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'SUBMITTED', 'AUTO_SUBMITTED', 'GRADED')),
      idempotency_key TEXT UNIQUE,
      active_session_token TEXT,
      time_extended_minutes INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    -- 9. Attempt Answers Table (Idempotent autosave target)
    CREATE TABLE IF NOT EXISTS attempt_answers (
      id TEXT PRIMARY KEY,
      attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
      question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      selected_option_ids TEXT,
      numeric_answer REAL,
      text_answer TEXT,
      is_marked_for_review INTEGER NOT NULL DEFAULT 0,
      client_sequence INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      UNIQUE(attempt_id, question_id)
    );

    -- 10. Exam Integrity Violations (Append-only)
    CREATE TABLE IF NOT EXISTS exam_violations (
      id TEXT PRIMARY KEY,
      attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
      violation_type TEXT NOT NULL,
      details TEXT,
      occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    -- 11. Results Table
    CREATE TABLE IF NOT EXISTS exam_results (
      id TEXT PRIMARY KEY,
      attempt_id TEXT UNIQUE NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
      exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      score REAL NOT NULL,
      total_marks REAL NOT NULL,
      correct_count INTEGER NOT NULL,
      wrong_count INTEGER NOT NULL,
      skipped_count INTEGER NOT NULL,
      accuracy_percentage REAL NOT NULL,
      time_spent_seconds INTEGER NOT NULL,
      rank INTEGER,
      is_passed INTEGER NOT NULL DEFAULT 0,
      original_score REAL,
      is_overridden INTEGER NOT NULL DEFAULT 0,
      override_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    -- 12. Audit Logs Table (Tamper-proof sensitive actions)
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_id TEXT NOT NULL REFERENCES users(id),
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      resource TEXT NOT NULL,
      resource_id TEXT,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    -- 13. Categories Table
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_bangla TEXT,
      slug TEXT UNIQUE NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    -- 14. Courses Table (Draft -> Pending Review -> Approved/Published workflow)
    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      title_bangla TEXT,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      cover_image_url TEXT,
      instructor_id TEXT REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING_REVIEW', 'REJECTED', 'PUBLISHED')),
      rejection_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    -- 15. Modules Table
    CREATE TABLE IF NOT EXISTS course_modules (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      title_bangla TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    -- 16. Lessons Table
    CREATE TABLE IF NOT EXISTS lessons (
      id TEXT PRIMARY KEY,
      module_id TEXT NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      title_bangla TEXT,
      content TEXT,
      video_url TEXT,
      duration_minutes INTEGER DEFAULT 15,
      is_free_preview INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    -- 17. Lesson Resources & Signed File Links
    CREATE TABLE IF NOT EXISTS lesson_resources (
      id TEXT PRIMARY KEY,
      lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_type TEXT NOT NULL CHECK (file_type IN ('PDF', 'NOTES', 'SLIDES', 'DOC', 'VIDEO')),
      file_size_bytes INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    -- 18. Student Lesson Progress Tracking (Phase 7 - Module 8)
    CREATE TABLE IF NOT EXISTS lesson_progress (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
      completed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      UNIQUE(user_id, lesson_id)
    );

    CREATE INDEX IF NOT EXISTS idx_lesson_progress_user ON lesson_progress(user_id);
    CREATE INDEX IF NOT EXISTS idx_lesson_progress_lesson ON lesson_progress(lesson_id);
  `);

  // Safe additive schema migrations for existing databases
  try {
    const tableInfo = db.prepare(`PRAGMA table_info(questions)`).all() as any[];
    const colNames = new Set(tableInfo.map((col) => col.name));

    if (!colNames.has('correct_numeric')) {
      db.prepare(`ALTER TABLE questions ADD COLUMN correct_numeric REAL`).run();
    }
    if (!colNames.has('numeric_tolerance')) {
      db.prepare(`ALTER TABLE questions ADD COLUMN numeric_tolerance REAL DEFAULT 0.0`).run();
    }
    if (!colNames.has('correct_text')) {
      db.prepare(`ALTER TABLE questions ADD COLUMN correct_text TEXT`).run();
    }
  } catch (migErr) {
    console.warn('[DB MIGRATION WARNING]:', migErr);
  }

  // Safe additive schema migration for Student Goal (Phase 1)
  try {
    const userTableInfo = db.prepare(`PRAGMA table_info(users)`).all() as any[];
    const userColNames = new Set(userTableInfo.map((col) => col.name));

    if (!userColNames.has('target_bank')) {
      db.prepare(`ALTER TABLE users ADD COLUMN target_bank TEXT`).run();
    }
    if (!userColNames.has('target_position')) {
      db.prepare(`ALTER TABLE users ADD COLUMN target_position TEXT`).run();
    }
  } catch (userMigErr) {
    console.warn('[DB MIGRATION WARNING - USERS GOAL]:', userMigErr);
  }

  // Safe additive schema migrations for Admin Governance (Module 10)
  try {
    const resTableInfo = db.prepare(`PRAGMA table_info(exam_results)`).all() as any[];
    const resColNames = new Set(resTableInfo.map((col) => col.name));

    if (!resColNames.has('original_score')) {
      db.prepare(`ALTER TABLE exam_results ADD COLUMN original_score REAL`).run();
    }
    if (!resColNames.has('is_overridden')) {
      db.prepare(`ALTER TABLE exam_results ADD COLUMN is_overridden INTEGER NOT NULL DEFAULT 0`).run();
    }
    if (!resColNames.has('override_reason')) {
      db.prepare(`ALTER TABLE exam_results ADD COLUMN override_reason TEXT`).run();
    }

    const attTableInfo = db.prepare(`PRAGMA table_info(attempts)`).all() as any[];
    const attColNames = new Set(attTableInfo.map((col) => col.name));

    if (!attColNames.has('time_extended_minutes')) {
      db.prepare(`ALTER TABLE attempts ADD COLUMN time_extended_minutes INTEGER NOT NULL DEFAULT 0`).run();
    }
  } catch (govMigErr) {
    console.warn('[DB MIGRATION WARNING - ADMIN GOVERNANCE]:', govMigErr);
  }

  // Safe migration for Course Moderation (Milestone 3):
  // Check if existing courses table check constraint only allows DRAFT and PUBLISHED.
  // If so, safely recreate courses table with expanded statuses and rejection_reason without data loss.
  try {
    const courseTableSqlRow: any = db.prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'courses'`).get();
    if (courseTableSqlRow && courseTableSqlRow.sql) {
      const sql: string = courseTableSqlRow.sql;
      const needsMigration = !sql.includes('PENDING_REVIEW') || !sql.includes('rejection_reason');

      if (needsMigration) {
        db.pragma('foreign_keys = OFF');
        const migrationTx = db.transaction(() => {
          db.prepare(`
            CREATE TABLE courses_new (
              id TEXT PRIMARY KEY,
              category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
              title TEXT NOT NULL,
              title_bangla TEXT,
              slug TEXT UNIQUE NOT NULL,
              description TEXT,
              cover_image_url TEXT,
              instructor_id TEXT REFERENCES users(id),
              status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING_REVIEW', 'REJECTED', 'PUBLISHED')),
              rejection_reason TEXT,
              created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
              updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            )
          `).run();

          db.prepare(`
            INSERT INTO courses_new (id, category_id, title, title_bangla, slug, description, cover_image_url, instructor_id, status, created_at, updated_at)
            SELECT id, category_id, title, title_bangla, slug, description, cover_image_url, instructor_id, status, created_at, updated_at
            FROM courses
          `).run();

          db.prepare(`DROP TABLE courses`).run();
          db.prepare(`ALTER TABLE courses_new RENAME TO courses`).run();
        });

        migrationTx();
        db.pragma('foreign_keys = ON');
      }
    }
  } catch (courseMigErr) {
    console.warn('[DB MIGRATION WARNING - COURSES]:', courseMigErr);
  }

  // Safe migration for Lesson Resources file_type (Milestone 3 / Phase 3):
  // Check if existing lesson_resources check constraint allows 'VIDEO'.
  // If not, safely recreate lesson_resources with expanded constraint without data loss.
  try {
    const resTableSqlRow: any = db.prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'lesson_resources'`).get();
    if (resTableSqlRow && resTableSqlRow.sql) {
      const sql: string = resTableSqlRow.sql;
      const needsMigration = !sql.includes('VIDEO');

      if (needsMigration) {
        db.pragma('foreign_keys = OFF');
        const migrationTx = db.transaction(() => {
          db.prepare(`
            CREATE TABLE lesson_resources_new (
              id TEXT PRIMARY KEY,
              lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
              title TEXT NOT NULL,
              file_path TEXT NOT NULL,
              file_type TEXT NOT NULL CHECK (file_type IN ('PDF', 'NOTES', 'SLIDES', 'DOC', 'VIDEO')),
              file_size_bytes INTEGER DEFAULT 0,
              created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            )
          `).run();

          db.prepare(`
            INSERT INTO lesson_resources_new (id, lesson_id, title, file_path, file_type, file_size_bytes, created_at)
            SELECT id, lesson_id, title, file_path, file_type, file_size_bytes, created_at
            FROM lesson_resources
          `).run();

          db.prepare(`DROP TABLE lesson_resources`).run();
          db.prepare(`ALTER TABLE lesson_resources_new RENAME TO lesson_resources`).run();
        });

        migrationTx();
        db.pragma('foreign_keys = ON');
      }
    }
  } catch (resMigErr) {
    console.warn('[DB MIGRATION WARNING - LESSON RESOURCES]:', resMigErr);
  }

  console.log('Database schema successfully initialized with UTC ISO timestamps.');
}
