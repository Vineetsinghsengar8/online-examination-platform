-- Migration v2: Add module support and coding question fields

USE online_exam_ai;

-- Add modules_json to exams table
ALTER TABLE exams ADD COLUMN IF NOT EXISTS modules_json TEXT DEFAULT NULL;

-- Add new fields to questions table
ALTER TABLE questions ADD COLUMN IF NOT EXISTS question_type VARCHAR(20) NOT NULL DEFAULT 'mcq';
ALTER TABLE questions ADD COLUMN IF NOT EXISTS module_id VARCHAR(200) DEFAULT '';
ALTER TABLE questions ADD COLUMN IF NOT EXISTS code_template TEXT DEFAULT '';
ALTER TABLE questions ADD COLUMN IF NOT EXISTS language VARCHAR(50) DEFAULT '';
ALTER TABLE questions ADD COLUMN IF NOT EXISTS test_cases TEXT DEFAULT '[]';

-- Make option fields nullable (for coding/paragraph questions)
ALTER TABLE questions MODIFY COLUMN option1 VARCHAR(300) NOT NULL DEFAULT '';
ALTER TABLE questions MODIFY COLUMN option2 VARCHAR(300) NOT NULL DEFAULT '';
ALTER TABLE questions MODIFY COLUMN option3 VARCHAR(300) NOT NULL DEFAULT '';
ALTER TABLE questions MODIFY COLUMN option4 VARCHAR(300) NOT NULL DEFAULT '';
ALTER TABLE questions MODIFY COLUMN answer VARCHAR(300) NOT NULL DEFAULT '';
