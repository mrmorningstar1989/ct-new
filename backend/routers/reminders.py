"""Automated WhatsApp reminders queue for due-today/due-tomorrow invoices."""
import os
import uuid
import hmac
import urllib.parse
from datetime import datetime, timezone, date, timedelta
from fastapi import APIRouter, HTTPException, Depends, Request, BackgroundTasks

from ..auth import require_admin
from ..db import db

router = APIRouter(prefix="/api/reminders", tags=["reminders"])


def _clean(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


def _brl(v) -> str:
    try:
        return ("R$ " + f"{float(v):.2f}").replace(".", ",")
    except Exception:
        return "R$ 0,00"


async def _build_reminders(academy_id: str) -> int:
    today = date.today()
    tomorrow = today + timedelta(days=1)
    now = datetime.now(timezone.utc).isoformat()

    # Cleanup old pending/sent reminders (older than 3 days)
    cutoff = (today - timedelta(days=3)).isoformat()
    await db.whatsapp_reminders.delete_many({"academy_id": academy_id, "due_date": {"$lt": cutoff}})

    academy = await db.academies.find_one({"id": academy_id}) or {}
    academy_name = academy.get("name") or "ZenkaiOS"

    created = 0
    for target_date, kind in [(today, "due_today"), (tomorrow, "due_tomorrow")]:
        invs = await db.invoices.find({
            "academy_id": academy_id,
            "status": {"$ne": "paid"},
            "due_date": target_date.isoformat(),
        }).to_list(1000)
        for inv in invs:
            existing = await db.whatsapp_reminders.find_one({"academy_id": academy_id, "invoice_id": inv["id"], "kind": kind})
            if existing and existing.get("status") == "sent":
                continue
            student = await db.students.find_one({"id": inv["student_id"], "academy_id": academy_id})
            if not student:
                continue
            phone = (student.get("whatsapp") or student.get("phone") or "").strip()
            digits = "".join(ch for ch in phone if ch.isdigit())
            if not digits:
                continue

            first_name = (student.get("full_name") or "").split(" ")[0]
            value = inv.get("final_value") or inv.get("value") or 0
            due_txt = date.fromisoformat(inv["due_date"]).strftime("%d/%m/%Y")

            if kind == "due_today":
                msg = (
                    f"OlÃ¡ {first_name}! Passando para lembrar que sua mensalidade "
                    f"de {inv.get('competency','')} ({_brl(value)}) vence HOJE ({due_txt}). "
                    f"Se jÃ¡ efetuou o pagamento, por favor desconsidere. "
                    f"Qualquer dÃºvida estamos Ã  disposiÃ§Ã£o! â€” {academy_name}"
                )
            else:
                early = inv.get("early_value")
                extra = f" AtÃ© amanhÃ£ ainda vale o valor com desconto: {_brl(early)}." if early is not None else ""
                msg = (
                    f"OlÃ¡ {first_name}! Sua mensalidade de {inv.get('competency','')} "
                    f"({_brl(value)}) vence AMANHÃƒ ({due_txt}).{extra} "
                    f"â€” {academy_name}"
                )
            wa_phone = digits if digits.startswith("55") else f"55{digits}"
            wa_url = f"https://wa.me/{wa_phone}?text=" + urllib.parse.quote(msg)

            base = {
                "invoice_id": inv["id"],
                "student_id": student["id"],
                "student_name": student.get("full_name"),
                "phone": phone,
                "competency": inv.get("competency"),
                "due_date": inv["due_date"],
                "value": value,
                "message": msg,
                "wa_url": wa_url,
            }
            if existing:
                await db.whatsapp_reminders.update_one(
                    {"id": existing["id"]},
                    {"$set": {**base, "updated_at": now}},
                )
            else:
                await db.whatsapp_reminders.insert_one({
                    "id": str(uuid.uuid4()),
                    "academy_id": academy_id,
                    "kind": kind,
                    "status": "pending",
                    "created_at": now,
                    **base,
                })
                created += 1
    # Record last run
    await db.cron_runs.update_one(
        {"job": "whatsapp_reminders", "academy_id": academy_id},
        {"$set": {"last_run_at": now, "created_count": created}},
        upsert=True,
    )
    return created


async def _cron_job():
    async for academy in db.academies.find({"status": {"$ne": "inactive"}}):
        await _build_reminders(academy["id"])


@router.get("")
async def list_reminders(user: dict = Depends(require_admin)):
    """Return today+tomorrow reminders grouped by kind."""
    academy_id = user["academy_id"]
    docs = await db.whatsapp_reminders.find({"academy_id": academy_id}).sort("due_date", 1).to_list(500)
    result = []
    for d in docs:
        d.pop("_id", None)
        result.append(d)
    last = await db.cron_runs.find_one({"job": "whatsapp_reminders", "academy_id": academy_id}, {"_id": 0})
    return {"items": result, "last_run": last}


@router.post("/generate-now")
async def generate_now(user: dict = Depends(require_admin)):
    created = await _build_reminders(user["academy_id"])
    return {"created": created}


@router.post("/{rid}/mark-sent")
async def mark_sent(rid: str, user: dict = Depends(require_admin)):
    res = await db.whatsapp_reminders.update_one(
        {"id": rid, "academy_id": user["academy_id"]},
        {"$set": {"status": "sent", "sent_at": datetime.now(timezone.utc).isoformat()}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lembrete nÃ£o encontrado")
    return _clean(await db.whatsapp_reminders.find_one({"id": rid, "academy_id": user["academy_id"]}))


@router.delete("/{rid}")
async def dismiss(rid: str, user: dict = Depends(require_admin)):
    res = await db.whatsapp_reminders.delete_one({"id": rid, "academy_id": user["academy_id"]})
    return {"deleted": res.deleted_count}


@router.post("/cron/whatsapp-daily")
async def cron_whatsapp_daily(request: Request, background: BackgroundTasks):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    # Vercel Cron automatically supplies CRON_SECRET as a Bearer token. Keep
    # WEBHOOK_CRON_SECRET as a backwards-compatible name for other schedulers.
    secret = os.environ.get("CRON_SECRET") or os.environ.get("WEBHOOK_CRON_SECRET", "")
    auth = request.headers.get("Authorization", "")
    if not secret or not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="unauthorized")
    if not hmac.compare_digest(auth[7:], secret):
        raise HTTPException(status_code=401, detail="unauthorized")
    background.add_task(_cron_job)
    return {"accepted": True}

