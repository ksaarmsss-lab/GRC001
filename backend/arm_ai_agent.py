#!/usr/bin/env python3
"""ARM-AI Background Worker.

Polls the MongoDB every POLL_INTERVAL_SEC seconds for unread chat messages
and emails addressed to any user whose alias starts with "ARM-AI". For each
unread item it asks Claude Sonnet 4.5 (via the Emergent Universal LLM key)
to draft a concise reply (max 7 lines) and posts the reply back to the
original sender through the existing FastAPI endpoints (so WebSocket
broadcasts fire correctly). A fixed signature is appended to every reply.

Runs as a supervisor-managed process — see
/etc/supervisor/conf.d/arm_ai_agent.conf.
"""

from __future__ import annotations

import os
import sys
import asyncio
import logging
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

import httpx
import jwt
from motor.motor_asyncio import AsyncIOMotorClient
from emergentintegrations.llm.chat import LlmChat, UserMessage

# ----------------------- Configuration -----------------------
POLL_INTERVAL_SEC = 30
MAX_RESPONSE_LINES = 7
CHAT_HISTORY_LIMIT = 15
ARM_AI_PREFIX = "ARM-AI"
INTERNAL_API = "http://localhost:8001/api"
LLM_PROVIDER = "anthropic"
LLM_MODEL = "claude-sonnet-4-5-20250929"

SIGNATURE = (
    "For more details please send a message to an ARM-EXPERT or call the "
    "ARM AI Company or Send an external email to solomon@armsss.com. Thanks"
)
SYSTEM_PROMPT = (
    "You are an ARM-AI assistant — a Governance, Risk and Compliance "
    "subject-matter expert serving senior audit, risk, compliance and "
    "controls leaders across the Middle East. Be concise, professional and "
    "directly useful. Respond in at most 7 short lines. Do NOT include any "
    "closing signature or sign-off; the system appends one automatically."
)

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
JWT_SECRET = os.environ.get("JWT_SECRET")
JWT_ALGO = "HS256"
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [arm-ai] %(levelname)s %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("arm-ai")

if not (EMERGENT_LLM_KEY and JWT_SECRET and MONGO_URL and DB_NAME):
    log.error("Missing required env vars (EMERGENT_LLM_KEY / JWT_SECRET / MONGO_URL / DB_NAME)")
    raise SystemExit(1)

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]


# ----------------------- Helpers -----------------------
def issue_token(user_id: str, alias: str) -> str:
    payload = {
        "sub": user_id,
        "alias": alias,
        "role": "consultant",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def trim_to_n_lines(text: str, n: int) -> str:
    lines = [ln.rstrip() for ln in text.strip().splitlines() if ln.strip()]
    return "\n".join(lines[:n])


def with_signature(reply: str) -> str:
    return f"{reply}\n\n{SIGNATURE}"


async def generate_reply(bot_alias: str, prior: list[dict], incoming_text: str) -> str:
    """Call Claude Sonnet 4.5 and return a 7-line max reply + signature."""
    session_id = f"{bot_alias}:{uuid.uuid4().hex[:12]}"
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=SYSTEM_PROMPT,
    ).with_model(LLM_PROVIDER, LLM_MODEL)

    history_lines: list[str] = []
    for m in prior[-CHAT_HISTORY_LIMIT:]:
        role = "Assistant" if m.get("from_alias") == bot_alias else "User"
        history_lines.append(f"{role}: {m.get('content', '')}")

    if history_lines:
        prompt = (
            "Conversation so far:\n"
            + "\n".join(history_lines)
            + "\n\nLatest user message:\n"
            + incoming_text
            + "\n\nReply directly to the user in at most 7 short lines."
        )
    else:
        prompt = (
            f"User message:\n{incoming_text}\n\n"
            f"Reply directly in at most 7 short lines."
        )

    try:
        raw = await chat.send_message(UserMessage(text=prompt))
    except Exception as e:
        log.error(f"LLM call failed: {e}")
        raw = "I'm temporarily unable to process your request. Please try again shortly."

    return with_signature(trim_to_n_lines(str(raw).strip(), MAX_RESPONSE_LINES))


# ----------------------- Chat processing -----------------------
async def process_unread_chats(bot: dict, http: httpx.AsyncClient) -> None:
    bot_alias = bot["alias"]
    token = issue_token(bot["id"], bot_alias)
    headers = {"Authorization": f"Bearer {token}"}

    # Find all unread inbound messages, excluding ones from other ARM-AI bots
    cursor = db.messages.find(
        {
            "to_alias": bot_alias,
            "read": False,
            "from_alias": {"$not": {"$regex": f"^{ARM_AI_PREFIX}"}},
        },
        {"_id": 0},
    ).sort("timestamp", 1)

    by_sender: dict[str, list[dict]] = {}
    async for m in cursor:
        by_sender.setdefault(m["from_alias"], []).append(m)

    for sender, msgs in by_sender.items():
        try:
            # Pull the full thread so the LLM has context
            thread = await db.messages.find(
                {
                    "$or": [
                        {"from_alias": bot_alias, "to_alias": sender},
                        {"from_alias": sender, "to_alias": bot_alias},
                    ]
                },
                {"_id": 0},
            ).sort("timestamp", 1).to_list(200)

            new_ids = {m["id"] for m in msgs}
            prior = [m for m in thread if m["id"] not in new_ids]
            incoming_text = "\n".join(m["content"] for m in msgs)

            log.info(f"[chat] {bot_alias} <- {sender}: {len(msgs)} unread; generating reply")
            reply = await generate_reply(bot_alias, prior, incoming_text)

            r = await http.post(
                f"{INTERNAL_API}/chat/send",
                headers=headers,
                json={"to_alias": sender, "content": reply},
                timeout=30.0,
            )
            if r.status_code != 200:
                log.error(f"[chat] send failed {r.status_code}: {r.text[:200]}")
                continue

            await db.messages.update_many(
                {"from_alias": sender, "to_alias": bot_alias, "read": False},
                {"$set": {"read": True}},
            )
            log.info(f"[chat] {bot_alias} -> {sender}: replied OK")
        except Exception as e:
            log.exception(f"[chat] handler failed for sender={sender}: {e}")


# ----------------------- Email processing -----------------------
async def process_unread_emails(bot: dict, http: httpx.AsyncClient) -> None:
    bot_alias = bot["alias"]
    token = issue_token(bot["id"], bot_alias)
    headers = {"Authorization": f"Bearer {token}"}

    cursor = db.emails.find(
        {
            "to_alias": bot_alias,
            "read": False,
            "from_alias": {"$not": {"$regex": f"^{ARM_AI_PREFIX}"}},
        },
        {"_id": 0},
    ).sort("timestamp", 1)

    async for em in cursor:
        try:
            sender = em["from_alias"]
            subject = em.get("subject", "")
            body = em.get("body", "")
            log.info(f"[mail] {bot_alias} <- {sender}: '{subject}'; generating reply")

            prompt_text = f"Subject: {subject}\n\n{body}"
            reply_body = await generate_reply(bot_alias, [], prompt_text)

            reply_subject = subject if subject.lower().startswith("re:") else f"Re: {subject}"

            r = await http.post(
                f"{INTERNAL_API}/mail/send",
                headers=headers,
                json={"to_alias": sender, "subject": reply_subject, "body": reply_body},
                timeout=30.0,
            )
            if r.status_code != 200:
                log.error(f"[mail] send failed {r.status_code}: {r.text[:200]}")
                continue

            await db.emails.update_one({"id": em["id"]}, {"$set": {"read": True}})
            log.info(f"[mail] {bot_alias} -> {sender}: replied OK")
        except Exception as e:
            log.exception(f"[mail] handler failed for email={em.get('id')}: {e}")


# ----------------------- Main loop -----------------------
async def loop() -> None:
    log.info(
        "ARM-AI worker starting (model=%s, poll=%ds, prefix=%s)",
        LLM_MODEL, POLL_INTERVAL_SEC, ARM_AI_PREFIX,
    )
    async with httpx.AsyncClient() as http:
        while True:
            try:
                bots = await db.users.find(
                    {"alias": {"$regex": f"^{ARM_AI_PREFIX}"}},
                    {"_id": 0},
                ).to_list(50)
                for bot in bots:
                    await process_unread_chats(bot, http)
                    await process_unread_emails(bot, http)
            except Exception as e:
                log.exception(f"loop iteration failed: {e}")
            await asyncio.sleep(POLL_INTERVAL_SEC)


if __name__ == "__main__":
    asyncio.run(loop())
