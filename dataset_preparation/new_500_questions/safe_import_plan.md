# Safe Database Import Plan (Future Phased Execution)

**Date:** 2026-10-29 17:42:59
**Status:** STAGED ONLY — NO DATABASE WRITES PERFORMED

## 1. Safety Principles

In accordance with strict project constraints, zero questions have been inserted into `server/bank_exam.db`. When explicit user approval is granted, the following 5-phase execution plan must be followed:

## 2. Proposed Phased Execution

### Phase 1: Timestamped Hot Backup
```bash
python -c "import sqlite3, datetime; conn=sqlite3.connect('server/bank_exam.db'); bck=sqlite3.connect(f'server/scratch/backup_pre_import_{datetime.datetime.now().strftime(\"%Y%m%d_%H%M%S\")}.db'); conn.backup(bck); bck.close(); conn.close(); print('Backup complete.')"
```

### Phase 2: Schema Mapping & UUID Generation
- Map JSON fields to `questions` and `question_options` tables.
- Assign UUID v4 to `questions.id` and `question_options.id`.
- Set `default_marks = 1.0`, `default_negative_marks = 0.25`, `is_approved = 1`.

### Phase 3: Transactional Batch Import
```sql
BEGIN TRANSACTION;
INSERT INTO questions (id, subject, chapter, topic, difficulty, type, prompt, prompt_bangla, explanation, explanation_bangla, default_marks, default_negative_marks, is_approved, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP);
INSERT INTO question_options (id, question_id, option_key, text, is_correct, sort_order)
VALUES (?, ?, ?, ?, ?, ?);
COMMIT;
```

### Phase 4: Post-Import Integrity Verification
- Verify exact addition of 500 rows to `questions` (3,317 -> 3,817).
- Verify exact addition of 2,000 rows to `question_options` (11,874 -> 13,874).
- Verify all 500 foreign keys resolve with zero orphaned records.

### Phase 5: Rollback Contingency
- If any error occurs during insertion, execute `ROLLBACK;` immediately.
- In the event of system crash, restore from the Phase 1 backup file.
