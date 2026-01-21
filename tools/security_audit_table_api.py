
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from datetime import datetime
from database import get_db

router = APIRouter()

@router.get("/api/security-audit-table")
def get_security_audit_table(user: dict = Depends(lambda: {"username": "admin"})):
    def safe(val, default='N/A'):
        if val is None:
            return default
        if isinstance(val, str) and not val.strip():
            return default
        return val

    rows = []
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, created_at, username, action, resource_type, resource_id, method, path, ip_address, user_agent, status_code, success, details, session_token, description
                FROM audit_logs
                ORDER BY created_at DESC
                LIMIT 200
            """)
            for row in cursor.fetchall():
                status = "Success" if row.get("success") else "Failed"
                event = "Security" if row.get("action", "").lower() in ["login", "logout", "password change", "failed login"] else "Audit"
                # Try to extract publicIP from details if present
                ip_val = safe(row.get("ip_address"), '-')
                details_val = safe(row.get("details"), '-')
                public_ip = None
                try:
                    if details_val and details_val.startswith('{'):
                        import json
                        d = json.loads(details_val)
                        if isinstance(d, dict) and 'publicIP' in d and d['publicIP']:
                            public_ip = d['publicIP']
                except Exception:
                    pass
                if public_ip:
                    ip_val = public_ip
                description_val = safe(row.get("description"), '-')
                rows.append({
                    "id": row.get("id"),
                    "timestamp": safe(row.get("created_at").strftime("%Y-%m-%d %H:%M:%S") if row.get("created_at") else None),
                    "username": safe(row.get("username")),
                    "action": safe(row.get("action")),
                    "event": event,
                    "resource": safe(row.get("resource_type")),
                    "resource_id": safe(row.get("resource_id")),
                    "method": safe(row.get("method")),
                    "path": safe(row.get("path")),
                    "ip": ip_val,
                    "user_agent": safe(row.get("user_agent")),
                    "status_code": safe(row.get("status_code")),
                    "status": status,
                    "details": details_val,
                    "session_token": safe(row.get("session_token")),
                    "description": description_val
                })
        return JSONResponse({"success": True, "rows": rows})
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e), "rows": []})
