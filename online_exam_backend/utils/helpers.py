"""Shared utility helpers."""

import hashlib
import os
import jwt
import datetime
from functools import wraps
from flask import request, jsonify


# ── Password Hashing ───────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return hashlib.sha256(plain.encode()).hexdigest()


def verify_password(plain: str, hashed: str) -> bool:
    return hash_password(plain) == hashed


# ── JWT Tokens ─────────────────────────────────────────────────────────────────

SECRET = os.getenv("SECRET_KEY", "dev-secret-key-change-in-prod")


def generate_token(user_id: int, role: str) -> str:
    payload = {
        "user_id": user_id,
        "role": role,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=8),
    }
    return jwt.encode(payload, SECRET, algorithm="HS256")


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


# ── Auth Decorators ────────────────────────────────────────────────────────────

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]

        if not token:
            return jsonify({"success": False, "message": "Token is missing"}), 401

        payload = decode_token(token)
        if not payload:
            return jsonify({"success": False, "message": "Token is invalid or expired"}), 401

        request.user_id = payload["user_id"]
        request.user_role = payload["role"]
        return f(*args, **kwargs)

    return decorated


def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]

        if not token:
            return jsonify({"success": False, "message": "Token is missing"}), 401

        payload = decode_token(token)
        if not payload:
            return jsonify({"success": False, "message": "Token is invalid or expired"}), 401

        if payload.get("role") != "admin":
            return jsonify({"success": False, "message": "Admin access required"}), 403

        request.user_id = payload["user_id"]
        request.user_role = payload["role"]
        return f(*args, **kwargs)

    return decorated


# ── Response Builders ──────────────────────────────────────────────────────────

def success_response(data=None, message="Success", code=200):
    body = {"success": True, "message": message}
    if data is not None:
        body["data"] = data
    return jsonify(body), code


def error_response(message="Error", code=400):
    return jsonify({"success": False, "message": message}), code
