"""Platform-only academy lifecycle endpoints."""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException

from auth import hash_password, require_superadmin
from db import db
from models import AcademyCreate, AcademyStatusUpdate

router = APIRouter(prefix="/api/platform/academies", tags=["platform"])


def _clean(doc: dict) -> dict:
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return doc


@router.get("")
async def list_academies(user: dict = Depends(require_superadmin)):
    docs = await db.academies.find({}).sort("name", 1).to_list(5000)
    return [_clean(d) for d in docs]


@router.post("")
async def create_academy(payload: AcademyCreate, user: dict = Depends(require_superadmin)):
    if len(payload.admin_password) < 8:
        raise HTTPException(status_code=400, detail="A senha do administrador deve ter ao menos 8 caracteres")
    email = payload.admin_email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Este e-mail já está em uso")
    now = datetime.now(timezone.utc).isoformat()
    academy = {"id": str(uuid.uuid4()), "name": payload.name.strip(), "cnpj": payload.cnpj or "",
               "status": "active", "created_at": now, "created_by": user["id"]}
    await db.academies.insert_one(academy)
    await db.users.insert_one({"id": str(uuid.uuid4()), "email": email,
        "password_hash": hash_password(payload.admin_password), "name": payload.admin_name.strip(),
        "role": "admin", "academy_id": academy["id"], "linked_id": None, "created_at": now})
    return _clean(academy)


@router.patch("/{academy_id}/status")
async def update_status(academy_id: str, payload: AcademyStatusUpdate, user: dict = Depends(require_superadmin)):
    if payload.status not in {"active", "inactive"}:
        raise HTTPException(status_code=400, detail="Status deve ser active ou inactive")
    result = await db.academies.update_one({"id": academy_id}, {"$set": {"status": payload.status, "updated_at": datetime.now(timezone.utc).isoformat()}})
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="Academia não encontrada")
    return _clean(await db.academies.find_one({"id": academy_id}))
