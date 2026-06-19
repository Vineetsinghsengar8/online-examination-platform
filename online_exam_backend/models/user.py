from app import db


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password = db.Column(db.String(256), nullable=False)
    role = db.Column(db.Enum("student", "admin"), nullable=False, default="student")
    exam_id = db.Column(db.Integer, db.ForeignKey("exams.exam_id"), nullable=True)

    # Relationships
    exam = db.relationship("Exam", backref="students", lazy=True)
    attempts = db.relationship("ExamAttempt", backref="student", lazy=True)
    results = db.relationship("Result", backref="student", lazy=True)
    violations = db.relationship("AIViolation", backref="student", lazy=True)

    def to_dict(self, include_password=False):
        data = {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "role": self.role,
        }
        if self.exam_id is not None:
            data["exam_id"] = self.exam_id
            data["exam_code"] = self.exam.code if self.exam else None
        if include_password:
            data["password"] = self.password
        return data
