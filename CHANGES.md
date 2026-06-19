# What Was Fixed & Added

## 1. Admin Panel — Module bug (the main reported issue)
**Problem:** When creating an exam with multiple modules, the modules didn't show up
when adding questions, and newly-added questions didn't show up in the UI.

**Root cause:**
- The backend `Exam` model never stored the `modules` array that `ExamStructure.tsx`
  sent — it only stored a single `title`/`duration`. So every exam always normalized
  back to **one fake module**, no matter how many modules you created.
- `ExamStructure.tsx` generated module IDs using `Date.now()` independently from the
  exam's own ID, so IDs could drift and not match what `ManageQuestions.tsx` expected.
- Newly added questions were only added to local state in some code paths and never
  re-fetched with the correct `moduleId`, so they vanished from the question list.

**Fix:**
- Added `modules_json` column to the `exams` table (`database/migrate_v2.sql`) and
  `Exam.to_dict()` now returns the real `modules` array.
- Added `question_type`, `module_id`, `code_template`, `language`, `test_cases`
  columns to `questions` so each question remembers which module it belongs to and
  what kind of question it is (MCQ / coding / paragraph).
- `create_exam` / `update_exam` now accept and persist `modules`.
- `add_question` now accepts `module_id` and `type` and stores them.
- Frontend `ExamStructure.tsx` now generates one stable `examId` and stamps every
  module with that same ID (`mod-<examId>-<index>`) — no more drift.
- `ManageQuestions.tsx` now reads modules straight from `exam.modules` (which come
  from the backend) instead of recomputing them, and the question list filters by
  the real `moduleId`, so both module selection and the question list update
  immediately after adding a question.

## 2. Multi-language code compiler
`/run_code` previously only supported JavaScript and Python. It now supports:
**Python, JavaScript (Node), Java, C, C++, Go, Rust, Ruby, PHP, Bash.**

- Compiles when needed (`javac`, `gcc`, `g++`, `go build`, `rustc`) before running.
- Runs each test case with a 10s timeout, returns pass/fail + stdout/stderr per case.
- Every code run is saved to the database (`student_answers` table) tagged with
  exam ID, question ID, and student ID, as JSON: `{code, language, test_results}`.

> **Server requirement:** the relevant compilers/interpreters must be installed on
> whatever machine runs the Flask backend (e.g. `apt install default-jdk gcc g++
> golang-go rustc ruby php` on Debian/Ubuntu). Python/Node are typically present
> already.

## 3. Admin can now view student answers
New endpoints:
- `GET /student_answers/<attempt_id>` — full per-question answer breakdown
  (selected vs. correct answer, pass/fail for coding submissions) for one attempt.
- `GET /all_attempts` — list of every exam attempt with student/exam/score info.

New UI: **Admin → Student Results → "Attempts" tab** lists every attempt with a
"Review" button that opens a modal showing each answer, marked correct/incorrect,
including full code submissions and their test-case results.

## 4. AI Proctoring (OpenCV) — now actually detects more and reports correctly
Old version only checked "is there exactly one face." New version
(`ai_module/monitor.py`):
- Uses **frontal + profile** Haar cascades (so side-on faces are still detected,
  fewer false "absent" alerts).
- Histogram-equalizes frames first, which meaningfully improves detection under
  uneven lighting/webcam exposure.
- Adds **eye detection** to flag "Looking Away."
- Adds **frame-to-frame motion analysis** to flag "Suspicious Movement."
- Returns a structured per-frame report (`face_count`, `confidence`, `details`).

New endpoint `GET /proctoring_report/<student_id>?exam_id=...` aggregates a
student's violations into a **risk score (0–100) and Low/Medium/High risk level**
with a plain-English recommendation, shown in **Admin → Proctoring Reports** as
risk cards per student before the raw violation log.

## 5. Database
Run `database/migrate_v2.sql` against an existing database to add the new columns
non-destructively. Fresh installs can just run `database/init_db.sql` followed by
`migrate_v2.sql` (or update `init_db.sql` directly — the model definitions in
`models/exam.py` and `models/question.py` already match the migrated schema, so
`db.create_all()` on a fresh DB will create the right schema automatically).
