import sqlite3, os

def main():
    db_path = os.path.join(os.getcwd(), 'sales.db')
    print('db_exists:', os.path.exists(db_path))
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='audit_logs'")
    present = bool(cur.fetchone())
    print('audit_logs present:', present)
    if present:
        cur.execute("PRAGMA table_info(audit_logs)")
        cols = [c[1] for c in cur.fetchall()]
        print('columns:', cols)
    conn.close()

if __name__ == '__main__':
    main()
