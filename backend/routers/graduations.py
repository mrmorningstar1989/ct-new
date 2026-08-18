"""Graduations / Faixas history."""
import uuid
from datetime import datetime, timezone, date
from fastapi import APIRouter, HTTPException, Depends

from auth import require_admin, get_current_user
from db import db
from models import GraduationCreate

router = APIRouter(prefix="/api/graduations", tags=["graduations"])


def _clean(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


@router.post("")
async def create_graduation(payload: GraduationCreate, user: dict = Depends(require_admin)):
    academy_id = user["academy_id"]
    if not await db.students.find_one({"id": payload.student_id, "academy_id": academy_id}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="Aluno não encontrado na academia")
    if not await db.modalities.find_one({"id": payload.modality_id, "academy_id": academy_id}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="Modalidade não encontrada na academia")
    now = datetime.now(timezone.utc).isoformat()
    doc = payload.model_dump()
    doc.update({
        "id": str(uuid.uuid4()),
        "academy_id": academy_id,
        "created_at": now,
    })
    await db.graduations.insert_one(doc)
    return _clean(doc)


@router.get("/student/{student_id}")
async def student_graduations(student_id: str, user: dict = Depends(get_current_user)):
    if user["role"] == "student" and user.get("linked_id") != student_id:
        raise HTTPException(status_code=403, detail="Acesso negado")
    docs = await db.graduations.find({"academy_id": user["academy_id"], "student_id": student_id}).sort("graduation_date", -1).to_list(500)
    result = []
    for d in docs:
        d.pop("_id", None)
        result.append(d)
    return result


@router.get("/student/{student_id}/current/{modality_id}")
async def current_belt(student_id: str, modality_id: str, user: dict = Depends(get_current_user)):
    if user["role"] == "student" and user.get("linked_id") != student_id:
        raise HTTPException(status_code=403, detail="Acesso negado")
    doc = await db.graduations.find({"academy_id": user["academy_id"], "student_id": student_id, "modality_id": modality_id}).sort("graduation_date", -1).to_list(1)
    if not doc:
        return None
    d = doc[0]
    d.pop("_id", None)
    try:
        days = (date.today() - date.fromisoformat(d["graduation_date"])).days
        d["days_on_belt"] = days
    except Exception:
        d["days_on_belt"] = 0
    return d


@router.delete("/{graduation_id}")
async def delete_graduation(graduation_id: str, user: dict = Depends(require_admin)):
    res = await db.graduations.delete_one({"id": graduation_id, "academy_id": user["academy_id"]})
    return {"deleted": res.deleted_count}
