"""Plans CRUD."""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends

from auth import require_admin, get_current_user
from db import db, DEFAULT_ACADEMY_ID
from models import PlanCreate, PlanUpdate

router = APIRouter(prefix="/api/plans", tags=["plans"])


def _clean(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


@router.get("")
async def list_plans(user: dict = Depends(get_current_user)):
    docs = await db.plans.find({"academy_id": DEFAULT_ACADEMY_ID}).to_list(500)
    return [_clean(d) for d in docs]


@router.post("")
async def create_plan(payload: PlanCreate, user: dict = Depends(require_admin)):
    doc = payload.model_dump()
    doc.update({
        "id": str(uuid.uuid4()),
        "academy_id": DEFAULT_ACADEMY_ID,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await db.plans.insert_one(doc)
    return _clean(doc)


@router.patch("/{plan_id}")
async def update_plan(plan_id: str, payload: PlanUpdate, user: dict = Depends(require_admin)):
    data = {k: v for k, v in payload.model_dump().items() if v is not None}
    res = await db.plans.update_one({"id": plan_id}, {"$set": data})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Plano não encontrado")
    return _clean(await db.plans.find_one({"id": plan_id}))


@router.delete("/{plan_id}")
async def delete_plan(plan_id: str, user: dict = Depends(require_admin)):
    res = await db.plans.delete_one({"id": plan_id})
    return {"deleted": res.deleted_count}
