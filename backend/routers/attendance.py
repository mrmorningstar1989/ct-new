"""Attendance / Chamada."""
import uuid
from datetime import datetime, timezone, date
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional

from auth import require_admin_or_teacher, get_current_user
from db import db, DEFAULT_ACADEMY_ID
from models import AttendanceCreate

router = APIRouter(prefix="/api/attendance", tags=["attendance"])


def _clean(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


@router.post("")
async def register_attendance(payload: AttendanceCreate, user: dict = Depends(require_admin_or_teacher)):
    now = datetime.now(timezone.utc).isoformat()
    # Replace existing record for that class+date
    await db.attendance.delete_many({"class_id": payload.class_id, "date": payload.date})

    doc = {
        "id": str(uuid.uuid4()),
        "academy_id": DEFAULT_ACADEMY_ID,
        "class_id": payload.class_id,
        "date": payload.date,
        "records": [r.model_dump() for r in payload.records],
        "registered_by": user["id"],
        "created_at": now,
    }
    await db.attendance.insert_one(doc)
    return _clean(doc)


@router.get("")
async def list_attendance(
    class_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user: dict = Depends(require_admin_or_teacher),
):
    query = {"academy_id": DEFAULT_ACADEMY_ID}
    if class_id:
        query["class_id"] = class_id
    if date_from or date_to:
        d = {}
        if date_from:
            d["$gte"] = date_from
        if date_to:
            d["$lte"] = date_to
        query["date"] = d
    docs = await db.attendance.find(query).sort("date", -1).to_list(500)
    return [_clean(d) for d in docs]


@router.get("/student/{student_id}")
async def student_attendance(student_id: str, user: dict = Depends(get_current_user)):
    """Aggregate attendance for a student across all classes."""
    if user["role"] == "student" and user.get("linked_id") != student_id:
        raise HTTPException(status_code=403, detail="Acesso negado")

    docs = await db.attendance.find({"academy_id": DEFAULT_ACADEMY_ID}).to_list(2000)
    records = []
    counts = {"present": 0, "absent": 0, "justified": 0, "trial": 0, "medical": 0}
    for att in docs:
        for r in att.get("records", []):
            if r.get("student_id") == student_id:
                item = {"date": att["date"], "class_id": att["class_id"], "status": r["status"]}
                records.append(item)
                counts[r["status"]] = counts.get(r["status"], 0) + 1

    total = sum(counts.values())
    freq_pct = round((counts["present"] / total) * 100, 1) if total > 0 else 0
    records.sort(key=lambda x: x["date"], reverse=True)
    return {
        "student_id": student_id,
        "records": records[:100],
        "counts": counts,
        "total": total,
        "frequency_pct": freq_pct,
    }


@router.get("/class/{class_id}/date/{date_str}")
async def get_class_attendance(class_id: str, date_str: str, user: dict = Depends(require_admin_or_teacher)):
    doc = await db.attendance.find_one({"class_id": class_id, "date": date_str})
    if not doc:
        return {"class_id": class_id, "date": date_str, "records": []}
    return _clean(doc)
