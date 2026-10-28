# Bank Exam LMS — Project Overview & Quickstart Guide
**Degree:** Master’s 6-Credit Individual Project (Fall 2026)  
**Student:** Farabi Mizan Oisi (Roll: 2506141)  
**Supervisor:** Dr. Naushin Nower  
**Department:** Institute of Information Technology (IIT), University of Dhaka  

---

## 🚀 System Architecture Overview

The system is organized into a modular monorepo:
- **`/client`**: Modern React + TypeScript + Vite frontend styled with responsive dark-mode aesthetics, KaTeX for math formulas, and Noto Sans Bengali typography.
- **`/server`**: Node.js & Express REST API with server-authoritative timer logic, pure auto-grader function, WAL-mode SQLite database with UTC timestamps, and Docker Compose configurations for PostgreSQL/Redis.
- **`/shared`**: Centralized domain interfaces, schema types, and models.
- **`/docs`**: Academic records including [docs/ai-log.md](file:///e:/bank_job_lms/docs/ai-log.md) as required by project proposal ground rules.

---

## 🔑 Key Features Implemented

1. **Server-Authoritative Clock & Timer Sync:**
   - Attempt expiration is computed on the backend as `min(started_at + duration, exam.ends_at)`.
   - Client clocks are not trusted; remaining duration is derived from `ends_at - serverNow`.

2. **Idempotent Debounced Autosave:**
   - Incremental sequence numbers (`client_sequence`) prevent stale writes over unstable connections.

3. **Pure Function Auto-Grading Engine:**
   - Handles Bangladesh Bank negative marking schemes (`+1.0 / -0.25 / 0`).
   - Supports 5 question types: Single MCQ, Multi-Select, True/False, Numeric (with tolerance), and Fill-in-the-Blank.

4. **Exam Integrity & Deterrence Mode:**
   - Detects tab switching (`visibilitychange`), window blurs, and fullscreen exits.
   - Logs incidents to an append-only `exam_violations` table.
   - Displays a freeze-and-warn overlay while the background timer keeps running.

5. **Safe Submit Transaction:**
   - Row-level status locking ensures submissions cannot be duplicated.

---

## 🏃 Running the Application

### 1. Backend Server
```bash
cd server
npm run dev
# Active at http://localhost:5000
```

### 2. Frontend Client
```bash
cd client
npm run dev
# Active at http://localhost:5173
```

### 3. Demo Credentials
- **Student Account:** `oisi@du.ac.bd` / `bankpass123`
- **Instructor Account:** `instructor@banklms.ac.bd` / `bankpass123`
- **Admin Account:** `admin@banklms.ac.bd` / `bankpass123`

---

## 🧪 Testing

Run the server grading engine unit tests:
```bash
cd server
npm test
```
Run end-to-end exam simulation:
```bash
python test_exam_lifecycle.py
```
