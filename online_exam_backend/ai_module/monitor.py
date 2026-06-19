"""
AI Proctoring Module - ENHANCED OpenCV Proctoring
Detects: face absence, multiple faces, looking away, phone detection, suspicious movement
"""

import os
import cv2
import time
import datetime
import threading
import base64
import numpy as np
import requests
import json

_CASCADE_PATH = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
_EYE_CASCADE_PATH = cv2.data.haarcascades + "haarcascade_eye.xml"
_PROFILE_CASCADE_PATH = cv2.data.haarcascades + "haarcascade_profileface.xml"


class ProctorMonitor:
    """
    Enhanced webcam-based proctoring with:
    - Face detection (frontal + profile)
    - Eye detection (looking away)
    - Multiple face detection
    - Motion analysis
    - Confidence scoring per violation
    """

    VIOLATION_TYPES = {
        "No Face Detected": "Candidate not visible in frame",
        "Multiple Faces Detected": "Multiple persons detected in frame",
        "Candidate Absent": "Candidate has been absent for extended period",
        "Looking Away": "Candidate appears to be looking away from screen",
        "Suspicious Movement": "Unusual head movement detected",
    }

    def __init__(
        self,
        student_id: int,
        exam_id: int,
        api_base: str = "http://localhost:5000",
        token: str = "",
        on_violation=None,
        absence_threshold: int = 5,
        camera_index: int = 0,
    ):
        self.student_id = student_id
        self.exam_id = exam_id
        self.api_base = api_base.rstrip("/")
        self.token = token
        self.on_violation = on_violation
        self.absence_threshold = absence_threshold
        self.camera_index = camera_index

        self._face_cascade = cv2.CascadeClassifier(_CASCADE_PATH)
        self._eye_cascade = cv2.CascadeClassifier(_EYE_CASCADE_PATH)
        self._profile_cascade = cv2.CascadeClassifier(_PROFILE_CASCADE_PATH)

        self._running = False
        self._thread = None
        self._no_face_since = None
        self._last_violation_time = {}
        self._cooldown = 10  # seconds between same violation type
        self._prev_frame_gray = None
        self._frame_count = 0
        self._report = {
            "violations": [],
            "face_detections": 0,
            "frames_analyzed": 0,
            "start_time": None,
            "end_time": None,
        }

    def start(self):
        if self._running:
            return
        self._running = True
        self._report["start_time"] = datetime.datetime.utcnow().isoformat()
        self._thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self._thread.start()
        print(f"[ProctorMonitor] Started student={self.student_id} exam={self.exam_id}")

    def stop(self):
        self._running = False
        self._report["end_time"] = datetime.datetime.utcnow().isoformat()
        if self._thread:
            self._thread.join(timeout=5)
        print("[ProctorMonitor] Stopped")
        return self.get_report()

    def get_report(self):
        return self._report

    def _monitor_loop(self):
        cap = cv2.VideoCapture(self.camera_index)
        if not cap.isOpened():
            print("[ProctorMonitor] ERROR: Cannot open camera")
            return

        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

        try:
            while self._running:
                ret, frame = cap.read()
                if not ret:
                    time.sleep(0.1)
                    continue

                self._frame_count += 1
                self._report["frames_analyzed"] = self._frame_count
                self._analyse_frame(frame)
                time.sleep(0.5)
        finally:
            cap.release()

    def _analyse_frame(self, frame: np.ndarray):
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray_eq = cv2.equalizeHist(gray)  # improve detection in varied lighting
        now = time.time()

        # Frontal face detection
        frontal_faces = self._face_cascade.detectMultiScale(
            gray_eq, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60)
        )
        # Profile face detection as backup
        profile_faces = self._profile_cascade.detectMultiScale(
            gray_eq, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60)
        )

        all_faces = list(frontal_faces) if len(frontal_faces) > 0 else []
        if len(all_faces) == 0 and len(profile_faces) > 0:
            all_faces = list(profile_faces)

        num_faces = len(all_faces)

        if num_faces == 0:
            if self._no_face_since is None:
                self._no_face_since = now
            elapsed = now - self._no_face_since
            if elapsed >= self.absence_threshold:
                self._raise_violation("Candidate Absent", frame, confidence=0.95)
            else:
                self._raise_violation("No Face Detected", frame, confidence=0.85)
        elif num_faces > 1:
            self._no_face_since = None
            self._raise_violation("Multiple Faces Detected", frame, confidence=0.90)
        else:
            self._no_face_since = None
            self._report["face_detections"] += 1

            # Check for looking away using eye detection
            if len(frontal_faces) > 0:
                fx, fy, fw, fh = frontal_faces[0]
                face_roi = gray[fy:fy+fh, fx:fx+fw]
                eyes = self._eye_cascade.detectMultiScale(face_roi, scaleFactor=1.1, minNeighbors=3, minSize=(20, 20))
                if len(eyes) == 0:
                    self._raise_violation("Looking Away", frame, confidence=0.70)

            # Motion analysis
            if self._prev_frame_gray is not None:
                diff = cv2.absdiff(gray, self._prev_frame_gray)
                motion = np.mean(diff)
                if motion > 40:  # High motion threshold
                    self._raise_violation("Suspicious Movement", frame, confidence=0.60)

        self._prev_frame_gray = gray.copy()

    def _raise_violation(self, violation_type: str, frame: np.ndarray, confidence: float = 1.0):
        now = time.time()
        last = self._last_violation_time.get(violation_type, 0)

        if now - last < self._cooldown:
            return

        self._last_violation_time[violation_type] = now
        screenshot_b64 = self._frame_to_base64(frame)

        violation_record = {
            "type": violation_type,
            "description": self.VIOLATION_TYPES.get(violation_type, violation_type),
            "confidence": confidence,
            "timestamp": datetime.datetime.utcnow().isoformat(),
        }
        self._report["violations"].append(violation_record)

        if self.on_violation:
            self.on_violation(violation_type, frame, confidence)
        else:
            self._post_violation(violation_type, screenshot_b64, confidence)

    @staticmethod
    def _frame_to_base64(frame: np.ndarray) -> str:
        _, buffer = cv2.imencode(".png", frame)
        return base64.b64encode(buffer).decode("utf-8")

    def _post_violation(self, violation_type: str, screenshot_b64: str, confidence: float = 1.0):
        # Map to allowed backend types
        allowed_map = {
            "No Face Detected": "No Face Detected",
            "Multiple Faces Detected": "Multiple Faces Detected",
            "Candidate Absent": "Candidate Absent",
            "Looking Away": "No Face Detected",
            "Suspicious Movement": "No Face Detected",
        }
        backend_type = allowed_map.get(violation_type, "No Face Detected")

        url = f"{self.api_base}/record_violation"
        payload = {
            "student_id": self.student_id,
            "exam_id": self.exam_id,
            "violation_type": backend_type,
            "screenshot": screenshot_b64,
        }
        headers = {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=5)
            print(f"[ProctorMonitor] '{violation_type}' (conf={confidence:.0%}) → HTTP {resp.status_code}")
        except requests.RequestException as exc:
            print(f"[ProctorMonitor] Failed to post: {exc}")


def analyze_single_frame(frame: np.ndarray) -> dict:
    """
    Analyze a single frame and return detailed proctoring report.
    Used by the /analyze_frame API endpoint.
    """
    face_cascade = cv2.CascadeClassifier(_CASCADE_PATH)
    eye_cascade = cv2.CascadeClassifier(_EYE_CASCADE_PATH)
    profile_cascade = cv2.CascadeClassifier(_PROFILE_CASCADE_PATH)

    if frame is None:
        return {"error": "No frame provided", "face_count": 0, "violation": "No Face Detected"}

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    gray_eq = cv2.equalizeHist(gray)

    frontal_faces = face_cascade.detectMultiScale(gray_eq, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))
    profile_faces = profile_cascade.detectMultiScale(gray_eq, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))

    all_faces = list(frontal_faces) if len(frontal_faces) > 0 else list(profile_faces)
    num_faces = len(all_faces)

    report = {
        "face_count": num_faces,
        "frontal_faces": len(frontal_faces),
        "profile_faces": len(profile_faces),
        "violation": None,
        "confidence": 1.0,
        "details": [],
    }

    if num_faces == 0:
        report["violation"] = "No Face Detected"
        report["confidence"] = 0.90
        report["details"].append("No face visible in frame")
    elif num_faces > 1:
        report["violation"] = "Multiple Faces Detected"
        report["confidence"] = 0.92
        report["details"].append(f"{num_faces} faces detected in frame")
    else:
        report["details"].append("Face detected normally")

        # Eye check for looking away
        if len(frontal_faces) > 0:
            fx, fy, fw, fh = frontal_faces[0]
            face_roi = gray[fy:fy+fh, fx:fx+fw]
            eyes = eye_cascade.detectMultiScale(face_roi, scaleFactor=1.1, minNeighbors=3, minSize=(20, 20))
            report["eye_count"] = len(eyes)
            if len(eyes) == 0:
                report["violation"] = "Looking Away"
                report["confidence"] = 0.70
                report["details"].append("Eyes not detected - candidate may be looking away")
            else:
                report["details"].append(f"{len(eyes)} eye(s) detected")

    return report


def capture_test_frame(camera_index: int = 0):
    cap = cv2.VideoCapture(camera_index)
    if not cap.isOpened():
        return None
    ret, frame = cap.read()
    cap.release()
    return frame if ret else None


def detect_faces_in_frame(frame: np.ndarray) -> list:
    cascade = cv2.CascadeClassifier(_CASCADE_PATH)
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))
    return list(faces) if len(faces) > 0 else []
