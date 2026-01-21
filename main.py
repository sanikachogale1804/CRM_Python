
# ...existing code...
# Add at the top with other FastAPI imports
from fastapi import Query
# --- Lead Report Upload/Download/Delete ---
def register_lead_report_routes(app):
    import uuid
    from fastapi import Request, UploadFile, File, Depends, HTTPException, Form
    from fastapi.responses import FileResponse
    from pathlib import Path
    from database import get_connection

    REPORTS_DIR = Path("uploads/reports")
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    @app.post("/api/lead-report/upload/{lead_id}")
    async def upload_lead_report(lead_id: str, request: Request, file: UploadFile = File(...), name: str = Form(...), description: str = Form(...), user: dict = Depends(get_current_user)):
        if not check_user_permission(user, 'can_edit_leads'):
            raise HTTPException(status_code=403, detail="No permission to upload report.")
        if not file.filename.lower().endswith('.pdf') or file.content_type != 'application/pdf':
            raise HTTPException(status_code=400, detail="Only PDF files are allowed.")
        report_id = str(uuid.uuid4())
        ext = Path(file.filename).suffix
        safe_name = f"{report_id}{ext}"
        lead_folder = REPORTS_DIR / lead_id
        lead_folder.mkdir(parents=True, exist_ok=True)
        file_path = lead_folder / safe_name
        with open(file_path, "wb") as f:
            f.write(await file.read())
        conn = get_connection()
        with conn.cursor() as cursor:
            cursor.execute(
                "INSERT INTO lead_reports (id, lead_id, name, description, filename, uploaded_at, uploaded_by) VALUES (%s, %s, %s, %s, %s, NOW(), %s)",
                (report_id, lead_id, name, description, safe_name, user.get('username', 'Unknown'))
            )
        conn.commit()
        conn.close()
        return {"success": True}

    @app.get("/api/lead-report/list/{lead_id}")
    async def list_lead_reports(lead_id: str, user: dict = Depends(get_current_user)):
        if not check_user_permission(user, 'can_view_leads'):
            raise HTTPException(status_code=403, detail="No permission to view reports.")
        conn = get_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM lead_reports WHERE lead_id = %s ORDER BY uploaded_at DESC", (lead_id,))
            rows = cursor.fetchall()
        conn.close()
        return [{"id": r["id"], "name": r["name"], "description": r["description"], "filename": r["filename"], "uploaded_at": r["uploaded_at"].strftime('%Y-%m-%d %H:%M'), "uploaded_by": r["uploaded_by"]} for r in rows]

    @app.get("/api/lead-report/download/{report_id}")
    async def download_lead_report(report_id: str, format: str = Query("original"), user: dict = Depends(get_current_user)):
        if not check_user_permission(user, 'can_view_leads'):
            raise HTTPException(status_code=403, detail="No permission to download report.")
        conn = get_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM lead_reports WHERE id = %s", (report_id,))
            row = cursor.fetchone()
        conn.close()
        if not row:
            raise HTTPException(status_code=404, detail="Report not found.")
        file_path = REPORTS_DIR / row["lead_id"] / row["filename"]
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found.")

        ext = file_path.suffix.lower()
        if ext != ".pdf":
            raise HTTPException(status_code=400, detail="Only PDF files are available for download.")
        return FileResponse(str(file_path), filename=row["name"], media_type="application/pdf")

    @app.delete("/api/lead-report/delete/{report_id}")
    async def delete_lead_report(report_id: str, user: dict = Depends(get_current_user)):
        if not check_user_permission(user, 'can_edit_leads'):
            raise HTTPException(status_code=403, detail="No permission to delete report.")
        conn = get_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM lead_reports WHERE id = %s", (report_id,))
            row = cursor.fetchone()
            if not row:
                conn.close()
                raise HTTPException(status_code=404, detail="Report not found.")
            file_path = REPORTS_DIR / row["lead_id"] / row["filename"]
            if file_path.exists():
                file_path.unlink()
            cursor.execute("DELETE FROM lead_reports WHERE id = %s", (report_id,))
        conn.commit()
        conn.close()
        return {"success": True}



# Mount Security & Audit Table API (move after app creation)
from fastapi import FastAPI, HTTPException, Depends, status, Request, Response, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import hashlib
from datetime import datetime, date, timedelta, timezone
import os
import json
from enum import Enum
from contextlib import contextmanager
import secrets
import shutil
import uuid

# Import MySQL database module
from database import get_db, test_connection

# Mount Security & Audit Table API only


app = FastAPI(title="Smart CRM System")
from tools.security_audit_table_api import router as security_audit_table_router
app.include_router(security_audit_table_router)
from tools.audit_system_info_api import router as audit_system_info_router
app.include_router(audit_system_info_router)

# API endpoint to receive user activity logs from frontend
from fastapi import Body
@app.post("/api/audit-log")
async def api_audit_log(request: Request, payload: dict = Body(...)):
    """
    Receives user activity logs from frontend and stores in audit_logs table.
    Expects: { action: str, details: dict, path: str, timestamp: str, resource: str, description: str }
    """
    session_token = request.cookies.get("session_token")
    user_id = None
    username = None
    if session_token:
        session_data = None
        try:
            session_data = validate_session_token(session_token)
        except Exception:
            pass
        if session_data:
            user_id = session_data.get("user_id")
            username = session_data.get("username")

    action = payload.get("action")
    details = payload.get("details", {})
    path = payload.get("path")
    timestamp = payload.get("timestamp")
    resource = payload.get("resource") or details.get("resource") or '-'
    description = payload.get("description") or details.get("description") or '-'

    # Use log_user_activity to persist
    try:
        log_user_activity(
            request=request,
            user_id=user_id,
            username=username,
            action=action,
            resource_type=resource,
            resource_id=None,
            success=True,
            status_code=200,
            details=json.dumps(details),
            session_token=session_token,
            description=description,
        )
        return {"success": True}
    except Exception as e:
        print("Audit log error:", e)
        return {"success": False, "error": str(e)}

# Exception handler for HTTPException - only for API routes
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    # Only redirect for API calls that require auth
    if exc.status_code == 401 and "api" in request.url.path:
        return JSONResponse(
            status_code=401,
            content={"detail": exc.detail}
        )
    elif exc.status_code == 403:
        # Return forbidden as JSON for API, otherwise let it raise
        if "api" in request.url.path:
            return JSONResponse(
                status_code=403,
                content={"detail": exc.detail}
            )
    
    # Re-raise for HTML pages to handle normally
    raise exc

# Enable CORS for all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("templates", exist_ok=True)
os.makedirs("static", exist_ok=True)

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# Add current date to template context
@app.middleware("http")
async def add_date_to_context(request: Request, call_next):
    response = await call_next(request)
    return response

# Session management
sessions = {}
SESSION_TIMEOUT = 3600  # 1 hour in seconds

# MySQL ke liye get_db_connection wrapper
def get_db_connection():
    """MySQL database connection return karta hai"""
    return get_db()

def dict_cursor(cursor):
    """MySQL cursor ko dict-like results return karwane ke liye helper"""
    columns = [col[0] for col in cursor.description] if cursor.description else []
    
    def fetchall_dict():
        rows = cursor.fetchall()
        return [dict(zip(columns, row)) for row in rows] if rows else []
    
    def fetchone_dict():
        row = cursor.fetchone()
        return dict(zip(columns, row)) if row else None
    
    cursor.fetchall_dict = fetchall_dict
    cursor.fetchone_dict = fetchone_dict
    return cursor

class UserRole(str, Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    SALES = "sales"
    VIEWER = "viewer"

class UserPermissions(BaseModel):
    can_view_leads: bool = True
    can_create_leads: bool = True
    can_edit_leads: bool = True
    can_delete_leads: bool = False
    can_view_users: bool = False
    can_manage_users: bool = False
    can_view_reports: bool = True
    can_export_data: bool = True

class UserCreate(BaseModel):
    username: str
    password: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    full_name: str
    email: str
    designation: Optional[str] = None
    mobile_no: Optional[str] = None
    date_of_birth: Optional[date] = None
    photo: Optional[str] = None
    role: UserRole = UserRole.SALES
    permissions: Optional[Dict[str, bool]] = None

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[UserRole] = None
    permissions: Optional[Dict[str, bool]] = None
    is_active: Optional[bool] = None

class LoginRequest(BaseModel):
    username: str
    password: str

class LeadCreate(BaseModel):
    lead_date: str
    lead_source: str
    lead_type: str
    lead_status: Optional[str] = None
    method_of_communication: Optional[str] = None
    lead_owner: Optional[str] = None
    assigned_to: Optional[int] = None
    staff_location: Optional[str] = None
    designation: str
    company_name: str
    industry_type: str
    system: str
    project_amc: str
    state: str
    district: str
    city: str
    pin_code: str
    full_address: str
    company_website: Optional[str] = None
    company_linkedin_link: Optional[str] = None
    sub_industry: Optional[str] = None
    gstin: Optional[str] = None
    customer_name: str
    contact_no: str
    email_id: str
    linkedin_profile: Optional[str] = None
    designation_customer: Optional[str] = None
    margin_percent: Optional[float] = None
    gross_margin_amount: Optional[float] = None
    net_margin_amount: Optional[float] = None
    received_amount: Optional[float] = None
    balance_amount: Optional[float] = None
    lead_closer_date: Optional[str] = None  # ISO date string
    expected_lead_closer_month: Optional[str] = None

class LeadUpdate(BaseModel):
    lead_type: Optional[str] = None
    lead_owner: Optional[str] = None
    assigned_to: Optional[int] = None
    designation: Optional[str] = None
    company_name: Optional[str] = None
    industry_type: Optional[str] = None
    sub_industry: Optional[str] = None
    system: Optional[str] = None
    project_amc: Optional[str] = None
    company_website: Optional[str] = None
    company_linkedin_profile: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    city: Optional[str] = None
    pin_code: Optional[str] = None
    full_address: Optional[str] = None
    customer_name: Optional[str] = None
    contact_no: Optional[str] = None
    email_id: Optional[str] = None
    linkedin_profile: Optional[str] = None
    designation_customer: Optional[str] = None
    method_of_communication: Optional[str] = None
    lead_status: Optional[str] = None
    purpose_of_meeting: Optional[str] = None
    meeting_outcome: Optional[str] = None
    discussion_held: Optional[str] = None
    remarks: Optional[str] = None
    next_follow_up_date: Optional[str] = None
    prospect: Optional[str] = None
    approx_value: Optional[float] = None
    negotiated_value: Optional[float] = None
    closing_amount: Optional[float] = None
    gstin: Optional[str] = None
    lead_percentage: Optional[int] = None
    margin_percent: Optional[float] = None
    gross_margin_amount: Optional[float] = None
    net_margin_amount: Optional[float] = None
    received_amount: Optional[float] = None
    balance_amount: Optional[float] = None
    lead_closer_date: Optional[str] = None
    expected_lead_closer_month: Optional[str] = None

# Helper functions
def generate_session_token():
    return secrets.token_urlsafe(32)

def create_session(user_id: int, username: str, role: str, permissions: Dict):
    session_token = generate_session_token()
    session_data = {
        "user_id": user_id,
        "username": username,
        "role": role,
        "permissions": permissions,
        "created_at": datetime.now(),
        "last_activity": datetime.now()
    }
    sessions[session_token] = session_data
    return session_token

def validate_session_token(session_token: str) -> Optional[Dict]:
    if session_token not in sessions:
        return None
    
    session_data = sessions[session_token]
    
    # Check session timeout
    last_activity = session_data["last_activity"]
    if (datetime.now() - last_activity).seconds > SESSION_TIMEOUT:
        del sessions[session_token]
        return None
    
    # Update last activity
    session_data["last_activity"] = datetime.now()
    sessions[session_token] = session_data
    
    return session_data

def logout_session(session_token: str):
    if session_token in sessions:
        del sessions[session_token]
    return True

def log_user_activity(
    request: Optional[Request],
    user_id: Optional[int],
    username: Optional[str],
    action: str,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    success: bool = True,
    status_code: Optional[int] = None,
    details: Optional[str] = None,
    session_token: Optional[str] = None,
    description: Optional[str] = None,
):
    """Persist a user activity audit record.

    Parameters:
    - request: FastAPI Request to capture path, method, IP, UA (optional)
    - user_id/username: actor identifiers (nullable for unauthenticated events)
    - action: verb like 'login', 'logout', 'create', 'update', 'delete', 'view'
    - resource_type/resource_id: target of the action, e.g., 'lead', 'user'
    - success/status_code: outcome details
    - details: short free-text/context payload
    - session_token: current session id if available
    """

    path = None
    method = None
    ip_address = None
    user_agent = None

    try:
        if request is not None:
            path = str(request.url.path)
            method = request.method
            # Best-effort IP capture
            ip_address = request.headers.get("x-forwarded-for") or request.client.host if request.client else None
            user_agent = request.headers.get("user-agent")
    except Exception:
        # Avoid blocking core flows due to audit capture errors
        pass


    def safe(val, default='N/A', int_field=False):
        if int_field:
            if val is None or val == '' or (isinstance(val, str) and not val.isdigit()):
                return None
            return int(val)
        if val is None:
            return default
        if isinstance(val, str) and not val.strip():
            return default
        return val

    # Defensive: description
    description = description or '-'
    if not description or (isinstance(description, str) and not description.strip()):
        description = '-'
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            '''
            INSERT INTO audit_logs (
                user_id,
                username,
                action,
                resource_type,
                resource_id,
                method,
                path,
                ip_address,
                user_agent,
                status_code,
                success,
                details,
                session_token,
                description
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ''', (
                safe(user_id, None, int_field=True),
                safe(username, '-'),
                safe(action, '-'),
                safe(resource_type, '-'),
                safe(resource_id, '-'),
                safe(method, '-'),
                safe(path, '-'),
                safe(ip_address, '-'),
                safe(user_agent, '-'),
                safe(status_code, '-'),
                1 if success else 0,
                safe(details, '-'),
                safe(session_token, '-'),
                safe(description, '-')
            )
        )
        conn.commit()

def generate_lead_id():
    """Generate unique lead ID using preferences (prefix + sequential numbers)"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Get preferences from settings
        cursor.execute("SELECT setting_data FROM lead_settings WHERE setting_type = 'preferences'")
        prefs_row = cursor.fetchone()
        
        prefix = 'CS'
        start_number = 1000000001
        
        if prefs_row:
            try:
                prefs = json.loads(prefs_row['setting_data'])
                prefix = prefs.get('leadIdPrefix', 'CS').strip() or 'CS'
                start_number = int(prefs.get('leadIdStart', 1000000001))
            except (json.JSONDecodeError, ValueError, TypeError):
                pass
        
        # Get last lead ID
        cursor.execute("SELECT lead_id FROM leads ORDER BY id DESC LIMIT 1")
        last_lead = cursor.fetchone()
        
        if last_lead:
            try:
                # Extract number part after prefix
                last_id = last_lead['lead_id']
                # Find where the prefix ends and numbers begin
                num_part = last_id[len(prefix):] if last_id.startswith(prefix) else last_id
                last_number = int(num_part)
                new_number = last_number + 1
            except (ValueError, KeyError, TypeError, IndexError):
                new_number = start_number
        else:
            new_number = start_number
        
        lead_id = f"{prefix}{new_number:010d}"
        return lead_id

def get_preferences():
    """Get system preferences from database with fallback defaults"""
    defaults = {
        'leadIdPrefix': 'CS',
        'leadIdStart': 1000000001,
        'followUpDays': 7,
        'agingAlertDays': 30,
        'emailNotifications': True,
        'dailyDigest': True,
        'defaultPageSize': 20,
        'autoLeadPercentage': False
    }
    
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT setting_data FROM lead_settings WHERE setting_type = 'preferences'")
            prefs_row = cursor.fetchone()
            
            if prefs_row:
                prefs = json.loads(prefs_row['setting_data'])
                # Merge with defaults (user settings override defaults)
                return {**defaults, **prefs}
    except Exception:
        pass
    
    return defaults

def get_status_percentages():
    """Get status-to-percentage mappings from database
    FRESH DATA FETCH - No caching to ensure latest config is always used
    """
    try:
        # Always fresh from database - no caching
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT setting_data FROM lead_settings WHERE setting_type = 'status_percentages'")
            row = cursor.fetchone()
            
            if row and row['setting_data']:
                data = json.loads(row['setting_data'])
                # Ensure it's a dictionary
                if isinstance(data, dict) and data:
                    return data
    except Exception as e:
        # Log but don't block
        print(f"⚠️ Error fetching status percentages: {e}")
    
    # Return empty dict (no fallback - force explicit config)
    return {}

def calculate_lead_percentage(lead_status: str) -> int:
    """Calculate lead percentage based on status from configured mappings
    IMPORTANT: This uses CURRENT database config, not defaults
    If status not configured, returns 0 (not old default)
    """
    # Fresh fetch every time to avoid stale data
    mappings = get_status_percentages()
    
    if lead_status and lead_status in mappings:
        try:
            return int(mappings[lead_status])
        except (ValueError, TypeError):
            pass
    
    # IMPORTANT: No fallback defaults - if not configured, return 0
    # This forces users to explicitly configure statuses
    # Old default mappings removed to prevent confusion
    return 0

import hashlib
import secrets
from datetime import datetime, timedelta

def hash_password(password: str) -> str:
    """Hash password using SHA-256"""
    return hashlib.sha256(password.encode()).hexdigest()

def seed_permissions(cursor):
    """Seed hierarchical permissions into database"""
    permissions = []
    
    # Helper to add permission
    def add_perm(key, name, parent_id, category, level, desc=""):
        cursor.execute('''
        INSERT INTO permissions (permission_key, permission_name, parent_id, category, level, description)
        VALUES (%s, %s, %s, %s, %s, %s)
        ''', (key, name, parent_id, category, level, desc))
        return cursor.lastrowid
    
    # ROOT LEVEL - Pages (Level 0)
    dashboard_id = add_perm("dashboard", "Dashboard", None, "page", 0, "Access to dashboard page")
    leads_id = add_perm("leads", "Leads", None, "page", 0, "Access to leads page")
    add_lead_id = add_perm("add_lead", "Add Lead", None, "page", 0, "Access to add lead page")
    target_id = add_perm("target_management", "Target Management", None, "page", 0, "Access to target management")
    settings_id = add_perm("lead_settings", "Lead Settings", None, "page", 0, "Access to lead settings")
    users_id = add_perm("users", "Users", None, "page", 0, "Access to users management")
    control_id = add_perm("control_panel", "Control Panel", None, "page", 0, "Access to control panel")
    
    # DASHBOARD - Level 1 & 2
    dash_kpis_id = add_perm("dashboard.view_kpis", "View KPIs", dashboard_id, "feature", 1, "View all KPIs")
    add_perm("dashboard.kpi.total_leads", "Total Leads KPI", dash_kpis_id, "kpi", 2)
    add_perm("dashboard.kpi.qualified_leads", "Qualified Leads KPI", dash_kpis_id, "kpi", 2)
    add_perm("dashboard.kpi.won_deals", "Won Deals KPI", dash_kpis_id, "kpi", 2)
    add_perm("dashboard.kpi.total_revenue", "Total Revenue KPI", dash_kpis_id, "kpi", 2)
    add_perm("dashboard.kpi.avg_lead_value", "Avg Lead Value KPI", dash_kpis_id, "kpi", 2)
    add_perm("dashboard.kpi.conversion_rate", "Conversion Rate KPI", dash_kpis_id, "kpi", 2)
    
    dash_charts_id = add_perm("dashboard.view_charts", "View Charts", dashboard_id, "feature", 1, "View all charts")
    add_perm("dashboard.chart.revenue", "Revenue Chart", dash_charts_id, "chart", 2)
    add_perm("dashboard.chart.lead_source", "Lead Source Chart", dash_charts_id, "chart", 2)
    add_perm("dashboard.chart.monthly_trend", "Monthly Trend Chart", dash_charts_id, "chart", 2)
    add_perm("dashboard.chart.status_distribution", "Status Distribution Chart", dash_charts_id, "chart", 2)
    
    # LEADS PAGE - Level 1 & 2
    add_perm("leads.view_table", "View Leads Table", leads_id, "feature", 1, "View leads table")
    
    leads_actions_id = add_perm("leads.actions", "Lead Actions", leads_id, "feature", 1, "Perform actions on leads")
    add_perm("leads.action.add", "Add Lead", leads_actions_id, "action", 2)
    add_perm("leads.action.edit", "Edit Lead", leads_actions_id, "action", 2)
    add_perm("leads.action.delete", "Delete Lead", leads_actions_id, "action", 2)
    add_perm("leads.action.export", "Export Leads", leads_actions_id, "action", 2)
    add_perm("leads.action.bulk", "Bulk Operations", leads_actions_id, "action", 2)
    
    # LEADS - Table Columns
    leads_cols_id = add_perm("leads.table_columns", "Table Columns", leads_id, "feature", 1, "View table columns")
    columns = [
        "lead_id", "lead_date", "company_name", "customer_name", "contact_no", "email_id",
        "lead_source", "lead_type", "lead_status", "lead_owner", "assigned_to", "industry_type",
        "state", "city", "method_of_communication", "next_follow_up_date", "prospect",
        "purpose_of_meeting", "approx_value", "negotiated_value", "closing_amount",
        "lead_percentage", "lead_aging", "meeting_outcome", "discussion_held", "remarks"
    ]
    for col in columns:
        add_perm(f"leads.column.{col}", f"{col.replace('_', ' ').title()} Column", leads_cols_id, "column", 2)
    
    # LEADS - View Fields
    leads_view_id = add_perm("leads.fields_view", "View Lead Fields", leads_id, "feature", 1, "View lead field values")
    fields = [
        "lead_id", "lead_date", "lead_source", "lead_type", "lead_owner", "designation",
        "company_name", "industry_type", "system", "project_amc", "state", "district",
        "city", "pin_code", "full_address", "company_website", "company_linkedin_link",
        "sub_industry", "gstin", "customer_name", "contact_no", "email_id", "linkedin_profile",
        "designation_customer", "method_of_communication", "lead_status", "purpose_of_meeting",
        "meeting_outcome", "discussion_held", "remarks", "next_follow_up_date", "prospect",
        "approx_value", "negotiated_value", "closing_amount", "lead_aging", "lead_percentage",
        "created_by", "assigned_to", "created_at", "updated_at"
    ]
    for field in fields:
        add_perm(f"leads.field.view.{field}", f"View {field.replace('_', ' ').title()}", leads_view_id, "field", 2)
    
    # LEADS - Edit Fields
    leads_edit_id = add_perm("leads.fields_edit", "Edit Lead Fields", leads_id, "feature", 1, "Edit lead field values")
    for field in fields:
        add_perm(f"leads.field.edit.{field}", f"Edit {field.replace('_', ' ').title()}", leads_edit_id, "field", 2)
    
    # ADD LEAD PAGE
    add_lead_view_id = add_perm("add_lead.view_form", "View Add Lead Form", add_lead_id, "feature", 1)
    add_lead_fields_id = add_perm("add_lead.fields", "Add Lead Form Fields", add_lead_id, "feature", 1)
    for field in fields[:35]:  # Most relevant fields for adding
        add_perm(f"add_lead.field.{field}", f"{field.replace('_', ' ').title()} Field", add_lead_fields_id, "field", 2)
    add_perm("add_lead.action.submit", "Submit New Lead", add_lead_id, "action", 1)
    
    # TARGET MANAGEMENT
    add_perm("target_management.view_page", "View Targets", target_id, "feature", 1)
    add_perm("target_management.action.add", "Add Target", target_id, "action", 1)
    add_perm("target_management.action.edit", "Edit Target", target_id, "action", 1)
    add_perm("target_management.action.delete", "Delete Target", target_id, "action", 1)
    
    # LEAD SETTINGS
    settings_view_id = add_perm("lead_settings.view_page", "View Settings", settings_id, "feature", 1)
    settings_tabs_id = add_perm("lead_settings.tabs", "Settings Tabs", settings_id, "feature", 1)
    tabs = [
        "status", "source", "type", "industry", "communication_method", "sub_industry",
        "designation", "system", "project_amc", "state", "district", "prospect", "purpose_of_meeting"
    ]
    for tab in tabs:
        add_perm(f"lead_settings.tab.{tab}", f"{tab.replace('_', ' ').title()} Tab", settings_tabs_id, "tab", 2)
    add_perm("lead_settings.action.edit", "Edit Settings", settings_id, "action", 1)
    
    # USERS MANAGEMENT
    add_perm("users.view_page", "View Users", users_id, "feature", 1)
    add_perm("users.action.add", "Add User", users_id, "action", 1)
    add_perm("users.action.edit", "Edit User", users_id, "action", 1)
    add_perm("users.action.delete", "Delete User", users_id, "action", 1)
    add_perm("users.manage_permissions", "Manage User Permissions", users_id, "action", 1, "Access permission management")
    
    # CONTROL PANEL
    add_perm("control_panel.view_page", "View Control Panel", control_id, "feature", 1)
    add_perm("control_panel.backup", "Database Backup", control_id, "action", 1)
    add_perm("control_panel.audit_logs", "View Audit Logs", control_id, "feature", 1)
    
    cursor.execute('SELECT COUNT(*) as count FROM permissions')
    perm_count_result = cursor.fetchone()
    perm_count = perm_count_result['count'] if perm_count_result else 0
    print(f"✅ {perm_count} permissions seeded!")

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def init_database():
    """Initialize MySQL database with tables"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        # Create tables with MySQL syntax
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS lead_reports (
            id VARCHAR(64) PRIMARY KEY,
            lead_id VARCHAR(64),
            name VARCHAR(255),
            description TEXT,
            filename VARCHAR(255),
            uploaded_at DATETIME,
            uploaded_by VARCHAR(128)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ''')
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS designations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            first_name VARCHAR(255),
            last_name VARCHAR(255),
            full_name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL,
            designation VARCHAR(255),
            mobile_no VARCHAR(50),
            date_of_birth DATE,
            photo TEXT,
            role VARCHAR(50) NOT NULL,
            permissions TEXT,
            is_active TINYINT(1) DEFAULT 1,
            created_by INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP NULL
        )
        ''')
        
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS leads (
            id INT AUTO_INCREMENT PRIMARY KEY,
            lead_id VARCHAR(255) UNIQUE NOT NULL,
            lead_date DATE NOT NULL,
            lead_source VARCHAR(255),
            lead_type VARCHAR(255),
            lead_owner VARCHAR(255),
            staff_location VARCHAR(255),
            designation VARCHAR(255),
            company_name VARCHAR(500) NOT NULL,
            industry_type VARCHAR(255),
            `system` VARCHAR(255),
            project_amc VARCHAR(255),
            state VARCHAR(255),
            district VARCHAR(255),
            city VARCHAR(255),
            pin_code VARCHAR(20),
            full_address TEXT,
            company_website VARCHAR(500),
            company_linkedin_link VARCHAR(500),
            sub_industry VARCHAR(255),
            gstin VARCHAR(50),
            customer_name VARCHAR(255) NOT NULL,
            contact_no VARCHAR(50) NOT NULL,
            email_id VARCHAR(255) NOT NULL,
            linkedin_profile VARCHAR(500),
            designation_customer VARCHAR(255),
            method_of_communication VARCHAR(100) DEFAULT 'Email',
            lead_status VARCHAR(100) DEFAULT 'New',
            purpose_of_meeting TEXT,
            meeting_outcome TEXT,
            discussion_held TEXT,
            remarks TEXT,
            next_follow_up_date DATE,
            prospect VARCHAR(255),
            approx_value DECIMAL(15,2),
            negotiated_value DECIMAL(15,2),
            closing_amount DECIMAL(15,2),
            margin_percent DECIMAL(7,2),
            gross_margin_amount DECIMAL(15,2),
            net_margin_amount DECIMAL(15,2),
            received_amount DECIMAL(15,2),
            balance_amount DECIMAL(15,2),
            payment_term VARCHAR(255),
            lead_closer_date DATE,
            expected_lead_closer_month VARCHAR(20),
            lead_aging INT DEFAULT 0,
            lead_percentage INT DEFAULT 0,
            created_by INT NOT NULL,
            assigned_to INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id),
            FOREIGN KEY (assigned_to) REFERENCES users(id)
        )
        ''')
        
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS lead_history (
            id INT AUTO_INCREMENT PRIMARY KEY,
            lead_id VARCHAR(255) NOT NULL,
            field_name VARCHAR(255) NOT NULL,
            old_value TEXT,
            new_value TEXT,
            changed_by INT NOT NULL,
            changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (changed_by) REFERENCES users(id)
        )
        ''')
        
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS lead_status_history (
            id INT AUTO_INCREMENT PRIMARY KEY,
            lead_id VARCHAR(255) NOT NULL,
            old_status VARCHAR(100),
            new_status VARCHAR(100),
            remarks TEXT,
            changed_by INT NOT NULL,
            changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (changed_by) REFERENCES users(id)
        )
        ''')
        
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS lead_activities (
            id INT AUTO_INCREMENT PRIMARY KEY,
            lead_id VARCHAR(255) NOT NULL,
            activity_type VARCHAR(100) NOT NULL,
            description TEXT NOT NULL,
            activity_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            performed_by INT NOT NULL,
            FOREIGN KEY (performed_by) REFERENCES users(id)
        )
        ''')
        
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS lead_settings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            setting_type VARCHAR(255) NOT NULL UNIQUE,
            setting_data TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            updated_by INT,
            FOREIGN KEY (updated_by) REFERENCES users(id)
        )
        ''')
        
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS system_settings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            setting_key VARCHAR(255) NOT NULL UNIQUE,
            setting_value TEXT NOT NULL,
            setting_type VARCHAR(50) DEFAULT 'string',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            updated_by INT,
            FOREIGN KEY (updated_by) REFERENCES users(id)
        )
        ''')

        # User activity audit table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT,
            username VARCHAR(255),
            action VARCHAR(255) NOT NULL,
            resource_type VARCHAR(255),
            resource_id VARCHAR(255),
            method VARCHAR(50),
            path TEXT,
            ip_address VARCHAR(50),
            user_agent TEXT,
            status_code INT,
            success TINYINT(1),
            details TEXT,
            session_token VARCHAR(255),
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
        ''')

        # Helpful indexes for audit queries
        try:
            cursor.execute("CREATE INDEX idx_audit_user_time ON audit_logs(user_id, created_at)")
        except Exception as e:
            print("Audit log error:", e)
        try:
            cursor.execute("CREATE INDEX idx_audit_action_resource ON audit_logs(action, resource_type)")
        except Exception as e:
            print("Audit log error:", e)
        
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS targets (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            type VARCHAR(100) NOT NULL,
            target_value DECIMAL(15,2) NOT NULL,
            current_value DECIMAL(15,2) DEFAULT 0,
            assigned_to INT NOT NULL,
            period VARCHAR(100) NOT NULL,
            context_tab VARCHAR(100),
            description TEXT,
            is_active TINYINT(1) DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            created_by INT,
            FOREIGN KEY (assigned_to) REFERENCES users(id),
            FOREIGN KEY (created_by) REFERENCES users(id)
        )
        ''')
        
        # Create permissions table for hierarchical permission system
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS permissions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            permission_key VARCHAR(255) UNIQUE NOT NULL,
            permission_name VARCHAR(255) NOT NULL,
            parent_id INT,
            category VARCHAR(100) NOT NULL,
            level INT DEFAULT 0,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (parent_id) REFERENCES permissions(id)
        )
        ''')
        
        # Create user_permissions table for direct user-based permission assignment
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_permissions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            permission_id INT NOT NULL,
            granted TINYINT(1) DEFAULT 1,
            granted_by INT,
            granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (permission_id) REFERENCES permissions(id),
            FOREIGN KEY (granted_by) REFERENCES users(id),
            UNIQUE(user_id, permission_id)
        )
        ''')
        
        # Create indexes for faster permission lookups
        try:
            cursor.execute("CREATE INDEX idx_permissions_key ON permissions(permission_key)")
            cursor.execute("CREATE INDEX idx_permissions_parent ON permissions(parent_id)")
            cursor.execute("CREATE INDEX idx_user_permissions_user ON user_permissions(user_id)")
            cursor.execute("CREATE INDEX idx_user_permissions_perm ON user_permissions(permission_id)")
        except Exception as e:
            print("Audit log error:", e)
        
        # Seed permissions (hierarchical structure)
        cursor.execute('SELECT COUNT(*) as count FROM permissions')
        perm_count_result = cursor.fetchone()
        perm_count = perm_count_result['count'] if perm_count_result else 0
        
        if perm_count == 0:
            print("🔐 Seeding permissions...")
            seed_permissions(cursor)
        
        # Check if admin user exists
        cursor.execute('SELECT COUNT(*) as count FROM users WHERE role = %s', ("admin",))
        result = cursor.fetchone()
        admin_count = result['count'] if result else 0
        
        if admin_count == 0:
            # Create default admin user
            default_admin_permissions = {
                'can_view_leads': True,
                'can_create_leads': True,
                'can_edit_leads': True,
                'can_delete_leads': True,
                'can_view_users': True,
                'can_manage_users': True,
                'can_view_reports': True,
                'can_export_data': True
            }
            
            hashed_password = hash_password("admin123")
            admin_permissions = json.dumps(default_admin_permissions)
            
            cursor.execute('''
            INSERT INTO users (username, password, full_name, email, role, permissions, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ''', ('admin', hashed_password, 'Administrator', 'admin@crm.com', 'admin', admin_permissions, 1))
            
            admin_user_id = cursor.lastrowid
            
            # Assign all permissions to admin user
            cursor.execute('SELECT id FROM permissions')
            all_perms = cursor.fetchall()
            for perm in all_perms:
                cursor.execute('''
                INSERT INTO user_permissions (user_id, permission_id, granted, granted_by)
                VALUES (%s, %s, 1, %s)
                ''', (admin_user_id, perm['id'], admin_user_id))
            
            print(f"✅ Admin user created (username: admin, password: admin123) with {len(all_perms)} permissions")
        else:
            # Assign any missing permissions to existing admin users
            cursor.execute('SELECT id FROM users WHERE role = %s', ("admin",))
            admin_users = cursor.fetchall()
            cursor.execute('SELECT id FROM permissions')
            all_perms = cursor.fetchall()
            
            for admin in admin_users:
                for perm in all_perms:
                    try:
                        cursor.execute('''
                        INSERT IGNORE INTO user_permissions (user_id, permission_id, granted, granted_by)
                        VALUES (%s, %s, 1, %s)
                        ''', (admin['id'], perm['id'], admin['id']))
                    except:
                        pass
        
        conn.commit()
        cursor.close()
        print("✅ MySQL Database initialized successfully!")

# Database initialization - will happen on first request
_db_initialized = False

def ensure_db_initialized():
    """Lazy database initialization"""
    global _db_initialized
    if not _db_initialized:
        print("🔄 Initializing database...")
        init_database()
        _db_initialized = True

# Startup event to initialize database
@app.on_event("startup")
async def startup_event():
    """Initialize database on application startup"""
    try:
        ensure_db_initialized()
        print("✅ Application started successfully!")
    except Exception as e:
        import traceback
        print(f"⚠️ Database initialization failed: {type(e).__name__}: {str(e)}")
        print(f"⚠️ Full error traceback:")
        traceback.print_exc()
        print("⚠️ Application may not work correctly")

# Dependency to get current user
def get_current_user(request: Request):
    """Get current user from session token"""
    session_token = request.cookies.get("session_token")
    
    if not session_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    session_data = validate_session_token(session_token)
    
    if not session_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid"
        )
    
    # Get user details from database
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM users WHERE id = %s', (session_data["user_id"],))
        user = cursor.fetchone()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
        
        permissions = json.loads(user['permissions']) if user['permissions'] else {}
        
        # Fetch hierarchical permission keys assigned to the user
        cursor.execute('''
        SELECT p.permission_key
        FROM user_permissions up
        JOIN permissions p ON up.permission_id = p.id
        WHERE up.user_id = %s AND up.granted = 1
        ORDER BY p.permission_key
        ''', (user['id'],))
        perm_rows = cursor.fetchall()
        permission_keys = [r['permission_key'] for r in perm_rows] if perm_rows else []
        
        return {
            "user_id": user['id'],
            "username": user['username'],
            "full_name": user['full_name'],
            "email": user['email'],
            "role": user['role'],
            "permissions": permissions,
            "permission_keys": permission_keys,
            "is_admin": user['role'] == 'admin',
            "session_token": session_token
        }

LEGACY_PERMISSION_ALIASES = {
    # Legacy boolean permission -> hierarchical equivalents
    "can_view_leads": ["leads", "leads.view_table"],
    "can_create_leads": ["add_lead", "leads.action.add"],
    "can_edit_leads": ["leads.action.edit"],
    "can_delete_leads": ["leads.action.delete"],
    "can_view_users": ["users", "control_panel"],
    "can_manage_users": ["control_panel", "users"],
}


def _has_permission_in_keys(permission: str, permission_keys: List[str]) -> bool:
    """Check hierarchical permission matches including parents/children"""
    if not permission:
        return True
    if not permission_keys:
        return False
    
    if permission in permission_keys:
        return True
    
    # Allow if any parent of the requested permission is granted
    parts = permission.split('.')
    for i in range(len(parts), 0, -1):
        candidate = '.'.join(parts[:i])
        if candidate in permission_keys:
            return True
    
    # Allow if any child of the requested permission is granted
    prefix = f"{permission}."
    return any(key.startswith(prefix) for key in permission_keys)


def check_user_permission(user: dict, permission: str):
    if not permission:
        return True
    if user.get('role') == 'admin' or user.get('is_admin'):
        return True
    
    permission_keys = user.get('permission_keys') or []
    if _has_permission_in_keys(permission, permission_keys):
        return True
    
    for alias in LEGACY_PERMISSION_ALIASES.get(permission, []):
        if _has_permission_in_keys(alias, permission_keys):
            return True
    
    permissions_map = user.get('permissions') or {}
    return permissions_map.get(permission, False)


# Register lead report routes after all dependencies are defined
register_lead_report_routes(app)


def resolve_default_route(user: dict) -> str:
    """Choose first accessible page for user"""
    preferred_routes = [
        ("dashboard", "/dashboard"),
        ("leads", "/leads"),
        ("add_lead", "/add-lead"),
        ("target_management", "/target-management"),
        ("lead_settings", "/lead-settings"),
        ("users", "/users"),
        ("control_panel", "/control-panel"),
    ]

    for key, path in preferred_routes:
        if check_user_permission(user, key):
            return path

    # Fallback to legacy booleans
    if (user.get('permissions') or {}).get('can_view_leads'):
        return "/leads"

    # Last resort
    return "/dashboard"

# Routes
@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})

@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})

@app.get("/permission-management", response_class=HTMLResponse)
async def permission_management_page(request: Request, user: dict = Depends(get_current_user)):
    """Permission management page - Admin only"""
    if user['role'] != 'admin':
        return templates.TemplateResponse("error.html", {
            "request": request,
            "error": "Access Denied",
            "message": "Only administrators can access permission management."
        })
    
    return templates.TemplateResponse("permission_management.html", {
        "request": request,
        "user": user
    })

@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request, user: dict = Depends(get_current_user)):
    # Server-side guard: if user lacks dashboard permission, redirect to Leads
    if not check_user_permission(user, 'dashboard'):
        return RedirectResponse(url="/leads", status_code=302)

    from copy import deepcopy
    stats = {}
    with get_db_connection() as conn:
        cursor = conn.cursor()
        where_clause = ""
        params = []

        if user['role'] != 'admin':
            where_clause = "AND (created_by = %s OR assigned_to = %s)"
            params = [user['user_id'], user['user_id']]

        # Total leads
        if where_clause:
            cursor.execute(f'SELECT COUNT(*) as count FROM leads WHERE 1=1 {where_clause}', params)
        else:
            cursor.execute(f'SELECT COUNT(*) as count FROM leads', params)
        result = cursor.fetchone()
        total_leads = result['count'] if result else 0

        # Upcoming follow-ups - use followUpDays preference
        prefs = get_preferences()
        follow_up_days = int(prefs.get('followUpDays', 7))
        
        upcoming_query = f'''
        SELECT COUNT(*) as count 
        FROM leads 
        WHERE next_follow_up_date >= CURDATE() 
        AND next_follow_up_date <= DATE_ADD(CURDATE(), INTERVAL {follow_up_days} DAY)
        {where_clause}
        '''
        cursor.execute(upcoming_query, params)
        upcoming_result = cursor.fetchone()
        upcoming_followups = upcoming_result['count'] if upcoming_result else 0

        # Missed follow-ups (where next_follow_up_date is in the past)
        missed_query = f'''
        SELECT COUNT(*) as count 
        FROM leads 
        WHERE next_follow_up_date IS NOT NULL
        AND next_follow_up_date < CURDATE()
        {where_clause}
        '''
        cursor.execute(missed_query, params)
        missed_result = cursor.fetchone()
        missed_followups = missed_result['count'] if missed_result else 0

        # Leads by status
        if where_clause:
            status_query = f'''
            SELECT lead_status, COUNT(*) as count 
            FROM leads 
            WHERE 1=1 {where_clause}
            GROUP BY lead_status
            ORDER BY count DESC
            '''
        else:
            status_query = f'''
            SELECT lead_status, COUNT(*) as count 
            FROM leads 
            GROUP BY lead_status
            ORDER BY count DESC
            '''
        cursor.execute(status_query, params)
        leads_by_status = cursor.fetchall()

        # Recent leads
        if where_clause:
            recent_query = f'''
            SELECT lead_id, company_name, customer_name, lead_status, updated_at, created_at
            FROM leads 
            WHERE 1=1 {where_clause}
            ORDER BY updated_at DESC
            LIMIT 10
            '''
        else:
            recent_query = f'''
            SELECT lead_id, company_name, customer_name, lead_status, updated_at, created_at
            FROM leads 
            ORDER BY updated_at DESC
            LIMIT 10
            '''
        cursor.execute(recent_query, params)
        recent_leads = cursor.fetchall()

        # Value metrics: Total Proposed, Negotiated, Closing Amount
        if where_clause:
            value_query = f'''
            SELECT 
                COALESCE(SUM(approx_value), 0) as total_proposed,
                COALESCE(SUM(negotiated_value), 0) as total_negotiated,
                COALESCE(SUM(closing_amount), 0) as total_closing
            FROM leads
            WHERE 1=1 {where_clause}
            '''
        else:
            value_query = '''
            SELECT 
                COALESCE(SUM(approx_value), 0) as total_proposed,
                COALESCE(SUM(negotiated_value), 0) as total_negotiated,
                COALESCE(SUM(closing_amount), 0) as total_closing
            FROM leads
            '''
        cursor.execute(value_query, params)
        value_result = cursor.fetchone()
        
        # Targets and Achievement (fetch active targets from database)
        if user['role'] != 'admin':
            targets_query = '''
            SELECT t.id, t.name, t.type, t.target_value, t.current_value, 
                   t.period, t.assigned_to, u.full_name as assigned_to_name
            FROM targets t
            LEFT JOIN users u ON t.assigned_to = u.id
            WHERE t.is_active = 1
            AND t.assigned_to = %s
            ORDER BY t.created_at DESC
            LIMIT 10
            '''
            cursor.execute(targets_query, [user['user_id']])
        else:
            targets_query = '''
            SELECT t.id, t.name, t.type, t.target_value, t.current_value, 
                   t.period, t.assigned_to, u.full_name as assigned_to_name
            FROM targets t
            LEFT JOIN users u ON t.assigned_to = u.id
            WHERE t.is_active = 1
            ORDER BY t.created_at DESC
            LIMIT 10
            '''
            cursor.execute(targets_query)
        targets_data = cursor.fetchall()
        print(f"DEBUG: Found {len(targets_data) if targets_data else 0} targets for user {user['username']}")
        
        stats = {
            "total_leads": total_leads,
            "upcoming_followups": upcoming_followups,
            "missed_followups": missed_followups,
            "leads_by_status": [dict(s) for s in leads_by_status] if leads_by_status else [],
            "recent_leads": [dict(l) for l in recent_leads] if recent_leads else [],
            "value_metrics": {
                "total_proposed": float(value_result['total_proposed']) if value_result else 0,
                "total_negotiated": float(value_result['total_negotiated']) if value_result else 0,
                "total_closing": float(value_result['total_closing']) if value_result else 0
            },
            "targets": [dict(t) for t in targets_data] if targets_data else []
        }

    return templates.TemplateResponse("dashboard.html", {
        "request": request,
        "user": user,
        "today": date.today().isoformat(),
        "stats": stats,
        "follow_up_days": follow_up_days
    })


@app.get("/leads", response_class=HTMLResponse)
async def leads_page(request: Request, user: dict = Depends(get_current_user)):
    if not check_user_permission(user, 'can_view_leads'):
        raise HTTPException(status_code=403, detail="You don't have permission to view leads")
    prefs = get_preferences()
    follow_up_days = int(prefs.get('followUpDays', 7))
    aging_alert_days = int(prefs.get('agingAlertDays', 30))
    return templates.TemplateResponse("leads.html", {
        "request": request,
        "user": user,
        "today": date.today().isoformat(),
        "follow_up_days": follow_up_days,
        "aging_alert_days": aging_alert_days
    })

@app.get("/add-lead", response_class=HTMLResponse)
async def add_lead_page(request: Request, user: dict = Depends(get_current_user)):
    if not check_user_permission(user, 'can_create_leads'):
        raise HTTPException(status_code=403, detail="You don't have permission to create leads")
    return templates.TemplateResponse("add_lead.html", {"request": request, "user": user, "today": date.today().isoformat()})

@app.get("/lead-detail/{lead_id}", response_class=HTMLResponse)
async def lead_detail_page(request: Request, lead_id: str, user: dict = Depends(get_current_user)):
    if not check_user_permission(user, 'can_view_leads'):
        raise HTTPException(status_code=403, detail="You don't have permission to view leads")
    return templates.TemplateResponse("lead_detail.html", {"request": request, "user": user, "lead_id": lead_id, "today": date.today().isoformat()})


@app.get("/lead-reports/{lead_id}", response_class=HTMLResponse)
async def lead_reports_page(request: Request, lead_id: str, user: dict = Depends(get_current_user)):
    if not check_user_permission(user, 'can_view_leads'):
        raise HTTPException(status_code=403, detail="You don't have permission to view lead reports")
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM lead_reports WHERE lead_id = %s ORDER BY uploaded_at DESC", (lead_id,))
        rows = cursor.fetchall()
    reports = [
        {
            "id": r["id"],
            "name": r["name"],
            "description": r["description"],
            "filename": r["filename"],
            "uploaded_at": r["uploaded_at"].strftime('%Y-%m-%d %H:%M') if r["uploaded_at"] else None,
            "uploaded_by": r["uploaded_by"]
        }
        for r in rows
    ]
    return templates.TemplateResponse("lead_reports.html", {"request": request, "user": user, "lead_id": lead_id, "today": date.today().isoformat(), "reports": reports})

@app.get("/edit-lead/{lead_id}", response_class=HTMLResponse)
async def edit_lead_page(request: Request, lead_id: str, user: dict = Depends(get_current_user)):
    if not check_user_permission(user, 'can_edit_leads'):
        raise HTTPException(status_code=403, detail="You don't have permission to edit leads")
    return templates.TemplateResponse("edit_lead.html", {"request": request, "user": user, "lead_id": lead_id, "today": date.today().isoformat()})

@app.get("/users", response_class=HTMLResponse)
async def users_page(request: Request, user: dict = Depends(get_current_user)):
    if not check_user_permission(user, 'can_view_users'):
        raise HTTPException(status_code=403, detail="You don't have permission to view users")
    return templates.TemplateResponse("users.html", {"request": request, "user": user, "today": date.today().isoformat()})

@app.get("/control-panel", response_class=HTMLResponse)
async def control_panel_page(request: Request, user: dict = Depends(get_current_user)):
    if not check_user_permission(user, 'can_view_users'):
        raise HTTPException(status_code=403, detail="You don't have permission to access control panel")
    return templates.TemplateResponse("control_panel.html", {"request": request, "user": user, "today": date.today().isoformat()})

@app.get("/lead-settings", response_class=HTMLResponse)
async def lead_settings_page(request: Request, user: dict = Depends(get_current_user)):
    if not check_user_permission(user, 'can_manage_users'):
        raise HTTPException(status_code=403, detail="You don't have permission to access lead settings")
    return templates.TemplateResponse("lead_settings.html", {"request": request, "user": user, "today": date.today().isoformat()})

@app.get("/target-management", response_class=HTMLResponse)
async def target_management_page(request: Request, user: dict = Depends(get_current_user)):
    # Admin users have full access, others also have access
    # This is a page for all authenticated users to track targets
    return templates.TemplateResponse("target_management.html", {"request": request, "user": user, "today": date.today().isoformat()})

# Security & Audit page route (define after app and templates)
@app.get("/security-audit", response_class=HTMLResponse)
async def security_audit_page(request: Request, user: dict = Depends(lambda: {"role": "admin"})):
    return templates.TemplateResponse("security_audit.html", {"request": request, "user": user})

# API Routes
@app.post("/api/login")
async def login(login_data: LoginRequest, response: Response):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        hashed_password = hash_password(login_data.password)
        cursor.execute('SELECT * FROM users WHERE username = %s AND is_active = 1', 
                      (login_data.username,))
        user = cursor.fetchone()
        
        if not user or hashed_password != user['password']:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        permissions = json.loads(user['permissions']) if user['permissions'] else {}
        
        # Get user's hierarchical permissions
        cursor.execute('''
        SELECT p.permission_key
        FROM user_permissions up
        JOIN permissions p ON up.permission_id = p.id
        WHERE up.user_id = %s AND up.granted = 1
        ORDER BY p.permission_key
        ''', (user['id'],))
        perm_rows = cursor.fetchall()
        permission_keys = [r['permission_key'] for r in perm_rows] if perm_rows else []
        
        cursor.execute('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = %s', (user['id'],))
        conn.commit()
        
        user_payload = {
            "user_id": user['id'],
            "username": user['username'],
            "full_name": user['full_name'],
            "email": user['email'],
            "role": user['role'],
            "permissions": permissions,
            "permission_keys": permission_keys,
            "is_admin": user['role'] == 'admin'
        }
        redirect_to = resolve_default_route(user_payload)
        
        # Create session
        session_token = create_session(
            user_id=user['id'],
            username=user['username'],
            role=user['role'],
            permissions=permissions
        )
        
        # Set session cookie
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=False,
            samesite="lax",
            max_age=SESSION_TIMEOUT
        )

        # Audit: successful login
        try:
            log_user_activity(
                request=None,
                user_id=user['id'],
                username=user['username'],
                action="login",
                resource_type="session",
                resource_id=session_token,
                success=True,
                status_code=200,
                details="User login successful",
                session_token=session_token,
            )
        except Exception as e:
            print("Audit log error:", e)
        
        return {
            "success": True,
            "user": user_payload,
            "session_token": session_token,
            "redirect_to": redirect_to
        }

@app.post("/api/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    
    if session_token:
        # Resolve user for audit (best-effort)
        session_data = validate_session_token(session_token)
        user_id = session_data["user_id"] if session_data else None
        username = session_data["username"] if session_data else None

        logout_session(session_token)

        # Audit: logout
        try:
            log_user_activity(
                request=request,
                user_id=user_id,
                username=username,
                action="logout",
                resource_type="session",
                resource_id=session_token,
                success=True,
                status_code=200,
                details="User logout",
                session_token=session_token,
            )
        except Exception as e:
            print("Audit log error:", e)
    
    response.delete_cookie(key="session_token")
    
    # Redirect to login page
    return RedirectResponse(url="/login", status_code=302)

@app.get("/api/validate-session")
async def validate_session(request: Request):
    """Check if user has a valid session"""
    try:
        session_token = request.cookies.get("session_token")
        
        if not session_token:
            return JSONResponse(
                status_code=401,
                content={"success": False, "detail": "No session token"}
            )
        
        session_data = validate_session_token(session_token)
        
        if not session_data:
            return JSONResponse(
                status_code=401,
                content={"success": False, "detail": "Session expired"}
            )
        
        # Get user details
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT id, username, full_name, email, role, permissions FROM users WHERE id = %s', 
                          (session_data["user_id"],))
            user = cursor.fetchone()
            
            if not user:
                return JSONResponse(
                    status_code=401,
                    content={"success": False, "detail": "User not found"}
                )
            
            permissions = json.loads(user['permissions']) if user['permissions'] else {}
            
            return JSONResponse(
                status_code=200,
                content={
                    "success": True,
                    "user": {
                        "user_id": user['id'],
                        "username": user['username'],
                        "full_name": user['full_name'],
                        "email": user['email'],
                        "role": user['role'],
                        "permissions": permissions
                    }
                }
            )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"success": False, "detail": str(e)}
        )

@app.get("/api/leads")
async def get_leads(
    request: Request,
    status: Optional[str] = None,
    owner: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    user: dict = Depends(get_current_user)
):
    if not check_user_permission(user, 'can_view_leads'):
        raise HTTPException(status_code=403, detail="No permission to view leads")
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Base query
        query = '''
        SELECT l.*, 
               u1.full_name as created_by_name,
               u2.full_name as assigned_to_name
        FROM leads l
        LEFT JOIN users u1 ON l.created_by = u1.id
        LEFT JOIN users u2 ON l.assigned_to = u2.id
        WHERE 1=1
        '''
        
        params = []
        
        # Add role-based filtering
        if user['role'] != 'admin':
            query += ' AND (l.created_by = %s OR l.assigned_to = %s)'
            params.extend([user['user_id'], user['user_id']])
        
        # Add status filter
        if status:
            query += ' AND l.lead_status = %s'
            params.append(status)

        # Add owner filter
        if owner:
            query += ' AND l.lead_owner = %s'
            params.append(owner)

        # Add search filter
        if search:
            search_term = f'%{search}%'
            query += '''
                AND (l.lead_id LIKE %s OR l.company_name LIKE %s 
                OR l.customer_name LIKE %s OR l.email_id LIKE %s 
                OR l.contact_no LIKE %s)
            '''
            params.extend([search_term, search_term, search_term, search_term, search_term])
        
        # Get total count - MySQL requires alias for derived tables
        count_query = "SELECT COUNT(*) as count FROM (" + query.replace("SELECT l.*, u1.full_name as created_by_name, u2.full_name as assigned_to_name", "SELECT l.id") + ") AS lead_count"
        
        cursor.execute(count_query, params)
        count_result = cursor.fetchone()
        total = count_result['count'] if count_result else 0
        
        # Add pagination
        query += ' ORDER BY l.updated_at DESC LIMIT %s OFFSET %s'
        offset = (page - 1) * limit
        params.extend([limit, offset])
        
        cursor.execute(query, params)
        leads = cursor.fetchall()
        
        leads_list = [dict(lead) for lead in leads] if leads else []

        # Normalize timestamps and compute dynamic aging (fix off-by-one)
        for l in leads_list:
            # Convert created_at / updated_at to ISO UTC for reliable JS parsing
            for ts_field in ("created_at", "updated_at"):
                val = l.get(ts_field)
                if isinstance(val, str) and val:
                    try:
                        dt = datetime.strptime(val, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
                        l[ts_field] = dt.isoformat()
                    except Exception:
                        # leave as-is if parsing fails
                        pass

            # Compute aging from lead_date using date-only difference
            ld = l.get("lead_date")
            if isinstance(ld, str) and ld:
                try:
                    lead_date_obj = datetime.strptime(ld, "%Y-%m-%d").date()
                    l["lead_aging"] = max(0, (date.today() - lead_date_obj).days)
                except Exception:
                    # fallback: keep existing aging
                    pass
            
            # Calculate lead percentage based on status (if not already set or zero)
            if not l.get("lead_percentage") or l.get("lead_percentage") == 0:
                l["lead_percentage"] = calculate_lead_percentage(l.get("lead_status", "New"))
        
        return {
            "success": True,
            "data": leads_list,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "pages": (total + limit - 1) // limit if limit > 0 else 0
            }
        }
        
        # Audit: leads list viewed
        try:
            log_user_activity(
                request=request,
                user_id=user['user_id'],
                username=user['username'],
                action="view",
                resource_type="lead_list",
                resource_id=None,
                success=True,
                status_code=200,
                details=f"status={status}, search={search}, owner={owner}, page={page}, limit={limit}",
                session_token=user.get('session_token'),
            )
        except Exception:
            pass

@app.get("/api/leads/{lead_id}")
async def get_lead_detail(lead_id: str, request: Request, user: dict = Depends(get_current_user)):
    if not check_user_permission(user, 'can_view_leads'):
        raise HTTPException(status_code=403, detail="No permission to view leads")
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Role-based access control
        if user['role'] != 'admin':
            cursor.execute('''
            SELECT l.*, 
                   u1.full_name as created_by_name,
                   u2.full_name as assigned_to_name
            FROM leads l
            LEFT JOIN users u1 ON l.created_by = u1.id
            LEFT JOIN users u2 ON l.assigned_to = u2.id
            WHERE l.lead_id = %s AND (l.created_by = %s OR l.assigned_to = %s)
            ''', (lead_id, user['user_id'], user['user_id']))
        else:
            cursor.execute('''
            SELECT l.*, 
                   u1.full_name as created_by_name,
                   u2.full_name as assigned_to_name
            FROM leads l
            LEFT JOIN users u1 ON l.created_by = u1.id
            LEFT JOIN users u2 ON l.assigned_to = u2.id
            WHERE l.lead_id = %s
            ''', (lead_id,))
        
        lead = cursor.fetchone()
        
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        # Get lead activities
        cursor.execute('''
        SELECT la.*, u.full_name as performed_by_name
        FROM lead_activities la
        LEFT JOIN users u ON la.performed_by = u.id
        WHERE la.lead_id = %s
        ORDER BY la.activity_date DESC
        ''', (lead_id,))
        activities = cursor.fetchall()
        
        # Get status history
        cursor.execute('''
        SELECT lsh.*, u.full_name as changed_by_name
        FROM lead_status_history lsh
        LEFT JOIN users u ON lsh.changed_by = u.id
        WHERE lsh.lead_id = %s
        ORDER BY lsh.changed_at DESC
        ''', (lead_id,))
        status_history = cursor.fetchall()

        # Get detailed field change history
        cursor.execute('''
        SELECT lh.*, u.full_name as changed_by_name
        FROM lead_history lh
        LEFT JOIN users u ON lh.changed_by = u.id
        WHERE lh.lead_id = %s
        ORDER BY lh.changed_at DESC
        ''', (lead_id,))
        field_history = cursor.fetchall()
        
        # Build lead response with normalized timestamps and dynamic aging
        lead_dict = dict(lead)
        for ts_field in ("created_at", "updated_at"):
            val = lead_dict.get(ts_field)
            if isinstance(val, str) and val:
                try:
                    dt = datetime.strptime(val, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
                    lead_dict[ts_field] = dt.isoformat()
                except Exception:
                    pass
        ld = lead_dict.get("lead_date")
        if isinstance(ld, str) and ld:
            try:
                lead_date_obj = datetime.strptime(ld, "%Y-%m-%d").date()
                lead_dict["lead_aging"] = max(0, (date.today() - lead_date_obj).days)
            except Exception:
                pass
        
        # Calculate lead percentage based on status (if not already set or zero)
        if not lead_dict.get("lead_percentage") or lead_dict.get("lead_percentage") == 0:
            lead_dict["lead_percentage"] = calculate_lead_percentage(lead_dict.get("lead_status", "New"))

        # Normalize activity and history timestamps to ISO UTC for consistent UI parsing
        activities_list = [dict(a) for a in activities] if activities else []
        for a in activities_list:
            val = a.get("activity_date")
            if isinstance(val, str) and val:
                try:
                    dt = datetime.strptime(val, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
                    a["activity_date"] = dt.isoformat()
                except Exception:
                    pass

        status_history_list = [dict(s) for s in status_history] if status_history else []
        for s in status_history_list:
            val = s.get("changed_at")
            if isinstance(val, str) and val:
                try:
                    dt = datetime.strptime(val, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
                    s["changed_at"] = dt.isoformat()
                except Exception:
                    pass

        field_history_list = [dict(h) for h in field_history] if field_history else []
        for h in field_history_list:
            val = h.get("changed_at")
            if isinstance(val, str) and val:
                try:
                    dt = datetime.strptime(val, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
                    h["changed_at"] = dt.isoformat()
                except Exception:
                    pass

        return {
            "success": True,
            "lead": lead_dict,
            "activities": activities_list,
            "status_history": status_history_list,
            "field_history": field_history_list
        }
        
        # Audit: lead viewed

        try:
            log_user_activity(
                request=request,
                user_id=user['user_id'],
                username=user['username'],
                action="view",
                resource_type="lead",
                resource_id=lead_id,
                success=True,
                status_code=200,
                details="Lead detail fetched",
                session_token=user.get('session_token')
            )
        except Exception:
            pass

@app.post("/api/leads")
async def create_lead(lead_data: LeadCreate, user: dict = Depends(get_current_user)):
    if not check_user_permission(user, 'can_create_leads'):
        raise HTTPException(status_code=403, detail="No permission to create leads")
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        lead_id = generate_lead_id()
        
        try:
            lead_date_obj = datetime.strptime(lead_data.lead_date, '%Y-%m-%d').date()
            lead_aging = max(0, (date.today() - lead_date_obj).days)

            # Determine assignee (exclude missing users)
            assigned_to_id = lead_data.assigned_to if lead_data.assigned_to else user['user_id']
            cursor.execute('SELECT id, full_name FROM users WHERE id = %s', (assigned_to_id,))
            assigned_user = cursor.fetchone()
            if not assigned_user:
                raise HTTPException(status_code=400, detail="Assigned user not found")

            lead_owner_value = lead_data.lead_owner or assigned_user['full_name']
            if not lead_owner_value:
                lead_owner_value = user['full_name']
            
            # Use provided status or default to 'New'
            status_value = lead_data.lead_status or 'New'
            lead_percentage = calculate_lead_percentage(status_value)
            
            cursor.execute('''
            INSERT INTO leads (
                `lead_id`, `lead_date`, `lead_source`, `lead_type`, `lead_owner`,
                `staff_location`,
                `designation`, `company_name`, `industry_type`, `system`, `project_amc`,
                `state`, `district`, `city`, `pin_code`, `full_address`, `company_website`,
                `company_linkedin_link`, `sub_industry`, `gstin`, `customer_name`,
                `contact_no`, `email_id`, `linkedin_profile`, `designation_customer`,
                `method_of_communication`, `lead_status`, `lead_aging`, `lead_percentage`,
                `lead_closer_date`,
                `created_by`, `assigned_to`
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ''', (
                lead_id, lead_data.lead_date, lead_data.lead_source, lead_data.lead_type,
                lead_owner_value, lead_data.staff_location,
                lead_data.designation, lead_data.company_name,
                lead_data.industry_type, lead_data.system, lead_data.project_amc,
                lead_data.state, lead_data.district, lead_data.city, lead_data.pin_code,
                lead_data.full_address, lead_data.company_website,
                lead_data.company_linkedin_link, lead_data.sub_industry,
                lead_data.gstin, lead_data.customer_name, lead_data.contact_no,
                lead_data.email_id, lead_data.linkedin_profile,
                lead_data.designation_customer, lead_data.method_of_communication or 'Email', status_value, lead_aging, lead_percentage,
                lead_data.lead_closer_date,
                user['user_id'], assigned_to_id
            ))
            
            # Get the newly created lead
            cursor.execute('''
            SELECT l.*, u.full_name as created_by_name
            FROM leads l
            LEFT JOIN users u ON l.created_by = u.id
            WHERE l.lead_id = %s
            ''', (lead_id,))
            new_lead = cursor.fetchone()
            new_lead_dict = dict(new_lead) if new_lead else {}
            
            # Add initial history entries for ALL fields that are provided
            history_count = 0
            for field, value in lead_data.dict(exclude_unset=True).items():
                if value is not None and value != '':
                    try:
                        cursor.execute('''
                        INSERT INTO lead_history (lead_id, field_name, old_value, new_value, changed_by)
                        VALUES (%s, %s, %s, %s, %s)
                        ''', (lead_id, field, None, str(value), user['user_id']))
                        history_count += 1
                        print(f"DEBUG: Inserted lead_history for {field} = {value}")
                    except Exception as e:
                        print(f"ERROR: Failed to insert lead_history for field {field}: {str(e)}")
                        raise  # Re-raise to rollback transaction
            
            print(f"DEBUG: Total history entries inserted: {history_count}")
            
            # Add to status history
            cursor.execute('''
            INSERT INTO lead_status_history (lead_id, old_status, new_status, changed_by)
            VALUES (%s, %s, %s, %s)
            ''', (lead_id, 'New', 'New', user['user_id']))
            
            # Add activity with details
            company_name = new_lead_dict.get("company_name") or lead_data.company_name or "Unknown"
            customer_name = new_lead_dict.get("customer_name") or lead_data.customer_name or "Unknown"
            cursor.execute('''
            INSERT INTO lead_activities (lead_id, activity_type, description, performed_by)
            VALUES (%s, %s, %s, %s)
            ''', (lead_id, 'created', f'Lead created: {company_name} - {customer_name}', user['user_id']))
            
            conn.commit()
            print(f"DEBUG: Lead {lead_id} created successfully with {history_count} history entries")
            
            return {
                "success": True,
                "lead_id": lead_id,
                "lead": dict(new_lead) if new_lead else None,
                "message": "Lead created successfully"
            }
        except Exception as e:
            conn.rollback()
            # Audit: lead create failed
            try:
                log_user_activity(
                    request=None,
                    user_id=user['user_id'],
                    username=user['username'],
                    action="create",
                    resource_type="lead",
                    resource_id=None,
                    success=False,
                    status_code=500,
                    details=str(e),
                    session_token=user.get('session_token'),
                )
            except Exception:
                pass
            raise HTTPException(status_code=500, detail=str(e))
    
    # Audit: lead created
    try:
        log_user_activity(
            request=None,
            user_id=user['user_id'],
            username=user['username'],
            action="create",
            resource_type="lead",
            resource_id=lead_id,
            success=True,
            status_code=200,
            details="Lead created",
            session_token=user.get('session_token'),
        )
    except Exception:
        pass

@app.put("/api/leads/{lead_id}")
async def update_lead(lead_id: str, lead_data: LeadUpdate, user: dict = Depends(get_current_user)):
    if not check_user_permission(user, 'can_edit_leads'):
        raise HTTPException(status_code=403, detail="No permission to edit leads")
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        try:
            # First get current lead data
            cursor.execute('SELECT * FROM leads WHERE lead_id = %s', (lead_id,))
            current_lead = cursor.fetchone()
            
            if not current_lead:
                raise HTTPException(status_code=404, detail="Lead not found")
            current_lead_dict = dict(current_lead)
            # --- PATCH: If lead_percentage becomes 100, set lead_closer_date to today ---
            # Calculate new percentage if status is being updated
            new_percentage = None
            if lead_data.lead_status:
                new_percentage = calculate_lead_percentage(lead_data.lead_status)
            elif lead_data.lead_percentage is not None:
                new_percentage = lead_data.lead_percentage
            else:
                new_percentage = current_lead_dict.get('lead_percentage')

            # If percentage is 100 and lead_closer_date is not set, set it to today
            if int(new_percentage or 0) == 100:
                from datetime import date
                today_str = date.today().isoformat()
                if not current_lead_dict.get('lead_closer_date') or lead_data.lead_closer_date is None:
                    lead_data.lead_closer_date = today_str
            
            # Check access permission for non-admin users
            if user['role'] != 'admin' and current_lead_dict.get('created_by') != user['user_id'] and current_lead_dict.get('assigned_to') != user['user_id']:
                raise HTTPException(status_code=403, detail="No permission to edit this lead")
            
            # Build update query
            update_fields = []
            params = []
            
            reserved = {"system", "state", "order", "group", "user", "key", "date", "percent", "rank"}
            activity_details = []  # Track all field changes for activity log
            history_count = 0
            
            for field, value in lead_data.dict(exclude_unset=True).items():
                sql_field = f"`{field}`" if field in reserved else field
                old_value = current_lead_dict.get(field)
                # Only log if value actually changed
                if field == "lead_closer_date":
                    # Always update this field if present
                    if value is None:
                        update_fields.append(f"{sql_field} = NULL")
                        params.append(None)
                    else:
                        update_fields.append(f"{sql_field} = %s")
                        params.append(value)
                else:
                    if value is None:
                        if old_value is not None:
                            update_fields.append(f"{sql_field} = NULL")
                            try:
                                cursor.execute('''
                                INSERT INTO lead_history (lead_id, field_name, old_value, new_value, changed_by)
                                VALUES (%s, %s, %s, %s, %s)
                                ''', (lead_id, field, str(old_value) if old_value else None, None, user['user_id']))
                                history_count += 1
                                print(f"DEBUG: Inserted lead_history for {field}: {old_value} -> NULL")
                            except Exception as e:
                                print(f"ERROR: Failed to insert lead_history for {field}: {str(e)}")
                                raise
                            activity_details.append(f"{field}: '{old_value}' -> (cleared)")
                    else:
                        if str(value) != str(old_value):
                            update_fields.append(f"{sql_field} = %s")
                            params.append(value)
                            try:
                                cursor.execute('''
                                INSERT INTO lead_history (lead_id, field_name, old_value, new_value, changed_by)
                                VALUES (%s, %s, %s, %s, %s)
                                ''', (lead_id, field, str(old_value) if old_value else None, str(value), user['user_id']))
                                history_count += 1
                                print(f"DEBUG: Inserted lead_history for {field}: {old_value} -> {value}")
                            except Exception as e:
                                print(f"ERROR: Failed to insert lead_history for {field}: {str(e)}")
                                raise
                            activity_details.append(f"{field}: '{old_value}' -> '{value}'")
            
            # Handle lead status change separately
            if lead_data.lead_status and lead_data.lead_status != current_lead_dict.get('lead_status'):
                cursor.execute('''
                INSERT INTO lead_status_history (lead_id, old_status, new_status, changed_by)
                VALUES (%s, %s, %s, %s)
                ''', (lead_id, current_lead_dict.get('lead_status'), lead_data.lead_status, user['user_id']))
                
                # Auto-calculate percentage if status changed: only if mapping exists
                new_percentage = calculate_lead_percentage(lead_data.lead_status)
                # Agar mapping mila (non-zero) to update karo, otherwise existing percentage rakho
                if new_percentage > 0:
                    # Find existing lead_percentage field and its param index (only count fields that use %s)
                    existing_param_idx = None
                    param_cursor = 0
                    for f in update_fields:
                        if "%s" in f:
                            if f.strip().startswith("lead_percentage = %s"):
                                existing_param_idx = param_cursor
                                break
                            param_cursor += 1
                    if existing_param_idx is not None:
                        # Replace existing parameter value with recalculated percentage
                        params[existing_param_idx] = new_percentage
                    else:
                        update_fields.append("lead_percentage = %s")
                        params.append(new_percentage)
            
            # If no fields to update, return early
            if not update_fields:
                raise HTTPException(status_code=400, detail="No fields to update")
            
            # Add updated_at timestamp
            update_fields.append("updated_at = CURRENT_TIMESTAMP")
            
            # Execute update
            query = f"UPDATE leads SET {', '.join(update_fields)} WHERE lead_id = %s"
            params.append(lead_id)
            
            cursor.execute(query, params)
            
            # Add individual activity log for each changed field, only if actually changed
            for detail in activity_details:
                field_name = detail.split(':')[0].strip()
                readable_field = field_name.replace('_', ' ').title()
                # Parse old and new values
                if "->" in detail:
                    parts = detail.split("->")
                    old_val = parts[0].split(":")[1].strip().strip("'")
                    new_val = parts[1].strip().strip("'")
                    if new_val == "(cleared)":
                        desc = f"Cleared {readable_field} (was '{old_val}')"
                    else:
                        desc = f"Changed {readable_field} from '{old_val}' to '{new_val}'"
                else:
                    desc = f"Edited {readable_field}"
                cursor.execute('''
                    INSERT INTO lead_activities (lead_id, activity_type, description, performed_by)
                    VALUES (%s, %s, %s, %s)
                ''', (lead_id, 'field_update', desc, user['user_id']))
            
            conn.commit()
            print(f"DEBUG: Lead {lead_id} updated successfully with {history_count} history entries")
            
            return {
                "success": True,
                "message": "Lead updated successfully"
            }
            
            return {
                "success": True,
                "message": "Lead updated successfully"
            }
        except Exception as e:
            conn.rollback()
            # Audit: lead update failed
            try:
                log_user_activity(
                    request=None,
                    user_id=user['user_id'],
                    username=user['username'],
                    action="update",
                    resource_type="lead",
                    resource_id=lead_id,
                    success=False,
                    status_code=500,
                    details=str(e),
                    session_token=user.get('session_token'),
                )
            except Exception:
                pass
            raise HTTPException(status_code=500, detail=str(e))
    
    # Audit: lead updated
    try:
        log_user_activity(
            request=None,
            user_id=user['user_id'],
            username=user['username'],
            action="update",
            resource_type="lead",
            resource_id=lead_id,
            success=True,
            status_code=200,
            details="Lead updated",
            session_token=user.get('session_token'),
        )
    except Exception:
        pass

@app.delete("/api/leads/{lead_id}")
async def delete_lead(lead_id: str, user: dict = Depends(get_current_user)):
    if not check_user_permission(user, 'can_delete_leads'):
        raise HTTPException(status_code=403, detail="No permission to delete leads")
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        try:
            # First check if lead exists
            cursor.execute('SELECT * FROM leads WHERE lead_id = %s', (lead_id,))
            lead = cursor.fetchone()
            
            if not lead:
                raise HTTPException(status_code=404, detail="Lead not found")
            
            # CASCADE DELETE: Delete from all related tables first
            # Delete lead history (field changes)
            cursor.execute('DELETE FROM lead_history WHERE lead_id = %s', (lead_id,))
            
            # Delete lead status history
            cursor.execute('DELETE FROM lead_status_history WHERE lead_id = %s', (lead_id,))
            
            # Delete lead activities
            cursor.execute('DELETE FROM lead_activities WHERE lead_id = %s', (lead_id,))
            
            # Finally delete the main lead record
            cursor.execute('DELETE FROM leads WHERE lead_id = %s', (lead_id,))
            
           
            conn.commit()
            
            # Log successful deletion
            log_user_activity(
                request=None,
                user_id=user['user_id'],
                username=user['username'],
                action="delete",
                resource_type="lead",
                resource_id=lead_id,
                success=True,
                status_code=200,
                details=f"Lead {lead_id} and all related data deleted successfully",
                session_token=user.get('session_token'),
            )
            
            return {
                "success": True,
                "message": "Lead and all related data deleted successfully"
            }
        except Exception as e:
            conn.rollback()
            # Audit: lead delete failed
            try:
                log_user_activity(
                    request=None,
                    user_id=user['user_id'],
                    username=user['username'],
                    action="delete",
                    resource_type="lead",
                    resource_id=lead_id,
                    success=False,
                    status_code=500,
                    details=str(e),
                    session_token=user.get('session_token'),
                )
            except Exception:
                pass
            raise HTTPException(status_code=500, detail=str(e))
    
    # Audit: lead deleted
    try:
        log_user_activity(
            request=None,
            user_id=user['user_id'],
            username=user['username'],
            action="delete",
            resource_type="lead",
            resource_id=lead_id,
            success=True,
            status_code=200,
            details="Lead deleted",
            session_token=user.get('session_token'),
        )
    except Exception:
        pass

@app.get("/api/settings/lead-settings")
async def get_lead_settings_api(user: dict = Depends(get_current_user)):
    """Get all lead settings from database"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT setting_type, setting_data FROM lead_settings')
        rows = cursor.fetchall()
        
        settings = {}
        for row in rows:
            try:
                settings[row['setting_type']] = json.loads(row['setting_data'])
            except:
                settings[row['setting_type']] = []
        
        result = {"success": True, "settings": settings}

        # Audit: view lead settings
        try:
            log_user_activity(
                request=None,
                user_id=user['user_id'],
                username=user['username'],
                action="view",
                resource_type="lead_settings",
                resource_id=None,
                success=True,
                status_code=200,
                details="Fetched lead settings",
                session_token=user.get('session_token'),
            )
        except Exception:
            pass
        return result

@app.post("/api/settings/lead-settings")
async def save_lead_settings_api(request: Request, user: dict = Depends(get_current_user)):
    """Save lead settings to database"""
    if not check_user_permission(user, 'can_manage_users') and user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="No permission to save settings")
    
    try:
        data = await request.json()
        setting_type = data.get('type')
        setting_data = data.get('data', [])
        
        if not setting_type:
            raise HTTPException(status_code=400, detail="Setting type is required")
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Check if setting exists
            cursor.execute('SELECT id FROM lead_settings WHERE setting_type = %s', (setting_type,))
            existing = cursor.fetchone()
            
            setting_json = json.dumps(setting_data)
            
            if existing:
                # Update existing
                cursor.execute(
                    'UPDATE lead_settings SET setting_data = %s, updated_at = CURRENT_TIMESTAMP, updated_by = %s WHERE setting_type = %s',
                    (setting_json, user['user_id'], setting_type)
                )
            else:
                # Create new
                cursor.execute(
                    'INSERT INTO lead_settings (setting_type, setting_data, updated_by) VALUES (%s, %s, %s)',
                    (setting_type, setting_json, user['user_id'])
                )
            
            conn.commit()
            # Audit: save settings
            try:
                log_user_activity(
                    request=request,
                    user_id=user['user_id'],
                    username=user['username'],
                    action="update",
                    resource_type="lead_settings",
                    resource_id=setting_type,
                    success=True,
                    status_code=200,
                    details=f"Saved {setting_type}",
                    session_token=user.get('session_token'),
                )
            except Exception:
                pass
            return {"success": True, "message": f"{setting_type} settings saved successfully"}
    
    except Exception as e:
        # Audit: settings save failed
        try:
            log_user_activity(
                request=request,
                user_id=user['user_id'],
                username=user['username'],
                action="update",
                resource_type="lead_settings",
                resource_id=None,
                success=False,
                status_code=500,
                details=str(e),
                session_token=user.get('session_token'),
            )
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/dashboard/stats")
async def get_dashboard_stats(user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        where_clause = ""
        params = []
        
        if user['role'] != 'admin':
            where_clause = "WHERE (created_by = %s OR assigned_to = %s)"
            params = [user['user_id'], user['user_id']]
        
        cursor.execute(f'SELECT COUNT(*) as count FROM leads {where_clause}', params)
        result = cursor.fetchone()
        total_leads = result['count'] if result else 0
        
        status_query = f'''
        SELECT lead_status, COUNT(*) as count 
        FROM leads 
        {where_clause}
        GROUP BY lead_status
        ORDER BY count DESC
        '''
        cursor.execute(status_query, params)
        leads_by_status = cursor.fetchall()
        
        recent_query = f'''
        SELECT lead_id, company_name, customer_name, lead_status, updated_at
        FROM leads 
        {where_clause}
        ORDER BY updated_at DESC
        LIMIT 10
        '''
        cursor.execute(recent_query, params)
        recent_leads = cursor.fetchall()
        recent = [dict(l) for l in recent_leads] if recent_leads else []
        for r in recent:
            val = r.get("updated_at")
            if isinstance(val, str) and val:
                try:
                    dt = datetime.strptime(val, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
                    r["updated_at"] = dt.isoformat()
                except Exception:
                    pass
        
        result = {
            "success": True,
            "stats": {
                "total_leads": total_leads,
                "leads_by_status": [dict(s) for s in leads_by_status] if leads_by_status else [],
                "recent_leads": recent
            }
        }
        # Audit: view dashboard stats
        try:
            log_user_activity(
                request=None,
                user_id=user['user_id'],
                username=user['username'],
                action="view",
                resource_type="dashboard_stats",
                resource_id=None,
                success=True,
                status_code=200,
                details="Fetched dashboard stats",
                session_token=user.get('session_token'),
            )
        except Exception:
            pass
        return result

@app.get("/api/designations")
async def get_designations(user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT id, name FROM designations ORDER BY name')
        designations = cursor.fetchall()
        result = {
            "success": True,
            "designations": [dict(d) for d in designations]
        }
        try:
            log_user_activity(
                request=None,
                user_id=user['user_id'],
                username=user['username'],
                action="view",
                resource_type="designations",
                resource_id=None,
                success=True,
                status_code=200,
                details="Fetched designations",
                session_token=user.get('session_token'),
            )
        except Exception:
            pass
        return result

@app.post("/api/designations")
async def create_designation(designation_data: dict, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute('INSERT INTO designations (name) VALUES (%s)', (designation_data.get('name'),))
            conn.commit()
            new_id = cursor.lastrowid
            try:
                log_user_activity(
                    request=None,
                    user_id=current_user['user_id'],
                    username=current_user['username'],
                    action="create",
                    resource_type="designation",
                    resource_id=str(new_id),
                    success=True,
                    status_code=200,
                    details=f"Created designation {designation_data.get('name')}",
                    session_token=current_user.get('session_token'),
                )
            except Exception:
                pass
            return {
                "success": True,
                "id": new_id,
                "name": designation_data.get('name')
            }
        except Exception as e:
            conn.rollback()
            try:
                log_user_activity(
                    request=None,
                    user_id=current_user['user_id'],
                    username=current_user['username'],
                    action="create",
                    resource_type="designation",
                    resource_id=None,
                    success=False,
                    status_code=400,
                    details=str(e),
                    session_token=current_user.get('session_token'),
                )
            except Exception:
                pass
            raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/user")
async def get_current_user_info(user: dict = Depends(get_current_user)):
    """Get current logged-in user information"""
    result = {
        "user_id": user["user_id"],
        "username": user["username"],
        "full_name": user["full_name"],
        "email": user["email"],
        "role": user["role"],
        "permissions": user["permissions"],
        "is_admin": user['role'] == 'admin'
    }
    try:
        log_user_activity(
            request=None,
            user_id=user['user_id'],
            username=user['username'],
            action="view",
            resource_type="user",
            resource_id=str(user['user_id']),
            success=True,
            status_code=200,
            details="Fetched current user",
            session_token=user.get('session_token'),
        )
    except Exception:
        pass
    return result

@app.get("/api/users")
async def get_all_users(user: dict = Depends(get_current_user)):
    if not check_user_permission(user, 'can_view_users'):
        raise HTTPException(status_code=403, detail="No permission to view users")
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute('''
        SELECT u.*, uc.full_name as created_by_name
        FROM users u
        LEFT JOIN users uc ON u.created_by = uc.id
        WHERE u.id != %s
        ORDER BY u.created_at DESC
        ''', (user['user_id'],))
        
        users_data = cursor.fetchall()
        users_list = [dict(u) for u in users_data] if users_data else []
        
        # Add permission count for each user
        for usr in users_list:
            cursor.execute('''
            SELECT COUNT(*) as count 
            FROM user_permissions 
            WHERE user_id = %s AND granted = 1
            ''', (usr['id'],))
            count_result = cursor.fetchone()
            usr['permission_count'] = count_result['count'] if count_result else 0
        
        result = {
            "success": True,
            "users": users_list
        }
        try:
            log_user_activity(
                request=None,
                user_id=user['user_id'],
                username=user['username'],
                action="view",
                resource_type="user_list",
                resource_id=None,
                success=True,
                status_code=200,
                details="Fetched all users",
                session_token=user.get('session_token'),
            )
        except Exception:
            pass
        return result

@app.post("/api/users")
async def create_user(user_data: UserCreate, current_user: dict = Depends(get_current_user)):
    if not check_user_permission(current_user, 'can_manage_users'):
        raise HTTPException(status_code=403, detail="No permission to manage users")
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute('SELECT id FROM users WHERE username = %s', (user_data.username,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Username already exists")
        
        if not user_data.permissions:
            default_perms = {
                'admin': UserPermissions().dict(),
                'sales': UserPermissions(can_view_users=False, can_manage_users=False, can_delete_leads=False, can_edit_leads=True).dict()
            }
            permissions = default_perms.get(user_data.role.value, UserPermissions().dict())
        else:
            permissions = user_data.permissions
        
        hashed_password = hash_password(user_data.password)
        
        try:
            cursor.execute('''
            INSERT INTO users (username, password, first_name, last_name, full_name, email, designation, mobile_no, date_of_birth, photo, role, permissions, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ''', (
                user_data.username,
                hashed_password,
                user_data.first_name,
                user_data.last_name,
                user_data.full_name,
                user_data.email,
                user_data.designation,
                user_data.mobile_no,
                user_data.date_of_birth,
                user_data.photo,
                user_data.role.value,
                json.dumps(permissions),
                current_user['user_id']
            ))
            
            conn.commit()
            try:
                log_user_activity(
                    request=None,
                    user_id=current_user['user_id'],
                    username=current_user['username'],
                    action="create",
                    resource_type="user",
                    resource_id=user_data.username,
                    success=True,
                    status_code=200,
                    details="User created",
                    session_token=current_user.get('session_token'),
                )
            except Exception:
                pass
            return {
                "success": True,
                "message": "User created successfully"
            }
        except Exception as e:
            conn.rollback()
            try:
                log_user_activity(
                    request=None,
                    user_id=current_user['user_id'],
                    username=current_user['username'],
                    action="create",
                    resource_type="user",
                    resource_id=user_data.username,
                    success=False,
                    status_code=500,
                    details=str(e),
                    session_token=current_user.get('session_token'),
                )
            except Exception:
                pass
            raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/users/active")
async def get_active_users(user: dict = Depends(get_current_user)):
    """Get list of active users for assignment dropdowns"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute('''
        SELECT id, username, full_name, role, designation, email, mobile_no
        FROM users 
        WHERE is_active = 1
        ORDER BY full_name
        ''')
        
        users = cursor.fetchall()
        
        return {
            "success": True,
            "users": [dict(u) for u in users] if users else []
        }

# Upload user photo and return relative path under static/
@app.post("/api/upload/photo")
async def upload_photo(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    if not check_user_permission(current_user, 'can_manage_users'):
        raise HTTPException(status_code=403, detail="No permission to manage users")

    try:
        upload_dir = os.path.join("static", "uploads", "users")
        os.makedirs(upload_dir, exist_ok=True)

        # Validate and build filename
        _, ext = os.path.splitext(file.filename or '')
        ext = ext.lower()
        if ext not in {'.jpg', '.jpeg', '.png', '.gif', '.webp'}:
            raise HTTPException(status_code=400, detail="Unsupported file type")

        filename = f"{uuid.uuid4().hex}{ext}"
        dest_path = os.path.join(upload_dir, filename)

        with open(dest_path, 'wb') as out_file:
            shutil.copyfileobj(file.file, out_file)

        rel_path = f"uploads/users/{filename}"
        return {"success": True, "path": rel_path}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/users/{user_id}")
async def update_user(user_id: int, user_data: dict, current_user: dict = Depends(get_current_user)):
    if not check_user_permission(current_user, 'can_manage_users'):
        raise HTTPException(status_code=403, detail="No permission to manage users")
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Check if user exists
        cursor.execute('SELECT id FROM users WHERE id = %s', (user_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="User not found")
        
        try:
            # Build update query dynamically based on provided fields
            fields = []
            values = []
            
            if 'first_name' in user_data:
                fields.append('first_name = %s')
                values.append(user_data['first_name'])
            if 'last_name' in user_data:
                fields.append('last_name = %s')
                values.append(user_data['last_name'])
            if 'full_name' in user_data:
                fields.append('full_name = %s')
                values.append(user_data['full_name'])
            if 'email' in user_data:
                fields.append('email = %s')
                values.append(user_data['email'])
            if 'designation' in user_data:
                fields.append('designation = %s')
                values.append(user_data['designation'])
            if 'mobile_no' in user_data:
                fields.append('mobile_no = %s')
                values.append(user_data['mobile_no'])
            if 'date_of_birth' in user_data:
                fields.append('date_of_birth = %s')
                values.append(user_data['date_of_birth'])
            if 'photo' in user_data:
                fields.append('photo = %s')
                values.append(user_data['photo'])
            if 'role' in user_data:
                fields.append('role = %s')
                values.append(user_data['role'])
            if 'password' in user_data:
                fields.append('password = %s')
                values.append(hash_password(user_data['password']))
            
            if not fields:
                raise HTTPException(status_code=400, detail="No fields to update")
            
            values.append(user_id)
            query = f"UPDATE users SET {', '.join(fields)} WHERE id = %s"
            
            cursor.execute(query, values)
            conn.commit()
            
            try:
                log_user_activity(
                    request=None,
                    user_id=current_user['user_id'],
                    username=current_user['username'],
                    action="update",
                    resource_type="user",
                    resource_id=str(user_id),
                    success=True,
                    status_code=200,
                    details="User updated",
                    session_token=current_user.get('session_token'),
                )
            except Exception:
                pass
            return {
                "success": True,
                "message": "User updated successfully"
            }
        except Exception as e:
            conn.rollback()
            try:
                log_user_activity(
                    request=None,
                    user_id=current_user['user_id'],
                    username=current_user['username'],
                    action="update",
                    resource_type="user",
                    resource_id=str(user_id),
                    success=False,
                    status_code=500,
                    details=str(e),
                    session_token=current_user.get('session_token'),
                )
            except Exception:
                pass
            raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/users/{user_id}/permissions")
async def update_user_permissions(user_id: int, permissions_data: dict, current_user: dict = Depends(get_current_user)):
    if not check_user_permission(current_user, 'can_manage_users'):
        raise HTTPException(status_code=403, detail="No permission to manage users")
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Check if user exists
        cursor.execute('SELECT id FROM users WHERE id = %s', (user_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="User not found")
        
        try:
            # Get permissions dict
            permissions = permissions_data.get('permissions', {})
            
            cursor.execute(
                'UPDATE users SET permissions = %s WHERE id = %s',
                (json.dumps(permissions), user_id)
            )
            conn.commit()
            
            try:
                log_user_activity(
                    request=None,
                    user_id=current_user['user_id'],
                    username=current_user['username'],
                    action="update_permissions",
                    resource_type="user",
                    resource_id=str(user_id),
                    success=True,
                    status_code=200,
                    details="Permissions updated",
                    session_token=current_user.get('session_token'),
                )
            except Exception:
                pass
            return {
                "success": True,
                "message": "Permissions updated successfully"
            }
        except Exception as e:
            conn.rollback()
            try:
                log_user_activity(
                    request=None,
                    user_id=current_user['user_id'],
                    username=current_user['username'],
                    action="update_permissions",
                    resource_type="user",
                    resource_id=str(user_id),
                    success=False,
                    status_code=500,
                    details=str(e),
                    session_token=current_user.get('session_token'),
                )
            except Exception:
                pass
            raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/users/{user_id}/status")
async def update_user_status(user_id: int, status_data: dict, current_user: dict = Depends(get_current_user)):
    if not check_user_permission(current_user, 'can_manage_users'):
        raise HTTPException(status_code=403, detail="No permission to manage users")
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Check if user exists
        cursor.execute('SELECT id FROM users WHERE id = %s', (user_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="User not found")
        
        try:
            is_active = status_data.get('is_active', True)
            
            cursor.execute(
                'UPDATE users SET is_active = %s WHERE id = %s',
                (is_active, user_id)
            )
            conn.commit()
            
            status_text = "activated" if is_active else "deactivated"
            try:
                log_user_activity(
                    request=None,
                    user_id=current_user['user_id'],
                    username=current_user['username'],
                    action="update_status",
                    resource_type="user",
                    resource_id=str(user_id),
                    success=True,
                    status_code=200,
                    details=f"User {status_text}",
                    session_token=current_user.get('session_token'),
                )
            except Exception:
                pass
            return {
                "success": True,
                "message": f"User {status_text} successfully"
            }
        except Exception as e:
            conn.rollback()
            try:
                log_user_activity(
                    request=None,
                    user_id=current_user['user_id'],
                    username=current_user['username'],
                    action="update_status",
                    resource_type="user",
                    resource_id=str(user_id),
                    success=False,
                    status_code=500,
                    details=str(e),
                    session_token=current_user.get('session_token'),
                )
            except Exception:
                pass
            raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/users/{user_id}")
async def delete_user(user_id: int, current_user: dict = Depends(get_current_user)):
    if not check_user_permission(current_user, 'can_manage_users'):
        raise HTTPException(status_code=403, detail="No permission to manage users")
    
    # Prevent self-deletion
    if current_user['user_id'] == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Check if user exists
        cursor.execute('SELECT id FROM users WHERE id = %s', (user_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="User not found")
        
        try:
            cursor.execute('DELETE FROM users WHERE id = %s', (user_id,))
            conn.commit()
            
            try:
                log_user_activity(
                    request=None,
                    user_id=current_user['user_id'],
                    username=current_user['username'],
                    action="delete",
                    resource_type="user",
                    resource_id=str(user_id),
                    success=True,
                    status_code=200,
                    details="User deleted",
                    session_token=current_user.get('session_token'),
                )
            except Exception:
                pass
            return {
                "success": True,
                "message": "User deleted successfully"
            }
        except Exception as e:
            conn.rollback()
            try:
                log_user_activity(
                    request=None,
                    user_id=current_user['user_id'],
                    username=current_user['username'],
                    action="delete",
                    resource_type="user",
                    resource_id=str(user_id),
                    success=False,
                    status_code=500,
                    details=str(e),
                    session_token=current_user.get('session_token'),
                )
            except Exception:
                pass
            raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/dashboard/stats")
async def get_dashboard_stats(user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        where_clause = ""
        params = []
        
        if user['role'] != 'admin':
            where_clause = "WHERE (created_by = %s OR assigned_to = %s)"
            params = [user['user_id'], user['user_id']]
        
        # Total leads
        cursor.execute(f'SELECT COUNT(*) as count FROM leads {where_clause}', params)
        result = cursor.fetchone()
        total_leads = result['count'] if result else 0
        
        # Upcoming follow-ups (next X days based on preference)
        prefs = get_preferences()
        follow_up_days = int(prefs.get('followUpDays', 7))
        
        upcoming_query = f'''
        SELECT COUNT(*) as count 
        FROM leads 
        WHERE next_follow_up_date >= CURDATE() 
        AND next_follow_up_date <= DATE_ADD(CURDATE(), INTERVAL {follow_up_days} DAY)
        {where_clause}
        '''
        cursor.execute(upcoming_query, params)
        upcoming_result = cursor.fetchone()
        upcoming_followups = upcoming_result['count'] if upcoming_result else 0

        # Leads by status
        status_query = f'''
        SELECT lead_status, COUNT(*) as count 
        FROM leads 
        {where_clause}
        GROUP BY lead_status
        ORDER BY count DESC
        '''
        cursor.execute(status_query, params)
        leads_by_status = cursor.fetchall()
        
        # Recent leads
        recent_query = f'''
        SELECT lead_id, company_name, customer_name, lead_status, updated_at
        FROM leads 
        {where_clause}
        ORDER BY updated_at DESC
        LIMIT 10
        '''
        cursor.execute(recent_query, params)
        recent_leads = cursor.fetchall()
        recent = [dict(l) for l in recent_leads] if recent_leads else []
        for r in recent:
            for ts_field in ("created_at", "updated_at"):
                val = r.get(ts_field)
                if isinstance(val, str) and val:
                    try:
                        dt = datetime.strptime(val, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
                        r[ts_field] = dt.isoformat()
                    except Exception:
                        pass
        
        return {
            "success": True,
            "stats": {
                "total_leads": total_leads,
                "upcoming_followups": upcoming_followups,
                "leads_by_status": [dict(s) for s in leads_by_status] if leads_by_status else [],
                "recent_leads": recent
            }
        }

# ============ TARGETS API ENDPOINTS ============

@app.get("/api/targets")
async def get_targets(user: dict = Depends(get_current_user)):
    """Get all targets"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, name, type, target_value, current_value, 
                     assigned_to, period, context_tab, description, is_active, 
                   created_at, updated_at 
            FROM targets 
            WHERE is_active = 1
            ORDER BY created_at DESC
        ''')
        targets = cursor.fetchall()
        result = {
            "success": True,
            "targets": [dict(t) for t in targets] if targets else []
        }
        try:
            log_user_activity(
                request=None,
                user_id=user['user_id'],
                username=user['username'],
                action="view",
                resource_type="target_list",
                resource_id=None,
                success=True,
                status_code=200,
                details="Fetched targets",
                session_token=user.get('session_token'),
            )
        except Exception:
            pass
        return result

@app.post("/api/targets")
async def create_target(request: Request, user: dict = Depends(get_current_user)):
    """Create a new target"""
    try:
        data = await request.json()
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO targets (name, type, target_value, current_value, assigned_to, period, context_tab, description, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ''', (
                data.get('name'),
                data.get('type'),
                data.get('target_value', 0),
                data.get('current_value', 0),
                data.get('assigned_to', user['user_id']),
                data.get('period'),
                data.get('context_tab'),
                data.get('description', ''),
                user['user_id']
            ))
            conn.commit()
            target_id = cursor.lastrowid
            
            try:
                log_user_activity(
                    request=request,
                    user_id=user['user_id'],
                    username=user['username'],
                    action="create",
                    resource_type="target",
                    resource_id=str(target_id),
                    success=True,
                    status_code=200,
                    details="Target created",
                    session_token=user.get('session_token'),
                )
            except Exception:
                pass
            return {
                "success": True,
                "message": "Target created successfully",
                "target_id": target_id
            }
    except Exception as e:
        try:
            log_user_activity(
                request=request,
                user_id=user['user_id'] if isinstance(user, dict) else None,
                username=user['username'] if isinstance(user, dict) else None,
                action="create",
                resource_type="target",
                resource_id=None,
                success=False,
                status_code=500,
                details=str(e),
                session_token=user.get('session_token') if isinstance(user, dict) else None,
            )
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/targets/{target_id}")
async def update_target(target_id: int, request: Request, user: dict = Depends(get_current_user)):
    """Update an existing target"""
    try:
        data = await request.json()
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Update the target
            update_fields = []
            params = []
            
            if 'name' in data:
                update_fields.append('name = %s')
                params.append(data['name'])
            if 'type' in data:
                update_fields.append('type = %s')
                params.append(data['type'])
            if 'target_value' in data:
                update_fields.append('target_value = %s')
                params.append(data['target_value'])
            if 'current_value' in data:
                update_fields.append('current_value = %s')
                params.append(data['current_value'])
            if 'period' in data:
                update_fields.append('period = %s')
                params.append(data['period'])
            if 'context_tab' in data:
                update_fields.append('context_tab = %s')
                params.append(data['context_tab'])
            if 'description' in data:
                update_fields.append('description = %s')
                params.append(data['description'])
            
            update_fields.append('updated_at = CURRENT_TIMESTAMP')
            params.append(target_id)
            
            query = f"UPDATE targets SET {', '.join(update_fields)} WHERE id = %s"
            cursor.execute(query, params)
            conn.commit()
            
            try:
                log_user_activity(
                    request=request,
                    user_id=user['user_id'],
                    username=user['username'],
                    action="update",
                    resource_type="target",
                    resource_id=str(target_id),
                    success=True,
                    status_code=200,
                    details="Target updated",
                    session_token=user.get('session_token'),
                )
            except Exception:
                pass
            return {
                "success": True,
                "message": "Target updated successfully"
            }
    except Exception as e:
        try:
            log_user_activity(
                request=request,
                user_id=user['user_id'] if isinstance(user, dict) else None,
                username=user['username'] if isinstance(user, dict) else None,
                action="update",
                resource_type="target",
                resource_id=str(target_id),
                success=False,
                status_code=500,
                details=str(e),
                session_token=user.get('session_token') if isinstance(user, dict) else None,
            )
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/targets/{target_id}")
async def delete_target(target_id: int, user: dict = Depends(get_current_user)):
    """Delete a target"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            # Soft delete - set is_active to 0
            cursor.execute('''
                UPDATE targets 
                SET is_active = 0, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            ''', (target_id,))
            conn.commit()
            
            try:
                log_user_activity(
                    request=None,
                    user_id=user['user_id'],
                    username=user['username'],
                    action="delete",
                    resource_type="target",
                    resource_id=str(target_id),
                    success=True,
                    status_code=200,
                    details="Target deleted",
                    session_token=user.get('session_token'),
                )
            except Exception:
                pass
            return {
                "success": True,
                "message": "Target deleted successfully"
            }
    except Exception as e:
        try:
            log_user_activity(
                request=None,
                user_id=user['user_id'] if isinstance(user, dict) else None,
                username=user['username'] if isinstance(user, dict) else None,
                action="delete",
                resource_type="target",
                resource_id=str(target_id),
                success=False,
                status_code=500,
                details=str(e),
                session_token=user.get('session_token') if isinstance(user, dict) else None,
            )
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=str(e))

def parse_target_period(period: str) -> tuple:
    """Parse period string and return (start_date, end_date) for queries"""
    from datetime import datetime, timedelta
    import calendar
    
    now = datetime.now()
    
    if period == 'daily':
        # Today
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = now.replace(hour=23, minute=59, second=59, microsecond=999999)
        
    elif period == 'weekly':
        # Current week (Monday to Sunday)
        start = now - timedelta(days=now.weekday())
        start = start.replace(hour=0, minute=0, second=0, microsecond=0)
        end = start + timedelta(days=6, hours=23, minutes=59, seconds=59)
        
    elif period == 'monthly':
        # Current month
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        last_day = calendar.monthrange(now.year, now.month)[1]
        end = now.replace(day=last_day, hour=23, minute=59, second=59, microsecond=999999)
        
    elif period == 'quarterly':
        # Current quarter
        quarter = (now.month - 1) // 3 + 1
        start_month = (quarter - 1) * 3 + 1
        start = datetime(now.year, start_month, 1, 0, 0, 0)
        end_month = start_month + 2
        last_day = calendar.monthrange(now.year, end_month)[1]
        end = datetime(now.year, end_month, last_day, 23, 59, 59)
        
    elif period == 'yearly':
        # Current year
        start = datetime(now.year, 1, 1, 0, 0, 0)
        end = datetime(now.year, 12, 31, 23, 59, 59)
        
    elif period.startswith('2025-Q') or period.startswith('2026-Q'):
        # Specific quarter (e.g., '2025-Q1')
        year = int(period[:4])
        quarter = int(period[-1])
        start_month = (quarter - 1) * 3 + 1
        start = datetime(year, start_month, 1, 0, 0, 0)
        end_month = start_month + 2
        last_day = calendar.monthrange(year, end_month)[1]
        end = datetime(year, end_month, last_day, 23, 59, 59)
        
    elif period.isdigit() and len(period) == 4:
        # Specific year (e.g., '2025')
        year = int(period)
        start = datetime(year, 1, 1, 0, 0, 0)
        end = datetime(year, 12, 31, 23, 59, 59)
        
    else:
        # Default to current month
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        last_day = calendar.monthrange(now.year, now.month)[1]
        end = now.replace(day=last_day, hour=23, minute=59, second=59, microsecond=999999)
    
    return (start.strftime('%Y-%m-%d %H:%M:%S'), end.strftime('%Y-%m-%d %H:%M:%S'))

@app.post("/api/targets/{target_id}/calculate-progress")
async def calculate_target_progress(target_id: int, user: dict = Depends(get_current_user)):
    """Calculate and update target progress based on actual lead history"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Debug log
            print(f"🔍 Looking for target_id: {target_id} (type: {type(target_id)})")
            
            # Get target details
            cursor.execute('SELECT * FROM targets WHERE id = %s', (target_id,))
            target = cursor.fetchone()
            
            if not target:
                # Check what targets exist
                cursor.execute('SELECT id, name FROM targets ORDER BY id DESC LIMIT 5')
                existing_targets = cursor.fetchall()
                print(f"⚠️ Target {target_id} not found. Recent targets: {existing_targets}")
                raise HTTPException(status_code=404, detail=f"Target not found (ID: {target_id})")
            
            context_tab = target.get('context_tab')
            target_name = target.get('name')
            target_type = target.get('type')
            assigned_to = target.get('assigned_to')
            period = target.get('period')
            
            # Parse period to get date range
            date_start, date_end = parse_target_period(period)
            
            # Field mapping for context tabs
            field_map = {
                'sources': 'lead_source',
                'statuses': 'lead_status',
                'types': 'lead_type',
                'systems': 'system',
                'project_amc': 'project_amc',
                'communication_method': 'method_of_communication'
            }
            
            current_value = 0
            
            # Calculate based on target type
            if target_type == 'deals':
                # Count status changes to specific status from history
                if context_tab == 'statuses':
                    # Count how many times this status was set in the period
                    cursor.execute('''
                        SELECT COUNT(DISTINCT lead_id) as count
                        FROM lead_status_history
                        WHERE new_status = %s
                          AND changed_by = %s
                          AND changed_at BETWEEN %s AND %s
                    ''', (target_name, assigned_to, date_start, date_end))
                    result = cursor.fetchone()
                    current_value = result['count'] if result else 0
                    
                elif context_tab == 'sources':
                    # Count closed/won deals from specific source
                    cursor.execute('''
                        SELECT COUNT(DISTINCT lsh.lead_id) as count
                        FROM lead_status_history lsh
                        JOIN leads l ON lsh.lead_id = l.lead_id
                        WHERE lsh.new_status IN ('Closed', 'Won', 'Converted')
                          AND l.lead_source = %s
                          AND lsh.changed_by = %s
                          AND lsh.changed_at BETWEEN %s AND %s
                    ''', (target_name, assigned_to, date_start, date_end))
                    result = cursor.fetchone()
                    current_value = result['count'] if result else 0
                else:
                    # Generic deal count based on context
                    filter_field = field_map.get(context_tab, 'lead_status')
                    cursor.execute(f'''
                        SELECT COUNT(DISTINCT lsh.lead_id) as count
                        FROM lead_status_history lsh
                        JOIN leads l ON lsh.lead_id = l.lead_id
                        WHERE lsh.new_status IN ('Closed', 'Won', 'Converted')
                          AND l.{filter_field} = %s
                          AND lsh.changed_by = %s
                          AND lsh.changed_at BETWEEN %s AND %s
                    ''', (target_name, assigned_to, date_start, date_end))
                    result = cursor.fetchone()
                    current_value = result['count'] if result else 0
                    
            elif target_type == 'revenue':
                # Sum closing amounts from history when they were updated
                if context_tab and context_tab in field_map:
                    filter_field = field_map[context_tab]
                    cursor.execute(f'''
                        SELECT COALESCE(SUM(CAST(lh.new_value AS DECIMAL(15,2))), 0) as total
                        FROM lead_history lh
                        JOIN leads l ON lh.lead_id = l.lead_id
                        WHERE lh.field_name = 'closing_amount'
                          AND lh.new_value IS NOT NULL
                          AND lh.new_value != ''
                          AND lh.new_value != '0'
                          AND l.{filter_field} = %s
                          AND lh.changed_by = %s
                          AND lh.changed_at BETWEEN %s AND %s
                    ''', (target_name, assigned_to, date_start, date_end))
                else:
                    # All revenue for this user in period
                    cursor.execute('''
                        SELECT COALESCE(SUM(CAST(new_value AS DECIMAL(15,2))), 0) as total
                        FROM lead_history
                        WHERE field_name = 'closing_amount'
                          AND new_value IS NOT NULL
                          AND new_value != ''
                          AND new_value != '0'
                          AND changed_by = %s
                          AND changed_at BETWEEN %s AND %s
                    ''', (assigned_to, date_start, date_end))
                result = cursor.fetchone()
                current_value = float(result['total']) if result else 0.0
                
            elif target_type == 'units':
                # Count activities or lead touches in period - ONLY from lead_history table
                if context_tab == 'communication_method':
                    # Track Method of Communication changes from lead_history
                    # Count ALL history entries (same lead updated 5 times = 5 counts)
                    cursor.execute('''
                        SELECT COUNT(*) as count
                        FROM lead_history
                        WHERE field_name = 'method_of_communication'
                          AND new_value = %s
                          AND changed_by = %s
                          AND changed_at BETWEEN %s AND %s
                    ''', (target_name, assigned_to, date_start, date_end))
                    result = cursor.fetchone()
                    current_value = result['count'] if result else 0
                    
                elif context_tab == 'sources':
                    # Track Lead Source changes from lead_history
                    cursor.execute('''
                        SELECT COUNT(*) as count
                        FROM lead_history
                        WHERE field_name = 'lead_source'
                          AND new_value = %s
                          AND changed_by = %s
                          AND changed_at BETWEEN %s AND %s
                    ''', (target_name, assigned_to, date_start, date_end))
                    result = cursor.fetchone()
                    current_value = result['count'] if result else 0
                else:
                    # Count distinct leads worked on in period
                    cursor.execute('''
                        SELECT COUNT(DISTINCT lead_id) as count
                        FROM lead_status_history
                        WHERE changed_by = %s
                          AND changed_at BETWEEN %s AND %s
                    ''', (assigned_to, date_start, date_end))
                    result = cursor.fetchone()
                    current_value = result['count'] if result else 0
                    
            elif target_type == 'conversion':
                # Calculate conversion rate from history
                # Total leads touched
                cursor.execute('''
                    SELECT COUNT(DISTINCT lead_id) as count
                    FROM lead_status_history
                    WHERE changed_by = %s
                      AND changed_at BETWEEN %s AND %s
                ''', (assigned_to, date_start, date_end))
                total_result = cursor.fetchone()
                total = total_result['count'] if total_result else 0
                
                # Converted leads
                cursor.execute('''
                    SELECT COUNT(DISTINCT lead_id) as count
                    FROM lead_status_history
                    WHERE new_status IN ('Closed', 'Won', 'Converted')
                      AND changed_by = %s
                      AND changed_at BETWEEN %s AND %s
                ''', (assigned_to, date_start, date_end))
                converted_result = cursor.fetchone()
                converted = converted_result['count'] if converted_result else 0
                
                current_value = round((converted / total * 100), 2) if total > 0 else 0.0
            
            # Update target with calculated value
            cursor.execute('''
                UPDATE targets 
                SET current_value = %s, 
                    updated_at = CURRENT_TIMESTAMP 
                WHERE id = %s
            ''', (current_value, target_id))
            conn.commit()
            
            # Calculate percentage
            target_value = float(target.get('target_value', 0))
            percentage = round((current_value / target_value * 100), 2) if target_value > 0 else 0
            
            try:
                log_user_activity(
                    request=None,
                    user_id=user['user_id'],
                    username=user['username'],
                    action="calculate",
                    resource_type="target",
                    resource_id=str(target_id),
                    success=True,
                    status_code=200,
                    details=f"Progress calculated: {current_value}/{target_value}",
                    session_token=user.get('session_token'),
                )
            except Exception:
                pass
                
            return {
                "success": True,
                "target_id": target_id,
                "current_value": current_value,
                "target_value": target_value,
                "percentage": percentage,
                "period": period,
                "date_range": {"start": date_start, "end": date_end},
                "message": "Target progress calculated successfully"
            }
            
    except HTTPException:
        raise
    except Exception as e:
        try:
            log_user_activity(
                request=None,
                user_id=user['user_id'] if isinstance(user, dict) else None,
                username=user['username'] if isinstance(user, dict) else None,
                action="calculate",
                resource_type="target",
                resource_id=str(target_id),
                success=False,
                status_code=500,
                details=str(e),
                session_token=user.get('session_token') if isinstance(user, dict) else None,
            )
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/targets/calculate-all")
async def calculate_all_targets_progress(user: dict = Depends(get_current_user)):
    """Calculate progress for all active targets"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT id FROM targets WHERE is_active = 1')
            targets = cursor.fetchall()
            
            results = []
            for target in targets:
                try:
                    result = await calculate_target_progress(target['id'], user)
                    results.append(result)
                except Exception as e:
                    results.append({"target_id": target['id'], "success": False, "error": str(e)})
            
            return {
                "success": True,
                "message": f"Calculated {len(results)} targets",
                "results": results
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ====== Audit query endpoint (admin only) ======
@app.get("/api/audit/logs")
async def get_audit_logs(
    request: Request,
    user: dict = Depends(get_current_user),
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
):
    # Admin-only access
    if user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")

    with get_db_connection() as conn:
        cursor = conn.cursor()
        where = []
        params = []

        if user_id is not None:
            where.append('user_id = %s')
            params.append(user_id)
        if action:
            where.append('action = %s')
            params.append(action)
        if resource_type:
            where.append('resource_type = %s')
            params.append(resource_type)
        if date_from:
            where.append("DATE(created_at) >= DATE(%s)")
            params.append(date_from)
        if date_to:
            where.append("DATE(created_at) <= DATE(%s)")
            params.append(date_to)

        base = 'SELECT * FROM audit_logs'
        if where:
            base += ' WHERE ' + ' AND '.join(where)

        # Count
        count_q = 'SELECT COUNT(*) as count FROM (' + base + ')'
        cursor.execute(count_q, params)
        count_result = cursor.fetchone()
        total = count_result['count'] if count_result else 0

        # Page
        offset = (page - 1) * limit
        q = base + ' ORDER BY created_at DESC LIMIT %s OFFSET %s'
        cursor.execute(q, params + [limit, offset])
        rows = cursor.fetchall()

        logs = [dict(r) for r in rows] if rows else []

        # Audit: audit logs viewed
        try:
            log_user_activity(
                request=request,
                user_id=user['user_id'],
                username=user['username'],
                action="view",
                resource_type="audit_logs",
                resource_id=None,
                success=True,
                status_code=200,
                details=f"filters user_id={user_id} action={action} resource_type={resource_type}",
                session_token=user.get('session_token'),
            )
        except Exception:
            pass

        return {
            "success": True,
            "data": logs,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "pages": (total + limit - 1) // limit if limit > 0 else 0
            }
        }

# ==================== PERMISSION MANAGEMENT ENDPOINTS ====================

@app.get("/api/permissions")
async def get_all_permissions(user: dict = Depends(get_current_user)):
    """Get all permissions with hierarchy - admin only"""
    if user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can view all permissions")
    
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
            SELECT id, permission_key, permission_name, parent_id, category, level, description
            FROM permissions
            ORDER BY level, parent_id, permission_key
            ''')
            rows = cursor.fetchall()
            permissions = [dict(r) for r in rows] if rows else []
            
            return {"success": True, "data": permissions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/permissions/tree")
async def get_permissions_tree(user: dict = Depends(get_current_user)):
    """Get permissions as hierarchical tree structure - admin only"""
    if user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can view permission tree")
    
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
            SELECT id, permission_key, permission_name, parent_id, category, level, description
            FROM permissions
            ORDER BY level, parent_id, permission_key
            ''')
            rows = cursor.fetchall()
            all_perms = [dict(r) for r in rows] if rows else []
            
            # Build tree structure
            tree = []
            perm_map = {p['id']: {**p, 'children': []} for p in all_perms}
            
            for perm in all_perms:
                if perm['parent_id'] is None:
                    tree.append(perm_map[perm['id']])
                else:
                    if perm['parent_id'] in perm_map:
                        perm_map[perm['parent_id']]['children'].append(perm_map[perm['id']])
            
            return {"success": True, "data": tree}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/users/{user_id}/permissions")
async def get_user_permissions(user_id: int, user: dict = Depends(get_current_user)):
    """Get specific user's permissions - admin only"""
    if user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can view user permissions")
    
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Get user details
            cursor.execute('SELECT id, username, full_name, role FROM users WHERE id = %s', (user_id,))
            user_data = cursor.fetchone()
            if not user_data:
                raise HTTPException(status_code=404, detail="User not found")
            
            # Get user's permissions
            cursor.execute('''
            SELECT p.id, p.permission_key, p.permission_name, p.parent_id, p.category, p.level,
                   up.granted, up.granted_at
            FROM user_permissions up
            JOIN permissions p ON up.permission_id = p.id
            WHERE up.user_id = %s AND up.granted = 1
            ORDER BY p.level, p.permission_key
            ''', (user_id,))
            rows = cursor.fetchall()
            permissions = [dict(r) for r in rows] if rows else []
            
            # Get permission keys only
            permission_keys = [p['permission_key'] for p in permissions]
            
            return {
                "success": True,
                "user": dict(user_data),
                "permissions": permissions,
                "permission_keys": permission_keys
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/users/{user_id}/permissions")
async def assign_user_permissions(user_id: int, request: Request, user: dict = Depends(get_current_user)):
    """Assign permissions to user - admin only"""
    if user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can assign permissions")
    
    try:
        data = await request.json()
        permission_ids = data.get('permission_ids', [])
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Check if user exists
            cursor.execute('SELECT id FROM users WHERE id = %s', (user_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="User not found")
            
            # Delete existing permissions
            cursor.execute('DELETE FROM user_permissions WHERE user_id = %s', (user_id,))
            
            # Assign new permissions
            for perm_id in permission_ids:
                cursor.execute('''
                INSERT INTO user_permissions (user_id, permission_id, granted, granted_by)
                VALUES (%s, %s, 1, %s)
                ''', (user_id, perm_id, user['user_id']))
            
            conn.commit()
            
            # Log activity
            try:
                log_user_activity(
                    request=request,
                    user_id=user['user_id'],
                    username=user['username'],
                    action="assign_permissions",
                    resource_type="user",
                    resource_id=str(user_id),
                    success=True,
                    status_code=200,
                    details=f"Assigned {len(permission_ids)} permissions",
                    session_token=user.get('session_token')
                )
            except:
                pass
            
            return {"success": True, "message": f"Assigned {len(permission_ids)} permissions"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/users/{user_id}/permissions/{permission_id}")
async def revoke_user_permission(user_id: int, permission_id: int, request: Request, user: dict = Depends(get_current_user)):
    """Revoke specific permission from user"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
            DELETE FROM user_permissions 
            WHERE user_id = %s AND permission_id = %s
            ''', (user_id, permission_id))
            conn.commit()
            
            return {"success": True, "message": "Permission revoked"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/check-permission")
async def check_permission(request: Request, user: dict = Depends(get_current_user)):
    """Check if user has specific permission"""
    try:
        data = await request.json()
        permission_key = data.get('permission_key')
        
        if not permission_key:
            raise HTTPException(status_code=400, detail="permission_key required")
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
            SELECT COUNT(*) as count
            FROM user_permissions up
            JOIN permissions p ON up.permission_id = p.id
            WHERE up.user_id = %s AND p.permission_key = %s AND up.granted = 1
            ''', (user['user_id'], permission_key))
            result = cursor.fetchone()
            has_permission = result['count'] > 0 if result else False
            
            return {"success": True, "has_permission": has_permission}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
