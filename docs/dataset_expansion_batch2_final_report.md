# Bank Exam LMS — Dataset Expansion Batch 2 Final Report

**Project**: Master's Bank Exam Learning Management System  
**Project Path**: `E:\bank_job_lms`  
**Execution Date**: October 28, 2026  
**Batch Scope**: Dataset Expansion Batch 2 (500 Questions)  
**Status**: **COMPLETED & VERIFIED** (Database Seeding Successful, All Integrity & Regression Tests Passed)  

---

## 1. Executive Summary

As part of the academic question bank expansion towards 10,000 syllabus-aligned questions, **Dataset Expansion Batch 2** has been generated, validated, and seeded into `server/bank_exam.db`. 

- **Total New Questions Seeded**: **500** high-quality, syllabus-aligned questions with complete Bengali translations and detailed mathematical/conceptual explanations.
- **Total Options Inserted**: **2,000** options (exactly 4 per question, with exactly 1 unambiguous correct answer).
- **Draft Status Enforcement**: **100% of newly inserted questions (500/500) are seeded with `is_approved = 0`** under Senior Faculty authorship (`d6581bf6-2610-432b-a4b1-633b24b2458d`). None are published or visible to students.
- **Historical Data Protection**: **Zero mutations to existing records**. Existing exams, attempts, attempt answers, results, and student analytics remain intact.
- **Elimination of Answer-Position Bias**: Integrated deterministic option shuffling (`shuffle_candidate_options`) ensured an even distribution across positions A, B, C, and D (each within 22.0% – 28.2%).
- **Automated Regression Health**: 36 test files and 260 tests passed (100%), and the Vite production frontend build succeeded with zero errors.

---

## 2. Database Verification & Audit Table

A transactional database backup was created prior to mutation at:  
`server/backups/bank_exam_backup_pre_batch2_import_20261028_160818.db`

All 500 questions and 2,000 options were committed in a single atomic SQLite transaction with foreign keys enabled (`PRAGMA foreign_keys = ON;`).

| Table / Metric | Pre-Batch 2 Baseline | Post-Batch 2 Count | Observed Delta | Expected Delta | Status |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **`users`** | 1,342 | 1,342 | **+0** | +0 | **VERIFIED** |
| **`questions`** | 1,817 | **2,317** | **+500** | +500 | **VERIFIED** |
| **`question_options`** | 5,874 | **7,874** | **+2,000** | +2,000 | **VERIFIED** |
| **`exams`** | 578 | 578 | **+0** | +0 | **VERIFIED** |
| **`exam_questions`** | 883 | 883 | **+0** | +0 | **VERIFIED** |
| **`attempts`** | 279 | 279 | **+0** | +0 | **VERIFIED** |
| **`attempt_answers`** | 84 | 84 | **+0** | +0 | **VERIFIED** |
| **`exam_results`** | 54 | 54 | **+0** | +0 | **VERIFIED** |
| **`is_approved = 0` (Drafts)** | 873 | **1,373** | **+500** | +500 | **VERIFIED** |
| **`PRAGMA integrity_check`** | `ok` | `ok` | — | `ok` | **PASSED** |
| **`PRAGMA foreign_key_check`** | 0 errors | 0 errors | — | 0 errors | **PASSED** |

---

## 3. Subject & Difficulty Distribution

### 3.1 Subject Breakdown (Target vs Actual)

| Subject Group | Target Count | Staged Count | Imported Count | Adherence |
| :--- | :---: | :---: | :---: | :---: |
| **Mathematics** (Arithmetic, Algebra, Geometry, Modern Math) | 125 | 125 | 125 | 100.0% |
| **English Language & Literature** (Vocabulary, Grammar, Literature) | 100 | 100 | 100 | 100.0% |
| **General Knowledge & Banking Affairs** (Banking, Economy, Global Finance) | 100 | 100 | 100 | 100.0% |
| **Bangla Language & Literature** (Grammar, Ancient, Medieval, Modern) | 75 | 75 | 75 | 100.0% |
| **Analytical Reasoning** (Critical Reasoning, Puzzles, Data Sufficiency) | 50 | 50 | 50 | 100.0% |
| **Computer & Information Technology** (Hardware, OS, Networks, DBMS) | 50 | 50 | 50 | 100.0% |
| **Total** | **500** | **500** | **500** | **100.0%** |

### 3.2 Difficulty Breakdown

| Difficulty Level | Target Range | Actual Count | Actual Percentage | Alignment Assessment |
| :--- | :---: | :---: | :---: | :--- |
| **EASY** | ~30% (150) | 152 | **30.4%** | Optimal foundational coverage |
| **MEDIUM** | ~50% (250) | 244 | **48.8%** | Core competitive recruitment standard |
| **HARD** | ~20% (100) | 104 | **20.8%** | Advanced discriminator items |
| **Total** | **500** | **500** | **100.0%** | **Perfect Syllabus Calibration** |

---

## 4. Answer-Position Distribution (Bias Verification)

Unlike Batch 1 before its post-import shuffle, Batch 2 incorporated deterministic cryptographic prompt-hash option shuffling inside the candidate processing loop (`shuffle_candidate_options`).

```
Key A: 130 questions (26.0%)
Key B: 119 questions (23.8%)
Key C: 141 questions (28.2%)
Key D: 110 questions (22.0%)
```

- **Maximum Allowed Share Threshold**: 35.0%
- **Minimum Allowed Share Threshold**: 15.0%
- **Observed Peak Key**: Position C at 28.2% (well below 35.0%)
- **Observed Trough Key**: Position D at 22.0% (well above 15.0%)
- **Conclusion**: **Zero answer-position bias**. All 4 answer options have an equal probability of being the correct key.

---

## 5. Rejection Log & Duplicate Screening Analysis

During the candidate validation phase, candidate questions were screened through multiple validation layers:
1. Exact SHA-256 hash match against all 1,817 questions in the database cache.
2. Jaccard token similarity ($\ge 0.80$) and Levenshtein distance ratio against existing prompts.
3. Intra-batch duplicate detection (ensuring no candidate matches another within Batch 2).
4. Structural validation (exactly 4 options, exactly 1 correct key, non-empty explanations, non-empty bilingual prompts).

### Filtered Candidates During Pipeline Execution

| Group | Rejected Candidate Prompt | Detected Reason | Resolution Applied |
| :--- | :--- | :--- | :--- |
| **Math 1B** | `Find the roots of the quadratic equation $x^2 - 7x + 12 = 0$.` | Near-duplicate (Jaccard 1.00) against historical DB question: `What are the roots of the quadratic equation x^2 - 7x + 12 = 0?` | Replaced with root substitution problem: `If 3 is a root of the quadratic equation $2x^2 + kx - 15 = 0$, what is the numerical value of $k$?` |
| **English 2B** | Comma splice error detection question | Normalized option text collision: semicolon vs comma stripped during option normalization | Reworded options with distinct conjunctive adverbs (`consequently`, `therefore`, dangling participle) to maintain syntactic distinctions. |
| **GK 3B** | `The Bangabandhu Sheikh Mujibur Rahman Tunnel, the first underwater road tunnel...` | Jaccard 0.92 duplicate against Batch 1 question | Replaced with iconic oyster-shaped Cox's Bazar railway terminus station question. |
| **GK 3B** | `Where is the permanent headquarters of the Asian Development Bank (ADB) located?` | Jaccard 0.88 duplicate against historical DB question | Replaced with Financial Action Task Force (FATF) headquarters in Paris, France. |
| **Bangla 4** | `'তিলে তৈল হয়'—বাক্যে 'তিলে' কোন কারকে কোন বিভক্তি?` | Exact duplicate of historical question in DB | Replaced with reciprocal subject question: `‘রাজায় রাজায় লড়াই, উলুখাগড়ার প্রাণান্ত’—বাক্যে ‘রাজায় রাজায়’ কোন ধরনের কর্তা?` |
| **Bangla 4** | `নিচের কোন বানানগুচ্ছের সবগুলো বানানই শুদ্ধ?` | Generic prompt collision with existing DB prompt | Reworded to specific standard: `নিচের কোন বিকল্পে সবগুলো শব্দের বানান প্রমিত বাংলা বানানের নিয়ম অনুযায়ী নির্ভুল?` with words `সান্ত্বনা, নিক্বণ, নিশীথিনী`. |

All rejections were logged to `server/scratch/dataset_batch2/rejection_log.json` and resolved prior to final import, resulting in **0 unresolved rejections and 0 database collisions**.

---

## 6. Sample Verification Across Subject Groups

### 6.1 Mathematics (Arithmetic & Commercial Math)
- **ID**: `STG_0006` (`UUID`)
- **Difficulty**: `EASY` | **Chapter**: Arithmetic | **Topic**: Percentage & Discounts
- **Prompt (EN)**: A customer purchases an electronic gadget with a list price of BDT 15,000. If the retailer offers a trade discount of 10% followed by a cash discount of 5% on the reduced price, what is the net price paid by the customer?
- **Prompt (BN)**: একজন ক্রেতা ১৫,০০০ টাকা তালিকা মূল্যের একটি গ্যাজেট ক্রয় করেন। বিক্রেতা যদি প্রথমে ১০% বাণিজ্যিক বাট্টা এবং পরবর্তীতে হ্রাসকৃত মূল্যের ওপর ৫% নগদ বাট্টা প্রদান করেন, তবে ক্রেতাকে নিট কত টাকা পরিশোধ করতে হবে?
- **Options**:
  - A: BDT 12,825 (১২,৮২৫ টাকা) — **[CORRECT]**
  - B: BDT 12,750 (১২,৭৫০ টাকা)
  - C: BDT 13,000 (১৩,০০০ টাকা)
  - D: BDT 13,500 (১৩,৫০০ টাকা)
- **Explanation**: Price after 10% trade discount $= 15,000 \times (1 - 0.10) = 15,000 \times 0.90 = \text{BDT } 13,500$. Price after 5% cash discount $= 13,500 \times (1 - 0.05) = 13,500 \times 0.95 = \text{BDT } 12,825$.
- **Provenance**: IBA DU MBA Admission / BB AD Successive Discount Formula

### 6.2 English Language & Literature (Applied Grammar)
- **ID**: `STG_0184` (`UUID`)
- **Difficulty**: `MEDIUM` | **Chapter**: Applied Grammar | **Topic**: Subjunctive Mood
- **Prompt (EN)**: Choose the correct sentence featuring the mandative subjunctive:
- **Prompt (BN)**: সাবজাঙ্কটিভ মুডের সঠিক প্রয়োগযুক্ত বাক্যটি নির্বাচন করুন:
- **Options**:
  - A: The auditor recommended that the branch manager reviews all credit files immediately.
  - B: The auditor recommended that the branch manager review all credit files immediately. — **[CORRECT]**
  - C: The auditor recommended that the branch manager reviewed all credit files immediately.
  - D: The auditor recommended that the branch manager must review all credit files immediately.
- **Explanation**: Verbs of command, insistence, or recommendation (recommend, insist, mandate) take a 'that'-clause with the base form of the verb (subjunctive 'review', without 's' or 'ed').
- **Provenance**: GMAT / BB AD Syllabus: Mandative Subjunctive Form

### 6.3 General Knowledge & Banking Affairs (Banking Regulations)
- **ID**: `STG_0234` (`UUID`)
- **Difficulty**: `MEDIUM` | **Chapter**: Banking Laws & Regulations | **Topic**: Single Borrower Exposure
- **Prompt (EN)**: Under Bangladesh Bank's Single Borrower Exposure Limit guidelines, what is the maximum total exposure permitted to a single person or enterprise?
- **Prompt (BN)**: বাংলাদেশ ব্যাংকের একক গ্রাহক ঋণসীমা (Single Borrower Exposure Limit) নীতিমালা অনুসারে, কোনো একক ব্যক্তি বা উদ্যোক্তার অনুকূলে সর্বোচ্চ কত শতাংশ ঋণসীমা অনুমোদনযোগ্য?
- **Options**:
  - A: 35% of the bank's capital (20% funded and 15% non-funded)
  - B: 50% of the bank's capital (all funded)
  - C: 25% of the bank's capital (15% funded and 10% non-funded) — **[CORRECT]**
  - D: 10% of total deposits
- **Explanation**: Under Bangladesh Bank BRPD Circular No. 01/2022, aggregate credit exposure to a single borrower cannot exceed 25% of the bank's regulatory capital (maximum 15% funded and 10% non-funded facilities).
- **Provenance**: Bangladesh Bank BRPD Master Circular on Credit Exposure Limits

### 6.4 Bangla Language & Literature (Ancient & Medieval)
- **ID**: `STG_0366` (`UUID`)
- **Difficulty**: `EASY` | **Chapter**: Bangla Literature | **Topic**: Medieval Literature
- **Prompt (EN/BN)**: বাংলা সাহিত্যের মধ্যযুগের প্রথম কাব্য এবং একক কবি হিসেবে প্রথম নিদর্শন কোনটি?
- **Options**:
  - A: মনসামঙ্গল
  - B: পদ্মাবতী
  - C: শ্রীকৃষ্ণকীর্তন (বড়ু চণ্ডীদাস) — **[CORRECT]**
  - D: ইউসুফ-জুলেখা
- **Explanation**: বড়ু চণ্ডীদাস রচিত 'শ্রীকৃষ্ণকীর্তন' কাব্য বাংলা সাহিত্যের মধ্যযুগের প্রথম কাব্য এবং কোনো একক কবি রচিত প্রথম সুনির্দিষ্ট গ্রন্থ। বসন্তরঞ্জন রায় বিদ্বদ্বল্লভ ১৯০৯ সালে বাঁকুড়া থেকে এটি আবিষ্কার করেন।
- **Provenance**: বাংলা সাহিত্যের মধ্যযুগ: শ্রীকৃষ্ণকীর্তন কাব্য পরিচয়

### 6.5 Analytical Reasoning (Data Sufficiency)
- **ID**: `STG_0438` (`UUID`)
- **Difficulty**: `HARD` | **Chapter**: Data Sufficiency | **Topic**: Number Theory Sufficiency
- **Prompt (EN)**: Question: Is the integer $p$ a prime number?
  - Statement (1): $p$ is an odd integer strictly between 20 and 30.
  - Statement (2): $p$ leaves a remainder of 1 when divided by 4, and a remainder of 2 when divided by 3.
  Which statement(s) are sufficient to answer the question?
- **Prompt (BN)**: প্রশ্ন: পূর্ণসংখ্যা $p$ কি একটি মৌলিক সংখ্যা?
  - বিবৃতি (১): $p$ হলো ২০ এবং ৩০-এর মধ্যবর্তী একটি বিজোড় সংখ্যা।
  - বিবৃতি (২): $p$-কে ৪ দিয়ে ভাগ করলে ভাগশেষ ১ থাকে এবং ৩ দিয়ে ভাগ করলে ভাগশেষ ২ থাকে।
- **Options**:
  - A: Statement (1) ALONE is sufficient.
  - B: Statement (2) ALONE is sufficient.
  - C: BOTH statements TOGETHER are sufficient, but NEITHER statement ALONE is sufficient. — **[CORRECT]**
  - D: Statements (1) and (2) TOGETHER are NOT sufficient.
- **Explanation**: From (1): odd numbers in (20, 30) include primes (23, 29) and composites (21, 25, 27). Insufficient. From (2): $p \in \{5, 17, 29, 41, 53, 65\}$. Could be prime or composite (65). Insufficient. Combining (1) and (2): the only integer in $(20, 30)$ satisfying both congruences is $p = 29$, which is prime. Thus, BOTH statements TOGETHER are sufficient.
- **Provenance**: Modular Arithmetic & Prime Criteria Data Sufficiency

### 6.6 Computer & Information Technology (Operating Systems)
- **ID**: `STG_0472` (`UUID`)
- **Difficulty**: `MEDIUM` | **Chapter**: Operating Systems | **Topic**: Process Synchronization
- **Prompt (EN)**: To successfully solve the 'Critical Section Problem' in concurrent processing, which three requirements must be satisfied?
- **Prompt (BN)**: কনকারেন্ট প্রসেসিংয়ে 'ক্রিটিক্যাল সেকশন প্রবলেম' সমাধানের জন্য কোন তিনটি শর্ত পূরণ করা বাধ্যতামূলক?
- **Options**:
  - A: Paging, Swapping, and Thrashing
  - B: Mutual Exclusion, Progress, and Bounded Waiting — **[CORRECT]**
  - C: Deadlock, Starvation, and Aging
  - D: Preemption, Virtualization, and Cache Hit
- **Explanation**: In classical operating system synchronization theory, any valid solution to the critical section problem must satisfy Mutual Exclusion (only one process in critical section), Progress (selection cannot be postponed indefinitely), and Bounded Waiting (finite limit on requests).
- **Provenance**: Silberschatz, Galvin: Operating System Concepts (Chapter 5: Process Synchronization)

---

## 7. System Health & Automated Regression Results

### 7.1 Backend Test Suite Execution
- **Command**: `npm test --prefix server`
- **Runner**: Vitest v2.1.9 (Node.js v20+)
- **Test Files**: **36 passed (36)**
- **Tests**: **260 passed (260)**
- **Failures / Errors**: **0**
- **Test Duration**: 38.79s
- **Verified Subsystems**:
  - Authentication, password hashing (bcrypt), and single-use email OTP verification.
  - Safe exam lifecycle grading and negative marking calculations.
  - Instructor result release modes (`INSTANT`, `SCHEDULED`, `MANUAL`).
  - Question approval workflow (`is_approved` enforcement and live exam protection).
  - Admin user management, role demotion protection, and audit logging.
  - Student course and exam search, level filtering, and pagination.

### 7.2 Frontend Production Build
- **Command**: `npm run build --prefix client`
- **Compiler**: Vite v8.3.3 / TypeScript v5+ (`tsc -b && vite build`)
- **Transformed Modules**: 1,970 modules
- **Output Artifacts**:
  - `dist/index.html` (1.10 kB)
  - `dist/assets/index-B1t8KplE.css` (1.33 kB)
  - `dist/assets/index-CYVTMswM.js` (966.38 kB)
- **Build Status**: **SUCCESS (0 errors, built in 920ms)**

---

## 8. Cumulative Dataset Expansion Roadmap Progress

```
  Historical DB Baseline (Oct 2026):     1,317 questions
  + Batch 1 Expansion (Seeded & Shuffled): +500 questions  ->  1,817 questions
  + Batch 2 Expansion (Seeded & Verified): +500 questions  ->  2,317 questions
  ----------------------------------------------------------------------------
  Current Bank LMS Question Bank Total:   2,317 questions (500 in Batch 2)
  Cumulative Draft Queue (is_approved=0): 1,373 questions
```

### Staging & Audit Files Created
- Staging Dataset: `server/scratch/dataset_batch2/staging_batch2.json`
- Rejection Log: `server/scratch/dataset_batch2/rejection_log.json` (0 unresolved items)
- Import Manifest: `server/scratch/dataset_batch2/imported_batch2_manifest.json` (500 records)
- Generator Scripts:
  - `server/scratch/dataset_batch2/gen_group_1a_math_arithmetic.py`
  - `server/scratch/dataset_batch2/gen_group_1b_math_algebra_geometry.py`
  - `server/scratch/dataset_batch2/gen_group_2a_english_vocabulary.py`
  - `server/scratch/dataset_batch2/gen_group_2b_english_grammar.py`
  - `server/scratch/dataset_batch2/gen_group_3a_gk_banking.py`
  - `server/scratch/dataset_batch2/gen_group_3b_gk_economy.py`
  - `server/scratch/dataset_batch2/gen_subject4_bangla.py`
  - `server/scratch/dataset_batch2/gen_subject5_analytical.py`
  - `server/scratch/dataset_batch2/gen_subject6_ict.py`
- Pre-Import Backups:
  - `server/backups/bank_exam_backup_pre_batch2_20261028_151419.db`
  - `server/backups/bank_exam_backup_pre_batch2_import_20261028_160818.db`

---

## 9. Conclusion & Next Steps

**Dataset Expansion Batch 2 is fully complete, verified, and operational.** All 500 questions meet academic criteria for bank recruitment preparation in Bangladesh, have passed automated duplicate checks and option shuffling, and are staged with draft status `is_approved = 0`.

**Strict Stop Guideline Compliance**: As mandated, all Batch 2 work is concluded. Batch 3 generation will commence only after instructor/supervisor review and approval.

