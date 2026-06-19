-- ============================================================
-- Online Examination System with AI Proctoring
-- MySQL Database Initialisation Script
-- ============================================================

CREATE DATABASE IF NOT EXISTS online_exam_ai
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE online_exam_ai;

-- ── users ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id       INT AUTO_INCREMENT PRIMARY KEY,
    name     VARCHAR(120)                NOT NULL,
    email    VARCHAR(150) UNIQUE         NOT NULL,
    password VARCHAR(256)                NOT NULL,
    role     ENUM('student', 'admin')    NOT NULL DEFAULT 'student',
    exam_id  INT                         DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── exams ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exams (
    exam_id    INT AUTO_INCREMENT PRIMARY KEY,
    code       VARCHAR(100)  UNIQUE NOT NULL,
    title      VARCHAR(200)  NOT NULL,
    duration   INT           NOT NULL COMMENT 'Duration in minutes',
    published  TINYINT(1)    NOT NULL DEFAULT 0,
    created_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ── questions ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS questions (
    question_id INT AUTO_INCREMENT PRIMARY KEY,
    exam_id     INT          NOT NULL,
    question    TEXT         NOT NULL,
    option1     VARCHAR(300) NOT NULL,
    option2     VARCHAR(300) NOT NULL,
    option3     VARCHAR(300) NOT NULL,
    option4     VARCHAR(300) NOT NULL,
    answer      VARCHAR(300) NOT NULL,
    CONSTRAINT fk_q_exam FOREIGN KEY (exam_id)
        REFERENCES exams (exam_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── exam_attempts ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exam_attempts (
    attempt_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT      NOT NULL,
    exam_id    INT      NOT NULL,
    start_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_time   DATETIME          DEFAULT NULL,
    CONSTRAINT fk_ea_student FOREIGN KEY (student_id)
        REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_ea_exam FOREIGN KEY (exam_id)
        REFERENCES exams (exam_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── student_answers ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_answers (
    answer_id       INT AUTO_INCREMENT PRIMARY KEY,
    attempt_id      INT          NOT NULL,
    question_id     INT          NOT NULL,
    selected_answer VARCHAR(300)          DEFAULT NULL,
    CONSTRAINT fk_sa_attempt  FOREIGN KEY (attempt_id)
        REFERENCES exam_attempts (attempt_id) ON DELETE CASCADE,
    CONSTRAINT fk_sa_question FOREIGN KEY (question_id)
        REFERENCES questions (question_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── results ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS results (
    result_id  INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT   NOT NULL,
    exam_id    INT   NOT NULL,
    attempt_id INT   NOT NULL,
    score      INT   NOT NULL DEFAULT 0,
    percentage FLOAT NOT NULL DEFAULT 0.0,
    CONSTRAINT fk_r_student FOREIGN KEY (student_id)
        REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_r_exam FOREIGN KEY (exam_id)
        REFERENCES exams (exam_id) ON DELETE CASCADE,
    CONSTRAINT fk_r_attempt FOREIGN KEY (attempt_id)
        REFERENCES exam_attempts (attempt_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── ai_violations ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_violations (
    violation_id   INT AUTO_INCREMENT PRIMARY KEY,
    student_id     INT          NOT NULL,
    exam_id        INT          NOT NULL,
    violation_type ENUM(
        'No Face Detected',
        'Multiple Faces Detected',
        'Candidate Absent',
        'Tab Switch',
        'Fullscreen Exit'
    ) NOT NULL,
    screenshot_path VARCHAR(500)  DEFAULT NULL,
    violation_time  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_v_student FOREIGN KEY (student_id)
        REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_v_exam FOREIGN KEY (exam_id)
        REFERENCES exams (exam_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
