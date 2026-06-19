import datetime
import json
from app import db


class Exam(db.Model):
    __tablename__ = "exams"

    exam_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    code = db.Column(db.String(100), unique=True, nullable=False)
    title = db.Column(db.String(200), nullable=False)
    duration = db.Column(db.Integer, nullable=False, comment="Duration in minutes")
    published = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    # NEW: store modules as JSON so frontend module structure is preserved
    modules_json = db.Column(db.Text, nullable=True, default=None)

    questions = db.relationship("Question", backref="exam", lazy=True, cascade="all, delete-orphan")
    attempts = db.relationship("ExamAttempt", backref="exam", lazy=True)
    results = db.relationship("Result", backref="exam", lazy=True)
    violations = db.relationship("AIViolation", backref="exam", lazy=True)

    def get_modules(self):
        if self.modules_json:
            try:
                return json.loads(self.modules_json)
            except Exception:
                pass
        # Default: single module matching the exam
        return [{"id": f"mod-{self.code}", "examId": self.code, "title": self.title, "type": "mcq", "timeLimit": self.duration}]

    def to_dict(self):
        return {
            "exam_id": self.exam_id,
            "code": self.code,
            "title": self.title,
            "duration": self.duration,
            "published": self.published,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "total_questions": len(self.questions),
            "modules": self.get_modules(),
        }
