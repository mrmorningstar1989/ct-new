"""Academy settings (single default academy in MVP)."""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends

from auth import require_admin, get_current_user
from db import db, DEFAULT_ACADEMY_ID
from models import AcademySettingsUpdate

router = APIRouter(prefix="/api/academy", tags=["academy"])


def _clean(doc: dict) -> dict:
    if doc:
        doc.pop("_id", None)
    return doc


@router.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    doc = await db.academies.find_one({"id": DEFAULT_ACADEMY_ID})
    if not doc:
        return {"id": DEFAULT_ACADEMY_ID, "name": "CT Warrior"}
    return _clean(doc)


@router.patch("/settings")
async def update_settings(payload: AcademySettingsUpdate, user: dict = Depends(require_admin)):
    data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not data:
        doc = await db.academies.find_one({"id": DEFAULT_ACADEMY_ID})
        return _clean(doc)
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.academies.update_one({"id": DEFAULT_ACADEMY_ID}, {"$set": data}, upsert=True)
    return _clean(await db.academies.find_one({"id": DEFAULT_ACADEMY_ID}))
