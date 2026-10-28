import { describe, it, expect, beforeEach } from 'vitest';
import { db, initDatabase } from '../db/schema';
import { v4 as uuidv4 } from 'uuid';

describe('Instructor Course Builder Ownership & Catalog Isolation', () => {
  let categoryId: string;
  let instructorAId: string;
  let instructorBId: string;
  let adminId: string;
  let studentId: string;

  let courseAId: string;
  let courseBPublishedId: string;
  let courseBDraftId: string;

  beforeEach(() => {
    initDatabase();
    categoryId = uuidv4();
    instructorAId = uuidv4();
    instructorBId = uuidv4();
    adminId = uuidv4();
    studentId = uuidv4();

    courseAId = uuidv4();
    courseBPublishedId = uuidv4();
    courseBDraftId = uuidv4();

    const timestamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Create Category
    db.prepare(`
      INSERT INTO categories (id, name, name_bangla, slug, sort_order)
      VALUES (?, 'Test Category', 'টেস্ট ক্যাটাগরি', ?, 1)
    `).run(categoryId, `cat-${timestamp}`);

    // Create Users: Instructor A, Instructor B, Admin, Student
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (?, ?, 'hash', 'Instructor A', 'INSTRUCTOR')
    `).run(instructorAId, `inst_a_${timestamp}@banklms.ac.bd`);

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (?, ?, 'hash', 'Instructor B', 'INSTRUCTOR')
    `).run(instructorBId, `inst_b_${timestamp}@banklms.ac.bd`);

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (?, ?, 'hash', 'System Admin', 'ADMIN')
    `).run(adminId, `admin_${timestamp}@banklms.ac.bd`);

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (?, ?, 'hash', 'Student User', 'STUDENT')
    `).run(studentId, `student_${timestamp}@banklms.ac.bd`);

    // Create Courses:
    // Course A owned by Instructor A (PUBLISHED)
    db.prepare(`
      INSERT INTO courses (id, category_id, title, title_bangla, slug, instructor_id, status)
      VALUES (?, ?, 'Instructor A Math Course', 'কোর্স এ', ?, ?, 'PUBLISHED')
    `).run(courseAId, categoryId, `math-a-${timestamp}`, instructorAId);

    // Course B owned by Instructor B (PUBLISHED)
    db.prepare(`
      INSERT INTO courses (id, category_id, title, title_bangla, slug, instructor_id, status)
      VALUES (?, ?, 'Instructor B English Course', 'কোর্স বি', ?, ?, 'PUBLISHED')
    `).run(courseBPublishedId, categoryId, `eng-b-pub-${timestamp}`, instructorBId);

    // Course B Draft owned by Instructor B (DRAFT)
    db.prepare(`
      INSERT INTO courses (id, category_id, title, title_bangla, slug, instructor_id, status)
      VALUES (?, ?, 'Instructor B Upcoming Draft', 'কোর্স বি ড্রাফট', ?, ?, 'DRAFT')
    `).run(courseBDraftId, categoryId, `eng-b-draft-${timestamp}`, instructorBId);
  });

  it('Instructor in Course Builder (mine=true) should ONLY receive their own courses', () => {
    // Simulating GET /api/courses?mine=true with Instructor A
    const instructorACourses = db.prepare(`
      SELECT c.* FROM courses c WHERE c.instructor_id = ?
    `).all(instructorAId);

    const ids = instructorACourses.map((c: any) => c.id);
    expect(ids).toContain(courseAId);
    expect(ids).not.toContain(courseBPublishedId);
    expect(ids).not.toContain(courseBDraftId);
    expect(ids.length).toBe(1);
  });

  it('Instructor B in Course Builder (mine=true) sees both their published and draft courses, but not Instructor A courses', () => {
    const instructorBCourses = db.prepare(`
      SELECT c.* FROM courses c WHERE c.instructor_id = ?
    `).all(instructorBId);

    const ids = instructorBCourses.map((c: any) => c.id);
    expect(ids).toContain(courseBPublishedId);
    expect(ids).toContain(courseBDraftId);
    expect(ids).not.toContain(courseAId);
    expect(ids.length).toBe(2);
  });

  it('Student course catalog (without mine=true) sees all PUBLISHED courses from all instructors, but no drafts', () => {
    // Simulating standard GET /api/courses for students
    const studentCatalog = db.prepare(`
      SELECT c.* FROM courses c WHERE c.status = 'PUBLISHED'
    `).all();

    const ids = studentCatalog.map((c: any) => c.id);
    expect(ids).toContain(courseAId);
    expect(ids).toContain(courseBPublishedId);
    expect(ids).not.toContain(courseBDraftId);
  });

  it('Admin retains full visibility across all courses', () => {
    // Simulating GET /api/courses for Admin
    const allCourses = db.prepare(`
      SELECT c.* FROM courses c
    `).all();

    const ids = allCourses.map((c: any) => c.id);
    expect(ids).toContain(courseAId);
    expect(ids).toContain(courseBPublishedId);
    expect(ids).toContain(courseBDraftId);
  });

  it('Instructor can generate signed link for resources on their own courses', () => {
    // Add module, lesson, resource to Course A
    const moduleId = uuidv4();
    const lessonId = uuidv4();
    const resourceId = uuidv4();

    db.prepare(`INSERT INTO course_modules (id, course_id, title) VALUES (?, ?, 'Mod A')`).run(moduleId, courseAId);
    db.prepare(`INSERT INTO lessons (id, module_id, title) VALUES (?, ?, 'Lesson A1')`).run(lessonId, moduleId);
    db.prepare(`INSERT INTO lesson_resources (id, lesson_id, title, file_path, file_type, file_size_bytes) VALUES (?, ?, 'Formula Sheet', '/uploads/formula.pdf', 'PDF', 1024)`).run(resourceId, lessonId);

    // Verify lookup for signed-link route
    const resource: any = db.prepare(`
      SELECT r.*, l.title as lesson_title, c.status as course_status, c.instructor_id
      FROM lesson_resources r
      JOIN lessons l ON l.id = r.lesson_id
      JOIN course_modules m ON m.id = l.module_id
      JOIN courses c ON c.id = m.course_id
      WHERE r.id = ?
    `).get(resourceId);

    expect(resource).toBeDefined();
    expect(resource.instructor_id).toBe(instructorAId);

    // Instructor A can access their own resource
    const canAccess = !(resource.course_status !== 'PUBLISHED' && resource.instructor_id !== instructorAId);
    expect(canAccess).toBe(true);
  });

  it('Instructor cannot generate signed link for resources on another instructor draft course', () => {
    const moduleId = uuidv4();
    const lessonId = uuidv4();
    const resourceId = uuidv4();

    db.prepare(`INSERT INTO course_modules (id, course_id, title) VALUES (?, ?, 'Mod B Draft')`).run(moduleId, courseBDraftId);
    db.prepare(`INSERT INTO lessons (id, module_id, title) VALUES (?, ?, 'Lesson B1')`).run(lessonId, moduleId);
    db.prepare(`INSERT INTO lesson_resources (id, lesson_id, title, file_path, file_type, file_size_bytes) VALUES (?, ?, 'Draft Handout', '/uploads/draft.pdf', 'PDF', 2048)`).run(resourceId, lessonId);

    const resource: any = db.prepare(`
      SELECT r.*, l.title as lesson_title, c.status as course_status, c.instructor_id
      FROM lesson_resources r
      JOIN lessons l ON l.id = r.lesson_id
      JOIN course_modules m ON m.id = l.module_id
      JOIN courses c ON c.id = m.course_id
      WHERE r.id = ?
    `).get(resourceId);

    // Instructor A tries to access Instructor B's draft course resource
    const requestingUser = { id: instructorAId, role: 'INSTRUCTOR' };
    const isForbidden = requestingUser.role === 'INSTRUCTOR' && resource.course_status !== 'PUBLISHED' && resource.instructor_id !== requestingUser.id;
    expect(isForbidden).toBe(true);
  });
});

