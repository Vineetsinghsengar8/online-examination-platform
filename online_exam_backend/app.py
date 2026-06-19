"""
Online Examination System with AI Proctoring
Flask Application Factory
"""

import os
from urllib.parse import quote_plus

from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from dotenv import load_dotenv
from sqlalchemy import inspect, text

base_dir = os.path.abspath(os.path.dirname(__file__))
dotenv_path = os.path.join(base_dir, '.env')
example_dotenv_path = os.path.join(base_dir, '.env.example')

if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path)
elif os.path.exists(example_dotenv_path):
    load_dotenv(example_dotenv_path)
    print('[CONFIG] No .env found; loaded settings from .env.example')
else:
    load_dotenv()

db = SQLAlchemy()


def _strip_quotes(value: str) -> str:
    """Remove surrounding single or double quotes that dotenv sometimes leaves."""
    if value and len(value) >= 2:
        if (value[0] == '"' and value[-1] == '"') or (value[0] == "'" and value[-1] == "'"):
            return value[1:-1]
    return value


def _create_mysql_database_if_needed(host, port, user, password, database):
    """Create the configured MySQL database before SQLAlchemy connects to it."""
    try:
        import pymysql
        connection = pymysql.connect(
            host=host,
            port=int(port),
            user=user,
            password=password,
            charset="utf8mb4",
            autocommit=True,
            connect_timeout=5,
        )
        try:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"CREATE DATABASE IF NOT EXISTS `{database}` "
                    "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
                )
            print(f"[DB] MySQL database '{database}' ready.")
        finally:
            connection.close()
        return True
    except ImportError:
        print("[DB] pymysql not installed — cannot use MySQL.")
        return False
    except Exception as e:
        print(f"[DB] MySQL connection failed: {e}")
        return False


def _sync_mysql_schema(app):
    """Bring older MySQL tables in line with the current SQLAlchemy models."""
    if not app.config["SQLALCHEMY_DATABASE_URI"].startswith("mysql"):
        return

    try:
        inspector = inspect(db.engine)
        table_names = set(inspector.get_table_names())

        with db.engine.begin() as connection:
            if "exams" in table_names:
                exam_columns = {column["name"] for column in inspector.get_columns("exams")}
                if "code" not in exam_columns:
                    connection.execute(text("ALTER TABLE exams ADD COLUMN code VARCHAR(100) NULL"))
                    connection.execute(
                        text(
                            "UPDATE exams "
                            "SET code = CONCAT('EXAM-', LPAD(exam_id, 3, '0')) "
                            "WHERE code IS NULL OR code = ''"
                        )
                    )
                    connection.execute(text("ALTER TABLE exams MODIFY code VARCHAR(100) NOT NULL"))

                exam_indexes = {index["name"] for index in inspector.get_indexes("exams")}
                if "uq_exams_code" not in exam_indexes:
                    connection.execute(text("CREATE UNIQUE INDEX uq_exams_code ON exams (code)"))

                if "published" not in exam_columns:
                    connection.execute(text("ALTER TABLE exams ADD COLUMN published TINYINT(1) NOT NULL DEFAULT 0"))

                # Ensure existing exams are visible in the student panel
                connection.execute(text("UPDATE exams SET published = 1 WHERE published = 0 OR published IS NULL"))

                # v2: module support on exams
                if "modules_json" not in exam_columns:
                    connection.execute(text("ALTER TABLE exams ADD COLUMN modules_json TEXT NULL"))

            if "users" in table_names:
                user_columns = {column["name"] for column in inspector.get_columns("users")}
                if "exam_id" not in user_columns:
                    connection.execute(text("ALTER TABLE users ADD COLUMN exam_id INT NULL"))

            if "questions" in table_names:
                question_columns = {column["name"] for column in inspector.get_columns("questions")}
                if "question_type" not in question_columns:
                    connection.execute(
                        text("ALTER TABLE questions ADD COLUMN question_type VARCHAR(20) NOT NULL DEFAULT 'mcq'")
                    )
                if "module_id" not in question_columns:
                    connection.execute(text("ALTER TABLE questions ADD COLUMN module_id VARCHAR(200) NULL DEFAULT ''"))
                if "code_template" not in question_columns:
                    connection.execute(text("ALTER TABLE questions ADD COLUMN code_template TEXT NULL"))
                if "language" not in question_columns:
                    connection.execute(text("ALTER TABLE questions ADD COLUMN language VARCHAR(50) NULL DEFAULT ''"))
                if "test_cases" not in question_columns:
                    connection.execute(text("ALTER TABLE questions ADD COLUMN test_cases TEXT NULL"))
                # Older schemas had these as NOT NULL with no default — coding/paragraph
                # questions can leave them blank, so relax the constraint.
                for col in ("option1", "option2", "option3", "option4", "answer"):
                    connection.execute(
                        text(f"ALTER TABLE questions MODIFY COLUMN {col} VARCHAR(300) NOT NULL DEFAULT ''")
                    )
    except Exception as e:
        print(f"[DB] Schema sync warning: {e}")


def create_app():
    app = Flask(__name__)

    # ── Configuration ──────────────────────────────────────────────────────────
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret-key-change-in-prod")

    db_host = os.getenv("DB_HOST", "").strip()
    db_port = os.getenv("DB_PORT", "3306").strip()
    db_user = _strip_quotes(os.getenv("DB_USER", "root").strip())
    db_password = _strip_quotes(os.getenv("DB_PASSWORD", "").strip())
    db_name = _strip_quotes(os.getenv("DB_NAME", "online_exam_ai").strip())

    use_mysql = False
    if db_host:
        use_mysql = _create_mysql_database_if_needed(db_host, db_port, db_user, db_password, db_name)

    if use_mysql:
        encoded_user = quote_plus(db_user)
        encoded_password = quote_plus(db_password)
        app.config["SQLALCHEMY_DATABASE_URI"] = (
            f"mysql+pymysql://{encoded_user}:{encoded_password}@{db_host}:{db_port}/{db_name}"
            "?charset=utf8mb4"
        )
        print(f"[CONFIG] Using MySQL database at: {db_user}@{db_host}:{db_port}/{db_name}")
    else:
        # Fallback to SQLite — works out-of-the-box, no MySQL needed
        db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "online_exam_ai.db"))
        app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{db_path}"
        print(f"[CONFIG] Using SQLite database at: {db_path}")

    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    screenshot_folder = os.path.join(
        os.path.dirname(__file__), os.getenv("SCREENSHOT_FOLDER", "screenshots")
    )
    os.makedirs(screenshot_folder, exist_ok=True)
    app.config["SCREENSHOT_FOLDER"] = screenshot_folder

    # ── Extensions ─────────────────────────────────────────────────────────────
    db.init_app(app)
    CORS(
        app,
        resources={r"/*": {"origins": "*"}},
        allow_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        expose_headers=["Content-Type", "Authorization"],
        supports_credentials=False,
    )

    @app.after_request
    def add_cors_headers(response):
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        
        # Prevent the browser from caching API responses so updates show immediately
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "-1"
        return response

    # Handle OPTIONS preflight globally
    @app.before_request
    def handle_options():
        from flask import request, make_response
        if request.method == "OPTIONS":
            response = make_response()
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
            response.status_code = 200
            return response

    # ── Register Blueprints ────────────────────────────────────────────────────
    from blueprints.auth import auth_bp
    from blueprints.student import student_bp
    from blueprints.admin import admin_bp
    from blueprints.ai_proctor import ai_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(student_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(ai_bp)

    # ── Create Tables & Seed ───────────────────────────────────────────────────
    with app.app_context():
        try:
            db.create_all()
            print("[DB] Tables created/verified.")
        except Exception as e:
            print(f"[DB] create_all error: {e}")

        if use_mysql:
            _sync_mysql_schema(app)

        _seed_admin()
        _seed_demo_data()

    return app


def _seed_admin():
    """Insert a default admin account if one doesn't exist yet."""
    try:
        from models.user import User
        from utils.helpers import hash_password

        admin_email = _strip_quotes(os.getenv("ADMIN_EMAIL", "admin@examportal.com"))
        if not User.query.filter_by(email=admin_email).first():
            admin = User(
                name="Administrator",
                email=admin_email,
                password=hash_password(_strip_quotes(os.getenv("ADMIN_PASSWORD", "Admin@123"))),
                role="admin",
            )
            db.session.add(admin)
            db.session.commit()
            print(f"[SEED] Default admin created: {admin_email}")
    except Exception as e:
        print(f"[SEED] Admin seed failed: {e}")
        db.session.rollback()


def _seed_demo_data():
    """Seed a sample exam, questions, and student for local demo use."""
    try:
        from models.exam import Exam
        from models.question import Question
        from models.user import User
        from utils.helpers import hash_password

        demo_exam_code = "EXAM-001"
        exam = Exam.query.filter_by(code=demo_exam_code).first()
        if not exam:
            exam = Exam(title="Frontend Developer Assessment", duration=30, code=demo_exam_code, published=True)
            db.session.add(exam)
            db.session.flush() # Ensure exam_id is populated for questions
            db.session.commit()
            print(f"[SEED] Demo exam created: {demo_exam_code}")

        if Question.query.filter_by(exam_id=exam.exam_id).count() == 0:
            demo_questions = [
                {
                    "question": "What is the correct hook for side effects in React?",
                    "option1": "useEffect", "option2": "useState",
                    "option3": "useContext", "option4": "useReducer",
                    "answer": "useEffect",
                },
                {
                    "question": "Which of these is not a valid React hook?",
                    "option1": "useMemo", "option2": "useFetch",
                    "option3": "useEffect", "option4": "useState",
                    "answer": "useFetch",
                },
                {
                    "question": "What is the primary purpose of the virtual DOM?",
                    "option1": "To store component styles",
                    "option2": "To improve browser performance",
                    "option3": "To create server side content",
                    "option4": "To render CSS animations",
                    "answer": "To improve browser performance",
                },
            ]
            for q in demo_questions:
                question = Question(exam_id=exam.exam_id, **q)
                db.session.add(question)
            db.session.commit()
            print(f"[SEED] Demo questions added for {demo_exam_code}")

        student_email = "john@example.com"
        if not User.query.filter_by(email=student_email).first():
            student = User(
                name="John Doe",
                email=student_email,
                password=hash_password("john1234"),
                role="student",
                exam_id=exam.exam_id,
            )
            db.session.add(student)
            db.session.commit()
            print(f"[SEED] Demo student created: {student_email}")
    except Exception as e:
        print(f"[SEED] Demo data seed failed: {e}")
        db.session.rollback()
