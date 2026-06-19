"""
Admin Blueprint - FIXED & ENHANCED
POST   /create_exam
PUT    /update_exam/<exam_id>
DELETE /delete_exam/<exam_id>
POST   /add_question
PUT    /update_question/<question_id>
DELETE /delete_question/<question_id>
GET    /students
POST   /students
POST   /students/bulk
DELETE /delete_student/<student_id>
GET    /all_results
GET    /student_answers/<attempt_id>   <-- NEW: admin can view student answers
GET    /violations
GET    /exams
GET    /questions/<exam_id>
GET    /dashboard_stats
"""

from flask import Blueprint, request
from app import db
from models.exam import Exam
from models.question import Question
from models.user import User
from models.result import Result
from models.ai_violation import AIViolation
from models.exam_attempt import ExamAttempt
from models.student_answer import StudentAnswer
from utils.helpers import admin_required, success_response, error_response, hash_password

admin_bp = Blueprint("admin", __name__, url_prefix="")


def _find_exam(identifier):
    if identifier is None:
        return None
    try:
        return Exam.query.get(int(identifier))
    except (TypeError, ValueError):
        return Exam.query.filter_by(code=str(identifier).strip()).first()


# ── Dashboard Stats ────────────────────────────────────────────────────────────

@admin_bp.route("/dashboard_stats", methods=["GET"])
@admin_required
def dashboard_stats():
    return success_response(
        {
            "total_students": User.query.filter_by(role="student").count(),
            "total_exams": Exam.query.count(),
            "total_results": Result.query.count(),
            "total_violations": AIViolation.query.count(),
        }
    )


# ── Exam Management ────────────────────────────────────────────────────────────

@admin_bp.route("/admin/exams", methods=["GET"])
@admin_required
def get_exams():
    exams = Exam.query.order_by(Exam.exam_id.desc()).all()
    return success_response([e.to_dict() for e in exams])


@admin_bp.route("/create_exam", methods=["POST"])
@admin_required
def create_exam():
    data = request.get_json(silent=True) or {}

    title = (data.get("title") or "").strip()
    duration = data.get("duration")
    code = (data.get("code") or "").strip()
    published = bool(data.get("published", False))
    # FIX: Accept modules from frontend exam structure
    modules = data.get("modules", [])

    if not title:
        return error_response("Exam title is required")
    try:
        duration = int(duration)
        if duration <= 0:
            raise ValueError
    except (TypeError, ValueError):
        return error_response("Duration must be a positive integer (minutes)")

    if not code:
        code = title.lower().replace(" ", "-").replace("_", "-")
    if Exam.query.filter_by(code=code).first():
        return error_response("Exam code must be unique", 409)

    exam = Exam(
        title=title,
        duration=duration,
        code=code,
        published=published,
        modules_json=__import__('json').dumps(modules) if modules else None
    )
    db.session.add(exam)
    db.session.commit()

    return success_response(exam.to_dict(), message="Exam created", code=201)


@admin_bp.route("/update_exam/<string:identifier>", methods=["PUT"])
@admin_required
def update_exam(identifier):
    exam = _find_exam(identifier)
    if not exam:
        return error_response("Exam not found", 404)

    data = request.get_json(silent=True) or {}

    if "title" in data and data["title"].strip():
        exam.title = data["title"].strip()
    if "code" in data and data["code"].strip():
        code = data["code"].strip()
        existing = Exam.query.filter_by(code=code).first()
        if existing and existing.exam_id != exam.exam_id:
            return error_response("Exam code must be unique", 409)
        exam.code = code
    if "duration" in data:
        try:
            exam.duration = int(data["duration"])
        except (TypeError, ValueError):
            return error_response("Duration must be an integer")
    if "published" in data:
        exam.published = bool(data["published"])
    if "modules" in data:
        import json
        exam.modules_json = json.dumps(data["modules"])

    db.session.commit()
    return success_response(exam.to_dict(), message="Exam updated")


@admin_bp.route("/publish_exam/<int:exam_id>", methods=["POST"])
@admin_required
def publish_exam(exam_id):
    exam = Exam.query.get(exam_id)
    if not exam:
        return error_response("Exam not found", 404)
    exam.published = True
    db.session.commit()
    return success_response(exam.to_dict(), message="Exam published")


@admin_bp.route("/unpublish_exam/<int:exam_id>", methods=["POST"])
@admin_required
def unpublish_exam(exam_id):
    exam = Exam.query.get(exam_id)
    if not exam:
        return error_response("Exam not found", 404)
    exam.published = False
    db.session.commit()
    return success_response(exam.to_dict(), message="Exam unpublished")


@admin_bp.route("/delete_exam/<string:identifier>", methods=["DELETE"])
@admin_required
def delete_exam(identifier):
    exam = _find_exam(identifier)
    if not exam:
        return error_response("Exam not found", 404)

    AIViolation.query.filter_by(exam_id=exam.exam_id).delete(synchronize_session=False)
    Result.query.filter_by(exam_id=exam.exam_id).delete(synchronize_session=False)
    attempts = ExamAttempt.query.filter_by(exam_id=exam.exam_id).all()
    for attempt in attempts:
        StudentAnswer.query.filter_by(attempt_id=attempt.attempt_id).delete(synchronize_session=False)
    ExamAttempt.query.filter_by(exam_id=exam.exam_id).delete(synchronize_session=False)
    User.query.filter_by(role="student", exam_id=exam.exam_id).delete(synchronize_session=False)
    Question.query.filter_by(exam_id=exam.exam_id).delete(synchronize_session=False)
    db.session.delete(exam)
    db.session.commit()
    return success_response(message="Exam deleted")


# ── Question Management ────────────────────────────────────────────────────────

@admin_bp.route("/admin/questions/<string:identifier>", methods=["GET"])
@admin_required
def get_questions_by_exam(identifier):
    exam = _find_exam(identifier)
    if not exam:
        return error_response("Exam not found", 404)
    questions = Question.query.filter_by(exam_id=exam.exam_id).all()
    return success_response([{**q.to_dict(include_answer=True), "exam_code": exam.code} for q in questions])


@admin_bp.route("/add_question", methods=["POST"])
@admin_required
def add_question():
    data = request.get_json(silent=True) or {}

    # Support both MCQ and coding/paragraph questions
    question_type = data.get("type", "mcq")

    # For MCQ: require all fields
    if question_type == "mcq":
        required_fields = ["question", "option1", "option2", "option3", "option4", "answer"]
        for field in required_fields:
            if not data.get(field):
                return error_response(f"'{field}' is required")
    else:
        if not data.get("question"):
            return error_response("'question' is required")

    exam = None
    exam_id = data.get("exam_id")
    exam_code = (data.get("exam_code") or data.get("code") or "").strip()
    module_id = data.get("module_id", "")

    if exam_id:
        try:
            exam = Exam.query.get(int(exam_id))
        except (TypeError, ValueError):
            exam = Exam.query.filter_by(code=str(exam_id).strip()).first()
    if not exam and exam_code:
        exam = Exam.query.filter_by(code=exam_code).first()
    if not exam:
        return error_response("Exam not found", 404)

    question = Question(
        exam_id=exam.exam_id,
        question=data["question"].strip(),
        option1=(data.get("option1") or "").strip(),
        option2=(data.get("option2") or "").strip(),
        option3=(data.get("option3") or "").strip(),
        option4=(data.get("option4") or "").strip(),
        answer=(data.get("answer") or "").strip(),
        question_type=question_type,
        module_id=module_id,
        code_template=data.get("code_template", ""),
        language=data.get("language", ""),
        test_cases=__import__('json').dumps(data.get("test_cases", [])),
    )
    db.session.add(question)
    db.session.commit()

    return success_response(question.to_dict(include_answer=True), message="Question added", code=201)


@admin_bp.route("/update_question/<int:question_id>", methods=["PUT"])
@admin_required
def update_question(question_id):
    q = Question.query.get(question_id)
    if not q:
        return error_response("Question not found", 404)

    data = request.get_json(silent=True) or {}

    for field in ["question", "option1", "option2", "option3", "option4", "answer"]:
        if field in data and data[field].strip():
            setattr(q, field, data[field].strip())

    db.session.commit()
    return success_response(q.to_dict(include_answer=True), message="Question updated")


@admin_bp.route("/delete_question/<int:question_id>", methods=["DELETE"])
@admin_required
def delete_question(question_id):
    q = Question.query.get(question_id)
    if not q:
        return error_response("Question not found", 404)

    db.session.delete(q)
    db.session.commit()
    return success_response(message="Question deleted")


# ── Students ───────────────────────────────────────────────────────────────────

@admin_bp.route("/students", methods=["GET"])
@admin_required
def get_students():
    students = User.query.filter_by(role="student").order_by(User.id).all()
    return success_response([s.to_dict() for s in students])


@admin_bp.route("/students", methods=["POST"])
@admin_required
def create_student():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    name = (data.get("name") or "").strip() or email.split("@")[0]
    exam_code = (data.get("exam_code") or "").strip()
    password = data.get("password") or "student123"

    if not email:
        return error_response("Email is required")
    if "@" not in email:
        return error_response("Invalid email address")
    if User.query.filter_by(email=email).first():
        return error_response("Email is already registered", 409)

    exam_id = None
    if exam_code:
        exam = Exam.query.filter_by(code=exam_code).first()
        if not exam:
            return error_response("Exam not found", 404)
        exam_id = exam.exam_id

    student = User(
        name=name,
        email=email,
        password=hash_password(password),
        role="student",
        exam_id=exam_id,
    )
    db.session.add(student)
    db.session.commit()

    return success_response(student.to_dict(), message="Student created", code=201)


@admin_bp.route("/students/bulk", methods=["POST"])
@admin_required
def create_students_bulk():
    data = request.get_json(silent=True) or {}
    items = data.get("students") or []
    if not isinstance(items, list):
        return error_response("students must be an array")

    created = []
    errors = []
    for idx, item in enumerate(items):
        email = (item.get("email") or "").strip().lower()
        name = (item.get("name") or "").strip() or email.split("@")[0]
        exam_code = (item.get("exam_code") or "").strip()
        if not email or "@" not in email:
            errors.append({"row": idx + 1, "message": "Invalid email"})
            continue
        if User.query.filter_by(email=email).first():
            errors.append({"row": idx + 1, "message": "Email already registered"})
            continue

        exam_id = None
        if exam_code:
            exam = Exam.query.filter_by(code=exam_code).first()
            if not exam:
                errors.append({"row": idx + 1, "message": f"Exam code '{exam_code}' not found"})
                continue
            exam_id = exam.exam_id

        student = User(
            name=name,
            email=email,
            password=hash_password(item.get("password") or "student123"),
            role="student",
            exam_id=exam_id,
        )
        db.session.add(student)
        created.append(student)

    db.session.commit()
    return success_response({"created": [s.to_dict() for s in created], "errors": errors}, message="Bulk students processed")


@admin_bp.route("/delete_student/<int:student_id>", methods=["DELETE"])
@admin_required
def delete_student(student_id):
    student = User.query.filter_by(id=student_id, role="student").first()
    if not student:
        return error_response("Student not found", 404)

    AIViolation.query.filter_by(student_id=student_id).delete(synchronize_session=False)
    Result.query.filter_by(student_id=student_id).delete(synchronize_session=False)
    attempts = ExamAttempt.query.filter_by(student_id=student_id).all()
    for attempt in attempts:
        StudentAnswer.query.filter_by(attempt_id=attempt.attempt_id).delete(synchronize_session=False)
    ExamAttempt.query.filter_by(student_id=student_id).delete(synchronize_session=False)
    db.session.delete(student)
    db.session.commit()

    return success_response(message="Student deleted")


# ── Results ────────────────────────────────────────────────────────────────────

@admin_bp.route("/all_results", methods=["GET"])
@admin_required
def get_all_results():
    results = db.session.query(Result, Exam.code).join(Exam, Result.exam_id == Exam.exam_id).order_by(Result.result_id.desc()).all()
    return success_response([{**r.to_dict(), "exam_code": code} for r, code in results])


# ── NEW: Admin View Student Answers ────────────────────────────────────────────

@admin_bp.route("/student_answers/<int:attempt_id>", methods=["GET"])
@admin_required
def get_student_answers(attempt_id):
    """Admin can view full answers for a specific exam attempt."""
    attempt = ExamAttempt.query.get(attempt_id)
    if not attempt:
        return error_response("Attempt not found", 404)

    answers = StudentAnswer.query.filter_by(attempt_id=attempt_id).all()
    questions = {q.question_id: q for q in Question.query.filter_by(exam_id=attempt.exam_id).all()}

    result = []
    for ans in answers:
        q = questions.get(ans.question_id)
        result.append({
            **ans.to_dict(),
            "question_text": q.question if q else "Unknown",
            "correct_answer": q.answer if q else None,
            "is_correct": (ans.selected_answer == q.answer) if q else None,
            "options": {
                "option1": q.option1 if q else None,
                "option2": q.option2 if q else None,
                "option3": q.option3 if q else None,
                "option4": q.option4 if q else None,
            } if q else {}
        })

    student = User.query.get(attempt.student_id)
    exam = Exam.query.get(attempt.exam_id)

    return success_response({
        "attempt": {
            "attempt_id": attempt.attempt_id,
            "student_id": attempt.student_id,
            "student_name": student.name if student else "Unknown",
            "student_email": student.email if student else "Unknown",
            "exam_id": attempt.exam_id,
            "exam_title": exam.title if exam else "Unknown",
            "exam_code": exam.code if exam else None,
            "start_time": attempt.start_time.isoformat() if attempt.start_time else None,
            "end_time": attempt.end_time.isoformat() if attempt.end_time else None,
        },
        "answers": result,
        "total_questions": len(questions),
        "answered": len(answers),
    })


@admin_bp.route("/all_attempts", methods=["GET"])
@admin_required
def get_all_attempts():
    """List all exam attempts with student/exam details for admin."""
    attempts = db.session.query(ExamAttempt, User, Exam).join(
        User, ExamAttempt.student_id == User.id
    ).join(
        Exam, ExamAttempt.exam_id == Exam.exam_id
    ).order_by(ExamAttempt.attempt_id.desc()).all()

    data = []
    for attempt, user, exam in attempts:
        result = Result.query.filter_by(attempt_id=attempt.attempt_id).first()
        data.append({
            "attempt_id": attempt.attempt_id,
            "student_id": user.id,
            "student_name": user.name,
            "student_email": user.email,
            "exam_id": exam.exam_id,
            "exam_title": exam.title,
            "exam_code": exam.code,
            "start_time": attempt.start_time.isoformat() if attempt.start_time else None,
            "end_time": attempt.end_time.isoformat() if attempt.end_time else None,
            "completed": attempt.end_time is not None,
            "score": result.score if result else None,
            "percentage": result.percentage if result else None,
        })

    return success_response(data)


# ── Violations ─────────────────────────────────────────────────────────────────

@admin_bp.route("/violations", methods=["GET"])
@admin_required
def get_violations():
    student_id = request.args.get("student_id", type=int)
    exam_identifier = request.args.get("exam_id")

    query = db.session.query(AIViolation, Exam.code).join(Exam, AIViolation.exam_id == Exam.exam_id)
    if student_id:
        query = query.filter(AIViolation.student_id == student_id)
    if exam_identifier:
        exam = _find_exam(exam_identifier)
        if exam:
            query = query.filter(AIViolation.exam_id == exam.exam_id)

    violations = query.order_by(AIViolation.violation_time.desc()).all()
    return success_response([{**v.to_dict(), "exam_code": code} for v, code in violations])
