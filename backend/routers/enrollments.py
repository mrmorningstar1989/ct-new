"""Enrollments (Matrículas)."""
import uuid
from datetime import datetime, timezone, date
from fastapi import APIRouter, HTTPException, Depends

from auth import require_admin, get_current_user
from db import db, DEFAULT_ACADEMY_ID
from models import EnrollmentCreate, EnrollmentUpdate
from utils import fifth_business_day

router = APIRouter(prefix="/api/enrollments", tags=["enrollments"])


def _clean(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


async def _generate_monthly_invoice(enrollment: dict, plan: dict, discount: float):
    """Create the current-month invoice for a monthly plan."""
    today = date.today()
    due_date = fifth_business_day(today.year, today.month).isoformat()
    value = float(plan.get("value", 0))
    early = plan.get("early_value")
    early_value = float(early) - discount if early is not None else None
    final_value = value - discount

    invoice = {
        "id": str(uuid.uuid4()),
        "academy_id": DEFAULT_ACADEMY_ID,
        "student_id": enrollment["student_id"],
        "enrollment_id": enrollment["id"],
        "plan_id": plan["id"],
        "competency": f"{today.year:04d}-{today.month:02d}",
        "due_date": due_date,
        "value": value,
        "early_value": early_value,
        "discount": discount,
        "final_value": final_value,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.invoices.insert_one(invoice)


@router.get("")
async def list_enrollments(student_id: str = None, user: dict = Depends(get_current_user)):
    query = {"academy_id": DEFAULT_ACADEMY_ID}
    if user["role"] == "student":
        query["student_id"] = user.get("linked_id")
    elif student_id:
        query["student_id"] = student_id
    docs = await db.enrollments.find(query).sort("created_at", -1).to_list(500)
    return [_clean(d) for d in docs]


@router.post("")
async def create_enrollment(payload: EnrollmentCreate, user: dict = Depends(require_admin)):
    now = datetime.now(timezone.utc).isoformat()
    doc = payload.model_dump()
    discount = float(doc.get("custom_discount") or 0)
    doc.update({
        "id": str(uuid.uuid4()),
        "academy_id": DEFAULT_ACADEMY_ID,
        "custom_discount": discount,
        "created_at": now,
    })
    if not doc.get("start_date"):
        doc["start_date"] = date.today().isoformat()
    await db.enrollments.insert_one(doc)

    if doc.get("plan_id"):
        plan = await db.plans.find_one({"id": doc["plan_id"]})
        if plan and plan.get("periodicity") == "monthly":
            await _generate_monthly_invoice(doc, plan, discount)

    return _clean(doc)


@router.patch("/{enrollment_id}")
async def update_enrollment(enrollment_id: str, payload: EnrollmentUpdate, user: dict = Depends(require_admin)):
    data = {k: v for k, v in payload.model_dump().items() if v is not None}
    res = await db.enrollments.update_one({"id": enrollment_id}, {"$set": data})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Matrícula não encontrada")
    return _clean(await db.enrollments.find_one({"id": enrollment_id}))


@router.delete("/{enrollment_id}")
async def delete_enrollment(enrollment_id: str, user: dict = Depends(require_admin)):
    res = await db.enrollments.delete_one({"id": enrollment_id})
    return {"deleted": res.deleted_count}
