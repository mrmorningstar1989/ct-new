"""Modalities CRUD with belt system."""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends

from auth import require_admin, get_current_user
from db import db
from models import ModalityCreate, ModalityUpdate

router = APIRouter(prefix="/api/modalities", tags=["modalities"])


def _clean(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


@router.get("")
async def list_modalities(user: dict = Depends(get_current_user)):
    docs = await db.modalities.find({"academy_id": user["academy_id"]}).to_list(500)
    return [_clean(d) for d in docs]


@router.post("")
async def create_modality(payload: ModalityCreate, user: dict = Depends(require_admin)):
    now = datetime.now(timezone.utc).isoformat()
    doc = payload.model_dump()
    doc.update({
        "id": str(uuid.uuid4()),
        "academy_id": user["academy_id"],
        "created_at": now,
    })
    await db.modalities.insert_one(doc)
    return _clean(doc)


@router.get("/{modality_id}")
async def get_modality(modality_id: str, user: dict = Depends(get_current_user)):
    doc = await db.modalities.find_one({"id": modality_id, "academy_id": user["academy_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Modalidade não encontrada")
    return _clean(doc)


@router.patch("/{modality_id}")
async def update_modality(modality_id: str, payload: ModalityUpdate, user: dict = Depends(require_admin)):
    data = {k: v for k, v in payload.model_dump().items() if v is not None}
    scope = {"id": modality_id, "academy_id": user["academy_id"]}
    res = await db.modalities.update_one(scope, {"$set": data})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Modalidade não encontrada")
    return _clean(await db.modalities.find_one(scope))


@router.delete("/{modality_id}")
async def delete_modality(modality_id: str, user: dict = Depends(require_admin)):
    res = await db.modalities.delete_one({"id": modality_id, "academy_id": user["academy_id"]})
    return {"deleted": res.deleted_count}
