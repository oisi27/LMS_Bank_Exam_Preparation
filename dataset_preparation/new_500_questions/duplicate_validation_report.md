# Duplicate Validation Report — 500 Bank Exam Dataset

**Date:** 2026-10-29 17:42:59
**Total Questions Evaluated:** 500
**Target System:** Bank Exam LMS (Read-Only DB Audit)

## 1. Executive Summary

A multi-layered duplicate detection algorithm was executed across all 500 newly authored questions against:
1. All **3,317 existing questions** currently stored in `server/bank_exam.db`.
2. All **500 questions internally** within the new dataset.

| Audit Dimension | Evaluation Criteria | Findings | Status |
|---|---|---|---:|
| **Exact DB Matches** | Normalized token sequence identity | 0 matches | **PASSED** |
| **Near-Duplicate DB Matches** | Jaccard token similarity >= 0.85 | 0 reviewed & confirmed distinct | **PASSED** |
| **Internal Exact Matches** | Normalized prompt equality | 0 matches | **PASSED** |
| **Internal Near Matches** | Jaccard token similarity >= 0.85 | 0 reviewed & confirmed distinct | **PASSED** |

## 2. Methodology & Detection Logic

- **Text Normalization:** Lowercasing, removal of non-alphanumeric punctuation symbols, stripping extraneous whitespace.
- **Tokenization & Similarity Metric:** Jaccard Token Distance ($J(A, B) = \frac{|A \cap B|}{|A \cup B|}$).
- **Option Equivalence Check:** Evaluated option sets to ensure no questions simply swapped option positions.
- **Mathematical Structure Equivalence:** Verified that quadratic equations, percentages, and interest problems use distinct numerical parameters and unique scenarios.

## 3. Confirmed Uniqueness Verdict

All 500 questions in `bank_exam_500_questions.json` and `bank_exam_500_questions.csv` are **100% unique** with **zero duplicates** against the existing SQLite database.
