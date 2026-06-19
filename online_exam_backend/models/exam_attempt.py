import datetime
from app import db


class ExamAttempt(db.Model):
    __tablename__ = "exam_attempts"

    attempt_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    student_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    exam_id = db.Column(db.Integer, db.ForeignKey("exams.exam_id"), nullable=False)
    start_time = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    end_time = db.Column(db.DateTime, nullable=True)

    # Relationships
    answers = db.relationship("StudentAnswer", backref="attempt", lazy=True, cascade="all, delete-orphan")
    result = db.relationship("Result", backref="attempt", lazy=True, uselist=False)

    def to_dict(self):
        return {
            "attempt_id": self.attempt_id,
            "student_id": self.student_id,
            "exam_id": self.exam_id,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
        }
