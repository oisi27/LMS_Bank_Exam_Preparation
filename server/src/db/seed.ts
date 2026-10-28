import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { db } from './schema';

export function seedDatabase() {
  const userCount: any = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count > 0) {
    return; // Already seeded
  }

  console.log('Seeding demo bank exam database with realistic Bangladesh Bank syllabus questions...');

  const passwordHash = bcrypt.hashSync('bankpass123', 10);
  const adminId = uuidv4();
  const instructorId = uuidv4();
  const studentId = uuidv4();

  // 1. Seed Users
  db.prepare(`
    INSERT INTO users (id, email, password_hash, name, role, target_exam)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(adminId, 'admin@banklms.ac.bd', passwordHash, 'Dr. Naushin Nower (Admin)', 'ADMIN', 'Combined 8 Banks Officer');

  db.prepare(`
    INSERT INTO users (id, email, password_hash, name, role, target_exam)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(instructorId, 'instructor@banklms.ac.bd', passwordHash, 'Senior Faculty (Math & English)', 'INSTRUCTOR', 'Bangladesh Bank AD');

  db.prepare(`
    INSERT INTO users (id, email, password_hash, name, role, target_exam)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(studentId, 'oisi@du.ac.bd', passwordHash, 'Farabi Mizan Oisi', 'STUDENT', 'Bangladesh Bank Assistant Director');

  // 2. Realistic Bank Questions (English, Quantitative Math, Bengali, GK/Banking)
  const questionsData = [
    {
      subject: 'English Language & Literature',
      chapter: 'Vocabulary & Analogy',
      topic: 'Antonyms',
      difficulty: 'MEDIUM',
      type: 'SINGLE_MCQ',
      prompt: 'What is the antonym of the word "EPHEMERAL"?',
      promptBangla: '"EPHEMERAL" শব্দটির বিপরীতার্থক শব্দ কোনটি?',
      explanation: 'Ephemeral means lasting for a very short time. Permanent means lasting indefinitely.',
      options: [
        { key: 'A', text: 'Transient', isCorrect: false },
        { key: 'B', text: 'Permanent', isCorrect: true },
        { key: 'C', text: 'Fleeting', isCorrect: false },
        { key: 'D', text: 'Momentary', isCorrect: false }
      ]
    },
    {
      subject: 'Quantitative Aptitude & Mathematics',
      chapter: 'Commercial Arithmetic',
      topic: 'Simple & Compound Interest',
      difficulty: 'HARD',
      type: 'SINGLE_MCQ',
      prompt: 'A sum of money invested at compound interest doubles itself in 4 years. In how many years will it amount to 8 times itself at the same rate?',
      promptBangla: 'চক্রবৃদ্ধি সুদে একটি মূলধন ৪ বছরে দ্বিগুণ হয়। একই সুদের হারে কত বছরে তা ৮ গুণ হবে?',
      explanation: 'Under compound interest, money doubles in 4 years: $2^1$ in 4 yrs, $2^2 = 4$ times in 8 yrs, $2^3 = 8$ times in $3 \\times 4 = 12$ years.',
      options: [
        { key: 'A', text: '8 years', isCorrect: false },
        { key: 'B', text: '12 years', isCorrect: true },
        { key: 'C', text: '16 years', isCorrect: false },
        { key: 'D', text: '24 years', isCorrect: false }
      ]
    },
    {
      subject: 'Bangla Language & Literature',
      chapter: 'বাংলা ব্যাকরণ',
      topic: 'সন্ধি ও সমাস',
      difficulty: 'MEDIUM',
      type: 'SINGLE_MCQ',
      prompt: '"গায়ক" শব্দের সঠিক সন্ধি বিচ্ছেদ কোনটি?',
      promptBangla: '"গায়ক" শব্দের সঠিক সন্ধি বিচ্ছেদ কোনটি?',
      explanation: 'গায়ক = গৈ + অক। এটি একটি স্বরসন্ধির বিশিষ্ট নিয়ম (ঐ + স্বরবর্ণ = আয়্)।',
      options: [
        { key: 'A', text: 'গা + অক', isCorrect: false },
        { key: 'B', text: 'গে + অক', isCorrect: false },
        { key: 'C', text: 'গৈ + অক', isCorrect: true },
        { key: 'D', text: 'গো + অক', isCorrect: false }
      ]
    },
    {
      subject: 'General Knowledge & Banking Affairs',
      chapter: 'Central Banking & Macroeconomics',
      topic: 'Monetary Policy',
      difficulty: 'EASY',
      type: 'SINGLE_MCQ',
      prompt: 'Which department in Bangladesh Bank is directly responsible for formulating the monetary policy?',
      promptBangla: 'বাংলাদেশ ব্যাংকের কোন বিভাগ সরাসরি মুদ্রানীতি প্রণয়নের দায়িত্ব পালন করে?',
      explanation: 'The Monetary Policy Department (MPD) of Bangladesh Bank conducts research and formulates the biannual Monetary Policy Statement (MPS).',
      options: [
        { key: 'A', text: 'Banking Inspection Department', isCorrect: false },
        { key: 'B', text: 'Monetary Policy Department', isCorrect: true },
        { key: 'C', text: 'Foreign Exchange Reserve Operations', isCorrect: false },
        { key: 'D', text: 'Department of Off-site Supervision', isCorrect: false }
      ]
    },
    {
      subject: 'Computer & Information Technology',
      chapter: 'Database Management Systems',
      topic: 'ACID Properties',
      difficulty: 'MEDIUM',
      type: 'MULTI_SELECT',
      prompt: 'Which of the following are ACID properties in database transaction management?',
      promptBangla: 'ডাটাবেজ লেনদেন ব্যবস্থাপনায় নিচের কোন বৈশিষ্ট্যগুলো ACID-এর অন্তর্ভুক্ত?',
      explanation: 'ACID stands for Atomicity, Consistency, Isolation, and Durability. Among the four provided options, Atomicity (A), Consistency (B), and Durability (D) are correct ACID properties. Distribution (C) is a distributed systems concept and is NOT an ACID property.',
      explanationBangla: 'ACID বলতে Atomicity, Consistency, Isolation এবং Durability-কে বোঝায়। প্রদত্ত চারটি বিকল্পের মধ্যে Atomicity (A), Consistency (B) এবং Durability (D) হলো সঠিক বৈশিষ্ট্য। Distribution (C) মূলত ডিস্ট্রিবিউটেড সিস্টেমের ধারণা এবং এটি ACID-এর অন্তর্ভুক্ত নয়।',
      options: [
        { key: 'A', text: 'Atomicity', isCorrect: true },
        { key: 'B', text: 'Consistency', isCorrect: true },
        { key: 'C', text: 'Distribution', isCorrect: false },
        { key: 'D', text: 'Durability', isCorrect: true }
      ]
    }
  ];

  // Insert Questions & Exam
  const examId = uuidv4();
  const now = new Date();
  const startsAt = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
  const endsAt = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO exams (
      id, title, title_bangla, description, category, type, status,
      duration_minutes, total_marks, pass_marks, negative_marking_rate,
      allowed_attempts, starts_at, ends_at, integrity_enabled, max_violations_allowed, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    examId,
    'Bangladesh Bank AD Special Model Test - 2026',
    'বাংলাদেশ ব্যাংক সহকারী পরিচালক স্পেশাল মডেল টেস্ট - ২০২৬',
    'Full-length simulation with server-authoritative timer, negative marking (0.25), and live browser integrity deterrence.',
    'BANK_RECRUITMENT',
    'MODEL_TEST',
    'LIVE',
    30,
    5.0,
    2.5,
    0.25,
    3,
    startsAt,
    endsAt,
    1,
    3,
    instructorId
  );

  questionsData.forEach((q, index) => {
    const qId = uuidv4();
    db.prepare(`
      INSERT INTO questions (
        id, subject, chapter, topic, difficulty, type, prompt, prompt_bangla,
        explanation, default_marks, default_negative_marks, author_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      qId, q.subject, q.chapter, q.topic, q.difficulty, q.type,
      q.prompt, q.promptBangla, q.explanation, 1.0, 0.25, instructorId
    );

    q.options.forEach((opt, optIdx) => {
      db.prepare(`
        INSERT INTO question_options (id, question_id, option_key, text, is_correct, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), qId, opt.key, opt.text, opt.isCorrect ? 1 : 0, optIdx);
    });

    db.prepare(`
      INSERT INTO exam_questions (id, exam_id, question_id, section_name, marks, negative_marks, order_index)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), examId, qId, q.subject, 1.0, 0.25, index + 1);
  });

  // 3. Seed Courses, Modules, Lessons, Resources
  const courseCount: any = db.prepare('SELECT COUNT(*) as count FROM courses').get();
  if (courseCount.count === 0) {
    db.prepare('DELETE FROM categories').run(); // Clean up categories to re-insert properly
    const catId1 = uuidv4();
    const catId2 = uuidv4();
    const catId3 = uuidv4();
    const catId4 = uuidv4();

    db.prepare(`
      INSERT INTO categories (id, name, name_bangla, slug, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `).run(catId1, 'Quantitative Aptitude & Mathematics', 'গাণিতিক যুক্তি ও মানসিক দক্ষতা', 'quantitative-math', 1);

    db.prepare(`
      INSERT INTO categories (id, name, name_bangla, slug, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `).run(catId2, 'English Language & Comprehension', 'ইংরেজি ভাষা ও সাহিত্য', 'english-language', 2);

    db.prepare(`
      INSERT INTO categories (id, name, name_bangla, slug, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `).run(catId3, 'Banking Affairs & Computer IT', 'ব্যাংকিং ও কম্পিউটার প্রযুক্তি', 'banking-it', 3);

    db.prepare(`
      INSERT INTO categories (id, name, name_bangla, slug, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `).run(catId4, 'Bangla Language & Literature', 'বাংলা ভাষা ও সাহিত্য', 'bangla-language', 4);

    // ==========================================
    // COURSE 1: Bank Math Foundation (Real Math Lecture Video)
    // ==========================================
    const courseId1 = uuidv4();
    db.prepare(`
      INSERT INTO courses (id, category_id, title, title_bangla, slug, description, instructor_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'PUBLISHED')
    `).run(
      courseId1,
      catId1,
      'Bank Math Foundation: Commercial Arithmetic Mastery',
      'ব্যাংক গণিত ফাউন্ডেশন: পাটিগণিত ও বাণিজ্যিক গণিত',
      'bank-math-foundation',
      'Comprehensive masterclass on Interest, Profit-Loss, Time & Work, Speed & Distance designed for Bangladesh Bank AD & Combined 8 Banks.',
      instructorId
    );

    const modId1 = uuidv4();
    db.prepare(`
      INSERT INTO course_modules (id, course_id, title, title_bangla, sort_order)
      VALUES (?, ?, ?, ?, 1)
    `).run(modId1, courseId1, 'Module 1: Simple & Compound Interest Principles', 'মডিউল ১: সরল ও চক্রবৃদ্ধি সুদের মূলনীতি');

    const lesId1 = uuidv4();
    db.prepare(`
      INSERT INTO lessons (id, module_id, title, title_bangla, content, video_url, duration_minutes, is_free_preview, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, 25, 1, 1)
    `).run(
      lesId1,
      modId1,
      'Core Formulas, Short-cut Techniques & Derivations',
      'মূল সূত্র, শর্টকাট টেকনিক ও প্রয়োগ',
      'In this lecture, we examine compound interest compounding periods (quarterly, semi-annually) and how to solve doubling-rate problems within 30 seconds without calculators.',
      'https://www.youtube.com/embed/LwCRRUa8yTU' // Authentic Quantitative Bank Mathematics Video
    );

    const resId1 = uuidv4();
    db.prepare(`
      INSERT INTO lesson_resources (id, lesson_id, title, file_path, file_type, file_size_bytes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      resId1,
      lesId1,
      'Lecture 01 Handout: Compound Interest Formula Sheet & 50 Practice Problems (PDF)',
      'uploads/pdfs/compound_interest_handout.pdf',
      'PDF',
      2450000
    );

    const lesId2 = uuidv4();
    db.prepare(`
      INSERT INTO lessons (id, module_id, title, title_bangla, content, duration_minutes, is_free_preview, sort_order)
      VALUES (?, ?, ?, ?, ?, 35, 0, 2)
    `).run(
      lesId2,
      modId1,
      'Past 10 Years Bangladesh Bank & Combined Bank Question Solutions',
      'বিগত ১০ বছরের বাংলাদেশ ব্যাংক ও সমন্বিত ব্যাংক প্রশ্ন সমাধান',
      'Step-by-step walkthrough of real recruitment exam problems from 2014 to 2024.'
    );

    // ==========================================
    // COURSE 2: English Grammar & Vocabulary Mastery
    // ==========================================
    const courseId2 = uuidv4();
    db.prepare(`
      INSERT INTO courses (id, category_id, title, title_bangla, slug, description, instructor_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'PUBLISHED')
    `).run(
      courseId2,
      catId2,
      'English Vocabulary, Analogy & Error Detection for Bank Exams',
      'ব্যাংক নিয়োগ পরীক্ষার জন্য ইংরেজি শব্দভাণ্ডার ও ব্যাকরণ',
      'english-vocab-analogy',
      'High-yield vocabulary building, sentence completion, reading comprehension strategies, and previous years IBA / DU recruited question patterns.',
      instructorId
    );

    const modId2 = uuidv4();
    db.prepare(`
      INSERT INTO course_modules (id, course_id, title, title_bangla, sort_order)
      VALUES (?, ?, ?, ?, 1)
    `).run(modId2, courseId2, 'Module 1: High Frequency Word Lists & Root Words', 'মডিউল ১: সর্বাধিক কমন ভোকাবুলারি ও রুট ওয়ার্ডস');

    const lesId3 = uuidv4();
    db.prepare(`
      INSERT INTO lessons (id, module_id, title, title_bangla, content, video_url, duration_minutes, is_free_preview, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, 20, 1, 1)
    `).run(
      lesId3,
      modId2,
      'Top 300 High-Frequency Bank Words & Contextual Usage',
      'টপ ৩০০ ব্যাংকিং ভোকাবুলারি ও বাক্যে প্রয়োগ',
      'Learn mnemonic methods and Latin/Greek root patterns to eliminate wrong choices swiftly in the MCQ preliminary test.',
      'https://www.youtube.com/embed/fW77nI2B-c0'
    );

    const resId2 = uuidv4();
    db.prepare(`
      INSERT INTO lesson_resources (id, lesson_id, title, file_path, file_type, file_size_bytes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      resId2,
      lesId3,
      'English Vocabulary & Analogy Quick Review Sheet (PDF)',
      'uploads/pdfs/english_vocab_analogy_handout.pdf',
      'PDF',
      9442
    );

    // ==========================================
    // COURSE 3: Banking Knowledge & IT Fundamentals
    // ==========================================
    const courseId3 = uuidv4();
    db.prepare(`
      INSERT INTO courses (id, category_id, title, title_bangla, slug, description, instructor_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'PUBLISHED')
    `).run(
      courseId3,
      catId3,
      'Central Banking, Monetary Policy & Computer Literacy',
      'কেন্দ্রীয় ব্যাংকিং, মুদ্রানীতি ও কম্পিউটার সাধারণ জ্ঞান',
      'banking-it-literacy',
      'Complete coverage of Bangladesh Bank regulations, Basel III norms, financial inclusion, fintech developments, and IT fundamentals.',
      adminId
    );

    const modId3 = uuidv4();
    db.prepare(`
      INSERT INTO course_modules (id, course_id, title, title_bangla, sort_order)
      VALUES (?, ?, ?, ?, 1)
    `).run(modId3, courseId3, 'Module 1: Monetary Policy & Financial Systems', 'মডিউল ১: মুদ্রানীতি ও ব্যাংকিং কাঠামো');

    const lesId4 = uuidv4();
    db.prepare(`
      INSERT INTO lessons (id, module_id, title, title_bangla, content, video_url, duration_minutes, is_free_preview, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, 30, 1, 1)
    `).run(
      lesId4,
      modId3,
      'Functions of Bangladesh Bank & Monetary Instruments',
      'বাংলাদেশ ব্যাংকের কার্যাবলি ও মুদ্রানীতির হাতিয়ারসমূহ',
      'Detailed breakdown of CRR, SLR, Repo, Reverse Repo, and the latest MPS framework issued by Bangladesh Bank.',
      'https://www.youtube.com/embed/rIof_nLzPq0'
    );

    const resId3 = uuidv4();
    db.prepare(`
      INSERT INTO lesson_resources (id, lesson_id, title, file_path, file_type, file_size_bytes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      resId3,
      lesId4,
      'Bangladesh Bank Monetary Framework & Summary Notes (PDF)',
      'uploads/pdfs/central_banking_monetary_notes.pdf',
      'PDF',
      8078
    );

    // ==========================================
    // COURSE 4: Bangla Grammar & Literature (NEW COURSE)
    // ==========================================
    const courseId4 = uuidv4();
    db.prepare(`
      INSERT INTO courses (id, category_id, title, title_bangla, slug, description, instructor_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'PUBLISHED')
    `).run(
      courseId4,
      catId4,
      'Bangla Grammar, Spelling Rules & Literature for Bank Recruitment',
      'ব্যাংক নিয়োগ স্পেশাল বাংলা ব্যাকরণ, শুদ্ধিকরণ ও সাহিত্য',
      'bangla-grammar-literature',
      'প্রমিত বাংলা বানানের নিয়ম, ণ-ত্ব ও ষ-ত্ব বিধান, সন্ধি, সমাস, কারক ও বিভক্তি এবং বিগত বছরের প্রশ্নাবলি সমাধান।',
      instructorId
    );

    const modId4 = uuidv4();
    db.prepare(`
      INSERT INTO course_modules (id, course_id, title, title_bangla, sort_order)
      VALUES (?, ?, ?, ?, 1)
    `).run(modId4, courseId4, 'মডিউল ১: শব্দ ও সন্ধি প্রকরণ', 'Module 1: Words & Sandhi Rules');

    const lesId5 = uuidv4();
    db.prepare(`
      INSERT INTO lessons (id, module_id, title, title_bangla, content, video_url, duration_minutes, is_free_preview, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, 25, 1, 1)
    `).run(
      lesId5,
      modId4,
      'সন্ধি ও সমাসের সহজ শর্টকাট নিয়মাবলী',
      'Short-cut Rules of Sandhi and Samas',
      'বাংলা স্বরসন্ধি, ব্যঞ্জনসন্ধি ও বিসর্গ সন্ধির ব্যতিক্রমী প্রশ্নসমূহ এবং সমাস নির্ণয়ের টেকনিকসমূহ বিশ্লেষণ।',
      'https://www.youtube.com/embed/5NV4y2j0g84'
    );

    const resId4 = uuidv4();
    db.prepare(`
      INSERT INTO lesson_resources (id, lesson_id, title, file_path, file_type, file_size_bytes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      resId4,
      lesId5,
      'বাংলা ব্যাকরণ ও প্রমিত বানানের স্পেশাল লেকচার শিট (PDF)',
      'uploads/pdfs/bangla_grammar_literature_handout.pdf',
      'PDF',
      197672
    );

    // ==========================================
    // COURSE 5: Bank Written & English Comprehension (NEW COURSE)
    // ==========================================
    const courseId5 = uuidv4();
    db.prepare(`
      INSERT INTO courses (id, category_id, title, title_bangla, slug, description, instructor_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'PUBLISHED')
    `).run(
      courseId5,
      catId2,
      'Bank Written English: Focus Writing, Critical Reading & Translation',
      'ব্যাংক রিটেন ও প্রিলিমিনারি ফোকাস রাইটিং ও অনুবাদ কৌশল',
      'bank-written-english',
      'Focus writing on contemporary macroeconomic issues, critical reading passages, English-to-Bangla and Bangla-to-English translation formulas.',
      instructorId
    );

    const modId5 = uuidv4();
    db.prepare(`
      INSERT INTO course_modules (id, course_id, title, title_bangla, sort_order)
      VALUES (?, ?, ?, ?, 1)
    `).run(modId5, courseId5, 'Module 1: Critical Reading & Contextual Translation', 'মডিউল ১: প্যাসেজ সমাধান ও অনুবাদ কৌশল');

    const lesId6 = uuidv4();
    db.prepare(`
      INSERT INTO lessons (id, module_id, title, title_bangla, content, video_url, duration_minutes, is_free_preview, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, 35, 1, 1)
    `).run(
      lesId6,
      modId5,
      'Effective Passage Reading & Translation Strategies',
      'কার্যকর প্যাসেজ বিশ্লেষণ ও দ্রুত অনুবাদ কলাকৌশল',
      'Techniques for tackling complex comprehension passages in Bangladesh Bank AD exams with high accuracy under strict time limits.',
      'https://www.youtube.com/embed/1BvyA6pXm4w'
    );

    const resId5 = uuidv4();
    db.prepare(`
      INSERT INTO lesson_resources (id, lesson_id, title, file_path, file_type, file_size_bytes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      resId5,
      lesId6,
      'Bank Written English Model Essays & Translation Handout (PDF)',
      'uploads/pdfs/bank_written_english_handout.pdf',
      'PDF',
      9026
    );
  }

  console.log('Database seeded with live model test, verified users, syllabus questions, and full course hierarchy.');
}

export const DEMO_ACTIVE_EXAM_ID = 'e0000000-0000-4000-8000-000000000001';
export const DEMO_CORRECTED_EXAM_ID = 'e0000000-0000-4000-8000-000000000002';
export const DEMO_NON_MCQ_EXAM_ID = 'e0000000-0000-4000-8000-000000000003';
export const DEMO_NON_MCQ_Q1_ID = 'q0000000-0000-4000-8000-000000000001';
export const DEMO_NON_MCQ_Q2_ID = 'q0000000-0000-4000-8000-000000000002';

export function ensureActiveDemoExam() {
  const now = new Date();
  // Valid active window: started 1 hour ago, ending 30 days in the future
  const startsAt = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const endsAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  // Find instructor user or create/use fallback
  const instructor: any = db.prepare('SELECT id FROM users WHERE role = ? LIMIT 1').get('INSTRUCTOR');
  const instructorId = instructor ? instructor.id : null;

  // 1. Maintain historical/previous demo exam active window without modifying its existing questions or attempts
  const existingOld: any = db.prepare('SELECT id, ends_at FROM exams WHERE id = ?').get(DEMO_ACTIVE_EXAM_ID);
  if (existingOld) {
    if (new Date(existingOld.ends_at) <= now) {
      db.prepare(`UPDATE exams SET starts_at = ?, ends_at = ?, status = 'LIVE' WHERE id = ?`)
        .run(startsAt, endsAt, DEMO_ACTIVE_EXAM_ID);
    }
  }

  // 2. Ensure Corrected Demo Exam with a new unique ID (e0000000-0000-4000-8000-000000000002)
  // This preserves existing attempt/question relationships and historical results completely
  const existingCorrected: any = db.prepare('SELECT id, starts_at, ends_at FROM exams WHERE id = ?').get(DEMO_CORRECTED_EXAM_ID);

  // Ensure ACID explanation clarity is synchronized for the existing demo question without changing IDs or keys
  const clarifiedExplanation = 'ACID stands for Atomicity, Consistency, Isolation, and Durability. Among the four provided options, Atomicity (A), Consistency (B), and Durability (D) are correct ACID properties. Distribution (C) is a distributed systems concept and is NOT an ACID property.';
  const clarifiedExplanationBangla = 'ACID বলতে Atomicity, Consistency, Isolation এবং Durability-কে বোঝায়। প্রদত্ত চারটি বিকল্পের মধ্যে Atomicity (A), Consistency (B) এবং Durability (D) হলো সঠিক বৈশিষ্ট্য। Distribution (C) মূলত ডিস্ট্রিবিউটেড সিস্টেমের ধারণা এবং এটি ACID-এর অন্তর্ভুক্ত নয়।';
  db.prepare(`
    UPDATE questions
    SET explanation = ?, explanation_bangla = ?
    WHERE prompt LIKE '%Which of the following are ACID properties in database transaction management?%'
  `).run(clarifiedExplanation, clarifiedExplanationBangla);

  if (existingCorrected) {
    if (new Date(existingCorrected.ends_at) <= now) {
      db.prepare(`
        UPDATE exams SET starts_at = ?, ends_at = ?, status = 'LIVE'
        WHERE id = ?
      `).run(startsAt, endsAt, DEMO_CORRECTED_EXAM_ID);
    }
  } else {
    // Insert deterministic corrected active demo exam
    db.prepare(`
      INSERT INTO exams (
        id, title, title_bangla, description, category, type, status,
        duration_minutes, total_marks, pass_marks, negative_marking_rate,
        allowed_attempts, starts_at, ends_at, integrity_enabled, max_violations_allowed, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      DEMO_CORRECTED_EXAM_ID,
      'Bangladesh Bank Officer (General) Mock Test - Active Demo',
      'বাংলাদেশ ব্যাংক অফিসার (সাধারণ) মডেল টেস্ট - অ্যাক্টিভ ডেমো',
      'Interactive timed model test for bank recruitment preparation with live proctoring deterrence and server-authoritative timer.',
      'BANK_RECRUITMENT',
      'MODEL_TEST',
      'LIVE',
      10,
      5.0,
      2.5,
      0.25,
      5,
      startsAt,
      endsAt,
      1,
      3,
      instructorId
    );

    // Link verified questions that each have valid options and correct answers
    const verifiedQuestions: any[] = db.prepare(`
      SELECT q.id
      FROM questions q
      WHERE EXISTS (
        SELECT 1 FROM question_options qo
        WHERE qo.question_id = q.id AND qo.is_correct = 1
      )
      GROUP BY q.prompt
      ORDER BY q.created_at ASC
      LIMIT 5
    `).all();

    verifiedQuestions.forEach((q, idx) => {
      db.prepare(`
        INSERT OR IGNORE INTO exam_questions (id, exam_id, question_id, section_name, marks, negative_marks, order_index)
        VALUES (?, ?, ?, ?, 1.0, 0.25, ?)
      `).run(uuidv4(), DEMO_CORRECTED_EXAM_ID, q.id, 'General Aptitude', idx + 1);
    });
  }

  // 3. Ensure Non-MCQ Browser Testing Demo Exam (ID: e0000000-0000-4000-8000-000000000003)
  // Question 1: NUMERIC (What is the simple interest on 10,000 BDT at 8% per annum for 3 years?) -> 2400
  // Question 2: FILL_BLANK (The central bank of Bangladesh is named ______ Bank.) -> Bangladesh
  const existingNonMcqExam: any = db.prepare('SELECT id, starts_at, ends_at FROM exams WHERE id = ?').get(DEMO_NON_MCQ_EXAM_ID);

  if (existingNonMcqExam) {
    if (new Date(existingNonMcqExam.ends_at) <= now) {
      db.prepare(`
        UPDATE exams SET starts_at = ?, ends_at = ?, status = 'LIVE'
        WHERE id = ?
      `).run(startsAt, endsAt, DEMO_NON_MCQ_EXAM_ID);
    }
  } else {
    // 1. Ensure Question 1 (NUMERIC)
    db.prepare(`
      INSERT OR IGNORE INTO questions (
        id, subject, chapter, topic, difficulty, type,
        prompt, prompt_bangla, explanation, explanation_bangla,
        default_marks, default_negative_marks,
        correct_numeric, numeric_tolerance, correct_text,
        is_approved, author_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      DEMO_NON_MCQ_Q1_ID,
      'Quantitative Aptitude & Mathematics',
      'Commercial Arithmetic',
      'Simple Interest',
      'MEDIUM',
      'NUMERIC',
      'What is the simple interest on 10,000 BDT at 8% per annum for 3 years?',
      '১০,০০০ টাকার ওপর বার্ষিক ৮% হারে ৩ বছরের সরল সুদ কত টাকা?',
      'Simple Interest = (Principal × Rate × Time) / 100 = (10000 × 8 × 3) / 100 = 2400 BDT.',
      'সরল সুদ = (মূলধন × সুদের হার × সময়) / ১০০ = (১০০০০ × ৮ × ৩) / ১০০ = ২৪০০ টাকা।',
      1.0,
      0.25,
      2400,
      0.0,
      null,
      1,
      instructorId
    );

    // 2. Ensure Question 2 (FILL_BLANK)
    db.prepare(`
      INSERT OR IGNORE INTO questions (
        id, subject, chapter, topic, difficulty, type,
        prompt, prompt_bangla, explanation, explanation_bangla,
        default_marks, default_negative_marks,
        correct_numeric, numeric_tolerance, correct_text,
        is_approved, author_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      DEMO_NON_MCQ_Q2_ID,
      'General Knowledge & Banking Affairs',
      'Central Banking',
      'Bangladesh Bank History',
      'EASY',
      'FILL_BLANK',
      'The central bank of Bangladesh is named ______ Bank.',
      'বাংলাদেশের কেন্দ্রীয় ব্যাংকের নাম হলো ______ ব্যাংক।',
      'Bangladesh Bank is the central bank of Bangladesh.',
      'বাংলাদেশ ব্যাংক হলো বাংলাদেশের কেন্দ্রীয় ব্যাংক।',
      1.0,
      0.25,
      null,
      0.0,
      'Bangladesh',
      1,
      instructorId
    );

    // 3. Create Demo Exam
    db.prepare(`
      INSERT INTO exams (
        id, title, title_bangla, description, category, type, status,
        duration_minutes, total_marks, pass_marks, negative_marking_rate,
        allowed_attempts, starts_at, ends_at, integrity_enabled, max_violations_allowed, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      DEMO_NON_MCQ_EXAM_ID,
      'Bangladesh Bank Math & Aptitude Test - Non-MCQ Demo',
      'বাংলাদেশ ব্যাংক গণিত ও সাধারণ জ্ঞান পরীক্ষা - নন-এমসিকিউ ডেমো',
      'Dedicated interactive demo exam for numeric precision and fill-in-the-blank text answer grading with negative marking.',
      'BANK_RECRUITMENT',
      'MODEL_TEST',
      'LIVE',
      5,
      2.0,
      1.0,
      0.25,
      10,
      startsAt,
      endsAt,
      1,
      3,
      instructorId
    );

    // 4. Attach Question 1 and Question 2 in specific order
    db.prepare(`
      INSERT OR IGNORE INTO exam_questions (id, exam_id, question_id, section_name, marks, negative_marks, order_index)
      VALUES (?, ?, ?, 'Mathematics', 1.0, 0.25, 1)
    `).run(uuidv4(), DEMO_NON_MCQ_EXAM_ID, DEMO_NON_MCQ_Q1_ID);

    db.prepare(`
      INSERT OR IGNORE INTO exam_questions (id, exam_id, question_id, section_name, marks, negative_marks, order_index)
      VALUES (?, ?, ?, 'General Banking', 1.0, 0.25, 2)
    `).run(uuidv4(), DEMO_NON_MCQ_EXAM_ID, DEMO_NON_MCQ_Q2_ID);
  }

  return DEMO_ACTIVE_EXAM_ID;
}
