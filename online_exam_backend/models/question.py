import json
from app import db


class Question(db.Model):
    __tablename__ = "questions"

    question_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    exam_id = db.Column(db.Integer, db.ForeignKey("exams.exam_id"), nullable=False)
    question = db.Column(db.Text, nullable=False)
    option1 = db.Column(db.String(300), nullable=False, default="")
    option2 = db.Column(db.String(300), nullable=False, default="")
    option3 = db.Column(db.String(300), nullable=False, default="")
    option4 = db.Column(db.String(300), nullable=False, default="")
    answer = db.Column(db.String(300), nullable=False, default="")
    # NEW fields for module support and coding questions
    question_type = db.Column(db.String(20), nullable=False, default="mcq")
    module_id = db.Column(db.String(200), nullable=True, default="")
    code_template = db.Column(db.Text, nullable=True, default="")
    language = db.Column(db.String(50), nullable=True, default="")
    test_cases = db.Column(db.Text, nullable=True, default="[]")

    student_answers = db.relationship("StudentAnswer", backref="question", lazy=True)

    def to_dict(self, include_answer=False):
        test_cases = []
        try:
            test_cases = json.loads(self.test_cases or "[]")
        except Exception:
            pass

        data = {
            "question_id": self.question_id,
            "exam_id": self.exam_id,
            "question": self.question,
            "type": self.question_type or "mcq",
            "module_id": self.module_id or "",
            "option1": self.option1,
            "option2": self.option2,
            "option3": self.option3,
            "option4": self.option4,
            "code_template": self.code_template or "",
            "language": self.language or "",
            "test_cases": test_cases,
        }
        if include_answer:
            data["answer"] = self.answer
        return data
