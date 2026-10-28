# Dataset Expansion Batch 3 Final Report

**Date:** 2026-10-28  
**Project:** Bank Exam LMS  
**Workspace:** `E:\bank_job_lms`  
**Database File:** `server/bank_exam.db`  
**Backup Baseline File:** `server/backups/bank_exam_backup_pre_batch3_20261028_224244.db`  
**Manifest File:** `server/scratch/dataset_batch3/imported_batch3_manifest.json`  
**Author ID:** `d6581bf6-2610-432b-a4b1-633b24b2458d` (Senior Faculty - Math & English, INSTRUCTOR)  
**Status:** Successfully Seeded (`is_approved = 0`)  

---

## 1. Executive Summary

Dataset Expansion Batch 3 has successfully generated, validated, and seeded **500 new, high-quality, syllabus-aligned bank recruitment questions** into the production database `server/bank_exam.db`.

Every single question was screened against:
1. All 2,317 pre-existing database questions (1,317 historical + 500 Batch 1 + 500 Batch 2) to guarantee zero prompt collisions, exact duplicates, or high-similarity near-duplicates.
2. Intra-batch duplicates and mathematical template repetitions.
3. Strict 4-option formatting with single correct answer verification.
4. Deterministic option shuffling eliminating answer-position bias ($A \approx B \approx C \approx D \approx 25\%$).
5. Academic syllabus alignment matching Bangladesh Bank AD, Combined 8/10 Bank Officer, and BIBM recruitment examination benchmarks.

Post-import database verification confirmed **100% data integrity**:
- **Total Questions:** Increased from **2,317 to 2,817** ($+500$).
- **Total Options:** Increased from **7,874 to 9,874** ($+2,000$).
- **Draft / Unapproved Questions:** Increased from **1,373 to 1,873** ($+500$, `is_approved = 0`).
- **Zero Modifications:** Zero historical exams ($578$), exam questions ($883$), student attempts ($279$), attempt answers ($84$), or exam results ($54$) were touched or altered.
- **SQLite PRAGMA Integrity Check:** `ok`
- **SQLite Foreign Key Violations:** `0`

---

## 2. Subject Distribution

The 500 questions in Batch 3 precisely fulfill the target syllabus distribution:

| Subject | Questions | Percentage | Key Topics Covered |
| :--- | :---: | :---: | :--- |
| **Mathematics** | **125** | 25.0% | Compound interest & depreciation, True/Banker's discount, Stocks & shares brokerage, Clocks & calendars, Alligation & mixtures, Races & circular tracks, Pipes & cisterns, AP/GP/HP progressions, Inequalities & modulus, Coordinate geometry (slopes, distances, line equations), 3D Mensuration (cylinders, cones, spheres, cuboids), Circle theorems, 3-set Venn diagrams, Permutations, Combinations & Probability (urns, cards, conditional probability). |
| **English Language & Literature** | **100** | 20.0% | Synonyms, Antonyms, Verbal analogies, One-word substitutions, Idiomatic expressions, Subject-verb concord, Parallelism, Mandative subjunctive mood, Dangling modifiers, Negative inversion, Appropriate prepositions, Phrasal verbs, Conditionals (2nd & 3rd), Voice & speech transformations, English Literature (Shaw, Forster, Golding, Beckett, Eliot, Hardy, Conrad, Woolf, Joyce, Achebe, Tagore in translation, Naipaul, Auden, Orwell). |
| **General Knowledge & Banking Affairs** | **100** | 20.0% | Bank Company (Amendment) Act 2023, Wilful defaulters regulation (BRPD 04/2024), Single borrower exposure limits, Money Loan Court Act 2003, Prompt Corrective Action (PCA) framework, BFIU CTR/STR rules, Islamic Banking modes (Mudaraba, Musharaka, Murabaha, Sukuk, Bai-Salam, Istisna'a, Wadiah, Qard al-Hasan), Payment systems (BEFTN, RTGS, NPSB, Binimoy, Bangla QR), Agent & School banking, Basel III (CRAR, CCB, LCR, NSFR, Leverage ratio, ICRRS), Offshore Banking Act 2024, FERA 1947, MTBF, ADP/ECNEC, Tax-to-GDP reforms, PSR under Income Tax Act 2023, 2.5% remittance incentive, Crawling peg exchange rate system, BPM6 reserve accounting, BCCTF, Sustainable finance & green banking (ESRM, green bonds, LEED), IMF RSF/ECF/EFF, WB IDA, AIIB, ADB, NDB, WTO TRIPS waiver, Federal Reserve FOMC, ECB, Bank of Japan NIRP ending, and Quantitative Tightening. |
| **Bangla Language & Literature** | **75** | 15.0% | নত্ব ও ষত্ব বিধান, ধ্বনি পরিবর্তন (আদি/মধ্য স্বরাগম, অভিশ্রুতি, বিষমীভবন, বর্ণবিপর্যয়), শব্দ ভাণ্ডার (তৎসম, তদ্ভব, দেশি, পর্তুগিজ/গুজরাটি ঋণশব্দ, যৌগিক/যোগরূঢ় শব্দ), পদ প্রকরণ ও দ্বিরুক্ত শব্দ, প্রত্যয় (কৃৎ ও তদ্ধিত), উপসর্গ ও অনুসর্গ, সমাস (বহুব্রীহি, অলুক, নিত্য, প্রাদি, মধ্যপদলোপী কর্মধারয়), বাগধারা ও প্রমিত পারিভাষিক শব্দ, চর্যাপদ, অন্ধকার যুগ, শ্রীকৃষ্ণকীর্তন, বৈষ্ণব পদাবলী (বিদ্যাপতি/চণ্ডীদাস), মঙ্গলকাব্য (ভারতচন্দ্র, কানাহরি দত্ত), মধ্যযুগের মুসলিম কবিগণ (শাহ মুহম্মদ সগীর, আলাওল, দৌলত কাজী, বাহরাম খাঁ), কৃত্তিবাসী রামায়ণ ও কাশীরাম দাস, ফোর্ট উইলিয়াম কলেজ ও বাংলা গদ্যের বিকাশ (উইলিয়াম কেরি, রামরাম বসু, বিদ্যাসাগর), প্যারীচাঁদ মিত্র, কালীপ্রসন্ন সিংহ, বঙ্কিমচন্দ্র, রবীন্দ্রনাথ, তারাশঙ্কর, মানিক বন্দ্যোপাধ্যায়, বিভূতিভূষণ, শরৎচন্দ্র, আখতারুজ্জামান ইলিয়াস, সৈয়দ ওয়ালীউল্লাহ, নজরুল, জীবনানন্দ, জসীমউদ্দীন, মুনীর চৌধুরী, শওকত ওসমান, শামসুর রাহমান, জাহানারা ইমাম ও সৈয়দ শামসুল হক। |
| **Analytical Reasoning** | **50** | 10.0% | Critical Reasoning: Necessary assumptions, Argument strengtheners/weakeners, Boldface argument roles, Logical inferences, Paradox resolution, Method of reasoning fallacies.<br>Analytical Puzzles: Floor puzzles (odd/even constraints), Departmental distribution matrices, Linear multi-directional sequencing, Circular symmetric arrangements, Multi-generation family blood relations.<br>Data Sufficiency: 16 standard two-statement questions testing algebraic uniqueness, geometry, inequalities, divisibility, and ratios. |
| **Computer & Information Technology** | **50** | 10.0% | Hardware Architecture & Number Systems: 8-bit two's complement, IEEE 754 single-precision format, Universal logic gates, CPU pipelining hazards, Program counter/registers, Cache write-through vs write-back, RAID 5/6/10, NVMe architecture, K-maps, RISC vs CISC, DMA, SRAM vs DRAM.<br>Operating Systems: Round Robin scheduling, Banker's algorithm, Coffman deadlock conditions, Page faults & virtual memory, TLB architecture, Internal vs external fragmentation, Unix octal permissions (chmod 754), Process vs thread resources, SCAN elevator disk scheduling, Docker containers vs Hypervisor VMs, Semaphores, Thrashing, fork() system call, Microkernel vs Monolithic.<br>Networking & Security: DHCP DORA handshake, TCP 3-way handshake, CIDR IPv4 subnetting (/26), CSRF web vulnerabilities, TLS 1.3 1-RTT latency improvements, OSI Layer 3 routing, ARP, Honeypots, BGP-4 routing, Asymmetric public key encryption.<br>DBMS & Cloud Computing: BCNF & 2NF normalization, ACID atomicity, Dirty read transaction anomalies, B+ tree disk indexing, Relational algebra projection (\u03c0), IaaS/PaaS/SaaS cloud service models, Brewer's CAP theorem, Hybrid cloud architecture. |
| **TOTAL** | **500** | **100.0%** | **Comprehensive Bank Preparation Syllabus** |

---

## 3. Difficulty Level Distribution

| Difficulty Level | Questions | Percentage | Academic Target |
| :--- | :---: | :---: | :---: |
| **EASY** | 156 | 31.2% | ~30% |
| **MEDIUM** | 218 | 43.6% | ~50% |
| **HARD** | 126 | 25.2% | ~20% |
| **TOTAL** | **500** | **100.0%** | **100.0%** |

The difficulty distribution closely aligns with the recruitment examination design requirements, ensuring foundational questions (~31%), standard competitive questions (~44%), and discriminating high-difficulty problem-solving questions (~25%).

---

## 4. Answer-Position Distribution Balance

To prevent position bias, all candidate options underwent deterministic shuffling prior to database insertion. The correct answer distribution across all 500 questions is exceptionally balanced:

| Option Key | Frequency | Percentage | Allowed Tolerance Range | Status |
| :---: | :---: | :---: | :---: | :---: |
| **A** | **129** | **25.80%** | 15.0% – 35.0% | **BALANCED** |
| **B** | **124** | **24.80%** | 15.0% – 35.0% | **BALANCED** |
| **C** | **123** | **24.60%** | 15.0% – 35.0% | **BALANCED** |
| **D** | **124** | **24.80%** | 15.0% – 35.0% | **BALANCED** |
| **TOTAL** | **500** | **100.00%** | – | **OPTIMAL (~25% each)** |

---

## 5. Database State Summary

| Metric | Pre-Batch 3 Count | Post-Batch 3 Count | Delta | Status |
| :--- | :---: | :---: | :---: | :--- |
| **Total Questions** | 2,317 | **2,817** | **+500** | Verified |
| **Total Question Options** | 7,874 | **9,874** | **+2,000** | Verified (4 options/q) |
| **Approved Questions (`is_approved = 1`)** | 944 | **944** | **0** | Untouched |
| **Unapproved / Draft Questions (`is_approved = 0`)** | 1,373 | **1,873** | **+500** | Safely Isolated |
| **Exams** | 578 | **578** | **0** | Untouched |
| **Exam Questions** | 883 | **883** | **0** | Untouched |
| **Student Attempts** | 279 | **279** | **0** | Untouched |
| **Attempt Answers** | 84 | **84** | **0** | Untouched |
| **Exam Results** | 54 | **54** | **0** | Untouched |
| **SQLite DB Integrity** | `ok` | `ok` | – | Verified |
| **Foreign Key Violations** | 0 | 0 | – | Clean |

---

## 6. Artifacts & Staging Manifest

The complete record of Batch 3 questions is preserved in:
- Staging JSON: `server/scratch/dataset_batch3/staging_batch3.json`
- Import Manifest: `server/scratch/dataset_batch3/imported_batch3_manifest.json`
- Pre-Batch 3 Backup: `server/backups/bank_exam_backup_pre_batch3_20261028_224244.db`
- Validation logs: `server/scratch/dataset_batch3/rejection_log.json`

