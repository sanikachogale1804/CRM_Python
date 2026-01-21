import pymysql

# Direct MySQL credentials (from database.py)
MYSQL_HOST = "127.0.0.1"
MYSQL_PORT = 3306
MYSQL_USER = "root"
MYSQL_PASSWORD = "@Ramlakhan123"
MYSQL_DB = "crm_system"

def add_description_column():
    conn = pymysql.connect(
        host=MYSQL_HOST,
        port=MYSQL_PORT,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        database=MYSQL_DB
    )
    try:
        with conn.cursor() as cursor:
            cursor.execute("ALTER TABLE audit_logs ADD COLUMN description TEXT AFTER session_token;")
        conn.commit()
        print("✅ 'description' column added successfully.")
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    add_description_column()
