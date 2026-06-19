# Online Exam Backend — Setup Guide

## Quick Start (SQLite — no MySQL needed)

If you just want to run locally without setting up MySQL:

1. Open `.env` and set `DB_HOST=` (leave it empty):
   ```
   DB_HOST=
   ```
2. Install requirements:
   ```
   pip install -r requirements.txt
   ```
3. Run:
   ```
   python run.py
   ```
   The backend creates `online_exam_ai.db` automatically.

---

## MySQL Setup

1. Make sure MySQL is running on your machine.
2. Edit `.env`:
   ```
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_actual_password_no_quotes
   DB_NAME=online_exam_ai
   ```
   > **Important:** Do NOT put quotes around the password value.

3. Check the connection first:
   ```
   python check_db.py
   ```
4. Run:
   ```
   python run.py
   ```

---

## Common Errors

### "Failed to fetch" in the browser
- The backend is not running. Check the terminal for errors.
- Run `python check_db.py` to diagnose the database connection.
- If MySQL fails, set `DB_HOST=` in `.env` to switch to SQLite.

### MySQL: Access denied (error 1045)
- Your password in `.env` is wrong, or has extra quotes.
- Make sure `DB_PASSWORD=yourpassword` (no quotes around it).

### "No module named pymysql"
- Run: `pip install pymysql`

---

## Default Credentials

| Role  | Email                | Password  |
|-------|----------------------|-----------|
| Admin | admin123@gmail.com   | admin123  |
| Demo student | john@example.com | john1234 |

Demo exam code: `EXAM-001`
