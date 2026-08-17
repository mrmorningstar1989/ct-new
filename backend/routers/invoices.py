"""Invoices (Mensalidades) and Payments."""
import uuid
from datetime import datetime, timezone, date
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional

from auth import require_admin, get_current_user
from db import db, DEFAULT_ACADEMY_ID
from models import InvoiceCreate, PaymentRegister

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


@router.post("/{invoice_id}/pay")
async def register_payment(invoice_id: str, payload: PaymentRegister, user: dict = Depends(require_admin)):
    inv = await db.invoices.find_one({"id": invoice_id})
    if not inv:
        raise HTTPException(status_code=404, detail="Mensalidade não encontrada")
    now = datetime.now(timezone.utc).isoformat()
    paid_at = payload.paid_at or date.today().isoformat()
    amount_paid = payload.amount_paid or inv.get("final_value", inv.get("value", 0))

    await db.invoices.update_one({"id": invoice_id}, {"$set": {
        "status": "paid",
        "paid_at": paid_at,
        "payment_method": payload.payment_method,
        "amount_paid": amount_paid,
        "updated_at": now,
    }})

    # Record cash transaction
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


@router.delete("/{invoice_id}")
async def delete_invoice(invoice_id: str, user: dict = Depends(require_admin)):
    res = await db.invoices.delete_one({"id": invoice_id})
    return {"deleted": res.deleted_count}


@router.get("/overdue/list")
async def overdue_list(user: dict = Depends(require_admin)):
    """Inadimplência."""
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
