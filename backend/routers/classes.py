"""Classes (Turmas) CRUD."""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends

from auth import require_admin, require_admin_or_teacher, get_current_user
from db import db, DEFAULT_ACADEMY_ID
from models import ClassCreate, ClassUpdate

router = APIRouter(prefix="/api/classes", tags=["classes"])


def _clean(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


@router.get("")
async def list_classes(user: dict = Depends(get_current_user)):
    query = {"academy_id": DEFAULT_ACADEMY_ID}
    # Teachers only see their classes
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
        "academy_id": DEFAULT_ACADEMY_ID,
        "created_at": now,
    })
    await db.classes.insert_one(doc)
    return _clean(doc)


@router.get("/{class_id}")
async def get_class(class_id: str, user: dict = Depends(get_current_user)):
    doc = await db.classes.find_one({"id": class_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Turma não encontrada")
    return _clean(doc)


@router.patch("/{class_id}")
async def update_class(class_id: str, payload: ClassUpdate, user: dict = Depends(require_admin)):
    data = {k: v for k, v in payload.model_dump().items() if v is not None}
    res = await db.classes.update_one({"id": class_id}, {"$set": data})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Turma não encontrada")
    return _clean(await db.classes.find_one({"id": class_id}))


@router.delete("/{class_id}")
async def delete_class(class_id: str, user: dict = Depends(require_admin)):
    res = await db.classes.delete_one({"id": class_id})
    return {"deleted": res.deleted_count}


@router.get("/{class_id}/students")
async def class_students(class_id: str, user: dict = Depends(require_admin_or_teacher)):
    """Return students enrolled in this class."""
    enrollments = await db.enrollments.find({"class_id": class_id, "status": "active"}).to_list(500)
    student_ids = [e["student_id"] for e in enrollments]
    students = await db.students.find({"id": {"$in": student_ids}}).to_list(500)
    return [_clean(s) for s in students]
