from app import db


class Result(db.Model):
    __tablename__ = "results"

    result_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    student_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    exam_id = db.Column(db.Integer, db.ForeignKey("exams.exam_id"), nullable=False)
    attempt_id = db.Column(db.Integer, db.ForeignKey("exam_attempts.attempt_id"), nullable=False)
    score = db.Column(db.Integer, nullable=False, default=0)
    percentage = db.Column(db.Float, nullable=False, default=0.0)

    def to_dict(self):
        from models.user import User
        from models.exam import Exam
        from models.question import Question
        from models.exam_attempt import ExamAttempt

        student = User.query.get(self.student_id)
        exam = Exam.query.get(self.exam_id)
        attempt = ExamAttempt.query.get(self.attempt_id)
        total_score = Question.query.filter_by(exam_id=self.exam_id).count()

        return {
            "result_id": self.result_id,
            "student_id": self.student_id,
            "student_name": student.name if student else "Unknown",
            "exam_id": self.exam_id,
            "exam_code": exam.code if exam else None,
            "exam_title": exam.title if exam else "Unknown",
            "attempt_id": self.attempt_id,
            "score": self.score,
            "total_score": total_score,
            "percentage": round(self.percentage, 2),
            "submitted_at": attempt.end_time.isoformat() if attempt and attempt.end_time else None,
            "status": "Pass" if self.percentage >= 50 else "Fail",
        }
