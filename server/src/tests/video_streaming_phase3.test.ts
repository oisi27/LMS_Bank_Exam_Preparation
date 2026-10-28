import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import http from 'http';
import express from 'express';
import { db, initDatabase } from '../db/schema';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { v4 as uuidv4 } from 'uuid';
import { coursesRouter, normalizeYouTubeUrl } from '../routes/courses';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(express.json());
app.use('/api/courses', coursesRouter);

let server: http.Server;
let serverPort: number;

function makeRequest(
  method: string,
  urlPath: string,
  headers: Record<string, string> = {},
  body?: any
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any; text: string; rawBuffer: Buffer }> {
  return new Promise((resolve, reject) => {
    const isBuffer = Buffer.isBuffer(body);
    const postData = isBuffer ? body : (body ? JSON.stringify(body) : null);

    const reqHeaders: Record<string, string | number> = { ...headers };
    if (postData && !reqHeaders['Content-Type'] && !reqHeaders['content-type']) {
      reqHeaders['Content-Type'] = 'application/json';
    }
    if (postData) {
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: serverPort,
        path: urlPath,
        method,
        headers: reqHeaders
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const text = buffer.toString('utf8');
          let parsed: any = null;
          try {
            parsed = JSON.parse(text);
          } catch {
            parsed = text;
          }
          resolve({ status: res.statusCode || 0, headers: res.headers, body: parsed, text, rawBuffer: buffer });
        });
      }
    );

    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

function buildMultipartBody(fields: Record<string, string>, file: { fieldname: string; filename: string; contentType: string; content: Buffer }) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).slice(2);
  const parts: Buffer[] = [];

  for (const [key, val] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`));
  }

  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${file.fieldname}"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`
  ));
  parts.push(file.content);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

  return {
    contentType: `multipart/form-data; boundary=${boundary}`,
    body: Buffer.concat(parts)
  };
}

describe('Phase 3: Video Upload, Normalization & HTTP Range Streaming Tests', () => {
  let instructorId: string;
  let otherInstructorId: string;
  let studentId: string;
  let instructorToken: string;
  let otherInstructorToken: string;
  let studentToken: string;

  let courseId: string;
  let publishedCourseId: string;
  let moduleId: string;
  let publishedModuleId: string;
  let lessonId: string;
  let publishedLessonId: string;

  const uploadedFilesToClean: string[] = [];

  beforeEach(async () => {
    initDatabase();

    if (!server) {
      await new Promise<void>((resolve) => {
        server = app.listen(0, '127.0.0.1', () => {
          const addr = server.address() as any;
          serverPort = addr.port;
          resolve();
        });
      });
    }

    const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    instructorId = uuidv4();
    otherInstructorId = uuidv4();
    studentId = uuidv4();

    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role)
      VALUES (?, 'Instructor Video Lead', ?, 'hash', 'INSTRUCTOR')
    `).run(instructorId, `inst_vid_${unique}@banklms.edu.bd`);

    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role)
      VALUES (?, 'Other Instructor', ?, 'hash', 'INSTRUCTOR')
    `).run(otherInstructorId, `other_inst_${unique}@banklms.edu.bd`);

    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role)
      VALUES (?, 'Student Candidate', ?, 'hash', 'STUDENT')
    `).run(studentId, `student_vid_${unique}@banklms.edu.bd`);

    const secret = config.JWT_SECRET || 'bank_lms_secure_signed_links_secret_2026';
    instructorToken = jwt.sign({ id: instructorId, role: 'INSTRUCTOR', email: 'inst@test.bd' }, secret);
    otherInstructorToken = jwt.sign({ id: otherInstructorId, role: 'INSTRUCTOR', email: 'other@test.bd' }, secret);
    studentToken = jwt.sign({ id: studentId, role: 'STUDENT', email: 'stud@test.bd' }, secret);

    const catId = uuidv4();
    db.prepare(`
      INSERT INTO categories (id, name, slug)
      VALUES (?, ?, ?)
    `).run(catId, `Bank Video Category ${unique}`, `cat-vid-${unique}`);

    courseId = uuidv4();
    db.prepare(`
      INSERT INTO courses (id, category_id, title, slug, status, instructor_id)
      VALUES (?, ?, 'Draft Video Course', ?, 'DRAFT', ?)
    `).run(courseId, catId, `draft-vid-${unique}`, instructorId);

    publishedCourseId = uuidv4();
    db.prepare(`
      INSERT INTO courses (id, category_id, title, slug, status, instructor_id)
      VALUES (?, ?, 'Published Video Course', ?, 'PUBLISHED', ?)
    `).run(publishedCourseId, catId, `published-vid-${unique}`, instructorId);

    moduleId = uuidv4();
    db.prepare(`
      INSERT INTO course_modules (id, course_id, title, sort_order)
      VALUES (?, ?, 'Draft Module 1', 1)
    `).run(moduleId, courseId);

    publishedModuleId = uuidv4();
    db.prepare(`
      INSERT INTO course_modules (id, course_id, title, sort_order)
      VALUES (?, ?, 'Published Module 1', 1)
    `).run(publishedModuleId, publishedCourseId);

    lessonId = uuidv4();
    db.prepare(`
      INSERT INTO lessons (id, module_id, title, sort_order)
      VALUES (?, ?, 'Draft Lesson 1', 1)
    `).run(lessonId, moduleId);

    publishedLessonId = uuidv4();
    db.prepare(`
      INSERT INTO lessons (id, module_id, title, sort_order)
      VALUES (?, ?, 'Published Lesson 1', 1)
    `).run(publishedLessonId, publishedModuleId);
  });

  afterAll(() => {
    if (server) {
      server.close();
    }
    for (const f of uploadedFilesToClean) {
      if (fs.existsSync(f)) {
        try { fs.unlinkSync(f); } catch {}
      }
    }
  });

  // 1. YouTube URL Normalization Tests
  it('should correctly normalize YouTube URLs across watch, youtu.be, shorts, and embed formats', () => {
    expect(normalizeYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
    expect(normalizeYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
    expect(normalizeYouTubeUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
    expect(normalizeYouTubeUrl('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
    expect(normalizeYouTubeUrl('https://example.com/not-a-video')).toBeNull();
  });

  // 2. Normalize YouTube link when saving lesson via API
  it('should automatically convert YouTube URLs to embed URLs when instructor creates or updates a lesson', async () => {
    const createRes = await makeRequest(
      'POST',
      `/api/courses/modules/${moduleId}/lessons`,
      { Authorization: `Bearer ${instructorToken}` },
      {
        title: 'Analytical Math Tricks',
        videoUrl: 'https://www.youtube.com/watch?v=fW77nI2B-c0',
        durationMinutes: 25,
        isFreePreview: true,
        sortOrder: 2
      }
    );

    expect(createRes.status).toBe(201);
    const newLessonId = createRes.body.id;

    const savedLesson: any = db.prepare('SELECT video_url FROM lessons WHERE id = ?').get(newLessonId);
    expect(savedLesson.video_url).toBe('https://www.youtube.com/embed/fW77nI2B-c0');

    // Update with youtu.be short format
    const updateRes = await makeRequest(
      'PUT',
      `/api/courses/lessons/${newLessonId}`,
      { Authorization: `Bearer ${instructorToken}` },
      { videoUrl: 'https://youtu.be/LwCRRUa8yTU' }
    );

    expect(updateRes.status).toBe(200);
    const updatedLesson: any = db.prepare('SELECT video_url FROM lessons WHERE id = ?').get(newLessonId);
    expect(updatedLesson.video_url).toBe('https://www.youtube.com/embed/LwCRRUa8yTU');

    // Regression Test: Update lesson with numeric isFreePreview: 1 (SQLite format reproduction)
    const updateNumericRes = await makeRequest(
      'PUT',
      `/api/courses/lessons/${newLessonId}`,
      { Authorization: `Bearer ${instructorToken}` },
      {
        title: 'Analytical Math Tricks – Updated',
        durationMinutes: 30,
        isFreePreview: 1
      }
    );
    expect(updateNumericRes.status).toBe(200);
    const updatedLessonNumeric: any = db.prepare('SELECT title, duration_minutes, is_free_preview FROM lessons WHERE id = ?').get(newLessonId);
    expect(updatedLessonNumeric.title).toBe('Analytical Math Tricks – Updated');
    expect(updatedLessonNumeric.duration_minutes).toBe(30);
    expect(updatedLessonNumeric.is_free_preview).toBe(1);

    // Regression Test: Update lesson with boolean isFreePreview: false
    const updateBoolRes = await makeRequest(
      'PUT',
      `/api/courses/lessons/${newLessonId}`,
      { Authorization: `Bearer ${instructorToken}` },
      {
        title: 'Analytical Math Tricks – Final',
        durationMinutes: 20,
        isFreePreview: false
      }
    );
    expect(updateBoolRes.status).toBe(200);
    const updatedLessonBool: any = db.prepare('SELECT title, duration_minutes, is_free_preview FROM lessons WHERE id = ?').get(newLessonId);
    expect(updatedLessonBool.title).toBe('Analytical Math Tricks – Final');
    expect(updatedLessonBool.duration_minutes).toBe(20);
    expect(updatedLessonBool.is_free_preview).toBe(0);
  });

  // 3. MP4 Upload Validation & File Type Mapping
  it('should accept MP4 video uploads and classify them with file_type VIDEO', async () => {
    const videoDummyContent = Buffer.from('ftypmp42isommp42mockvideostreamingheader2026');
    const multipart = buildMultipartBody(
      { title: 'Divisibility Shortcut Video' },
      {
        fieldname: 'file',
        filename: 'divisibility_tricks.mp4',
        contentType: 'video/mp4',
        content: videoDummyContent
      }
    );

    const uploadRes = await makeRequest(
      'POST',
      `/api/courses/lessons/${publishedLessonId}/resources/upload`,
      {
        Authorization: `Bearer ${instructorToken}`,
        'Content-Type': multipart.contentType
      },
      multipart.body
    );

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.resource.fileType).toBe('VIDEO');
    const resourceId = uploadRes.body.resource.id;

    const resourceDb: any = db.prepare('SELECT * FROM lesson_resources WHERE id = ?').get(resourceId);
    expect(resourceDb).toBeDefined();
    expect(resourceDb.file_type).toBe('VIDEO');
    expect(fs.existsSync(resourceDb.file_path)).toBe(true);
    uploadedFilesToClean.push(resourceDb.file_path);
  });

  // 4. Instructor-Only Upload Authorization
  it('should forbid unauthorized users (STUDENT and other instructors) from uploading to course lessons', async () => {
    const dummyContent = Buffer.from('test mp4 content');
    const multipart = buildMultipartBody(
      { title: 'Unauthorized Video' },
      {
        fieldname: 'file',
        filename: 'hack.mp4',
        contentType: 'video/mp4',
        content: dummyContent
      }
    );

    // Student attempt
    const studentAttempt = await makeRequest(
      'POST',
      `/api/courses/lessons/${publishedLessonId}/resources/upload`,
      {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': multipart.contentType
      },
      multipart.body
    );
    expect(studentAttempt.status).toBe(403);

    // Other Instructor attempt on course they do not own
    const otherInstAttempt = await makeRequest(
      'POST',
      `/api/courses/lessons/${publishedLessonId}/resources/upload`,
      {
        Authorization: `Bearer ${otherInstructorToken}`,
        'Content-Type': multipart.contentType
      },
      multipart.body
    );
    expect(otherInstAttempt.status).toBe(403);
  });

  // 5. Student Access to Authorized Videos and Unpublished Course Rejection
  it('should allow student to obtain signed link for published video, but reject draft course resource', async () => {
    // 1. Create resource in published course
    const pubResourceFile = path.resolve(__dirname, '../../uploads/resources/pub_test.mp4');
    fs.writeFileSync(pubResourceFile, 'video sample data for published course');
    uploadedFilesToClean.push(pubResourceFile);

    const pubResId = uuidv4();
    db.prepare(`
      INSERT INTO lesson_resources (id, lesson_id, title, file_path, file_type, file_size_bytes)
      VALUES (?, ?, 'Published Video', ?, 'VIDEO', 34)
    `).run(pubResId, publishedLessonId, pubResourceFile);

    const pubLinkRes = await makeRequest(
      'GET',
      `/api/courses/resources/${pubResId}/signed-link`,
      { Authorization: `Bearer ${studentToken}` }
    );
    expect(pubLinkRes.status).toBe(200);
    expect(pubLinkRes.body.signedUrl).toContain('token=');
    expect(pubLinkRes.body.fileType).toBe('VIDEO');

    // 2. Create resource in draft course
    const draftResourceFile = path.resolve(__dirname, '../../uploads/resources/draft_test.mp4');
    fs.writeFileSync(draftResourceFile, 'video sample data for draft course');
    uploadedFilesToClean.push(draftResourceFile);

    const draftResId = uuidv4();
    db.prepare(`
      INSERT INTO lesson_resources (id, lesson_id, title, file_path, file_type, file_size_bytes)
      VALUES (?, ?, 'Draft Video', ?, 'VIDEO', 30)
    `).run(draftResId, lessonId, draftResourceFile);

    // Student should be rejected (403) from accessing draft course resource
    const draftLinkRes = await makeRequest(
      'GET',
      `/api/courses/resources/${draftResId}/signed-link`,
      { Authorization: `Bearer ${studentToken}` }
    );
    expect(draftLinkRes.status).toBe(403);
    expect(draftLinkRes.body.error).toContain('unpublished course');
  });

  // 6. HTTP Range Playback Support (206 Partial Content)
  it('should stream video with HTTP 206 Partial Content when Range header is provided', async () => {
    const videoData = Buffer.from('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz');
    const testVideoPath = path.resolve(__dirname, '../../uploads/resources/range_test.mp4');
    fs.writeFileSync(testVideoPath, videoData);
    uploadedFilesToClean.push(testVideoPath);

    const resId = uuidv4();
    db.prepare(`
      INSERT INTO lesson_resources (id, lesson_id, title, file_path, file_type, file_size_bytes)
      VALUES (?, ?, 'Range Video', ?, 'VIDEO', ?)
    `).run(resId, publishedLessonId, testVideoPath, videoData.length);

    // Get signed link
    const linkRes = await makeRequest(
      'GET',
      `/api/courses/resources/${resId}/signed-link`,
      { Authorization: `Bearer ${studentToken}` }
    );
    const token = new URL(linkRes.body.signedUrl).searchParams.get('token')!;

    // Request byte range: bytes=0-9 (first 10 bytes)
    const rangeRes = await makeRequest(
      'GET',
      `/api/courses/resources/download?token=${token}`,
      { Range: 'bytes=0-9' }
    );

    expect(rangeRes.status).toBe(206);
    expect(rangeRes.headers['content-range']).toBe(`bytes 0-9/${videoData.length}`);
    expect(rangeRes.headers['accept-ranges']).toBe('bytes');
    expect(rangeRes.headers['content-type']).toBe('video/mp4');
    expect(rangeRes.text).toBe('0123456789');

    // Request middle byte range: bytes=10-19
    const midRangeRes = await makeRequest(
      'GET',
      `/api/courses/resources/download?token=${token}`,
      { Range: 'bytes=10-19' }
    );

    expect(midRangeRes.status).toBe(206);
    expect(midRangeRes.headers['content-range']).toBe(`bytes 10-19/${videoData.length}`);
    expect(midRangeRes.text).toBe('ABCDEFGHIJ');
  });

  // 7. Expired Signed Resource Access Rejection
  it('should reject expired signed links with HTTP 403', async () => {
    const secret = config.JWT_SECRET || 'bank_lms_secure_signed_links_secret_2026';
    const expiredToken = jwt.sign(
      { resourceId: 'mock-res', userId: studentId, filePath: 'nonexistent.mp4' },
      secret,
      { expiresIn: '-5s' }
    );

    const expiredRes = await makeRequest('GET', `/api/courses/resources/download?token=${expiredToken}`);
    expect(expiredRes.status).toBe(403);
    expect(expiredRes.body.error).toContain('expired or is invalid');
  });

  // 8. Existing PDF & Notes Download Continues Working
  it('should continue streaming existing PDF files without regression', async () => {
    const pdfData = Buffer.from('%PDF-1.4 Mock Bank Lecture Handout 2026');
    const testPdfPath = path.resolve(__dirname, '../../uploads/resources/test_handout.pdf');
    fs.writeFileSync(testPdfPath, pdfData);
    uploadedFilesToClean.push(testPdfPath);

    const resId = uuidv4();
    db.prepare(`
      INSERT INTO lesson_resources (id, lesson_id, title, file_path, file_type, file_size_bytes)
      VALUES (?, ?, 'Lecture PDF Handout', ?, 'PDF', ?)
    `).run(resId, publishedLessonId, testPdfPath, pdfData.length);

    const linkRes = await makeRequest(
      'GET',
      `/api/courses/resources/${resId}/signed-link`,
      { Authorization: `Bearer ${studentToken}` }
    );
    const token = new URL(linkRes.body.signedUrl).searchParams.get('token')!;

    const downloadRes = await makeRequest('GET', `/api/courses/resources/download?token=${token}`);
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers['content-type']).toContain('application/pdf');
    expect(downloadRes.text).toContain('Mock Bank Lecture Handout');
  });

  // 9. Existing Lesson Progress Behavior Continues Working
  it('should preserve lesson completion toggle and progress percentage calculation', async () => {
    // Student marks published lesson as complete
    const completeRes = await makeRequest(
      'POST',
      `/api/courses/lessons/${publishedLessonId}/complete`,
      { Authorization: `Bearer ${studentToken}` }
    );
    expect(completeRes.status).toBe(201);
    expect(completeRes.body.completed).toBe(true);

    // Verify progress tracking endpoint
    const progressRes = await makeRequest(
      'GET',
      `/api/courses/${publishedCourseId}/progress`,
      { Authorization: `Bearer ${studentToken}` }
    );
    expect(progressRes.status).toBe(200);
    expect(progressRes.body.completedLessonIds).toContain(publishedLessonId);
    expect(progressRes.body.progressPercentage).toBe(100);

    // Undo completion
    const undoRes = await makeRequest(
      'DELETE',
      `/api/courses/lessons/${publishedLessonId}/complete`,
      { Authorization: `Bearer ${studentToken}` }
    );
    expect(undoRes.status).toBe(200);
    expect(undoRes.body.completed).toBe(false);
  });
});
