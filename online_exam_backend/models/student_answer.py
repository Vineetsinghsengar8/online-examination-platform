from app import db


class StudentAnswer(db.Model):
    __tablename__ = "student_answers"

    answer_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    attempt_id = db.Column(db.Integer, db.ForeignKey("exam_attempts.attempt_id"), nullable=False)
    question_id = db.Column(db.Integer, db.ForeignKey("questions.question_id"), nullable=False)
    selected_answer = db.Column(db.String(300), nullable=True)

    def to_dict(self):
        return {
            "answer_id": self.answer_id,
            "attempt_id": self.attempt_id,
            "question_id": self.question_id,
            "selected_answer": self.selected_answer,
        }
