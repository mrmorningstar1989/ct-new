"""Teachers CRUD."""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional

from auth import require_admin, require_admin_or_teacher, hash_password
from db import db, DEFAULT_ACADEMY_ID
from models import TeacherCreate, TeacherUpdate

router = APIRouter(prefix="/api/teachers", tags=["teachers"])


def _clean(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


@router.get("")
async def list_teachers(status: Optional[str] = None, user: dict = Depends(require_admin_or_teacher)):
    query = {"academy_id": DEFAULT_ACADEMY_ID}
    if status:
        query["status"] = status
    docs = await db.teachers.find(query).sort("created_at", -1).to_list(500)
    return [_clean(d) for d in docs]


@router.post("")
async def create_teacher(payload: TeacherCreate, user: dict = Depends(require_admin)):
    teacher_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    doc = payload.model_dump()
    doc.pop("create_login", None)
    password = doc.pop("password", None)
    doc.update({
        "id": teacher_id,
        "academy_id": DEFAULT_ACADEMY_ID,
        "created_at": now,
        "updated_at": now,
    })
    await db.teachers.insert_one(doc)

    if payload.create_login and payload.email and password:
        email = payload.email.lower()
        existing = await db.users.find_one({"email": email})
        if not existing:
            await db.users.insert_one({
                "id": str(uuid.uuid4()),
                "email": email,
                "password_hash": hash_password(password),
                "name": payload.full_name,
                "role": "teacher",
                "academy_id": DEFAULT_ACADEMY_ID,
                "linked_id": teacher_id,
                "created_at": now,
            })
    return _clean(doc)


@router.get("/{teacher_id}")
async def get_teacher(teacher_id: str, user: dict = Depends(require_admin_or_teacher)):
    doc = await db.teachers.find_one({"id": teacher_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Professor não encontrado")
    return _clean(doc)


@router.patch("/{teacher_id}")
async def update_teacher(teacher_id: str, payload: TeacherUpdate, user: dict = Depends(require_admin)):
    data = {k: v for k, v in payload.model_dump().items() if v is not None}
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.teachers.update_one({"id": teacher_id}, {"$set": data})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Professor não encontrado")
    return _clean(await db.teachers.find_one({"id": teacher_id}))


@router.delete("/{teacher_id}")
async def delete_teacher(teacher_id: str, user: dict = Depends(require_admin)):
    res = await db.teachers.delete_one({"id": teacher_id})
    await db.users.delete_many({"linked_id": teacher_id, "role": "teacher"})
    return {"deleted": res.deleted_count}
