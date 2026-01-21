from fastapi import APIRouter, Request, Depends
from fastapi.responses import JSONResponse
from database import get_db
import json

router = APIRouter()

@router.post("/api/audit-system-info")
async def audit_system_info(payload: dict):
    username = payload.get("username")
    system_info = payload.get("system_info")
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO audit_logs (username, action, resource_type, details)
                VALUES (%s, %s, %s, %s)
            """, (
                username or "unknown",
                "system_info",
                "login",
                json.dumps(system_info)
            ))
            conn.commit()
        return JSONResponse({"success": True})
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)})