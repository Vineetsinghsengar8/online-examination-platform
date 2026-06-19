"""
Student Blueprint - ENHANCED with full multi-language compiler
"""

import datetime
import json
from flask import Blueprint, request
from app import db
from models.exam import Exam
from models.question import Question
from models.exam_attempt import ExamAttempt
from models.student_answer import StudentAnswer
from models.result import Result
from utils.helpers import token_required, success_response, error_response
import subprocess
import tempfile
import os
import shlex

student_bp = Blueprint("student", __name__, url_prefix="")


@student_bp.route("/exams", methods=["GET"])
@token_required
def get_exams():
    exams = Exam.query.order_by(Exam.created_at.desc()).all()
    return success_response([e.to_dict() for e in exams])


@student_bp.route("/questions/<string:exam_code>", methods=["GET"])
@token_required
def get_questions(exam_code):
    exam = Exam.query.filter_by(code=exam_code).first()
    if not exam:
        return error_response("Exam not found", 404)

    questions = Question.query.filter_by(exam_id=exam.exam_id).all()

    attempt = ExamAttempt.query.filter_by(
        student_id=request.user_id,
        exam_id=exam.exam_id,
        end_time=None,
    ).first()

    if not attempt:
        attempt = ExamAttempt(student_id=request.user_id, exam_id=exam.exam_id)
        db.session.add(attempt)
        db.session.commit()

    return success_response(
        {
            "exam": exam.to_dict(),
            "attempt_id": attempt.attempt_id,
            "questions": [q.to_dict() for q in questions],
        }
    )


@student_bp.route("/submit_exam", methods=["POST"])
@token_required
def submit_exam():
    data = request.get_json(silent=True) or {}

    attempt_id = data.get("attempt_id")
    answers_payload = data.get("answers", [])

    attempt = None

    if attempt_id:
        attempt = ExamAttempt.query.get(attempt_id)
        if not attempt:
            return error_response("Exam attempt not found", 404)
        if attempt.student_id != request.user_id:
            return error_response("Unauthorized", 403)
    else:
        attempt = ExamAttempt.query.filter_by(
            student_id=request.user_id,
            end_time=None,
        ).order_by(ExamAttempt.attempt_id.desc()).first()

        if not attempt:
            return error_response("attempt_id is required when no active attempt exists")

    if attempt.end_time:
        return error_response("Exam already submitted")

    attempt.end_time = datetime.datetime.utcnow()

    questions = Question.query.filter_by(exam_id=attempt.exam_id).all()
    question_map = {q.question_id: q for q in questions}
    score = 0

    for item in answers_payload:
        qid = item.get("question_id")
        selected = item.get("selected_answer", "")

        if qid not in question_map:
            continue

        # Check if answer already stored
        existing_ans = StudentAnswer.query.filter_by(attempt_id=attempt.attempt_id, question_id=qid).first()
        if existing_ans:
            existing_ans.selected_answer = selected
        else:
            sa = StudentAnswer(
                attempt_id=attempt.attempt_id,
                question_id=qid,
                selected_answer=selected,
            )
            db.session.add(sa)

        q = question_map[qid]
        if q.question_type == "mcq" and selected and selected == q.answer:
            score += 1
        elif q.question_type == "coding" and selected:
            # For coding: store submitted code, score based on test cases
            try:
                code_submission = json.loads(selected)
                if isinstance(code_submission, dict):
                    code = code_submission.get("code", "")
                    lang = code_submission.get("language", "python")
                    tc_results = code_submission.get("test_results", [])
                    if tc_results and all(r.get("passed") for r in tc_results):
                        score += 1
                else:
                    pass  # Raw code submitted, manual grading needed
            except Exception:
                pass

    total = len(questions)
    percentage = (score / total * 100) if total > 0 else 0.0

    result = Result(
        student_id=request.user_id,
        exam_id=attempt.exam_id,
        attempt_id=attempt.attempt_id,
        score=score,
        percentage=percentage,
    )
    db.session.add(result)
    db.session.commit()

    return success_response(result.to_dict(), message="Exam submitted successfully")


@student_bp.route("/results/<int:student_id>", methods=["GET"])
@token_required
def get_results(student_id):
    if request.user_role != "admin" and request.user_id != student_id:
        return error_response("Unauthorized", 403)

    results = (
        Result.query.filter_by(student_id=student_id)
        .order_by(Result.result_id.desc())
        .all()
    )
    return success_response([r.to_dict() for r in results])


# ── POST /run_code - Full Multi-Language Compiler ────────────────────────────
LANGUAGE_CONFIG = {
    # Language key -> (file_extension, command_template, compile_template or None)
    "javascript": (".js", "node {file}", None),
    "js": (".js", "node {file}", None),
    "python": (".py", "python3 {file}", None),
    "py": (".py", "python3 {file}", None),
    "java": (".java", "java {classname}", "javac {file}"),
    "c": (".c", "{binary}", "gcc -o {binary} {file} -lm"),
    "cpp": (".cpp", "{binary}", "g++ -o {binary} {file} -lm"),
    "c++": (".cpp", "{binary}", "g++ -o {binary} {file} -lm"),
    "ruby": (".rb", "ruby {file}", None),
    "rb": (".rb", "ruby {file}", None),
    "php": (".php", "php {file}", None),
    "go": (".go", "{binary}", "go build -o {binary} {file}"),
    "rust": (".rs", "{binary}", "rustc -o {binary} {file}"),
    "typescript": (".ts", "ts-node {file}", None),
    "ts": (".ts", "ts-node {file}", None),
    "bash": (".sh", "bash {file}", None),
    "sh": (".sh", "bash {file}", None),
}


@student_bp.route("/run_code", methods=["POST"])
@token_required
def run_code():
    data = request.get_json(silent=True) or {}
    language = (data.get("language") or "python").lower().strip()
    code = data.get("code", "")
    testcases = data.get("testcases", [])
    exam_id = data.get("exam_id")
    question_id = data.get("question_id")
    student_id = request.user_id

    if not code:
        return error_response("code is required")

    config = LANGUAGE_CONFIG.get(language)
    if not config:
        return error_response(f"Unsupported language: {language}. Supported: {', '.join(set(LANGUAGE_CONFIG.keys()))}", 400)

    file_ext, run_cmd_template, compile_cmd_template = config

    # Write code to temp file
    with tempfile.NamedTemporaryFile("w", suffix=file_ext, delete=False, prefix="exam_code_") as tf:
        tf.write(code)
        tmp_path = tf.name

    binary_path = tmp_path.replace(file_ext, "")
    java_classname = "Solution"  # For Java, class name must match file

    if language == "java":
        # Java needs file named as class
        java_dir = tempfile.mkdtemp()
        tmp_path_java = os.path.join(java_dir, f"{java_classname}.java")
        with open(tmp_path_java, "w") as jf:
            jf.write(code)
        os.unlink(tmp_path)
        tmp_path = tmp_path_java

    compile_error = None
    results = []

    try:
        # Compile if needed
        if compile_cmd_template:
            if language == "java":
                compile_cmd = f"javac {shlex.quote(tmp_path)}"
            elif language in ("c", "cpp", "c++"):
                compile_cmd = f"{'gcc' if language=='c' else 'g++'} -o {shlex.quote(binary_path)} {shlex.quote(tmp_path)} -lm"
            elif language == "go":
                compile_cmd = f"go build -o {shlex.quote(binary_path)} {shlex.quote(tmp_path)}"
            elif language == "rust":
                compile_cmd = f"rustc -o {shlex.quote(binary_path)} {shlex.quote(tmp_path)}"
            else:
                compile_cmd = compile_cmd_template.format(
                    file=shlex.quote(tmp_path),
                    binary=shlex.quote(binary_path),
                    classname=java_classname,
                )

            try:
                comp_proc = subprocess.run(
                    compile_cmd, shell=True, capture_output=True, text=True, timeout=30
                )
                if comp_proc.returncode != 0:
                    compile_error = comp_proc.stderr or comp_proc.stdout
                    return success_response({
                        "compile_error": compile_error,
                        "results": [],
                        "language": language,
                    })
            except subprocess.TimeoutExpired:
                return success_response({"compile_error": "Compilation timed out", "results": []})

        # Build run command
        if language == "java":
            java_dir = os.path.dirname(tmp_path)
            run_cmd = f"java -cp {shlex.quote(java_dir)} {java_classname}"
        elif language in ("c", "cpp", "c++", "go", "rust"):
            run_cmd = shlex.quote(binary_path)
        else:
            run_cmd = run_cmd_template.format(file=shlex.quote(tmp_path))

        # Run against each test case (or once if no test cases)
        if not testcases:
            testcases = [{"input": "", "output": ""}]

        for tc in testcases:
            inp = str(tc.get("input", ""))
            expected = str(tc.get("output", "")).strip()
            try:
                proc = subprocess.Popen(
                    run_cmd, shell=True,
                    stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                    text=True
                )
                try:
                    out, err = proc.communicate(inp, timeout=10)
                except subprocess.TimeoutExpired:
                    proc.kill()
                    out, err = proc.communicate()
                    results.append({
                        "passed": False,
                        "output": out.strip(),
                        "expected": expected,
                        "error": "Time Limit Exceeded (10s)",
                        "stderr": err.strip(),
                    })
                    continue

                out_str = out.strip()
                passed = (out_str == expected) if expected else True
                results.append({
                    "passed": passed,
                    "output": out_str,
                    "expected": expected,
                    "stderr": err.strip() if err else "",
                    "return_code": proc.returncode,
                })
            except Exception as e:
                results.append({"passed": False, "error": str(e), "expected": expected})

        # Save code submission to DB if exam context provided
        if exam_id and question_id and student_id:
            try:
                attempt = ExamAttempt.query.filter_by(
                    student_id=student_id, end_time=None
                ).order_by(ExamAttempt.attempt_id.desc()).first()

                if attempt:
                    code_submission = json.dumps({
                        "code": code,
                        "language": language,
                        "test_results": results,
                        "submitted_at": datetime.datetime.utcnow().isoformat(),
                    })
                    existing = StudentAnswer.query.filter_by(
                        attempt_id=attempt.attempt_id,
                        question_id=int(question_id)
                    ).first()
                    if existing:
                        existing.selected_answer = code_submission
                    else:
                        ans = StudentAnswer(
                            attempt_id=attempt.attempt_id,
                            question_id=int(question_id),
                            selected_answer=code_submission,
                        )
                        db.session.add(ans)
                    db.session.commit()
            except Exception as save_err:
                print(f"[run_code] Could not save code to DB: {save_err}")

        passed_count = sum(1 for r in results if r.get("passed"))
        return success_response({
            "results": results,
            "passed": passed_count,
            "total": len(results),
            "language": language,
            "all_passed": passed_count == len(results),
        })

    finally:
        # Cleanup temp files
        for path in [tmp_path, binary_path]:
            try:
                if path and os.path.exists(path):
                    os.unlink(path)
            except Exception:
                pass
