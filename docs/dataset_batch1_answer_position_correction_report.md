# Dataset Expansion Batch 1 — Answer-Position Bias Correction & Generator Enhancement Report

**Project:** Bank Exam LMS  
**Workspace Path:** `E:\bank_job_lms`  
**Task:** Safe Option Shuffling & Generation Pipeline Upgrade  
**Execution Timestamp:** 2026-10-28T21:10:00+06:00  
**Status:** COMPLETED & VERIFIED (Atomic SQLite Transaction Committed, Zero Historical Mutation)

---

## 1. Executive Summary

Following the independent 30-question sample audit, an answer-position bias was identified across Dataset Expansion Batch 1 (where 73.4% of correct answers were stored at Key 'A' and 0% at Key 'D').

This task safely eliminated the answer-position bias across all 500 Batch 1 questions in `server/bank_exam.db` and permanently enhanced the question generation/validation pipeline for future batches.

### 1.1 Correct Answer Key Distribution Comparison

| Option Key | Pre-Correction Count | Pre-Correction Share | Post-Correction Count | Post-Correction Share | Status |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **Key 'A'** | 367 | 73.4% | **115** | **23.0%** | Balanced |
| **Key 'B'** | 79 | 15.8% | **144** | **28.8%** | Balanced |
| **Key 'C'** | 54 | 10.8% | **127** | **25.4%** | Balanced |
| **Key 'D'** | 0 | 0.0% | **114** | **22.8%** | Balanced |
| **TOTAL** | **500** | **100.0%** | **500** | **100.0%** | **Near-Perfect $\approx 25\%$ Balance** |

---

## 2. Safety Audit Findings (Phase 1)

1. **Identification:** All 500 Batch 1 question IDs were loaded from [`imported_batch1_manifest.json`](file:///E:/bank_job_lms/server/scratch/dataset_batch1/imported_batch1_manifest.json).
2. **Approval Status:** Confirmed that all 500 questions remain in unapproved draft status (`is_approved = 0`).
3. **Usage Check in Historical Tables:**
   * `exam_questions`: **0 references**
   * `attempts`: **0 references**
   * `attempt_answers`: **0 references**
   * `exam_results`: **0 references**
   * Total historical references: **0** (0 questions excluded; all 500 eligible).
4. **Grading & Presentation Architecture:**
   * Backend grading (`gradingEngine.ts`) matches student submission using **option UUIDs** (`selectedOptionIds === correctOptionIds` where `is_correct === 1`).
   * Frontend presentation (`ExamScreen.tsx`) displays options sorted by `sort_order ASC` and renders `option_key`.
   * Therefore, shuffling option records and updating `option_key` and `sort_order` while strictly preserving option `id`, `text`, `text_bangla`, and `is_correct` guarantees 100% semantic identity and grading correctness.

---

## 3. Verified Database Backup (Phase 2)

An online SQLite backup was created and verified prior to modifying any database records:
* **Backup File Path:** [`server/backups/bank_exam_backup_pre_shuffle_20261028_150555.db`](file:///E:/bank_job_lms/server/backups/bank_exam_backup_pre_shuffle_20261028_150555.db)
* **Integrity Status:** `PRAGMA integrity_check` returned **`ok`**.
* **Foreign Key Status:** `PRAGMA foreign_key_check` returned **0 violations**.
* **Recovery Smoke-Test:** Verified by attaching to an in-memory SQLite session and confirming full table readability (1,817 questions verified).

---

## 4. Controlled Transactional Option Shuffling (Phase 3)

The shuffling script ([`execute_safe_option_shuffle.py`](file:///E:/bank_job_lms/server/scratch/dataset_batch1/execute_safe_option_shuffle.py)) executed within an explicit SQLite transaction (`BEGIN TRANSACTION` ... `COMMIT`):
1. **Deterministic Reproducibility:** Used pseudo-random generator with fixed seed `20261028`.
2. **Semantic Identity Preservation:** For every question, the option with `is_correct = 1` preserved its exact `id`, `text`, and `text_bangla`. Only `option_key` ('A', 'B', 'C', 'D') and `sort_order` (0, 1, 2, 3) were updated to match its new shuffled position.
3. **Audit Logging:** Every question's pre-shuffle key and post-shuffle key were recorded in [`server/scratch/dataset_batch1/shuffle_execution_log.json`](file:///E:/bank_job_lms/server/scratch/dataset_batch1/shuffle_execution_log.json).
4. **Manifest Synchronization:** Updated [`server/scratch/dataset_batch1/imported_batch1_manifest.json`](file:///E:/bank_job_lms/server/scratch/dataset_batch1/imported_batch1_manifest.json) to reflect the new option keys.

---

## 5. Generator Pipeline Improvements (Phase 4)

To permanently prevent answer-position bias in future batches (Batch 2 through Batch 20):
1. **Automatic Option Shuffling in Validator:**
   * Added `shuffle_candidate_options(cand, global_seed)` to [`server/scratch/dataset_batch1/validator.py`](file:///E:/bank_job_lms/server/scratch/dataset_batch1/validator.py).
   * Generates a deterministic hash-based seed from `prompt + global_seed`.
   * Preserves text and semantic correctness while re-labeling keys 'A', 'B', 'C', 'D' post-shuffle.
   * Integrated into `process_group()` so that every accepted question in future batches is automatically shuffled before staging.
2. **Automated Bias Guard:**
   * Added `check_key_distribution(max_allowed_share=0.35, min_allowed_share=0.15)` to `DatasetValidator`.
   * Automatically asserts that no key exceeds 35% or drops below 15% across any accepted batch.
3. **Automated Test Suite:**
   * Created [`server/scratch/dataset_batch1/test_shuffling_and_bias.py`](file:///E:/bank_job_lms/server/scratch/dataset_batch1/test_shuffling_and_bias.py).
   * 5 automated unit tests verifying semantic preservation, deterministic reproducibility, series distribution balance, and detector rejection on biased batches.
   * **Test Status:** 5/5 passed in 0.003s.

---

## 6. Comprehensive Verification (Phase 5)

| Verification Check | Target | Observed Result | Status |
| :--- | :---: | :---: | :---: |
| **Batch 1 Questions Existing** | 500 | **500** | PASS |
| **Options per Question** | Exactly 4 | **4 on all 500 questions** | PASS |
| **Correct Options per Question** | Exactly 1 | **1 on all 500 questions** | PASS |
| **Original Option Texts Preserved** | 100% | **100% (0 text mutations)** | PASS |
| **Semantic Mismatches** | 0 | **0 mismatches** | PASS |
| **Approval Status** | `is_approved = 0` | **500 / 500 unapproved** | PASS |
| **Database Integrity** | `ok` | **`ok`** | PASS |
| **Foreign Key Check** | 0 violations | **0 violations** | PASS |
| **Total Database Questions** | 1,817 | **1,817 (+0 delta)** | PASS |
| **Total Database Options** | 5,874 | **5,874 (+0 delta)** | PASS |
| **Historical Exams** | 578 | **578 (+0 delta)** | PASS |
| **Historical Exam Questions** | 883 | **883 (+0 delta)** | PASS |
| **Historical Attempts** | 279 | **279 (+0 delta)** | PASS |
| **Historical Answers** | 84 | **84 (+0 delta)** | PASS |
| **Historical Results** | 54 | **54 (+0 delta)** | PASS |
| **Grading Engine Tests** | Pass | **2/2 passed** | PASS |
| **Database Scaffolding Tests** | Pass | **6/6 passed** | PASS |
| **Frontend Production Build** | Pass | **Built cleanly in 774ms** | PASS |

---

## 7. Files Modified or Created

1. [`server/scratch/dataset_batch1/validator.py`](file:///E:/bank_job_lms/server/scratch/dataset_batch1/validator.py): Added safe option shuffling and bias-detection distribution checker.
2. [`server/scratch/dataset_batch1/test_shuffling_and_bias.py`](file:///E:/bank_job_lms/server/scratch/dataset_batch1/test_shuffling_and_bias.py): Automated unit test suite for generator shuffling and bias prevention.
3. [`server/scratch/dataset_batch1/imported_batch1_manifest.json`](file:///E:/bank_job_lms/server/scratch/dataset_batch1/imported_batch1_manifest.json): Updated with post-shuffle option keys.
4. [`server/scratch/dataset_batch1/shuffle_execution_log.json`](file:///E:/bank_job_lms/server/scratch/dataset_batch1/shuffle_execution_log.json): Full execution log of all 500 questions.
5. [`server/backups/bank_exam_backup_pre_shuffle_20261028_150555.db`](file:///E:/bank_job_lms/server/backups/bank_exam_backup_pre_shuffle_20261028_150555.db): Verified pre-shuffle SQLite database backup.
6. [`server/bank_exam.db`](file:///E:/bank_job_lms/server/bank_exam.db): Active SQLite database (updated `option_key` and `sort_order` for the 2,000 options of Batch 1; zero question or historical records touched).
7. [`docs/dataset_batch1_answer_position_correction_report.md`](file:///E:/bank_job_lms/docs/dataset_batch1_answer_position_correction_report.md): Master audit and correction report.

---

## 8. Conclusion & Readiness

The answer-position bias in Dataset Expansion Batch 1 has been successfully eliminated. All 500 questions now exhibit an authentic, balanced distribution (A: 23.0%, B: 28.8%, C: 25.4%, D: 22.8%) while maintaining 100% semantic identity, bilingual precision, and grading accuracy. The generator pipeline has been permanently upgraded and verified with automated unit tests for future batches.

