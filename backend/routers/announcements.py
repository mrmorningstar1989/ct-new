"""Announcements / Avisos."""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends

from auth import require_admin, get_current_user
from db import db
from models import AnnouncementCreate

router = APIRouter(prefix="/api/announcements", tags=["announcements"])


def _clean(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


@router.get("")
async def list_announcements(user: dict = Depends(get_current_user)):
    docs = await db.announcements.find({"academy_id": user["academy_id"]}).sort("created_at", -1).to_list(200)
    result = []
    for d in docs:
        d.pop("_id", None)
        if user["role"] == "student" and d.get("audience") not in ("all", "students"):
            continue
        if user["role"] == "teacher" and d.get("audience") not in ("all", "teachers"):
            continue
        result.append(d)
    return result


@router.post("")
async def create_announcement(payload: AnnouncementCreate, user: dict = Depends(require_admin)):
    doc = payload.model_dump()
    doc.update({
        "id": str(uuid.uuid4()),
        "academy_id": user["academy_id"],
        "author_id": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await db.announcements.insert_one(doc)
    return _clean(doc)


@router.delete("/{ann_id}")
async def delete_announcement(ann_id: str, user: dict = Depends(require_admin)):
    res = await db.announcements.delete_one({"id": ann_id, "academy_id": user["academy_id"]})
    return {"deleted": res.deleted_count}
