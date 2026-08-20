"""Students CRUD."""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional

from ..auth import require_admin, require_admin_or_teacher, hash_password, get_current_user
from ..db import db
from ..models import StudentCreate, StudentUpdate, StudentPasswordReset

router = APIRouter(prefix="/api/students", tags=["students"])


def _clean(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


async def _next_matricula(academy_id: str) -> str:
    # Atomic counter to avoid race conditions and reuse after deletes
    doc = await db.counters.find_one_and_update(
        {"_id": f"student_matricula:{academy_id}"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = (doc or {}).get("seq", 1)
    return f"ZK{seq:05d}"


@router.get("")
async def list_students(
    q: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = Query(100, le=500),
    user: dict = Depends(require_admin_or_teacher),
):
    query = {"academy_id": user["academy_id"]}
    if status:
        query["status"] = status
    if q:
        query["$or"] = [
            {"full_name": {"$regex": q, "$options": "i"}},
            {"matricula": {"$regex": q, "$options": "i"}},
            {"cpf": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}},
        ]
    docs = await db.students.find(query).sort("created_at", -1).to_list(limit)
    return [_clean(d) for d in docs]


@router.post("")
async def create_student(payload: StudentCreate, user: dict = Depends(require_admin)):
    student_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    academy_id = user["academy_id"]
    matricula = await _next_matricula(academy_id)

    doc = payload.model_dump()
    if doc.get("emergency_contact"):
        pass  # already dict
    doc.pop("create_login", None)
    password = doc.pop("password", None)

    doc.update({
        "id": student_id,
        "matricula": matricula,
        "academy_id": academy_id,
        "created_at": now,
        "updated_at": now,
    })

    await db.students.insert_one(doc)

    # Optional linked user (student login)
    if payload.create_login and payload.email and password:
        email = payload.email.lower()
        existing = await db.users.find_one({"email": email, "academy_id": academy_id})
        if not existing:
            await db.users.insert_one({
                "id": str(uuid.uuid4()),
                "email": email,
                "password_hash": hash_password(password),
                "name": payload.full_name,
                "role": "student",
                "academy_id": academy_id,
                "linked_id": student_id,
                "created_at": now,
            })

    return _clean(doc)


@router.get("/{student_id}")
async def get_student(student_id: str, user: dict = Depends(get_current_user)):
    # Students can only see themselves
    if user["role"] == "student" and user.get("linked_id") != student_id:
        raise HTTPException(status_code=403, detail="Acesso negado")
    doc = await db.students.find_one({"id": student_id, "academy_id": user["academy_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Aluno nÃ£o encontrado")
    return _clean(doc)


@router.patch("/{student_id}")
async def update_student(student_id: str, payload: StudentUpdate, user: dict = Depends(require_admin)):
    data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not data:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    scope = {"id": student_id, "academy_id": user["academy_id"]}
    res = await db.students.update_one(scope, {"$set": data})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Aluno nÃ£o encontrado")
    doc = await db.students.find_one(scope)
    return _clean(doc)


@router.delete("/{student_id}")
async def delete_student(student_id: str, user: dict = Depends(require_admin)):
    scope = {"id": student_id, "academy_id": user["academy_id"]}
    res = await db.students.delete_one(scope)
    # Also delete linked user
    await db.users.delete_many({"linked_id": student_id, "role": "student", "academy_id": user["academy_id"]})
    return {"deleted": res.deleted_count}


@router.post("/{student_id}/reset-password")
async def reset_student_password(student_id: str, payload: StudentPasswordReset, user: dict = Depends(require_admin)):
    """Admin resets or creates the login of a student."""
    if len(payload.password or "") < 4:
        raise HTTPException(status_code=400, detail="A senha deve ter ao menos 4 caracteres")
    student = await db.students.find_one({"id": student_id, "academy_id": user["academy_id"]})
    if not student:
        raise HTTPException(status_code=404, detail="Aluno nÃ£o encontrado")

    existing = await db.users.find_one({"linked_id": student_id, "role": "student", "academy_id": user["academy_id"]})
    now = datetime.now(timezone.utc).isoformat()

    if existing:
        await db.users.update_one(
            {"id": existing["id"]},
            {"$set": {"password_hash": hash_password(payload.password), "updated_at": now}},
        )
        return {"ok": True, "email": existing["email"], "action": "updated"}

    # No login yet â€” create one. Email must be provided or exist on student
    email = (payload.email or student.get("email") or "").lower().strip()
    if not email:
        raise HTTPException(status_code=400, detail="Email Ã© obrigatÃ³rio para criar o acesso do aluno")

    # Update student email if it was blank
    if not student.get("email"):
        await db.students.update_one({"id": student_id, "academy_id": user["academy_id"]}, {"$set": {"email": email}})

    # Ensure email not taken
    if await db.users.find_one({"email": email, "academy_id": user["academy_id"]}):
        raise HTTPException(status_code=400, detail="Este email jÃ¡ estÃ¡ em uso nesta academia")

    await db.users.insert_one({
        "id": str(uuid.uuid4()),
        "email": email,
        "password_hash": hash_password(payload.password),
        "name": student.get("full_name"),
        "role": "student",
        "academy_id": user["academy_id"],
        "linked_id": student_id,
        "created_at": now,
    })
    return {"ok": True, "email": email, "action": "created"}


@router.get("/{student_id}/login-status")
async def student_login_status(student_id: str, user: dict = Depends(require_admin)):
    linked = await db.users.find_one({"linked_id": student_id, "role": "student", "academy_id": user["academy_id"]})
    return {
        "has_login": bool(linked),
        "email": linked.get("email") if linked else None,
    }

