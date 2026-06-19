"""
Run this script to diagnose database connection issues:
    python check_db.py
"""
import os
import sys
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

def strip_quotes(v):
    if v and len(v) >= 2 and v[0] in ('"', "'") and v[-1] == v[0]:
        return v[1:-1]
    return v

host     = os.getenv("DB_HOST", "").strip()
port     = int(os.getenv("DB_PORT", "3306").strip())
user     = strip_quotes(os.getenv("DB_USER", "root").strip())
password = strip_quotes(os.getenv("DB_PASSWORD", "").strip())
db_name  = strip_quotes(os.getenv("DB_NAME", "online_exam_ai").strip())

print(f"\n=== Database Connection Check ===")
print(f"  Host    : {host or '(not set — will use SQLite)'}")
print(f"  Port    : {port}")
print(f"  User    : {user}")
print(f"  Password: {'(empty)' if not password else '(set, ' + str(len(password)) + ' chars)'}")
print(f"  DB Name : {db_name}")

if not host:
    print("\n[INFO] DB_HOST is not set. Backend will use SQLite — no MySQL needed.")
    print("       SQLite file: online_exam_ai.db  (created automatically)")
    sys.exit(0)

# Try pymysql
try:
    import pymysql
except ImportError:
    print("\n[ERROR] pymysql is not installed.")
    print("  Fix: pip install pymysql")
    sys.exit(1)

print(f"\nTrying to connect to MySQL at {host}:{port} ...")
try:
    conn = pymysql.connect(
        host=host, port=port, user=user, password=password,
        charset='utf8mb4', connect_timeout=5
    )
    print("[OK] MySQL connection successful!")
    cur = conn.cursor()
    cur.execute("SHOW DATABASES")
    dbs = [row[0] for row in cur.fetchall()]
    print(f"     Databases visible: {dbs}")
    if db_name in dbs:
        print(f"[OK] Database '{db_name}' already exists.")
    else:
        print(f"[INFO] Database '{db_name}' not found — it will be created on first run.")
    conn.close()
except pymysql.err.OperationalError as e:
    code, msg = e.args
    print(f"\n[ERROR] MySQL error {code}: {msg}")
    if code == 1045:
        print("  → Wrong username or password.")
        print(f"  → Check DB_USER and DB_PASSWORD in your .env file.")
    elif code == 2003:
        print("  → Cannot reach MySQL server.")
        print(f"  → Is MySQL running on {host}:{port}?")
    print("\n  TIP: Set DB_HOST= (empty) in .env to use SQLite instead.")
    sys.exit(1)
except Exception as e:
    print(f"\n[ERROR] Unexpected: {e}")
    sys.exit(1)
