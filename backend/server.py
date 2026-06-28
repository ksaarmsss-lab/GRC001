from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, WebSocket, WebSocketDisconnect, Query
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime, timezone, timedelta
import uuid
import bcrypt
import jwt
import json
import logging
import asyncio

import arm_ai_agent  # background worker, started in @app.on_event("startup")

# ---------- Configuration ----------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGO = "HS256"

CATEGORIES = [
    "Advisory and Board",
    "Chief or Senior Audit Role",
    "Chief or Senior Risk Officer",
    "Chief or Senior Compliance Officer",
    "Chief or Senior Control Officer",
]
EXPERIENCE_OPTIONS = ["7-10 years", "11-15 years", "16-25 years", "25+ years"]
AREAS_OF_INTEREST = [
    "Internal Audit", "Risk Management", "Compliance", "Controls",
    "Fraud Management", "Quality and Project Management",
]
COUNTRIES = ["KSA", "UAE", "Qatar", "Oman", "Kuwait", "Bahrain", "Egypt"]

# Login rate-limit settings (per IP + alias)
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_WINDOW_SEC = 15 * 60  # 15 minutes

# ISIC Rev.4 Section-level industries (the international standard referenced as "ISO SIC")
INDUSTRIES = [
    "A - Agriculture, Forestry and Fishing",
    "B - Mining and Quarrying",
    "C - Manufacturing",
    "D - Electricity, Gas, Steam and Air Conditioning Supply",
    "E - Water Supply; Sewerage, Waste Management and Remediation",
    "F - Construction",
    "G - Wholesale and Retail Trade; Repair of Motor Vehicles",
    "H - Transportation and Storage",
    "I - Accommodation and Food Service Activities",
    "J - Information and Communication",
    "K - Financial and Insurance Activities",
    "L - Real Estate Activities",
    "M - Professional, Scientific and Technical Activities",
    "N - Administrative and Support Service Activities",
    "O - Public Administration and Defence; Compulsory Social Security",
    "P - Education",
    "Q - Human Health and Social Work Activities",
    "R - Arts, Entertainment and Recreation",
    "S - Other Service Activities",
    "T - Activities of Households as Employers",
    "U - Activities of Extraterritorial Organizations and Bodies",
]

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("grc")

app = FastAPI(title="GRC Consultant Portal API")
api = APIRouter(prefix="/api")

# ---------- Utils ----------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def create_token(user_id: str, alias: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "alias": alias,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

def public_user(u: dict) -> dict:
    return {
        "id": u["id"],
        "alias": u["alias"],
        "verified": u.get("verified", False),
        "primary_industry": u.get("primary_industry"),
        "category": u.get("category"),
        "experience": u.get("experience"),
        "areas_of_interest": u.get("areas_of_interest", []),
        "countries": u.get("countries", []),
        "role": u.get("role", "consultant"),
        "created_at": u.get("created_at"),
    }

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(token)
    user = await db.users.find_one({"id": payload["sub"]})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    user.pop("_id", None)
    return user

async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# ---------- Login rate limiting (brute-force protection) ----------
def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"

async def check_login_attempts(identifier: str) -> None:
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=LOCKOUT_WINDOW_SEC)
    record = await db.login_attempts.find_one({"identifier": identifier})
    if not record:
        return
    recent = []
    for ts in record.get("attempts", []):
        try:
            if datetime.fromisoformat(ts) > cutoff:
                recent.append(ts)
        except Exception:
            continue
    if len(recent) >= MAX_LOGIN_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail="Too many failed login attempts. Please try again in 15 minutes.",
        )

async def record_failed_attempt(identifier: str) -> None:
    now_iso = datetime.now(timezone.utc).isoformat()
    cutoff_iso = (datetime.now(timezone.utc) - timedelta(seconds=LOCKOUT_WINDOW_SEC)).isoformat()
    # Prune old attempts first
    await db.login_attempts.update_one(
        {"identifier": identifier},
        {"$pull": {"attempts": {"$lt": cutoff_iso}}},
    )
    # Then push the new attempt (upsert if document missing)
    await db.login_attempts.update_one(
        {"identifier": identifier},
        {"$push": {"attempts": now_iso}},
        upsert=True,
    )

async def clear_login_attempts(identifier: str) -> None:
    await db.login_attempts.delete_one({"identifier": identifier})

# ---------- Models ----------
class RegisterIn(BaseModel):
    alias: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6, max_length=200)
    primary_industry: str = Field(..., max_length=200)
    category: str
    experience: str
    areas_of_interest: List[str] = Field(..., min_length=1, max_length=20)
    countries: List[str] = Field(..., min_length=1, max_length=20)

class LoginIn(BaseModel):
    alias: str = Field(..., max_length=50)
    password: str = Field(..., max_length=200)

class MessageIn(BaseModel):
    to_alias: str = Field(..., max_length=50)
    content: str = Field(..., min_length=1, max_length=5000)

class EmailIn(BaseModel):
    to_alias: str = Field(..., max_length=50)
    subject: str = Field(..., min_length=1, max_length=200)
    body: str = Field(..., min_length=1, max_length=50000)

class VerifyIn(BaseModel):
    verified: bool

# ---------- Auth ----------
@api.post("/auth/register")
async def register(data: RegisterIn):
    if data.category not in CATEGORIES:
        raise HTTPException(400, "Invalid category")
    if data.experience not in EXPERIENCE_OPTIONS:
        raise HTTPException(400, "Invalid experience")
    if data.primary_industry not in INDUSTRIES:
        raise HTTPException(400, "Invalid primary industry")
    for a in data.areas_of_interest:
        if a not in AREAS_OF_INTEREST:
            raise HTTPException(400, f"Invalid area of interest: {a}")
    for c in data.countries:
        if c not in COUNTRIES:
            raise HTTPException(400, f"Invalid country: {c}")
    alias = data.alias.strip()
    existing = await db.users.find_one({"alias": alias})
    if existing:
        raise HTTPException(409, "Alias already taken")
    uid = str(uuid.uuid4())
    doc = {
        "id": uid,
        "alias": alias,
        "password_hash": hash_password(data.password),
        "verified": False,
        "primary_industry": data.primary_industry,
        "category": data.category,
        "experience": data.experience,
        "areas_of_interest": data.areas_of_interest,
        "countries": data.countries,
        "role": "consultant",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    token = create_token(uid, alias, "consultant")
    doc.pop("_id", None)
    return {"token": token, "user": public_user(doc)}

@api.post("/auth/login")
async def login(data: LoginIn, request: Request):
    alias = data.alias.strip()
    identifier = f"{client_ip(request)}:{alias.lower()}"
    await check_login_attempts(identifier)
    user = await db.users.find_one({"alias": alias})
    if not user or not verify_password(data.password, user["password_hash"]):
        await record_failed_attempt(identifier)
        raise HTTPException(401, "Invalid credentials")
    await clear_login_attempts(identifier)
    token = create_token(user["id"], user["alias"], user.get("role", "consultant"))
    user.pop("_id", None)
    return {"token": token, "user": public_user(user)}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)

# ---------- Consultants / Directory ----------
@api.get("/consultants")
async def list_consultants(user: dict = Depends(get_current_user)):
    rows = await db.users.find({"role": "consultant"}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [public_user(r) for r in rows]

@api.get("/consultants/{alias}")
async def get_consultant(alias: str, user: dict = Depends(get_current_user)):
    u = await db.users.find_one({"alias": alias}, {"_id": 0, "password_hash": 0})
    if not u:
        raise HTTPException(404, "Not found")
    return public_user(u)

@api.get("/options")
async def options():
    return {
        "categories": CATEGORIES,
        "experience": EXPERIENCE_OPTIONS,
        "areas_of_interest": AREAS_OF_INTEREST,
        "countries": COUNTRIES,
        "industries": INDUSTRIES,
    }

# ---------- Admin ----------
@api.get("/admin/pending")
async def admin_pending(user: dict = Depends(require_admin)):
    rows = await db.users.find({"role": "consultant", "verified": False}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [public_user(r) for r in rows]

@api.get("/admin/all")
async def admin_all(user: dict = Depends(require_admin)):
    rows = await db.users.find({"role": "consultant"}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [public_user(r) for r in rows]

@api.post("/admin/verify/{alias}")
async def admin_verify(alias: str, data: VerifyIn, user: dict = Depends(require_admin)):
    res = await db.users.update_one({"alias": alias}, {"$set": {"verified": data.verified}})
    if res.matched_count == 0:
        raise HTTPException(404, "Consultant not found")
    return {"alias": alias, "verified": data.verified}

# ---------- Chat ----------
@api.get("/chat/conversations")
async def conversations(user: dict = Depends(get_current_user)):
    alias = user["alias"]
    pipeline = [
        {"$match": {"$or": [{"from_alias": alias}, {"to_alias": alias}]}},
        {"$sort": {"timestamp": -1}},
        {"$group": {
            "_id": {"$cond": [{"$eq": ["$from_alias", alias]}, "$to_alias", "$from_alias"]},
            "last_message": {"$first": "$content"},
            "last_ts": {"$first": "$timestamp"},
            "unread": {"$sum": {"$cond": [
                {"$and": [{"$eq": ["$to_alias", alias]}, {"$eq": ["$read", False]}]}, 1, 0
            ]}},
        }},
        {"$sort": {"last_ts": -1}},
    ]
    rows = await db.messages.aggregate(pipeline).to_list(1000)
    return [{"alias": r["_id"], "last_message": r["last_message"], "last_ts": r["last_ts"], "unread": r["unread"]} for r in rows]

@api.get("/chat/messages/{other_alias}")
async def get_messages(other_alias: str, user: dict = Depends(get_current_user)):
    alias = user["alias"]
    msgs = await db.messages.find({
        "$or": [
            {"from_alias": alias, "to_alias": other_alias},
            {"from_alias": other_alias, "to_alias": alias},
        ]
    }, {"_id": 0}).sort("timestamp", 1).to_list(2000)
    await db.messages.update_many(
        {"from_alias": other_alias, "to_alias": alias, "read": False},
        {"$set": {"read": True}},
    )
    return msgs

@api.post("/chat/send")
async def send_message(data: MessageIn, user: dict = Depends(get_current_user)):
    if data.to_alias == user["alias"]:
        raise HTTPException(400, "Cannot message yourself")
    recipient = await db.users.find_one({"alias": data.to_alias})
    if not recipient:
        raise HTTPException(404, "Recipient not found")
    msg = {
        "id": str(uuid.uuid4()),
        "from_alias": user["alias"],
        "to_alias": data.to_alias,
        "content": data.content,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "read": False,
    }
    await db.messages.insert_one(msg.copy())
    msg.pop("_id", None)
    await manager.send_to(data.to_alias, {"type": "message", "data": msg})
    await manager.send_to(user["alias"], {"type": "message", "data": msg})
    return msg

# ---------- Email ----------
@api.get("/mail/{folder}")
async def list_mail(folder: str, user: dict = Depends(get_current_user)):
    alias = user["alias"]
    if folder == "inbox":
        q = {"to_alias": alias}
    elif folder == "sent":
        q = {"from_alias": alias}
    else:
        raise HTTPException(400, "Invalid folder")
    rows = await db.emails.find(q, {"_id": 0}).sort("timestamp", -1).to_list(1000)
    return rows

@api.post("/mail/send")
async def send_mail(data: EmailIn, user: dict = Depends(get_current_user)):
    recipient = await db.users.find_one({"alias": data.to_alias})
    if not recipient:
        raise HTTPException(404, "Recipient not found")
    em = {
        "id": str(uuid.uuid4()),
        "from_alias": user["alias"],
        "to_alias": data.to_alias,
        "subject": data.subject,
        "body": data.body,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "read": False,
    }
    await db.emails.insert_one(em.copy())
    em.pop("_id", None)
    await manager.send_to(data.to_alias, {"type": "email", "data": em})
    return em

@api.post("/mail/{email_id}/read")
async def mark_read(email_id: str, user: dict = Depends(get_current_user)):
    await db.emails.update_one({"id": email_id, "to_alias": user["alias"]}, {"$set": {"read": True}})
    return {"ok": True}

@api.get("/mail/unread/count")
async def unread_count(user: dict = Depends(get_current_user)):
    n = await db.emails.count_documents({"to_alias": user["alias"], "read": False})
    return {"count": n}

# ---------- WebSocket connection manager ----------
class ConnectionManager:
    def __init__(self):
        self.active: Dict[str, List[WebSocket]] = {}
        self.lock = asyncio.Lock()

    async def connect(self, alias: str, ws: WebSocket):
        await ws.accept()
        async with self.lock:
            self.active.setdefault(alias, []).append(ws)
        await self.broadcast_online()

    async def disconnect(self, alias: str, ws: WebSocket):
        async with self.lock:
            if alias in self.active:
                if ws in self.active[alias]:
                    self.active[alias].remove(ws)
                if not self.active[alias]:
                    del self.active[alias]
        await self.broadcast_online()

    async def send_to(self, alias: str, message: dict):
        sockets = list(self.active.get(alias, []))
        dead = []
        for s in sockets:
            try:
                await s.send_text(json.dumps(message))
            except Exception:
                dead.append(s)
        for s in dead:
            await self.disconnect(alias, s)

    async def broadcast_online(self):
        online = list(self.active.keys())
        payload = {"type": "online", "data": online}
        for alias in list(self.active.keys()):
            await self.send_to(alias, payload)

    def online_aliases(self) -> List[str]:
        return list(self.active.keys())

manager = ConnectionManager()

@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    try:
        payload = decode_token(token)
    except HTTPException:
        await websocket.close(code=4401)
        return
    alias = payload["alias"]
    await manager.connect(alias, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(alias, websocket)
    except Exception:
        await manager.disconnect(alias, websocket)

@api.get("/online")
async def online_list(user: dict = Depends(get_current_user)):
    return manager.online_aliases()

# ---------- Startup ----------
@app.on_event("startup")
async def startup():
    await db.users.create_index("alias", unique=True)
    await db.messages.create_index([("from_alias", 1), ("to_alias", 1), ("timestamp", 1)])
    await db.emails.create_index([("to_alias", 1), ("timestamp", -1)])
    await db.login_attempts.create_index("identifier", unique=True)

    admin_alias = os.environ.get("ADMIN_ALIAS", "admin")
    admin_pw = os.environ.get("ADMIN_PASSWORD")
    if not admin_pw:
        logger.warning("ADMIN_PASSWORD not set in environment — admin seed skipped.")
    else:
        existing = await db.users.find_one({"alias": admin_alias})
        if not existing:
            await db.users.insert_one({
                "id": str(uuid.uuid4()),
                "alias": admin_alias,
                "password_hash": hash_password(admin_pw),
                "verified": True,
                "primary_industry": "O - Public Administration and Defence; Compulsory Social Security",
                "category": "Advisory and Board",
                "experience": "25+ years",
                "areas_of_interest": [],
                "countries": [],
                "role": "admin",
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            logger.info(f"Admin user seeded: {admin_alias}")
        # NOTE: We intentionally do NOT auto-reset the admin password on every
        # startup. Changing ADMIN_PASSWORD in env after first boot has no
        # effect — rotate via DB or a dedicated rotate-admin-password script.

    # Seed default ARM-AI assistant bot. The arm_ai_agent.py worker auto-replies
    # to any unread chats/emails addressed to users whose alias starts with
    # "ARM-AI". Admins can create more bots via the normal Register page.
    arm_alias = "ARM-AI-Assistant"
    if not await db.users.find_one({"alias": arm_alias}):
        import secrets
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "alias": arm_alias,
            "password_hash": hash_password(secrets.token_urlsafe(24)),
            "verified": True,
            "primary_industry": "M - Professional, Scientific and Technical Activities",
            "category": "Advisory and Board",
            "experience": "25+ years",
            "areas_of_interest": [
                "Internal Audit", "Risk Management", "Compliance",
                "Controls", "Fraud Management", "Quality and Project Management",
            ],
            "countries": ["KSA", "UAE", "Qatar", "Oman", "Kuwait", "Bahrain", "Egypt"],
            "role": "consultant",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"ARM-AI bot seeded: {arm_alias}")

    # Start the ARM-AI background worker as an asyncio task inside this
    # process so it ships with the backend in production (no separate
    # supervisor program required).
    asyncio.create_task(arm_ai_agent.run())

@app.on_event("shutdown")
async def shutdown():
    client.close()

app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
