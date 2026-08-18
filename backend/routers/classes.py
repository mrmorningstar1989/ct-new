"""Classes (Turmas) CRUD."""
import uuid
from datetime import datetime, timezone, date
from fastapi import APIRouter, HTTPException, Depends

from auth import require_admin, require_admin_or_teacher, get_current_user
from db import db
from models import ClassCreate, ClassUpdate, BulkEnrollRequest
from utils import fifth_business_day

router = APIRouter(prefix="/api/classes", tags=["classes"])


def _clean(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


@router.get("")
async def list_classes(user: dict = Depends(get_current_user)):
    query = {"academy_id": user["academy_id"]}
    if user["role"] == "teacher":
        query["teacher_id"] = user.get("linked_id")
    docs = await db.classes.find(query).to_list(500)
    return [_clean(d) for d in docs]


@router.post("")
async def create_class(payload: ClassCreate, user: dict = Depends(require_admin)):
    now = datetime.now(timezone.utc).isoformat()
    doc = payload.model_dump()
    doc.update({
        "id": str(uuid.uuid4()),
        "academy_id": user["academy_id"],
        "created_at": now,
    })
    await db.classes.insert_one(doc)
    return _clean(doc)


@router.get("/{class_id}")
async def get_class(class_id: str, user: dict = Depends(get_current_user)):
    doc = await db.classes.find_one({"id": class_id, "academy_id": user["academy_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Turma não encontrada")
    return _clean(doc)


@router.patch("/{class_id}")
async def update_class(class_id: str, payload: ClassUpdate, user: dict = Depends(require_admin)):
    data = {k: v for k, v in payload.model_dump().items() if v is not None}
    scope = {"id": class_id, "academy_id": user["academy_id"]}
    res = await db.classes.update_one(scope, {"$set": data})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Turma não encontrada")
    return _clean(await db.classes.find_one(scope))


@router.delete("/{class_id}")
async def delete_class(class_id: str, user: dict = Depends(require_admin)):
    res = await db.classes.delete_one({"id": class_id, "academy_id": user["academy_id"]})
    return {"deleted": res.deleted_count}


@router.get("/{class_id}/students")
async def class_students(class_id: str, user: dict = Depends(require_admin_or_teacher)):
    scope = {"academy_id": user["academy_id"]}
    enrollments = await db.enrollments.find({**scope, "class_id": class_id, "status": "active"}).to_list(500)
    student_ids = [e["student_id"] for e in enrollments]
    students = await db.students.find({**scope, "id": {"$in": student_ids}}).to_list(500)
    return [_clean(s) for s in students]


@router.post("/{class_id}/enroll")
async def bulk_enroll(class_id: str, payload: BulkEnrollRequest, user: dict = Depends(require_admin)):
    """Enroll many students in a class at once (manual add from class edit screen)."""
    academy_id = user["academy_id"]
    cls = await db.classes.find_one({"id": class_id, "academy_id": academy_id})
    if not cls:
        raise HTTPException(status_code=404, detail="Turma não encontrada")

    plan = None
    if payload.plan_id:
        plan = await db.plans.find_one({"id": payload.plan_id, "academy_id": academy_id})

    now = datetime.now(timezone.utc).isoformat()
    today = date.today()
    created = []
    for sid in payload.student_ids:
        # Skip if already enrolled active in this class
        student = await db.students.find_one({"id": sid, "academy_id": academy_id}, {"_id": 1})
        if not student:
            raise HTTPException(status_code=404, detail="Aluno não encontrado na academia")
        exists = await db.enrollments.find_one({"academy_id": academy_id, "class_id": class_id, "student_id": sid, "status": "active"})
        if exists:
            continue
        enrollment = {
            "id": str(uuid.uuid4()),
            "academy_id": academy_id,
            "student_id": sid,
            "modality_id": payload.modality_id,
            "class_id": class_id,
            "plan_id": payload.plan_id,
            "custom_discount": float(payload.custom_discount or 0),
            "start_date": today.isoformat(),
            "status": "active",
            "notes": None,
            "created_at": now,
        }
        await db.enrollments.insert_one(enrollment)
        created.append(enrollment["id"])

        # Generate invoice if monthly plan
        if plan and plan.get("periodicity") == "monthly":
            due_date = fifth_business_day(today.year, today.month).isoformat()
            value = float(plan.get("value", 0))
            early = plan.get("early_value")
            discount = float(payload.custom_discount or 0)
            early_value = float(early) - discount if early is not None else None
            invoice = {
                "id": str(uuid.uuid4()),
                "academy_id": academy_id,
                "student_id": sid,
                "enrollment_id": enrollment["id"],
                "plan_id": plan["id"],
                "competency": f"{today.year:04d}-{today.month:02d}",
                "due_date": due_date,
                "value": value,
                "early_value": early_value,
                "discount": discount,
                "final_value": value - discount,
                "status": "pending",
                "created_at": now,
            }
            await db.invoices.insert_one(invoice)

    return {"created": len(created), "enrollment_ids": created}
