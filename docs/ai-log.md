# AI-Use Journal
**Project:** Online Learning Management System for Bank Exam Preparation  
**Student:** Farabi Mizan Oisi (Roll: 2506141, IIT - University of Dhaka)  
**Supervisor:** Dr. Naushin Nower  

According to the master plan and academic proposal ground rules, this log maintains a transparent record of all AI assistance used in building the platform.

---

## Entry 1: Monorepo Architecture & Master Plan Breakdown
- **Date:** 2026-10-06
- **Prompt / Intent:** Initial project setup following the 12-week Master Plan (Phase 0 - Ground rules, Phase 1 - Foundation, Phase 2 - Exam Core, Phase 3 - Integrity, Phase 4 - Product Layer, Phase 5 - Testing & Verification).
- **Tool Used:** Antigravity AI Assistant
- **Generated Code/Assets:**
  - Monorepo folder layout (`/client`, `/server`, `/shared`, `/docs`)
  - ERD specifications and Prisma Schema
  - Server-authoritative timer logic and pure-function auto-grading engine
  - Docker Compose configuration for PostgreSQL, Redis, MinIO
- **Modifications / Rationale:** Reordered modules to deliver the exam vertical slice (Question Bank, Exam Engine, Server Timer, Safe Submit, Grading, and Integrity) as the primary foundational milestone before commodity CMS/Courses.

---

## Entry 2: Courses & Content Hierarchy (Category > Course > Module > Lesson) & Expiring Signed URLs
- **Date:** 2026-10-06
- **Prompt / Intent:** Implement Option A (Module 2 of Proposal / Week 9 of Master Plan) delivering the structured academic syllabus with protected downloadable materials.
- **Tool Used:** Antigravity AI Assistant
- **Generated Code/Assets:**
  - Expanded relational tables: `categories`, `courses`, `course_modules`, `lessons`, and `lesson_resources`.
  - Backend router [`server/src/routes/courses.ts`](file:///e:/bank_job_lms/server/src/routes/courses.ts) generating HMAC-signed 15-minute time-expiring tokens for PDF handouts and lecture attachments.
  - Interactive UI [`client/src/components/CoursesScreen.tsx`](file:///e:/bank_job_lms/client/src/components/CoursesScreen.tsx) with module navigation, embedded video lecture player, and on-demand signed link generator.
- **Modifications / Rationale:** Enforced time-expiring signed tokens instead of static file paths to fulfill project proposal requirement 2 (protecting study materials from unauthorized public sharing).

---

## Entry 3: Post-Exam Question Review with Explanations & Negative-Mark Auditing
- **Date:** 2026-10-06
- **Prompt / Intent:** Implement Option B (Week 8 of Master Plan / Proposal Item 7) giving candidates immediate pedagogical review with KaTeX LaTeX math solutions, bilingual explanations, and question status filters.
- **Tool Used:** Antigravity AI Assistant
- **Generated Code/Assets:**
  - Secure backend review route `GET /api/exams/:attemptId/review` in [`server/src/routes/exams.ts`](file:///e:/bank_job_lms/server/src/routes/exams.ts).
  - Post-Exam Review UI [`client/src/components/ExamReviewScreen.tsx`](file:///e:/bank_job_lms/client/src/components/ExamReviewScreen.tsx) with interactive status filters (`All`, `Correct`, `Wrong`, `Skipped`), visual choice comparison (green check for correct, red cross for incorrect candidate choice), and KaTeX formula explanations.
  - Automated verification test script [`test_review_lifecycle.py`](file:///e:/bank_job_lms/test_review_lifecycle.py).
- **Modifications / Rationale:** Protected review payloads until the attempt reaches terminal `GRADED` state to prevent answer leakage during live testing.
