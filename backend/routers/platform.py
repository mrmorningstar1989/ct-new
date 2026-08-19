"""Platform-only academy lifecycle endpoints."""
import uuid
from datetime import datetime, timezone, date
from fastapi import APIRouter, Depends, HTTPException

from auth import hash_password, require_superadmin
from db import db
from models import (AcademyCreate, AcademyStatusUpdate, PlatformPlanCreate, PlatformPlanUpdate,
                    AcademySubscriptionUpdate, PlatformPaymentRegister)

router = APIRouter(prefix="/api/platform/academies", tags=["platform"])


def _clean(doc: dict) -> dict:
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return doc


async def _create_invoice(academy_id: str, plan: dict):
    today = date.today()
    competency = f"{today.year:04d}-{today.month:02d}"
    existing = await db.platform_invoices.find_one({"academy_id": academy_id, "competency": competency})
    if existing:
        return existing
    doc = {"id": str(uuid.uuid4()), "academy_id": academy_id, "plan_id": plan["id"],
           "competency": competency, "due_date": today.replace(day=min(5, 28)).isoformat(),
           "value": float(plan["value"]), "status": "pending", "created_at": datetime.now(timezone.utc).isoformat()}
    await db.platform_invoices.insert_one(doc)
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


@router.get("/plans")
async def list_plans(user: dict = Depends(require_superadmin)):
    return [_clean(p) for p in await db.platform_plans.find({}).sort("value", 1).to_list(500)]


@router.post("/plans")
async def create_plan(payload: PlatformPlanCreate, user: dict = Depends(require_superadmin)):
    if payload.value < 0 or payload.periodicity not in {"monthly", "quarterly", "yearly"}:
        raise HTTPException(status_code=400, detail="Plano inválido")
    plan = {"id": str(uuid.uuid4()), **payload.model_dump(), "created_at": datetime.now(timezone.utc).isoformat()}
    await db.platform_plans.insert_one(plan)
    return _clean(plan)


@router.patch("/plans/{plan_id}")
async def update_plan(plan_id: str, payload: PlatformPlanUpdate, user: dict = Depends(require_superadmin)):
    data = {k: v for k, v in payload.model_dump().items() if v is not None}
    result = await db.platform_plans.update_one({"id": plan_id}, {"$set": {**data, "updated_at": datetime.now(timezone.utc).isoformat()}})
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="Plano não encontrado")
    return _clean(await db.platform_plans.find_one({"id": plan_id}))


@router.put("/{academy_id}/subscription")
async def set_subscription(academy_id: str, payload: AcademySubscriptionUpdate, user: dict = Depends(require_superadmin)):
    plan = await db.platform_plans.find_one({"id": payload.plan_id, "status": "active"})
    if not await db.academies.find_one({"id": academy_id}) or not plan:
        raise HTTPException(status_code=404, detail="Academia ou plano ativo não encontrado")
    now = datetime.now(timezone.utc).isoformat()
    await db.academy_subscriptions.update_one({"academy_id": academy_id}, {"$set": {"academy_id": academy_id, "plan_id": plan["id"], "status": "active", "start_date": payload.start_date or date.today().isoformat(), "updated_at": now}, "$setOnInsert": {"id": str(uuid.uuid4()), "created_at": now}}, upsert=True)
    return _clean(await _create_invoice(academy_id, plan))


@router.get("/billing")
async def billing(user: dict = Depends(require_superadmin)):
    academies = {a["id"]: _clean(a) for a in await db.academies.find({}).to_list(5000)}
    plans = {p["id"]: _clean(p) for p in await db.platform_plans.find({}).to_list(500)}
    subscriptions = await db.academy_subscriptions.find({}).to_list(5000)
    invoices = await db.platform_invoices.find({}).sort("due_date", -1).to_list(10000)
    for item in subscriptions:
        item.pop("_id", None); item["academy"] = academies.get(item["academy_id"]); item["plan"] = plans.get(item["plan_id"])
    for item in invoices:
        item.pop("_id", None); item["academy"] = academies.get(item["academy_id"]); item["plan"] = plans.get(item["plan_id"])
        if item.get("status") != "paid" and item.get("due_date", "") < date.today().isoformat(): item["status"] = "overdue"
    return {"subscriptions": subscriptions, "invoices": invoices}


@router.post("/billing/{invoice_id}/pay")
async def pay_invoice(invoice_id: str, payload: PlatformPaymentRegister, user: dict = Depends(require_superadmin)):
    invoice = await db.platform_invoices.find_one({"id": invoice_id})
    if not invoice: raise HTTPException(status_code=404, detail="Cobrança não encontrada")
    await db.platform_invoices.update_one({"id": invoice_id}, {"$set": {"status": "paid", "paid_at": payload.paid_at or date.today().isoformat(), "amount_paid": float(payload.amount_paid if payload.amount_paid is not None else invoice["value"]), "payment_method": payload.payment_method, "notes": payload.notes, "updated_at": datetime.now(timezone.utc).isoformat()}})
    return _clean(await db.platform_invoices.find_one({"id": invoice_id}))
