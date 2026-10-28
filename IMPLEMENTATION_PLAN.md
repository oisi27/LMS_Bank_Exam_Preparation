# Bank Exam LMS Implementation Roadmap & Architecture Blueprint
**Project:** An Online Learning Management System for Bank Exam Preparation  
**Student:** Farabi Mizan Oisi (Roll: 2506141, IIT - University of Dhaka)  
**Supervisor:** Dr. Naushin Nower  

---

## 1. System Architecture & Tech Stack

### Client (`/client`)
- **Core:** React 18 / 19 + Vite + TypeScript
- **Styling:** Tailwind CSS + Lucide Icons + Custom Premium Design System
- **Math & Typography:** KaTeX (LaTeX math equations), Google Font (Noto Sans Bengali & Inter)
- **Exam Delivery Engine:**
  - Idempotent auto-saving with sequence numbers & local buffer
  - Server-authoritative timer sync (`ends_at - server_now`)
  - Fullscreen API & Tab visibility tracking / blur detector
  - Context menu, text selection, and print interceptors
  - Question palette (Answered, Unanswered, Marked for Review, Current)

### Server (`/server`)
- **Runtime:** Node.js + Express.js + TypeScript
- **Database & ORM:** PostgreSQL + Prisma ORM (with timestamptz everywhere)
- **Cache & Queues:** Redis + BullMQ (auto-submit scheduled jobs, single active session tokens)
- **Security & Auth:**
  - JWT Access Token + HttpOnly Rotating Refresh Token cookie
  - Argon2/Bcrypt password hashing
  - Server-side RBAC middleware (`requireRole('STUDENT' | 'INSTRUCTOR' | 'ADMIN')`)
  - Rate limiting on Auth & OTP routes
  - Tamper-proof append-only exam violations table
- **Pure Function Grading Engine:**
  - Configurable negative marking (+1, -0.25, 0)
  - Partial scoring rules for multi-select, numeric tolerances, true/false, fill-in-blank

### Storage & Infra
- **Docker Compose:** PostgreSQL 16 + Redis 7 + MinIO (S3 compatible for secure attachments/notes)

---

## 2. Master Plan Phased Execution

### Phase 0: Ground Rules & Monorepo Setup (Week 1)
- [x] Monorepo structure (`/client`, `/server`, `/shared`, `/docs`)
- [x] `docker-compose.yml` for Postgres & Redis
- [x] Prisma Schema with comprehensive ERD matching proposal (Users, Profiles, Courses, Modules, Lessons, Questions, Options, Exams, Sections, Attempts, Answers, Violations, Results, AuditLogs)
- [x] AI-Use Journal (`docs/ai-log.md`)

### Phase 1: Accounts & Access (Week 2)
- [x] User signup & login with JWT + Refresh tokens
- [x] Email OTP & Phone OTP (with extensible console mock provider)
- [x] Onboarding profile flow (target bank exam e.g. Bangladesh Bank AD, Combined 8 Banks, target date)
- [x] Server-side RBAC middleware

### Phase 2: Exam Core (Weeks 3–6) [High Priority - Core Done]
- [x] **Week 3 Question Bank:** CRUD, tags, difficulty, KaTeX math, Bengali text support, CSV bulk importer
- [x] **Week 4 Exam Engine:** Negative marking settings, section rules, attempt restrictions, question palette, idempotent autosave
- [x] **Week 5 Delivery & Safe Submit:** Server timer (`ends_at`), pure auto-grader function, row-locking transaction against double submit, zero-leak question payload
- [x] **Week 6 Scheduling & Timer Hardening:** Lazy auto-submit fallback, offline reconnect resume, Asia/Dhaka time handling

### Phase 3: Integrity & Results (Weeks 7–8) [Complete]
- [x] Fullscreen exit tracking, tab-switch blur counter, freeze-and-warn modal
- [x] Append-only violations logging with customizable thresholds
- [x] Results computation: scores, correct/wrong/skipped counts, negative marking breakdown
- [x] Post-exam question review with correct answers, explanations, KaTeX equations, and status filters (Option B & Proposal Item 7)

### Phase 4: Product Layer (Weeks 9–11) [Active]
- [x] Student dashboard & analytics (subject coverage, live mock exams, target goal tracking)
- [x] Admin & Live Exam Monitor (real-time attempt tracking, violation watcher, user directory, audit trail)
- [x] Category > Course > Module > Lesson CMS viewer with signed attachments (Week 9 & Proposal Item 2)
- [ ] Instructor course draft-to-published editor

### Phase 5: Testing & Polling (Week 12)
- [x] Test suites (pure grading engine unit tests passing via Vitest, end-to-end integration test passing)
- [x] Course & signed expiring link integration test passing (`test_courses_lifecycle.py`)
- [ ] k6/Artillery load simulation test script
