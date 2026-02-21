from fastapi import FastAPI, APIRouter, HTTPException, Request, Response
from fastapi.responses import FileResponse, StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import hashlib
import json
import re
import random
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from io import BytesIO
import jwt
import asyncio

from csv_manager import CSVManager
from gmail_service import GmailService
from pdf_service import PDFService

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Services
csv_mgr = CSVManager(ROOT_DIR / 'data')
gmail_svc = GmailService(
    email_addr=os.environ.get('GMAIL_EMAIL', ''),
    password=os.environ.get('GMAIL_PASSWORD', '')
)
pdf_svc = PDFService(ROOT_DIR / 'pdfs')

JWT_SECRET = os.environ.get('JWT_SECRET', 'dpdp-shield-secret')
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', '')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', '')

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ── Startup ──
@app.on_event("startup")
async def startup():
    csv_mgr.seed_customers(30)
    csv_mgr.seed_sample_incident()
    # Store breach state in MongoDB
    existing = await db.breach_state.find_one({"_id": "current"})
    if not existing:
        await db.breach_state.insert_one({
            "_id": "current",
            "active": False,
            "incident_id": None,
            "discovery_time": None,
            "nature": "",
            "systems": "",
            "categories": "",
            "affected_count": 0,
            "step": 0,
            "containment_confirmed": False,
            "dpb_sent": False,
            "users_notified": False,
            "closed": False,
            "closed_at": None,
            "timeline": [],
        })
    # Store settings in MongoDB
    existing_settings = await db.settings.find_one({"_id": "app_settings"})
    if not existing_settings:
        await db.settings.insert_one({
            "_id": "app_settings",
            "theme": "dark",
            "sim_leaked_api_key": False,
            "sim_mailbox_forwarding": False,
            "sim_mass_download": False,
            "integrations": {"zoho": False, "whatsapp": False, "cloudwatch": False, "tally": False},
        })
    # Store OTPs in MongoDB
    await db.otps.create_index("expires_at", expireAfterSeconds=0)
    logger.info("DPDP Shield started. Customers seeded.")

@app.on_event("shutdown")
async def shutdown():
    client.close()


# ── Pydantic Models ──
class LoginRequest(BaseModel):
    email: str
    password: str

class CustomerCreate(BaseModel):
    name: str
    email: str
    phone: str

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = None

class BreachTrigger(BaseModel):
    nature: str = "Unauthorized access to personal data"
    systems: str = "Customer Database, Email Server"
    categories: str = "Name, Email, Phone Number"
    affected_count: int = 30
    description: str = "A potential data breach has been detected involving unauthorized access to the customer database."

class OTPVerify(BaseModel):
    request_id: str
    otp: str

class EmailProcess(BaseModel):
    email_id: str
    from_email: str
    subject: str
    body: str
    received_at: str = ""

class BroadcastRequest(BaseModel):
    channel: str = "EMAIL"
    message: str = ""

class CorrectionData(BaseModel):
    request_id: str
    customer_id: str
    new_name: Optional[str] = None
    new_email: Optional[str] = None
    new_phone: Optional[str] = None


# ── Auth Helpers ──
def create_token(email):
    payload = {"email": email, "exp": datetime.now(timezone.utc) + timedelta(hours=12), "iat": datetime.now(timezone.utc)}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def verify_token(token):
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except Exception:
        return None

async def get_admin(request: Request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    payload = verify_token(auth.split(" ")[1])
    if not payload:
        raise HTTPException(401, "Invalid token")
    return payload["email"]


# ══════════════════════════════════════
# AUTH ROUTES
# ══════════════════════════════════════
@api_router.post("/auth/login")
async def login(req: LoginRequest, request: Request):
    if req.email != ADMIN_EMAIL or req.password != ADMIN_PASSWORD:
        raise HTTPException(401, "Invalid credentials")
    token = create_token(req.email)
    session_id = str(uuid.uuid4())
    ua = request.headers.get("User-Agent", "unknown")
    ip = request.client.host if request.client else "unknown"
    csv_mgr.append_row('admin_access.csv', {
        'session_id': session_id,
        'admin_email': req.email,
        'login_time': datetime.now(timezone.utc).isoformat(),
        'logout_time': '',
        'ip_address': ip,
        'device': ua[:100],
    })
    return {"token": token, "session_id": session_id, "email": req.email}

@api_router.post("/auth/logout")
async def logout(request: Request):
    body = await request.json()
    session_id = body.get("session_id", "")
    if session_id:
        csv_mgr.update_row('admin_access.csv', 'session_id', session_id, {
            'logout_time': datetime.now(timezone.utc).isoformat()
        })
    return {"ok": True}


# ══════════════════════════════════════
# CUSTOMER ROUTES
# ══════════════════════════════════════
@api_router.get("/customers")
async def get_customers():
    return csv_mgr.read_csv('customers.csv')

@api_router.post("/customers")
async def create_customer(c: CustomerCreate):
    cid = csv_mgr.get_next_id('customers.csv', 'customer_id', 'CUST-')
    if not re.match(r'^CUST-\d{4}$', cid):
        raise HTTPException(400, "Invalid customer ID format")
    now = datetime.now(timezone.utc).isoformat()
    row = {'customer_id': cid, 'name': c.name, 'email': c.email, 'phone': c.phone, 'status': 'ACTIVE', 'created_at': now, 'updated_at': now}
    csv_mgr.append_row('customers.csv', row)
    return row

@api_router.put("/customers/{customer_id}")
async def update_customer(customer_id: str, c: CustomerUpdate):
    existing = csv_mgr.find_customer(customer_id)
    if not existing:
        raise HTTPException(404, "Customer not found")
    updates = {k: v for k, v in c.model_dump().items() if v is not None}
    updates['updated_at'] = datetime.now(timezone.utc).isoformat()
    csv_mgr.update_row('customers.csv', 'customer_id', customer_id, updates)
    return {**existing, **updates}

@api_router.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str):
    existing = csv_mgr.find_customer(customer_id)
    if not existing:
        raise HTTPException(404, "Customer not found")
    csv_mgr.update_row('customers.csv', 'customer_id', customer_id, {
        'status': 'DELETED', 'name': 'REDACTED', 'email': 'REDACTED', 'phone': 'REDACTED',
        'updated_at': datetime.now(timezone.utc).isoformat()
    })
    return {"ok": True, "customer_id": customer_id}

@api_router.get("/customers/export")
async def export_customers():
    filepath = csv_mgr.data_dir / 'customers.csv'
    return FileResponse(filepath, media_type='text/csv', filename='customers.csv')


# ══════════════════════════════════════
# BREACH ROUTES
# ══════════════════════════════════════
@api_router.get("/breach/status")
async def breach_status():
    state = await db.breach_state.find_one({"_id": "current"})
    if not state:
        return {"active": False}
    state.pop("_id", None)
    return state

@api_router.post("/breach/trigger")
async def trigger_breach(b: BreachTrigger):
    state = await db.breach_state.find_one({"_id": "current"})
    if state and state.get("active"):
        raise HTTPException(400, "Breach already active")
    now = datetime.now(timezone.utc).isoformat()
    incident_id = f"INC-{random.randint(100,999)}"
    timeline = [{"time": now, "event": "Breach protocol triggered", "type": "trigger"}]
    await db.breach_state.update_one({"_id": "current"}, {"$set": {
        "active": True,
        "incident_id": incident_id,
        "discovery_time": now,
        "nature": b.nature,
        "systems": b.systems,
        "categories": b.categories,
        "affected_count": b.affected_count,
        "description": b.description,
        "step": 1,
        "containment_confirmed": False,
        "dpb_sent": False,
        "users_notified": False,
        "closed": False,
        "closed_at": None,
        "timeline": timeline,
    }})
    return {"ok": True, "incident_id": incident_id, "discovery_time": now}

@api_router.post("/breach/contain")
async def confirm_containment():
    now = datetime.now(timezone.utc).isoformat()
    await db.breach_state.update_one({"_id": "current"}, {
        "$set": {"containment_confirmed": True, "step": 2},
        "$push": {"timeline": {"time": now, "event": "Containment confirmed", "type": "containment"}}
    })
    return {"ok": True}

@api_router.post("/breach/dpb-notice")
async def generate_dpb_notice():
    state = await db.breach_state.find_one({"_id": "current"})
    if not state or not state.get("active"):
        raise HTTPException(400, "No active breach")
    incident = {k: state.get(k) for k in ['incident_id','discovery_time','nature','systems','categories','affected_count','description']}
    pdf_bytes, sha256, filename = pdf_svc.generate_dpb_notice(incident)
    now = datetime.now(timezone.utc).isoformat()
    report_id = csv_mgr.get_next_report_id()
    csv_mgr.append_row('reports_sent.csv', {
        'report_id': report_id, 'generated_at': now, 'generated_by': 'SYSTEM',
        'report_type': 'DPB_NOTICE', 'incident_id': state.get('incident_id',''),
        'request_id': '', 'customer_id': '', 'recipient': 'dpb@meity.gov.in',
        'delivery_channel': 'DOWNLOAD_ONLY', 'delivery_status': 'GENERATED',
        'pdf_filename': filename, 'pdf_sha256': sha256, 'notes': 'DPB Notice generated',
    })
    await db.breach_state.update_one({"_id": "current"}, {
        "$set": {"dpb_sent": True, "step": 3},
        "$push": {"timeline": {"time": now, "event": "DPB Notice generated", "type": "dpb"}}
    })
    return {"ok": True, "report_id": report_id, "filename": filename, "sha256": sha256}

@api_router.post("/breach/notify-users")
async def notify_users(b: BroadcastRequest):
    state = await db.breach_state.find_one({"_id": "current"})
    if not state or not state.get("active"):
        raise HTTPException(400, "No active breach")
    customers = csv_mgr.read_csv('customers.csv')
    active_customers = [c for c in customers if c.get('status') == 'ACTIVE']
    count = len(active_customers)
    incident = {k: state.get(k) for k in ['incident_id','discovery_time','nature','systems','categories','affected_count','description']}
    pdf_bytes, sha256, filename = pdf_svc.generate_customer_breach_notice(incident)
    now = datetime.now(timezone.utc).isoformat()
    report_id = csv_mgr.get_next_report_id()
    csv_mgr.append_row('reports_sent.csv', {
        'report_id': report_id, 'generated_at': now, 'generated_by': 'SYSTEM',
        'report_type': 'CUSTOMER_BREACH_NOTICE', 'incident_id': state.get('incident_id',''),
        'request_id': '', 'customer_id': '', 'recipient': f'BULK({count})',
        'delivery_channel': b.channel, 'delivery_status': 'SENT',
        'pdf_filename': filename, 'pdf_sha256': sha256, 'notes': f'Broadcast to {count} users',
    })
    # Send at least one real email if possible
    sent_real = False
    if b.channel == "EMAIL" and gmail_svc.email and active_customers:
        try:
            first_cust = active_customers[0]
            gmail_svc.send_email(
                to=gmail_svc.email,
                subject=f"DPDP Shield - Data Breach Notification - {state.get('incident_id','')}",
                body_html=f"<p>Dear Customer,</p><p>This is to notify you about a data security incident. Incident ID: {state.get('incident_id','')}. Please check the attached notice.</p><p>DPDP Shield Team</p>",
                attachments=[(filename, pdf_bytes)]
            )
            sent_real = True
        except Exception as e:
            logger.error(f"Failed to send real email: {e}")
    await db.breach_state.update_one({"_id": "current"}, {
        "$set": {"users_notified": True, "step": 4},
        "$push": {"timeline": {"time": now, "event": f"Customer notifications sent to {count} users via {b.channel}", "type": "notify"}}
    })
    return {"ok": True, "count": count, "report_id": report_id, "real_email_sent": sent_real}

@api_router.post("/breach/close")
async def close_breach():
    state = await db.breach_state.find_one({"_id": "current"})
    if not state or not state.get("active"):
        raise HTTPException(400, "No active breach")
    now = datetime.now(timezone.utc).isoformat()
    incident = {k: state.get(k) for k in ['incident_id','discovery_time','nature','systems','categories','affected_count','description']}
    incident['closure_time'] = now
    incident['severity'] = 'HIGH'
    incident['vector'] = 'Under Investigation'
    pdf_bytes, sha256, filename = pdf_svc.generate_audit_report(incident, state.get('timeline', []))
    report_id = csv_mgr.get_next_report_id()
    csv_mgr.append_row('reports_sent.csv', {
        'report_id': report_id, 'generated_at': now, 'generated_by': 'SYSTEM',
        'report_type': 'AUDIT_REPORT', 'incident_id': state.get('incident_id',''),
        'request_id': '', 'customer_id': '', 'recipient': 'SELF_DOWNLOAD',
        'delivery_channel': 'DOWNLOAD_ONLY', 'delivery_status': 'GENERATED',
        'pdf_filename': filename, 'pdf_sha256': sha256, 'notes': 'Incident closed, audit report generated',
    })
    await db.breach_state.update_one({"_id": "current"}, {
        "$set": {"closed": True, "closed_at": now, "active": False, "step": 5},
        "$push": {"timeline": {"time": now, "event": "Incident closed. Audit report generated.", "type": "close"}}
    })
    return {"ok": True, "report_id": report_id, "filename": filename}

@api_router.post("/breach/reset")
async def reset_breach():
    await db.breach_state.update_one({"_id": "current"}, {"$set": {
        "active": False, "incident_id": None, "discovery_time": None,
        "nature": "", "systems": "", "categories": "", "affected_count": 0,
        "step": 0, "containment_confirmed": False, "dpb_sent": False,
        "users_notified": False, "closed": False, "closed_at": None, "timeline": [],
        "description": "",
    }})
    return {"ok": True}


# ══════════════════════════════════════
# EMAIL / MAILBOX ROUTES
# ══════════════════════════════════════
@api_router.get("/emails")
async def get_emails():
    try:
        emails = gmail_svc.read_emails(limit=30)
        return {"emails": emails, "connected": True}
    except Exception as e:
        logger.error(f"Email fetch error: {e}")
        return {"emails": [], "connected": False, "error": str(e)}

@api_router.get("/emails/connection-status")
async def email_connection_status():
    ok = gmail_svc.test_connection()
    return {"connected": ok, "email": gmail_svc.email}

@api_router.get("/mail-replies")
async def get_mail_replies():
    return csv_mgr.read_csv('mail_replies.csv')

def detect_intent(subject, body):
    text = (subject + " " + body).lower()
    delete_kw = ['delete', 'remove', 'erase', 'close account', 'forget me', 'right to erasure']
    show_kw = ['show', 'export', 'download', 'share my data', 'access my data', 'right to access', 'send me my data']
    correct_kw = ['correct', 'update', 'change', 'rectify', 'modify', 'fix my', 'wrong']
    if any(k in text for k in delete_kw):
        return 'DELETE'
    if any(k in text for k in show_kw):
        return 'SHOW'
    if any(k in text for k in correct_kw):
        return 'CORRECT'
    return 'UNKNOWN'

def extract_customer_id(text):
    match = re.search(r'CUST-\d{4}', text, re.IGNORECASE)
    return match.group().upper() if match else None

@api_router.post("/emails/process")
async def process_email(e: EmailProcess):
    now = datetime.now(timezone.utc).isoformat()
    text = e.subject + " " + e.body
    customer_id = extract_customer_id(text)
    intent = detect_intent(e.subject, e.body)
    request_id = f"REQ-{uuid.uuid4().hex[:8].upper()}"

    if not customer_id:
        # Reply asking for customer ID
        if gmail_svc.email:
            gmail_svc.send_reply(e.from_email, e.subject,
                "<p>Thank you for contacting DPDP Shield.</p><p>We could not find a valid Customer ID in your request. Please include your Customer ID (format: CUST-0007) and resend.</p><p>DPDP Shield Team</p>")
        csv_mgr.append_row('mail_replies.csv', {
            'request_id': request_id, 'received_at': e.received_at or now,
            'from_email': e.from_email, 'subject': e.subject, 'body': e.body[:500],
            'customer_id': '', 'intent': intent, 'otp_status': 'NOT_SENT',
            'otp_sent_at': '', 'otp_verified_at': '', 'action_taken': 'Asked for customer ID',
            'action_status': 'NEEDS_INFO', 'replied_at': now, 'pdf_files': '', 'notes': 'Missing customer ID',
        })
        return {"request_id": request_id, "status": "NEEDS_INFO", "message": "Customer ID not found. Reply sent."}

    customer = csv_mgr.find_customer(customer_id)
    if not customer:
        csv_mgr.append_row('mail_replies.csv', {
            'request_id': request_id, 'received_at': e.received_at or now,
            'from_email': e.from_email, 'subject': e.subject, 'body': e.body[:500],
            'customer_id': customer_id, 'intent': intent, 'otp_status': 'NOT_SENT',
            'otp_sent_at': '', 'otp_verified_at': '', 'action_taken': 'Customer not found',
            'action_status': 'FAILED', 'replied_at': now, 'pdf_files': '', 'notes': f'Customer {customer_id} not found',
        })
        return {"request_id": request_id, "status": "FAILED", "message": f"Customer {customer_id} not found"}

    # Generate OTP
    otp = str(random.randint(100000, 999999))
    expires = datetime.now(timezone.utc) + timedelta(minutes=5)
    await db.otps.insert_one({
        "request_id": request_id,
        "customer_id": customer_id,
        "otp": otp,
        "attempts": 0,
        "expires_at": expires,
        "verified": False,
        "intent": intent,
        "from_email": e.from_email,
        "subject": e.subject,
        "body": e.body,
    })

    # Send OTP to registered email
    registered_email = customer.get('email', '')
    otp_sent = False
    if gmail_svc.email and registered_email and registered_email != 'REDACTED':
        otp_sent = gmail_svc.send_otp_email(registered_email, otp, customer_id)

    otp_status = 'OTP_SENT' if otp_sent else 'FAILED'
    csv_mgr.append_row('mail_replies.csv', {
        'request_id': request_id, 'received_at': e.received_at or now,
        'from_email': e.from_email, 'subject': e.subject, 'body': e.body[:500],
        'customer_id': customer_id, 'intent': intent, 'otp_status': otp_status,
        'otp_sent_at': now if otp_sent else '', 'otp_verified_at': '',
        'action_taken': f'OTP sent to {registered_email}', 'action_status': 'PENDING',
        'replied_at': now, 'pdf_files': '', 'notes': '',
    })

    # Also reply to requester
    if gmail_svc.email:
        gmail_svc.send_reply(e.from_email, e.subject,
            f"<p>Your request has been received. An OTP has been sent to the registered email for customer {customer_id}.</p><p>Please reply with the OTP to verify your identity.</p><p>DPDP Shield Team</p>")

    return {
        "request_id": request_id,
        "status": otp_status,
        "intent": intent,
        "customer_id": customer_id,
        "otp_sent_to": registered_email,
        "message": f"OTP sent to registered email for {customer_id}",
        "otp_for_demo": otp,
    }

@api_router.post("/emails/verify-otp")
async def verify_otp(v: OTPVerify):
    otp_doc = await db.otps.find_one({"request_id": v.request_id, "verified": False})
    if not otp_doc:
        raise HTTPException(404, "OTP request not found or already verified")
    if otp_doc.get("attempts", 0) >= 3:
        csv_mgr.update_row('mail_replies.csv', 'request_id', v.request_id, {'otp_status': 'FAILED', 'action_status': 'FAILED', 'notes': 'Max OTP attempts exceeded'})
        raise HTTPException(400, "Maximum OTP attempts exceeded")
    if datetime.now(timezone.utc) > otp_doc["expires_at"].replace(tzinfo=timezone.utc) if otp_doc["expires_at"].tzinfo is None else otp_doc["expires_at"]:
        csv_mgr.update_row('mail_replies.csv', 'request_id', v.request_id, {'otp_status': 'OTP_EXPIRED', 'action_status': 'FAILED'})
        raise HTTPException(400, "OTP expired")
    if v.otp != otp_doc["otp"]:
        await db.otps.update_one({"request_id": v.request_id}, {"$inc": {"attempts": 1}})
        remaining = 3 - otp_doc.get("attempts", 0) - 1
        raise HTTPException(400, f"Invalid OTP. {remaining} attempts remaining.")

    # OTP verified
    now = datetime.now(timezone.utc).isoformat()
    await db.otps.update_one({"request_id": v.request_id}, {"$set": {"verified": True}})
    csv_mgr.update_row('mail_replies.csv', 'request_id', v.request_id, {
        'otp_status': 'OTP_VERIFIED', 'otp_verified_at': now,
    })

    intent = otp_doc.get("intent", "UNKNOWN")
    customer_id = otp_doc.get("customer_id", "")
    customer = csv_mgr.find_customer(customer_id)
    result = {"verified": True, "intent": intent, "customer_id": customer_id}

    if intent == "SHOW" and customer:
        pdf_bytes, sha256, filename = pdf_svc.generate_data_export(customer)
        report_id = csv_mgr.get_next_report_id()
        csv_mgr.append_row('reports_sent.csv', {
            'report_id': report_id, 'generated_at': now, 'generated_by': 'SYSTEM',
            'report_type': 'DATA_EXPORT', 'incident_id': '', 'request_id': v.request_id,
            'customer_id': customer_id, 'recipient': customer.get('email',''),
            'delivery_channel': 'EMAIL', 'delivery_status': 'GENERATED',
            'pdf_filename': filename, 'pdf_sha256': sha256, 'notes': 'Data export for SHOW request',
        })
        if gmail_svc.email:
            sent = gmail_svc.send_email(customer.get('email',''), f"DPDP Shield - Your Personal Data Export ({customer_id})",
                "<p>Please find your personal data export attached.</p><p>DPDP Shield Team</p>",
                [(filename, pdf_bytes)])
            if sent:
                csv_mgr.update_row('reports_sent.csv', 'report_id', report_id, {'delivery_status': 'SENT'})
        csv_mgr.update_row('mail_replies.csv', 'request_id', v.request_id, {
            'action_taken': 'Data export generated and sent', 'action_status': 'COMPLETED',
            'pdf_files': filename,
        })
        result["action"] = "Data export sent"
        result["filename"] = filename

    elif intent == "DELETE" and customer:
        deleted_fields = ['name', 'email', 'phone']
        pdf_bytes, sha256, filename = pdf_svc.generate_deletion_certificate(customer_id, deleted_fields)
        report_id = csv_mgr.get_next_report_id()
        reg_email = customer.get('email', '')
        csv_mgr.append_row('reports_sent.csv', {
            'report_id': report_id, 'generated_at': now, 'generated_by': 'SYSTEM',
            'report_type': 'DELETION_CERTIFICATE', 'incident_id': '', 'request_id': v.request_id,
            'customer_id': customer_id, 'recipient': reg_email,
            'delivery_channel': 'EMAIL', 'delivery_status': 'GENERATED',
            'pdf_filename': filename, 'pdf_sha256': sha256, 'notes': 'Deletion certificate',
        })
        if gmail_svc.email and reg_email and reg_email != 'REDACTED':
            sent = gmail_svc.send_email(reg_email, f"DPDP Shield - Data Deletion Certificate ({customer_id})",
                "<p>Your data has been deleted. Please find the deletion certificate attached.</p><p>DPDP Shield Team</p>",
                [(filename, pdf_bytes)])
            if sent:
                csv_mgr.update_row('reports_sent.csv', 'report_id', report_id, {'delivery_status': 'SENT'})
        csv_mgr.update_row('customers.csv', 'customer_id', customer_id, {
            'status': 'DELETED', 'name': 'REDACTED', 'email': 'REDACTED', 'phone': 'REDACTED',
            'updated_at': now,
        })
        csv_mgr.update_row('mail_replies.csv', 'request_id', v.request_id, {
            'action_taken': 'Customer data deleted and redacted', 'action_status': 'COMPLETED',
            'pdf_files': filename,
        })
        result["action"] = "Customer data deleted"
        result["filename"] = filename

    elif intent == "CORRECT":
        csv_mgr.update_row('mail_replies.csv', 'request_id', v.request_id, {
            'action_taken': 'Awaiting correction details', 'action_status': 'NEEDS_INFO',
        })
        result["action"] = "OTP verified. Provide correction details."
        result["needs_correction_data"] = True

    return result

@api_router.post("/emails/apply-correction")
async def apply_correction(c: CorrectionData):
    customer = csv_mgr.find_customer(c.customer_id)
    if not customer:
        raise HTTPException(404, "Customer not found")
    before = dict(customer)
    updates = {}
    if c.new_name:
        updates['name'] = c.new_name
    if c.new_email:
        updates['email'] = c.new_email
    if c.new_phone:
        updates['phone'] = c.new_phone
    if not updates:
        raise HTTPException(400, "No correction values provided")
    updates['updated_at'] = datetime.now(timezone.utc).isoformat()
    csv_mgr.update_row('customers.csv', 'customer_id', c.customer_id, updates)
    after = {**customer, **updates}
    pdf_bytes, sha256, filename = pdf_svc.generate_correction_confirmation(c.customer_id, before, after)
    now = datetime.now(timezone.utc).isoformat()
    report_id = csv_mgr.get_next_report_id()
    csv_mgr.append_row('reports_sent.csv', {
        'report_id': report_id, 'generated_at': now, 'generated_by': 'SYSTEM',
        'report_type': 'CORRECTION_CONFIRMATION', 'incident_id': '', 'request_id': c.request_id,
        'customer_id': c.customer_id, 'recipient': after.get('email', customer.get('email','')),
        'delivery_channel': 'EMAIL', 'delivery_status': 'GENERATED',
        'pdf_filename': filename, 'pdf_sha256': sha256, 'notes': 'Correction confirmation',
    })
    if gmail_svc.email:
        target = after.get('email', customer.get('email',''))
        if target and target != 'REDACTED':
            sent = gmail_svc.send_email(target, f"DPDP Shield - Data Correction Confirmation ({c.customer_id})",
                "<p>Your data has been corrected as requested. Please find the confirmation attached.</p>",
                [(filename, pdf_bytes)])
            if sent:
                csv_mgr.update_row('reports_sent.csv', 'report_id', report_id, {'delivery_status': 'SENT'})
    csv_mgr.update_row('mail_replies.csv', 'request_id', c.request_id, {
        'action_taken': f'Data corrected: {list(updates.keys())}', 'action_status': 'COMPLETED',
        'pdf_files': filename,
    })
    return {"ok": True, "report_id": report_id, "filename": filename, "before": before, "after": after}


# ══════════════════════════════════════
# PDF ROUTES
# ══════════════════════════════════════
@api_router.get("/pdf/{filename}")
async def download_pdf(filename: str):
    filepath = pdf_svc.output_dir / filename
    if not filepath.exists():
        raise HTTPException(404, "PDF not found")
    now = datetime.now(timezone.utc).isoformat()
    reports = csv_mgr.read_csv('reports_sent.csv')
    for r in reports:
        if r.get('pdf_filename') == filename and r.get('delivery_status') != 'DOWNLOADED':
            csv_mgr.update_row('reports_sent.csv', 'report_id', r['report_id'], {'delivery_status': 'DOWNLOADED'})
            break
    return FileResponse(filepath, media_type='application/pdf', filename=filename)

@api_router.post("/pdf/audit-report")
async def generate_standalone_audit():
    state = await db.breach_state.find_one({"_id": "current"})
    incident = {}
    timeline = []
    if state:
        incident = {k: state.get(k) for k in ['incident_id','discovery_time','nature','systems','categories','affected_count','description']}
        incident['closure_time'] = state.get('closed_at', datetime.now(timezone.utc).isoformat())
        incident['severity'] = 'HIGH'
        incident['vector'] = 'Under Investigation'
        timeline = state.get('timeline', [])
    else:
        incident = {'incident_id': 'N/A', 'discovery_time': 'N/A', 'severity': 'N/A'}
    pdf_bytes, sha256, filename = pdf_svc.generate_audit_report(incident, timeline)
    now = datetime.now(timezone.utc).isoformat()
    report_id = csv_mgr.get_next_report_id()
    csv_mgr.append_row('reports_sent.csv', {
        'report_id': report_id, 'generated_at': now, 'generated_by': 'SYSTEM',
        'report_type': 'AUDIT_REPORT', 'incident_id': incident.get('incident_id',''),
        'request_id': '', 'customer_id': '', 'recipient': 'SELF_DOWNLOAD',
        'delivery_channel': 'DOWNLOAD_ONLY', 'delivery_status': 'GENERATED',
        'pdf_filename': filename, 'pdf_sha256': sha256, 'notes': 'Audit report generated from Evidence Locker',
    })
    return {"ok": True, "report_id": report_id, "filename": filename}


# ══════════════════════════════════════
# ATTACK VECTOR ROUTES
# ══════════════════════════════════════
@api_router.get("/attack-vector")
async def get_attack_vector():
    settings = await db.settings.find_one({"_id": "app_settings"})
    sim_api = settings.get('sim_leaked_api_key', False) or settings.get('sim_mass_download', False) if settings else False
    sim_email = settings.get('sim_mailbox_forwarding', False) if settings else False
    sim_mass = settings.get('sim_mass_download', False) if settings else False

    api_signals = [
        {"id": "mass_download", "label": "Mass download >500 records in <5 min", "ok": not sim_mass, "severity": "high"},
        {"id": "unusual_ip", "label": "Unusual IP address detected", "ok": not sim_api, "severity": "medium"},
        {"id": "rate_limit", "label": "API rate limit exceeded", "ok": not sim_mass, "severity": "high"},
        {"id": "after_hours", "label": "After-hours API access", "ok": True, "severity": "low"},
    ]
    email_signals = [
        {"id": "suspicious_login", "label": "Suspicious mailbox login", "ok": not sim_email, "severity": "high"},
        {"id": "forwarding_rule", "label": "Forwarding rule created", "ok": not sim_email, "severity": "high"},
        {"id": "otp_failures", "label": "OTP failure spikes", "ok": True, "severity": "medium"},
    ]

    api_score = sum(0 if s['ok'] else (3 if s['severity']=='high' else 2 if s['severity']=='medium' else 1) for s in api_signals)
    email_score = sum(0 if s['ok'] else (3 if s['severity']=='high' else 2 if s['severity']=='medium' else 1) for s in email_signals)

    if api_score == 0 and email_score == 0:
        source, confidence = "None Detected", "N/A"
    elif api_score > email_score:
        source = "API"
        confidence = "High" if api_score >= 5 else "Medium"
    elif email_score > api_score:
        source = "Email"
        confidence = "High" if email_score >= 5 else "Medium"
    else:
        source, confidence = "Mixed", "Medium"

    findings = []
    for s in api_signals + email_signals:
        if not s['ok']:
            findings.append(f"{s['label']} - {s['severity'].upper()} risk")
    if not findings:
        findings = ["No anomalies detected. All systems nominal."]

    return {
        "api_signals": api_signals,
        "email_signals": email_signals,
        "api_status": "Insecure" if api_score > 0 else "Secure",
        "email_status": "Insecure" if email_score > 0 else "Secure",
        "likely_source": source,
        "confidence": confidence,
        "findings": findings,
        "api_score": api_score,
        "email_score": email_score,
    }

@api_router.post("/attack-vector/pdf")
async def generate_vector_pdf():
    analysis = await get_attack_vector()
    pdf_bytes, sha256, filename = pdf_svc.generate_vector_analysis(analysis)
    now = datetime.now(timezone.utc).isoformat()
    report_id = csv_mgr.get_next_report_id()
    csv_mgr.append_row('reports_sent.csv', {
        'report_id': report_id, 'generated_at': now, 'generated_by': 'SYSTEM',
        'report_type': 'VECTOR_ANALYSIS', 'incident_id': '', 'request_id': '',
        'customer_id': '', 'recipient': 'SELF_DOWNLOAD',
        'delivery_channel': 'DOWNLOAD_ONLY', 'delivery_status': 'GENERATED',
        'pdf_filename': filename, 'pdf_sha256': sha256, 'notes': 'Attack vector analysis',
    })
    return {"ok": True, "report_id": report_id, "filename": filename}


# ══════════════════════════════════════
# SETTINGS ROUTES
# ══════════════════════════════════════
@api_router.get("/settings")
async def get_settings():
    s = await db.settings.find_one({"_id": "app_settings"})
    if s:
        s.pop("_id", None)
    return s or {}

@api_router.put("/settings")
async def update_settings(request: Request):
    body = await request.json()
    body.pop("_id", None)
    await db.settings.update_one({"_id": "app_settings"}, {"$set": body})
    return {"ok": True}


# ══════════════════════════════════════
# REPORTS ROUTES
# ══════════════════════════════════════
@api_router.get("/reports")
async def get_reports():
    return csv_mgr.read_csv('reports_sent.csv')


# ══════════════════════════════════════
# CSV DOWNLOAD ROUTES
# ══════════════════════════════════════
@api_router.get("/csv/{filename}")
async def download_csv(filename: str):
    allowed = ['customers.csv', 'mail_replies.csv', 'admin_access.csv', 'reports_sent.csv']
    if filename not in allowed:
        raise HTTPException(404, "File not found")
    filepath = csv_mgr.data_dir / filename
    if not filepath.exists():
        raise HTTPException(404, "File not found")
    return FileResponse(filepath, media_type='text/csv', filename=filename)


# ══════════════════════════════════════
# EVIDENCE ROUTES
# ══════════════════════════════════════
@api_router.get("/evidence/timeline")
async def get_evidence_timeline():
    state = await db.breach_state.find_one({"_id": "current"})
    timeline = state.get('timeline', []) if state else []
    reports = csv_mgr.read_csv('reports_sent.csv')
    return {"timeline": timeline, "reports_count": len(reports)}

@api_router.get("/evidence/encryption-demo")
async def encryption_demo():
    customers = csv_mgr.read_csv('customers.csv')[:5]
    encrypted = []
    for c in customers:
        enc = {}
        for k, v in c.items():
            if k == 'customer_id':
                enc[k] = v
            else:
                enc[k] = hashlib.sha256(str(v).encode()).hexdigest()[:32] + "..."
        encrypted.append(enc)
    return {"raw": encrypted, "decrypted": customers}


# ══════════════════════════════════════
# DASHBOARD STATS
# ══════════════════════════════════════
@api_router.get("/dashboard/stats")
async def dashboard_stats():
    customers = csv_mgr.read_csv('customers.csv')
    active = sum(1 for c in customers if c.get('status') == 'ACTIVE')
    reports = csv_mgr.read_csv('reports_sent.csv')
    mail_replies = csv_mgr.read_csv('mail_replies.csv')
    breach = await db.breach_state.find_one({"_id": "current"})
    return {
        "total_customers": len(customers),
        "active_customers": active,
        "total_reports": len(reports),
        "total_requests": len(mail_replies),
        "breach_active": breach.get('active', False) if breach else False,
        "incident_id": breach.get('incident_id') if breach else None,
    }


# Include router and middleware
app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
