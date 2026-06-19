"""
Authentication Blueprint
POST /register
POST /login
"""

from flask import Blueprint, request
from app import db
from models.user import User
from utils.helpers import (
    hash_password,
    verify_password,
    generate_token,
    success_response,
    error_response,
)

auth_bp = Blueprint("auth", __name__, url_prefix="")


# ── POST /register ─────────────────────────────────────────────────────────────

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}

    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    confirm_password = data.get("confirm_password") or ""
    exam_code = (data.get("exam_code") or "").strip()

    # Validation
    if not name:
        return error_response("Name is required")
    if not email:
        return error_response("Email is required")
    if "@" not in email:
        return error_response("Invalid email address")
    if len(password) < 6:
        return error_response("Password must be at least 6 characters")
    if password != confirm_password:
        return error_response("Passwords do not match")
    if User.query.filter_by(email=email).first():
        return error_response("Email is already registered", 409)

    exam_id = None
    if exam_code:
        from models.exam import Exam
        exam = Exam.query.filter_by(code=exam_code).first()
        if not exam:
            return error_response("Exam not found", 404)
        exam_id = exam.exam_id

    user = User(
        name=name,
        email=email,
        password=hash_password(password),
        role="student",
        exam_id=exam_id,
    )
    db.session.add(user)
    db.session.commit()

    return success_response(
        {"user": user.to_dict()},
        message="Registration successful",
        code=201,
    )


@auth_bp.route("/student/login", methods=["POST"])
def student_login():
    data = request.get_json(silent=True) or {}

    email = (data.get("email") or "").strip().lower()
    exam_code = (data.get("exam_id") or "").strip()

    if not email or not exam_code:
        return error_response("Email and exam code are required", 400)

    from models.exam import Exam
    exam = Exam.query.filter_by(code=exam_code).first()
    if not exam:
        return error_response("Exam not found", 404)

    user = User.query.filter_by(email=email, role="student", exam_id=exam.exam_id).first()
    if not user:
        return error_response("Invalid student credentials or exam assignment", 401)

    token = generate_token(user.id, user.role)
    return success_response(
        {
            "token": token,
            "user": user.to_dict(),
        },
        message="Login successful",
    )


# ── POST /login ────────────────────────────────────────────────────────────────

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}

    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    # Special-case developer/admin shortcut: allow admin login with email
    # 'admin123@gmail.com' without requiring a password (or using 'admin123').
    # If the admin user doesn't exist, create it.
    if email == 'admin123@gmail.com' and (not password or password == 'admin123'):
        admin_user = User.query.filter_by(email=email, role='admin').first()
        if not admin_user:
            # create a simple admin user with a default password hash
            admin_user = User(
                name='Administrator',
                email=email,
                password=hash_password('admin123'),
                role='admin',
            )
            db.session.add(admin_user)
            db.session.commit()

        token = generate_token(admin_user.id, admin_user.role)
        return success_response({
            "token": token,
            "user": admin_user.to_dict(),
        }, message="Admin login (dev shortcut)")

    if not email or not password:
        return error_response("Email and password are required")

    user = User.query.filter_by(email=email).first()
    if not user or not verify_password(password, user.password):
        return error_response("Invalid email or password", 401)

    token = generate_token(user.id, user.role)

    return success_response(
        {
            "token": token,
            "user": user.to_dict(),
        },
        message="Login successful",
    )
