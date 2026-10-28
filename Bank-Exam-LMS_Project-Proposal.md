# **Project Proposal Form, Fall 2026** 

**Institute of Information Technology (IIT), University of Dhaka** 

|**Student's Name:**|**FARABI MIZAN OISI**<br>**Phone:**|**01770221817**|
|---|---|---|
|**Student's Roll:**|**2506141**||
|**Project Title:**|**An Online Learning Management System for Bank**|**Exam Preparation**|



## **Motivation** 

Bank recruitment exams in Bangladesh are highly competitive, syllabus-heavy, and strictly timed, yet most candidates prepare using scattered PDFs, printed guidebooks, and unmoderated Facebook groups with no structured feedback on where their preparation actually stands. Existing generic e-learning platforms are not built around the specific rhythm of bank exam preparation — negative marking, sectioned MCQ papers, live mock tests under exam-like time pressure, and topic-wise weakness tracking across subjects such as English, Mathematics, Bangla, General Knowledge, and Banking/Computer knowledge. This project is motivated by the need for a dedicated, disciplined practice environment that closely mirrors the real exam experience: reliable timing, negative marking, exam-integrity controls during highstakes mock tests, and clear, actionable feedback after every attempt. By building a focused Learning Management System for this single, well-defined use case rather than a general-purpose platform, the goal is to give candidates a realistic, trustworthy space to study, take timed mock exams, and track their readiness — while giving instructors and administrators the tools to build and moderate that content responsibly. 

## **Project Description** 

### **1. Accounts & Access** 

Users register and log in with email or phone OTP. Three roles are supported — Student, Instructor, and Admin — with permissions checked on the server (never trusted from the client). After signup, a short onboarding step collects the student's profile, target bank exam, and target date. 

**_Purpose:_** _Establishes a secure, role-aware foundation so that only authenticated, correctly-permissioned users can access course content, build exams, or view administrative data, and personalizes the experience from the first login._ 

### **2. Courses & Content** 

Content is organized as Category > Course > Module > Lesson, with each course moving through a simple Draft > Published workflow. Bangla and English content are both supported. Instructors upload video, PDF, slide, and note resources, served via signed, time-expiring links rather than public URLs. 

**_Purpose:_** _Gives the syllabus (English, Math, Bangla, GK, Banking/Computer knowledge) a clear structure students can navigate, keeps unfinished content hidden from students until reviewed, and protects paid/prepared content from being freely shared outside the platform._ 

### **3. Question Bank** 

Every question is tagged by subject, chapter, topic, difficulty, marks, and type. Supported types are single MCQ, multiselect, true/false, numeric, and fill-in-the-blank. Math expressions render via LaTeX, images are supported, and Bangla text renders correctly. Every question carries a written explanation, and a simple approved/unapproved flag keeps unreviewed questions out of live exams. 

**_Purpose:_** _Creates a structured, filterable pool of exam-realistic questions that can be reused across chapter quizzes and mock exams, supports the quantitative and Bangla-medium content real bank exams use, and lets students learn from the explanation after every attempt instead of just seeing right/wrong._ 

### **4. Exam & Quiz Engine** 

Two exam types are supported: chapter-wise quizzes and full mock/model tests. Each exam is configurable for duration, total marks, pass mark, number of attempts, sections, and negative marking. Students see a question palette (answered / 

unanswered / marked for review), answers auto-save as they work, submission is protected against double-submit, and questions are only released to the client after the exam officially starts. 

**_Purpose:_** _Recreates the actual look, feel, and rules of a bank exam — including negative marking, which is central to real bank exam scoring — so that practice under this engine genuinely prepares students for exam-day conditions, while autosave and safe submit remove the risk of losing an attempt to a crash or accidental double-click._ 

### **5. Exam Scheduling & Timer** 

Each exam has a start time, end time, and duration, stored in UTC and displayed in Dhaka time. The countdown timer is controlled entirely by the server, so changing a device's clock has no effect. If a student's internet drops mid-exam, the timer keeps running in the background; when they reconnect, they resume with everything already answered still saved. Exams move through clear states: Draft > Scheduled > Live > Closed > Results Published. 

**_Purpose:_** _Guarantees that every student, regardless of device or connection quality, is held to the exact same clock — which is essential for an exam whose scoring depends on fairness — while gracefully handling Bangladesh's variable mobile/broadband connectivity without giving anyone an unfair time advantage._ 

### **6. Exam Integrity Mode** 

During a live mock exam, the platform forces full screen and logs any exit; detects tab switches or window-focus loss and logs their time and duration; freezes the screen with a warning the student must dismiss (while the timer keeps running); applies configurable per-exam violation rules (warn, flag, or auto-submit after N violations); blocks copy, paste, right-click, text selection, and printing; allows only one active exam session per student; and stores every violation on the server where the student cannot delete it. (As with any browser-based system, this discourages and detects likely cheating — it cannot physically lock a device.) 

**_Purpose:_** _Protects the credibility of mock-exam rankings and readiness scores — without a reasonable level of integrity monitoring, self-reported practice scores would be meaningless as a measure of real exam readiness, and instructors/admins need an auditable record to review disputed attempts._ 

### **7. Marking & Results** 

Objective questions are auto-graded on the server using the configured negative-marking scheme (e.g., +1 / -0.25 / 0 for skipped). Instructors choose when results are released — instantly, on a schedule, or manually. The result page shows total score, correct/wrong/skipped counts, marks, percentage, time taken, accuracy, and rank, and a full answer review with explanations becomes available once the exam closes. 

**_Purpose:_** _Delivers fast, consistent, bias-free grading at scale, mirrors the real scoring logic bank exams use so the score is a meaningful readiness indicator, and turns every mock test into a learning opportunity through the post-exam review._ 

### **8. Student Dashboard & Analytics** 

Students get a personal dashboard summarizing enrolled courses, upcoming exams, and recent scores; progress tracking for lessons and quizzes completed; a per-subject and per-chapter accuracy breakdown; and search/filter tools to quickly find relevant courses or practice material by subject or level. 

**_Purpose:_** _Gives students a single, motivating view of where their preparation stands and which subjects need more attention, encouraging consistent study habits rather than one-off exam attempts._ 

### **9. Instructor Panel** 

Instructors build courses, modules, and lessons; create questions and assemble exams with a student-view preview before publishing; and view their own students' results and integrity flags for exams they created. 

**_Purpose:_** _Lets subject instructors manage and quality-check bank-exam content and monitor how their exams performed without needing developer involvement for every content change._ 

### **10. Admin Panel** 

Admins manage users (search, suspend, change role, approve instructor accounts), approve or reject submitted courses, monitor live exams (active attempts and violations in real time), view platform-wide analytics (students, courses, exams, average scores), and review an audit log of every sensitive action such as grade overrides or time extensions. 

**_Purpose:_** _Gives the platform owner operational control and accountability — the ability to keep content quality high, watch high-stakes mock exams as they happen, and trace who changed what, which is essential once real grades and rankings are involved._ 

## **Strategy & Timeline** 

This project follows a 12-week (3-month) build plan. Modules are sequenced so that each week's work depends only on functionality already completed in a prior week, keeping the plan realistic for one developer working incrementally with regular, dated commits. The Gantt chart is given below: 

|**Week**<br>1|**Task No / Module**<br>Module 0 — Planning &<br>Setup|**Description**<br>Finalize scope, design database schema (users,<br>courses, questions, exams, attempts, violations), set<br>up repo, and dev environment.|**Dependencies**<br>None|
|---|---|---|---|
|2|Module 1 — Accounts &<br>Access|Registration/login (email or phone OTP), role-based<br>access control (Student/Instructor/Admin), basic<br>onboarding (profile, target exam, target date).|Week 1|
|3|Module 2 — Courses &<br>Content|Content hierarchy (Category > Course > Module ><br>Lesson), Draft/Published workflow, Bangla & English<br>content, file upload with signed expiring links.|Week 2|
|4|Module 3 — Question<br>Bank|Tagging<br>(subject/chapter/topic/difficulty/marks/type),<br>MCQ/multi-select/true-false/numeric/fill-in-blank<br>types, Bangla support, explanations, approval flag.|Week 3|
|5|Module 4a — Exam<br>Engine (Core)|Exam settings (duration, marks, pass mark, attempts,<br>sections, negative marking), question palette<br>(answered/unanswered/marked), auto-save.|Week 4|
|6|Module 4b — Exam<br>Engine (Delivery)|Safe submit (no double-submit), server-side question<br>release only after exam start, sectioned navigation.|Week 5|
|7|Module 5 — Scheduling<br>& Timer|Exam lifecycle (Draft>Scheduled>Live>Closed>Results<br>Published), UTC storage shown in Dhaka time,<br>server-controlled timer, auto-submit at time end,<br>offline-resume with running clock.|Week 6|
|8|Module 6 — Exam<br>Integrity Mode|Forced full screen + exit logging, tab/focus-loss<br>detection, freeze-and-warn overlay, configurable<br>violation rules (warn/flag/auto-submit),<br>copy/paste/right-click block, single active session,<br>tamper-proof server logs.|Week 7|
|9|Module 7 — Marking &<br>Results|Server-side auto-grading, negative marking,<br>configurable result visibility, detailed result page<br>(score/accuracy/rank/time), post-exam answer<br>review with explanations.|Week 8|
|10|Module 8 — Student<br>Dashboard & Analytics|Personal dashboard (courses, upcoming exams,<br>scores), progress tracking, per-subject/chapter<br>accuracy breakdown, search & filter.|Week 9|
|11|Module 9 & 10 —<br>Instructor & Admin<br>Panels|Instructor: course/question/exam builder with<br>student-view preview, result & integrity views.<br>Admin: user management, course approval, live<br>exam monitor, platform analytics, audit log.|Weeks 2–9|



|**Week**|**Task No / Module**|**Description**|**Dependencies**|
|---|---|---|---|
|12|Integration, Testing &<br>Deployment|End-to-end testing (esp. timer/auto-submit/integrity<br>edge cases), bug fixing, UI polish, deployment,<br>user/technical documentation, final report<br>preparation.|Weeks 1–11|



## **Languages or Tools to be Used** 

- Frontend: React.js (with Tailwind CSS) 

- Backend: Node.js with Express.js (REST API) 

- Database: PostgreSQL (primary data), Redis (session/exam-timer caching) 

- IDE / Editor: Visual Studio Code 

- AI Tools / Assistants (if any) — e.g., GitHub Copilot, ChatGPT, Claude. 

## **AI Tool Use Declaration** 

- ☑ I intend to use AI coding/writing assistance tools for this project. 

- ☐ I do not intend to use AI tools for this project. 

- If yes, tool(s) to be used: GitHub Copilot, ChatGPT, Claude. 

Intended purpose(s) (e.g., boilerplate generation, debugging, documentation drafting, learning a new framework): 

Boilerplate/scaffolding generation (CRUD endpoints, React components, DB migrations); debugging (async/timer race conditions); learning new stack components (server-authoritative timers, LaTeX rendering, signed URLs, Fullscreen/tab-visibility APIs); documentation drafting; code review & refactoring suggestions. 

_Declaration: I understand that, regardless of AI tool use, I am required to disclose such use in my project report, and I must be able to independently explain, defend, and modify any part of my code — including any AI-assisted sections — during the midterm and final presentations, live defense, and supervisor meetings throughout the semester. I understand that submitting AI-generated work I cannot explain or defend may result in a reduced grade or other academic consequences._ 

**Student's Signature:** FARABI **Date:** 26/09/26 

## **Project GitHub Link** 

<u>https://github.com/oisi27/LMS_Bank_Exam_Preparation.git</u> 

_Note: Maintain a regular, incremental, and dated commit history throughout the semester. A single large commit submitted close to the deadline is treated as a red flag and may be investigated._ 

**Supervisor's Name:** Dr. NAUSHIN NOWER **Date:** 26/09/26 

**Signature of the supervisor: Date:** ________________ 

## **Before the Midterm Presentation** 

I confirm that the progress is satisfactory and I am forwarding it for the midterm presentation. 

I further confirm that the student has demonstrated independent understanding of the codebase — including any AIassisted portions — and was able to explain and modify their prototype during our supervision meetings. 

**Signature of the supervisor:** ________________________________ **Date:** ________________ 

## **Before the Final Presentation** 

I confirm that the progress is satisfactory and I am forwarding it for the final presentation. 

I further confirm that the student has consistently demonstrated understanding and ownership of their work — including any AI-assisted code — throughout the semester, based on regular supervision meetings and progress reviews. 

**Signature of the supervisor:** ________________________________ **Date:** ________________ 

## **Proposal Presentation Feedback (if any)** 

**Midterm Presentation Feedback (if any)** 

## **AI-Use Disclosure Review Notes (if any)** 

_(For supervisor/evaluator use — note any discrepancy between disclosed AI use and demonstrated understanding.)_ 

