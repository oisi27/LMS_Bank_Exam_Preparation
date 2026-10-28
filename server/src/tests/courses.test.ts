import { describe, it, expect, beforeEach } from 'vitest';
import { db, initDatabase } from '../db/schema';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { v4 as uuidv4 } from 'uuid';

describe('Phase 6 Courses CMS & Learning Hierarchy Tests', () => {
  let categoryId: string;
  let instructorId: string;
  let studentId: string;
  let publishedCourseId: string;
  let draftCourseId: string;

  beforeEach(() => {
    initDatabase();
    categoryId = uuidv4();
    instructorId = uuidv4();
    studentId = uuidv4();
    publishedCourseId = uuidv4();
    draftCourseId = uuidv4();

    // 1. Create Instructor & Student
    const userSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (?, ?, 'hash', 'Course Instructor', 'INSTRUCTOR')
    `).run(instructorId, `inst_${userSuffix}@banklms.ac.bd`);

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (?, ?, 'hash', 'Student Candidate', 'STUDENT')
    `).run(studentId, `student_${userSuffix}@banklms.ac.bd`);

    // 2. Create Category
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    db.prepare(`
      INSERT INTO categories (id, name, name_bangla, slug, sort_order)
      VALUES (?, 'Combined Banks Syllabus', 'সম্মিলিত ব্যাংক নিয়োগ', ?, 1)
    `).run(categoryId, `combined-banks-${uniqueSuffix}`);

    // 3. Create Published and Draft Courses
    db.prepare(`
      INSERT INTO courses (id, category_id, title, title_bangla, slug, instructor_id, status)
      VALUES (?, ?, 'Complete Math Preparation', 'গণিত প্রস্তুতি', ?, ?, 'PUBLISHED')
    `).run(publishedCourseId, categoryId, `math-prep-${uniqueSuffix}`, instructorId);

    db.prepare(`
      INSERT INTO courses (id, category_id, title, title_bangla, slug, instructor_id, status)
      VALUES (?, ?, 'Upcoming English Masterclass', 'ইংরেজি মাস্টারক্লাস', ?, ?, 'DRAFT')
    `).run(draftCourseId, categoryId, `english-master-${uniqueSuffix}`, instructorId);
  });

  it('should enforce that students only see PUBLISHED courses while instructors see their DRAFTS', () => {
    // Student query
    const studentCourses = db.prepare(`SELECT * FROM courses WHERE status = 'PUBLISHED'`).all();
    const publishedIds = studentCourses.map((c: any) => c.id);

    expect(publishedIds).toContain(publishedCourseId);
    expect(publishedIds).not.toContain(draftCourseId);

    // Instructor query (published + own drafts)
    const instructorCourses = db.prepare(`
      SELECT * FROM courses WHERE status = 'PUBLISHED' OR instructor_id = ?
    `).all(instructorId);
    const instructorCourseIds = instructorCourses.map((c: any) => c.id);

    expect(instructorCourseIds).toContain(publishedCourseId);
    expect(instructorCourseIds).toContain(draftCourseId);
  });

  it('should structure Course -> Module -> Lesson -> Resource hierarchy cleanly', () => {
    const moduleId = uuidv4();
    const lessonId = uuidv4();
    const resourceId = uuidv4();

    // Create Module
    db.prepare(`
      INSERT INTO course_modules (id, course_id, title, sort_order)
      VALUES (?, ?, 'Module 1: Arithmetic Basics', 1)
    `).run(moduleId, publishedCourseId);

    // Create Lesson
    db.prepare(`
      INSERT INTO lessons (id, module_id, title, duration_minutes, is_free_preview, sort_order)
      VALUES (?, ?, 'Lesson 1.1: Percentage & Profit Loss', 25, 1, 1)
    `).run(lessonId, moduleId);

    // Attach Resource
    db.prepare(`
      INSERT INTO lesson_resources (id, lesson_id, title, file_path, file_type, file_size_bytes)
      VALUES (?, ?, 'Formula Sheet Handout', '/uploads/math_formulas.pdf', 'PDF', 1048576)
    `).run(resourceId, lessonId);

    // Verify relations
    const modules: any = db.prepare('SELECT * FROM course_modules WHERE course_id = ?').all(publishedCourseId);
    expect(modules.length).toBe(1);

    const lessons: any = db.prepare('SELECT * FROM lessons WHERE module_id = ?').all(moduleId);
    expect(lessons.length).toBe(1);
    expect(lessons[0].title).toBe('Lesson 1.1: Percentage & Profit Loss');

    const resources: any = db.prepare('SELECT * FROM lesson_resources WHERE lesson_id = ?').all(lessonId);
    expect(resources.length).toBe(1);
    expect(resources[0].file_type).toBe('PDF');
  });

  it('should generate secure signed link and reject when token expires', () => {
    const secret = config.JWT_SECRET || 'bank_lms_secure_signed_links_secret_2026';
    const resourceId = uuidv4();

    // Valid short-lived token
    const validToken = jwt.sign(
      { resourceId, userId: studentId, type: 'SECURE_ATTACHMENT' },
      secret,
      { expiresIn: '15m' }
    );
    const decodedValid: any = jwt.verify(validToken, secret);
    expect(decodedValid.resourceId).toBe(resourceId);

    // Expired token (expires in 0s)
    const expiredToken = jwt.sign(
      { resourceId, userId: studentId, type: 'SECURE_ATTACHMENT' },
      secret,
      { expiresIn: '-1s' }
    );

    expect(() => jwt.verify(expiredToken, secret)).toThrow();
  });

  it('should cascade delete modules, lessons, and resources when a course is removed', () => {
    const moduleId = uuidv4();
    const lessonId = uuidv4();
    const resourceId = uuidv4();

    db.prepare(`INSERT INTO course_modules (id, course_id, title) VALUES (?, ?, 'Module')`).run(moduleId, draftCourseId);
    db.prepare(`INSERT INTO lessons (id, module_id, title) VALUES (?, ?, 'Lesson')`).run(lessonId, moduleId);
    db.prepare(`INSERT INTO lesson_resources (id, lesson_id, title, file_path, file_type) VALUES (?, ?, 'Res', 'path', 'PDF')`).run(resourceId, lessonId);

    // Confirm exists
    expect(db.prepare('SELECT id FROM course_modules WHERE id = ?').get(moduleId)).toBeDefined();

    // Delete course
    db.prepare('DELETE FROM courses WHERE id = ?').run(draftCourseId);

    // Verify cascade
    expect(db.prepare('SELECT id FROM course_modules WHERE id = ?').get(moduleId)).toBeUndefined();
    expect(db.prepare('SELECT id FROM lessons WHERE id = ?').get(lessonId)).toBeUndefined();
    expect(db.prepare('SELECT id FROM lesson_resources WHERE id = ?').get(resourceId)).toBeUndefined();
  });
});
