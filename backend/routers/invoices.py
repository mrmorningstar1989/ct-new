"""Invoices (Mensalidades) and Payments."""
import os
import uuid
import hmac
from datetime import datetime, timezone, date
from fastapi import APIRouter, HTTPException, Depends, Request, BackgroundTasks
from typing import Optional

from auth import require_admin, get_current_user
from db import db, DEFAULT_ACADEMY_ID
from models import InvoiceCreate, PaymentRegister
from utils import fifth_business_day

router = APIRouter(prefix="/api/invoices", tags=["invoices"])


def _clean(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


def _compute_status(inv: dict) -> str:
    if inv.get("status") == "paid":
        return "paid"
    try:
        due = date.fromisoformat(inv["due_date"])
        if due < date.today():
            return "overdue"
    except Exception:
        pass
    return "pending"


def _suggested_amount(inv: dict, paid_at_str: str) -> float:
    try:
        paid_at = date.fromisoformat(paid_at_str)
        due = date.fromisoformat(inv["due_date"])
    except Exception:
        return float(inv.get("final_value") or inv.get("value") or 0)
    early = inv.get("early_value")
    regular = float(inv.get("final_value") or inv.get("value") or 0)
    if early is not None and paid_at <= due:
        return float(early)
    return regular


async def _generate_invoices_for_month(year: int, month: int) -> int:
    """Idempotently create invoices for competency YYYY-MM for all active monthly enrollments."""
    competency = f"{year:04d}-{month:02d}"
    due_date = fifth_business_day(year, month).isoformat()
    now = datetime.now(timezone.utc).isoformat()

    enrollments = await db.enrollments.find({
        "academy_id": DEFAULT_ACADEMY_ID,
        "status": "active",
        "plan_id": {"$ne": None},
    }).to_list(5000)

    created = 0
    for e in enrollments:
        exists = await db.invoices.find_one({"enrollment_id": e["id"], "competency": competency})
        if exists:
            continue
        plan = await db.plans.find_one({"id": e["plan_id"]})
        if not plan or plan.get("periodicity") != "monthly":
            continue
        discount = float(e.get("custom_discount") or 0)
        value = float(plan.get("value", 0))
        early = plan.get("early_value")
        early_value = float(early) - discount if early is not None else None
        await db.invoices.insert_one({
            "id": str(uuid.uuid4()),
            "academy_id": DEFAULT_ACADEMY_ID,
            "student_id": e["student_id"],
            "enrollment_id": e["id"],
            "plan_id": plan["id"],
            "competency": competency,
            "due_date": due_date,
            "value": value,
            "early_value": early_value,
            "discount": discount,
            "final_value": value - discount,
            "status": "pending",
            "created_at": now,
        })
        created += 1
    return created


async def _cron_job():
    settings = await db.academies.find_one({"id": DEFAULT_ACADEMY_ID}) or {}
    if settings.get("auto_renew_enabled") is False:
        return
    today = date.today()
    await _generate_invoices_for_month(today.year, today.month)


@router.get("")
async def list_invoices(
    student_id: Optional[str] = None,
    status: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    query = {"academy_id": DEFAULT_ACADEMY_ID}
    if user["role"] == "student":
        query["student_id"] = user.get("linked_id")
    elif student_id:
        query["student_id"] = student_id
    docs = await db.invoices.find(query).sort("due_date", -1).to_list(500)
    result = []
    for d in docs:
        d.pop("_id", None)
        d["status"] = _compute_status(d)
        if status and d["status"] != status:
            continue
        result.append(d)
    return result


@router.post("")
async def create_invoice(payload: InvoiceCreate, user: dict = Depends(require_admin)):
    doc = payload.model_dump()
    doc.update({
        "id": str(uuid.uuid4()),
        "academy_id": DEFAULT_ACADEMY_ID,
        "final_value": doc["value"] - doc.get("discount", 0),
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await db.invoices.insert_one(doc)
    return _clean(doc)


@router.post("/generate-month")
async def generate_month(competency: Optional[str] = None, user: dict = Depends(require_admin)):
    """Manual trigger to generate all monthly invoices for a competency (default: current month)."""
    if competency:
        try:
            y, m = competency.split("-")
            year, month = int(y), int(m)
        except Exception:
            raise HTTPException(status_code=400, detail="Formato inválido. Use YYYY-MM")
    else:
        today = date.today()
        year, month = today.year, today.month
    created = await _generate_invoices_for_month(year, month)
    return {"created": created, "competency": f"{year:04d}-{month:02d}"}


@router.post("/cron/generate-monthly")
async def cron_generate_monthly(request: Request, background: BackgroundTasks):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    secret = os.environ.get("WEBHOOK_CRON_SECRET", "")
    auth = request.headers.get("Authorization", "")
    if not secret or not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="unauthorized")
    if not hmac.compare_digest(auth[7:], secret):
        raise HTTPException(status_code=401, detail="unauthorized")
    background.add_task(_cron_job)
    return {"accepted": True}


@router.post("/{invoice_id}/pay")
async def register_payment(invoice_id: str, payload: PaymentRegister, user: dict = Depends(require_admin)):
    inv = await db.invoices.find_one({"id": invoice_id})
    if not inv:
        raise HTTPException(status_code=404, detail="Mensalidade não encontrada")
    now = datetime.now(timezone.utc).isoformat()
    paid_at = payload.paid_at or date.today().isoformat()
    amount_paid = payload.amount_paid
    if amount_paid is None:
        amount_paid = _suggested_amount(inv, paid_at)

    await db.invoices.update_one({"id": invoice_id}, {"$set": {
        "status": "paid",
        "paid_at": paid_at,
        "payment_method": payload.payment_method,
        "amount_paid": amount_paid,
        "notes": payload.notes,
        "updated_at": now,
    }})

    await db.cash_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "academy_id": DEFAULT_ACADEMY_ID,
        "type": "income",
        "category": "mensalidade",
        "value": amount_paid,
        "description": f"Pagamento mensalidade {inv.get('competency')}",
        "reference_id": invoice_id,
        "date": paid_at,
        "created_at": now,
    })

    return _clean(await db.invoices.find_one({"id": invoice_id}))


@router.post("/{invoice_id}/reopen")
async def reopen_payment(invoice_id: str, user: dict = Depends(require_admin)):
    inv = await db.invoices.find_one({"id": invoice_id})
    if not inv:
        raise HTTPException(status_code=404, detail="Mensalidade não encontrada")
    await db.invoices.update_one({"id": invoice_id}, {"$set": {"status": "pending"}, "$unset": {"paid_at": "", "payment_method": "", "amount_paid": ""}})
    await db.cash_transactions.delete_many({"reference_id": invoice_id})
    return _clean(await db.invoices.find_one({"id": invoice_id}))


@router.delete("/{invoice_id}")
async def delete_invoice(invoice_id: str, user: dict = Depends(require_admin)):
    res = await db.invoices.delete_one({"id": invoice_id})
    return {"deleted": res.deleted_count}


@router.get("/overdue/list")
async def overdue_list(user: dict = Depends(require_admin)):
    today = date.today().isoformat()
    docs = await db.invoices.find({
        "academy_id": DEFAULT_ACADEMY_ID,
        "status": {"$ne": "paid"},
        "due_date": {"$lt": today},
    }).to_list(1000)
    result = []
    for d in docs:
        d.pop("_id", None)
        student = await db.students.find_one({"id": d["student_id"]}, {"_id": 0})
        d["student"] = student
        try:
            days_late = (date.today() - date.fromisoformat(d["due_date"])).days
        except Exception:
            days_late = 0
        d["days_late"] = days_late
        d["status"] = "overdue"
        result.append(d)
    return result
