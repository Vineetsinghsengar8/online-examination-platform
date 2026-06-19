import datetime
from app import db


class AIViolation(db.Model):
    __tablename__ = "ai_violations"

    violation_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    student_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    exam_id = db.Column(db.Integer, db.ForeignKey("exams.exam_id"), nullable=False)
    violation_type = db.Column(
        db.Enum("No Face Detected", "Multiple Faces Detected", "Candidate Absent", "Tab Switch", "Fullscreen Exit"),
        nullable=False,
    )
    screenshot_path = db.Column(db.String(500), nullable=True)
    violation_time = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def to_dict(self):
        from models.user import User
        from models.exam import Exam

        student = User.query.get(self.student_id)
        exam = Exam.query.get(self.exam_id)

        return {
            "violation_id": self.violation_id,
            "student_id": self.student_id,
            "student_name": student.name if student else "Unknown",
            "exam_id": self.exam_id,
            "exam_code": exam.code if exam else None,
            "exam_title": exam.title if exam else "Unknown",
            "violation_type": self.violation_type,
            "screenshot_path": self.screenshot_path,
            "violation_time": self.violation_time.isoformat() if self.violation_time else None,
        }
