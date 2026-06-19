"""
AI Proctoring Blueprint - ENHANCED with detailed reports
"""

import os
import base64
import datetime
import json
import cv2
import numpy as np
from flask import Blueprint, request, Response, current_app
from app import db
from models.ai_violation import AIViolation
from models.exam import Exam
from models.user import User
from models.exam_attempt import ExamAttempt
from ai_module.monitor import analyze_single_frame, detect_faces_in_frame
from utils.helpers import token_required, admin_required, success_response, error_response

ai_bp = Blueprint("ai", __name__, url_prefix="")


def _resolve_exam_id(value):
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        exam = Exam.query.filter_by(code=str(value).strip()).first()
        return exam.exam_id if exam else None


@ai_bp.route("/record_violation", methods=["POST"])
@token_required
def record_violation():
    data = request.get_json(silent=True) or {}

    student_id = data.get("student_id") or request.user_id
    raw_exam_id = data.get("exam_id")
    violation_type = data.get("violation_type")
    screenshot_b64 = data.get("screenshot")

    allowed_types = [
        "No Face Detected",
        "Multiple Faces Detected",
        "Candidate Absent",
        "Tab Switch",
        "Fullscreen Exit",
    ]

    if not student_id:
        return error_response("student_id is required")
    if not raw_exam_id:
        return error_response("exam_id is required")
    if violation_type not in allowed_types:
        return error_response(f"violation_type must be one of: {allowed_types}")

    exam_id = _resolve_exam_id(raw_exam_id)
    if exam_id is None:
        return error_response("Exam not found", 404)

    screenshot_path = None
    if screenshot_b64:
        screenshot_path = _save_screenshot(screenshot_b64, student_id, exam_id)

    violation = AIViolation(
        student_id=int(student_id),
        exam_id=exam_id,
        violation_type=violation_type,
        screenshot_path=screenshot_path,
        violation_time=datetime.datetime.utcnow(),
    )
    db.session.add(violation)
    db.session.commit()

    return success_response(violation.to_dict(), message="Violation recorded", code=201)


@ai_bp.route("/analyze_frame", methods=["POST"])
@token_required
def analyze_frame():
    data = request.get_json(silent=True) or {}
    student_id = data.get("student_id", request.user_id)
    raw_exam_id = data.get("exam_id")
    screenshot_b64 = data.get("screenshot")

    if not raw_exam_id:
        return error_response("exam_id is required")
    if not screenshot_b64:
        return error_response("screenshot is required")

    exam_id = _resolve_exam_id(raw_exam_id)
    if exam_id is None:
        return error_response("Exam not found", 404)

    frame = _decode_frame(screenshot_b64)
    if frame is None:
        return error_response("Unable to decode screenshot")

    # Use enhanced analysis
    analysis = analyze_single_frame(frame)
    violation_type = analysis.get("violation")

    # Map "Looking Away" to backend allowed types
    backend_violation_map = {
        "No Face Detected": "No Face Detected",
        "Multiple Faces Detected": "Multiple Faces Detected",
        "Candidate Absent": "Candidate Absent",
        "Looking Away": "No Face Detected",
        "Suspicious Movement": "No Face Detected",
    }

    response_payload = {
        "face_count": analysis.get("face_count", 0),
        "violation": violation_type,
        "confidence": analysis.get("confidence", 1.0),
        "details": analysis.get("details", []),
        "eye_count": analysis.get("eye_count", 0),
    }

    if violation_type:
        backend_type = backend_violation_map.get(violation_type, "No Face Detected")
        screenshot_path = _save_screenshot(screenshot_b64, student_id, exam_id)
        violation = AIViolation(
            student_id=int(student_id),
            exam_id=exam_id,
            violation_type=backend_type,
            screenshot_path=screenshot_path,
            violation_time=datetime.datetime.utcnow(),
        )
        db.session.add(violation)
        db.session.commit()
        response_payload["violation_recorded"] = True
        response_payload["violation_id"] = violation.violation_id
        response_payload["violation_description"] = violation_type

    return success_response(response_payload)


@ai_bp.route("/proctoring_report/<int:student_id>", methods=["GET"])
@token_required
def get_proctoring_report(student_id):
    """Get detailed proctoring report for a student."""
    if request.user_role != "admin" and request.user_id != student_id:
        return error_response("Unauthorized", 403)

    exam_identifier = request.args.get("exam_id")
    exam_id = _resolve_exam_id(exam_identifier) if exam_identifier else None

    query = AIViolation.query.filter_by(student_id=student_id)
    if exam_id:
        query = query.filter_by(exam_id=exam_id)

    violations = query.order_by(AIViolation.violation_time.asc()).all()

    # Build summary
    summary = {}
    for v in violations:
        vtype = v.violation_type
        if vtype not in summary:
            summary[vtype] = 0
        summary[vtype] += 1

    total = len(violations)
    risk_score = min(100, (
        summary.get("No Face Detected", 0) * 10 +
        summary.get("Multiple Faces Detected", 0) * 25 +
        summary.get("Candidate Absent", 0) * 20 +
        summary.get("Tab Switch", 0) * 15 +
        summary.get("Fullscreen Exit", 0) * 15
    ))

    risk_level = "Low" if risk_score < 30 else "Medium" if risk_score < 60 else "High"

    return success_response({
        "student_id": student_id,
        "total_violations": total,
        "risk_score": risk_score,
        "risk_level": risk_level,
        "summary": summary,
        "violations": [v.to_dict() for v in violations],
        "recommendation": _get_recommendation(risk_level, summary),
    })


def _get_recommendation(risk_level: str, summary: dict) -> str:
    if risk_level == "Low":
        return "Student appeared to comply with exam rules."
    elif risk_level == "Medium":
        top = max(summary, key=summary.get) if summary else ""
        return f"Review recommended — notable violations: {top}. Consider manual review of answers."
    else:
        return "High risk of academic dishonesty detected. Manual review strongly recommended. Consider invalidating this attempt."


def _save_screenshot(b64_data: str, student_id, exam_id) -> str | None:
    try:
        if "," in b64_data:
            b64_data = b64_data.split(",", 1)[1]
        img_bytes = base64.b64decode(b64_data)
        folder = current_app.config["SCREENSHOT_FOLDER"]
        os.makedirs(folder, exist_ok=True)
        timestamp = datetime.datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
        filename = f"violation_s{student_id}_eexam-{exam_id}_{timestamp}.png"
        filepath = os.path.join(folder, filename)
        with open(filepath, "wb") as f:
            f.write(img_bytes)
        return f"screenshots/{filename}"
    except Exception as exc:
        print(f"[AI] Screenshot save failed: {exc}")
        return None


def _decode_frame(b64_data: str):
    try:
        if "," in b64_data:
            b64_data = b64_data.split(",", 1)[1]
        data = base64.b64decode(b64_data)
        arr = np.frombuffer(data, np.uint8)
        frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        return frame
    except Exception as exc:
        print(f"[AI] Frame decode failed: {exc}")
        return None


@ai_bp.route("/start_ai_monitoring", methods=["GET"])
@token_required
def start_ai_monitoring():
    student_id = request.args.get("student_id", type=int) or request.user_id
    raw_exam_id = request.args.get("exam_id")

    if not raw_exam_id:
        return error_response("exam_id query parameter is required")

    exam_id = _resolve_exam_id(raw_exam_id)
    if exam_id is None:
        return error_response("Exam not found", 404)

    def event_stream():
        import time
        yield _sse_event("connected", {"student_id": student_id, "exam_id": exam_id, "message": "AI Proctoring Active"})
        counter = 0
        while True:
            time.sleep(5)
            counter += 1
            yield _sse_event("heartbeat", {"tick": counter, "monitoring": True})

    return Response(
        event_stream(),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


def _sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"
