import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db, initDatabase } from '../db/schema';
import { questionsRouter } from '../routes/questions';
import { config } from '../config/env';

let app: express.Application;
let server: any;
let port: number;

function makeRequest(
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body?: any
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const url = `http://127.0.0.1:${port}${path}`;
    fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: body ? JSON.stringify(body) : undefined
    })
      .then(async (res) => {
        const text = await res.text();
        let parsed = {};
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = { raw: text };
        }
        resolve({ status: res.status, body: parsed });
      })
      .catch(reject);
  });
}

describe('Question Bank Pagination Automated Tests', () => {
  let adminId: string;
  let adminToken: string;

  beforeAll(async () => {
    initDatabase();

    adminId = uuidv4();
    const adminEmail = `admin_page_${Date.now()}@example.com`;
    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role)
      VALUES (?, 'Admin Pagination', ?, 'hash', 'ADMIN')
    `).run(adminId, adminEmail);

    adminToken = jwt.sign(
      { id: adminId, email: adminEmail, role: 'ADMIN' },
      config.JWT_SECRET
    );

    app = express();
    app.use(express.json());
    app.use('/api/questions', questionsRouter);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        port = (server.address() as any).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(resolve));
    }
  });

  // 1. First page
  it('1. should return first page with default pageSize 25', async () => {
    const res = await makeRequest('GET', '/api/questions?page=1&pageSize=25', {
      Authorization: `Bearer ${adminToken}`
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(25);
    expect(res.body.questions.length).toBe(25);
    expect(res.body.count).toBe(25);
    expect(res.body.totalItems).toBeGreaterThanOrEqual(1316);
    expect(res.body.totalPages).toBe(Math.ceil(res.body.totalItems / 25));
  });

  // 2. Middle page
  it('2. should return a middle page with distinct items', async () => {
    const resPage1 = await makeRequest('GET', '/api/questions?page=1&pageSize=25', {
      Authorization: `Bearer ${adminToken}`
    });
    const resPage2 = await makeRequest('GET', '/api/questions?page=2&pageSize=25', {
      Authorization: `Bearer ${adminToken}`
    });

    expect(resPage2.status).toBe(200);
    expect(resPage2.body.success).toBe(true);
    expect(resPage2.body.page).toBe(2);
    expect(resPage2.body.pageSize).toBe(25);
    expect(resPage2.body.questions.length).toBe(25);

    // Verify IDs on page 1 and page 2 do not overlap
    const page1Ids = new Set(resPage1.body.questions.map((q: any) => q.id));
    const page2Ids = resPage2.body.questions.map((q: any) => q.id);
    for (const id of page2Ids) {
      expect(page1Ids.has(id)).toBe(false);
    }
  });

  // 3. Last page
  it('3. should return last page correctly with remaining count', async () => {
    const resPage1 = await makeRequest('GET', '/api/questions?page=1&pageSize=50', {
      Authorization: `Bearer ${adminToken}`
    });
    const totalPages = resPage1.body.totalPages;
    const totalItems = resPage1.body.totalItems;

    const resLast = await makeRequest('GET', `/api/questions?page=${totalPages}&pageSize=50`, {
      Authorization: `Bearer ${adminToken}`
    });

    expect(resLast.status).toBe(200);
    expect(resLast.body.success).toBe(true);
    expect(resLast.body.page).toBe(totalPages);
    const expectedLastPageCount = totalItems % 50 === 0 ? 50 : totalItems % 50;
    expect(resLast.body.questions.length).toBe(expectedLastPageCount);
    expect(resLast.body.count).toBe(expectedLastPageCount);
  });

  // 4. Combined filters
  it('4. should handle combined filters with pagination', async () => {
    const res = await makeRequest(
      'GET',
      '/api/questions?subject=Quantitative+Aptitude+%26+Mathematics&difficulty=MEDIUM&page=1&pageSize=10',
      { Authorization: `Bearer ${adminToken}` }
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(10);
    expect(res.body.questions.length).toBeLessThanOrEqual(10);
    res.body.questions.forEach((q: any) => {
      expect(q.subject).toBe('Quantitative Aptitude & Mathematics');
      expect(q.difficulty).toBe('MEDIUM');
    });
  });

  // 5. Search
  it('5. should paginate search results properly', async () => {
    const res = await makeRequest(
      'GET',
      '/api/questions?search=interest&page=1&pageSize=5',
      { Authorization: `Bearer ${adminToken}` }
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(5);
    expect(res.body.totalItems).toBeGreaterThan(0);
  });

  // 6. Approved-only
  it('6. should filter and paginate approved-only questions', async () => {
    const dbApprovedCount = (db.prepare('SELECT COUNT(*) as c FROM questions WHERE is_approved = 1').get() as any).c;

    const res = await makeRequest('GET', '/api/questions?isApproved=true&page=1&pageSize=20', {
      Authorization: `Bearer ${adminToken}`
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.totalItems).toBe(dbApprovedCount);
    expect(res.body.questions.length).toBe(Math.min(20, dbApprovedCount));
    res.body.questions.forEach((q: any) => {
      expect(q.isApproved).toBe(true);
    });
  });

  // 7. Unapproved-only (Allows browsing all unapproved questions)
  it('7. should filter and paginate unapproved-only questions', async () => {
    const dbUnapprovedCount = (db.prepare('SELECT COUNT(*) as c FROM questions WHERE is_approved = 0').get() as any).c;

    const res = await makeRequest('GET', '/api/questions?isApproved=false&page=1&pageSize=50', {
      Authorization: `Bearer ${adminToken}`
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.totalItems).toBe(dbUnapprovedCount);
    expect(res.body.totalPages).toBe(Math.ceil(dbUnapprovedCount / 50) || 1);
    expect(res.body.questions.length).toBe(Math.min(50, dbUnapprovedCount));
    res.body.questions.forEach((q: any) => {
      expect(q.isApproved).toBe(false);
    });
  });

  // 8. Empty results
  it('8. should return empty questions array and 0 totalPages for non-matching queries', async () => {
    const res = await makeRequest(
      'GET',
      '/api/questions?search=nonexistent_xyz_phrase_never_found_12345',
      { Authorization: `Bearer ${adminToken}` }
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.totalItems).toBe(0);
    expect(res.body.totalPages).toBe(0);
    expect(res.body.count).toBe(0);
    expect(res.body.questions).toEqual([]);
  });

  // 9. Invalid pagination parameters
  it('9. should handle invalid, negative, or excessive pagination parameters safely', async () => {
    const resNegative = await makeRequest('GET', '/api/questions?page=-5&pageSize=-20', {
      Authorization: `Bearer ${adminToken}`
    });

    expect(resNegative.status).toBe(200);
    expect(resNegative.body.success).toBe(true);
    expect(resNegative.body.page).toBe(1);
    expect(resNegative.body.pageSize).toBe(25);

    const resExcessive = await makeRequest('GET', '/api/questions?page=1&pageSize=99999', {
      Authorization: `Bearer ${adminToken}`
    });

    expect(resExcessive.status).toBe(200);
    expect(resExcessive.body.success).toBe(true);
    expect(resExcessive.body.page).toBe(1);
    // Clamped to 150 limit
    expect(resExcessive.body.pageSize).toBe(150);
  });

  // 10. Subject category mapping & unapproved filter
  it('10. should filter questions using "Quantitative Mathematics" category and return unapproved math questions', async () => {
    const res = await makeRequest('GET', '/api/questions?subject=Quantitative+Mathematics&isApproved=false&page=1&pageSize=50', {
      Authorization: `Bearer ${adminToken}`
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.totalItems).toBeGreaterThan(0);
    expect(res.body.questions.length).toBeGreaterThan(0);
    res.body.questions.forEach((q: any) => {
      expect(['Mathematics', 'Math', 'Quantitative Aptitude', 'Quantitative Aptitude & Mathematics']).toContain(q.subject);
      expect(q.isApproved).toBe(false);
    });
  });

  // 11. Combined Subject + Difficulty + Approval Status filter
  it('11. should filter combined Subject + Difficulty + Approval Status accurately', async () => {
    const res = await makeRequest('GET', '/api/questions?subject=Quantitative+Mathematics&difficulty=MEDIUM&isApproved=false&page=1&pageSize=50', {
      Authorization: `Bearer ${adminToken}`
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.totalItems).toBeGreaterThan(0);
    res.body.questions.forEach((q: any) => {
      expect(['Mathematics', 'Math', 'Quantitative Aptitude', 'Quantitative Aptitude & Mathematics']).toContain(q.subject);
      expect(q.difficulty).toBe('MEDIUM');
      expect(q.isApproved).toBe(false);
    });
  });
});
