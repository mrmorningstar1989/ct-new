"""Platform-only academy lifecycle and manual SaaS billing endpoints."""
import re
import secrets
import uuid
from datetime import datetime, timezone, date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from ..auth import hash_password, require_superadmin
from ..db import db
from ..models import AcademyCreate, AcademyStatusUpdate, AcademyUpdate, PlatformPlanCreate, PlatformPlanUpdate, AcademySubscriptionUpdate, PlatformPaymentRegister, PlatformAdminInviteCreate, PlatformAdminInviteAccept

router = APIRouter(prefix="/api/platform", tags=["platform"])
ACADEMY_STATUSES = {"trial", "active", "overdue", "suspended", "cancelled"}
DEFAULT_MODALITIES = [
    {
        "name": "Jiu-Jitsu",
        "description": "Sistema base de faixas adultas; a academia pode personalizar.",
        "belt_system": [
            {"order": 0, "name": "Branca", "color": "#FFFFFF"},
            {"order": 1, "name": "Azul", "color": "#2563EB"},
            {"order": 2, "name": "Roxa", "color": "#7E22CE"},
            {"order": 3, "name": "Marrom", "color": "#78350F"},
            {"order": 4, "name": "Preta", "color": "#111111"},
        ],
    },
    {
        "name": "Muay Thai",
        "description": "Sistema base editável; as graduações variam por escola.",
        "belt_system": [
            {"order": 0, "name": "Branca", "color": "#FFFFFF"},
            {"order": 1, "name": "Amarela", "color": "#EAB308"},
            {"order": 2, "name": "Verde", "color": "#16A34A"},
            {"order": 3, "name": "Azul", "color": "#2563EB"},
            {"order": 4, "name": "Marrom", "color": "#78350F"},
            {"order": 5, "name": "Preta", "color": "#111111"},
        ],
    },
    {
        "name": "Taekwondo",
        "description": "Sistema base editável conforme a federação ou escola.",
        "belt_system": [
            {"order": 0, "name": "Branca", "color": "#FFFFFF"},
            {"order": 1, "name": "Amarela", "color": "#EAB308"},
            {"order": 2, "name": "Verde", "color": "#16A34A"},
            {"order": 3, "name": "Azul", "color": "#2563EB"},
            {"order": 4, "name": "Vermelha", "color": "#DC2626"},
            {"order": 5, "name": "Preta", "color": "#111111"},
        ],
    },
    {
        "name": "Boxe",
        "description": "Progressão pedagógica base, pois o boxe não possui graduação universal.",
        "belt_system": [
            {"order": 0, "name": "Iniciante", "color": "#FFFFFF"},
            {"order": 1, "name": "Fundamentos", "color": "#EAB308"},
            {"order": 2, "name": "Intermediário", "color": "#2563EB"},
            {"order": 3, "name": "Avançado", "color": "#DC2626"},
            {"order": 4, "name": "Competidor", "color": "#111111"},
        ],
    },
]

def _clean(doc):
    if doc is None: return None
    doc = dict(doc)
    for key in ("_id", "password_hash", "token"): doc.pop(key, None)
    return doc

def _slug(value):
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")

async def _audit(actor, action, academy_id=None, details=None):
    await db.platform_audit_events.insert_one({"id": str(uuid.uuid4()), "academy_id": academy_id, "actor_id": actor.get("id") if actor else None, "actor_email": actor.get("email") if actor else None, "action": action, "details": details or {}, "created_at": datetime.now(timezone.utc).isoformat()})

async def _ensure_default_modalities(academy_id):
    """Insert only missing base modalities; never overwrite academy customizations."""
    existing = {
        re.sub(r"[^a-z0-9]+", "", item.get("name", "").lower())
        for item in await db.modalities.find({"academy_id": academy_id}, {"name": 1}).to_list(100)
    }
    now, created = datetime.now(timezone.utc).isoformat(), []
    for template in DEFAULT_MODALITIES:
        key = re.sub(r"[^a-z0-9]+", "", template["name"].lower())
        if key in existing:
            continue
        doc = {
            "id": str(uuid.uuid4()), "academy_id": academy_id, **template,
            "status": "active", "created_at": now, "updated_at": now,
        }
        await db.modalities.insert_one(doc)
        created.append(template["name"])
    return created

async def _create_invoice(academy_id, plan):
    today, competency = date.today(), date.today().strftime("%Y-%m")
    existing = await db.platform_invoices.find_one({"academy_id": academy_id, "competency": competency})
    if existing: return existing
    doc = {"id": str(uuid.uuid4()), "academy_id": academy_id, "plan_id": plan["id"], "competency": competency, "due_date": today.replace(day=min(5, 28)).isoformat(), "value": float(plan["value"]), "status": "pending", "created_at": datetime.now(timezone.utc).isoformat()}
    await db.platform_invoices.insert_one(doc)
    return doc

@router.get("/overview")
async def overview(user: dict = Depends(require_superadmin)):
    academies, invoices = await db.academies.find({}).to_list(5000), await db.platform_invoices.find({}).to_list(10000)
    current = date.today().strftime("%Y-%m")
    paid = [i for i in invoices if i.get("status") == "paid" and i.get("competency") == current]
    open_invoices = [i for i in invoices if i.get("status") != "paid"]
    return {"academies": {"total": len(academies), "active": sum(a.get("status", "active") == "active" for a in academies), "trial": sum(a.get("status") == "trial" for a in academies), "overdue": sum(a.get("status") == "overdue" for a in academies), "blocked": sum(a.get("status") in {"suspended", "cancelled"} for a in academies)}, "revenue": {"received_current_month": round(sum(float(i.get("amount_paid", i.get("value", 0))) for i in paid), 2), "outstanding": round(sum(float(i.get("value", 0)) for i in open_invoices), 2), "active_subscriptions": await db.academy_subscriptions.count_documents({"status": "active"})}, "attention": [{"id": a["id"], "name": a.get("name"), "status": a.get("status", "active")} for a in academies if a.get("status", "active") not in {"active", "trial"}][:10]}

@router.get("/academies")
async def list_academies(q: str = "", status: str = "", user: dict = Depends(require_superadmin)):
    query = {"status": status} if status else {}
    if q.strip():
        safe = re.escape(q.strip()); query["$or"] = [{"name": {"$regex": safe, "$options": "i"}}, {"slug": {"$regex": safe, "$options": "i"}}, {"cnpj": {"$regex": safe, "$options": "i"}}]
    docs = await db.academies.find(query).sort("name", 1).to_list(5000)
    subscriptions = {s["academy_id"]: s for s in await db.academy_subscriptions.find({}).to_list(5000)}
    plans = {p["id"]: p for p in await db.platform_plans.find({}).to_list(500)}
    result = []
    for academy in docs:
        item = _clean(academy); item["student_count"] = await db.students.count_documents({"academy_id": academy["id"]})
        subscription = subscriptions.get(academy["id"]); item["subscription"] = _clean(subscription); item["plan"] = _clean(plans.get(subscription.get("plan_id"))) if subscription else None; result.append(item)
    return result

@router.post("/academies")
async def create_academy(payload: AcademyCreate, user: dict = Depends(require_superadmin)):
    if len(payload.admin_password) < 8: raise HTTPException(status_code=400, detail="A senha do administrador deve ter ao menos 8 caracteres")
    email, slug = payload.admin_email.lower(), _slug(payload.slug or payload.name)
    if not slug: raise HTTPException(status_code=400, detail="Informe uma URL válida para a academia")
    if await db.academies.find_one({"slug": slug}): raise HTTPException(status_code=400, detail="Esta URL de academia já está em uso")
    now = datetime.now(timezone.utc).isoformat(); academy = {"id": str(uuid.uuid4()), "name": payload.name.strip(), "slug": slug, "cnpj": payload.cnpj or "", "status": "trial", "created_at": now, "created_by": user["id"]}
    await db.academies.insert_one(academy)
    await db.users.insert_one({"id": str(uuid.uuid4()), "email": email, "password_hash": hash_password(payload.admin_password), "name": payload.admin_name.strip(), "role": "admin", "academy_id": academy["id"], "linked_id": None, "created_at": now})
    modalities = await _ensure_default_modalities(academy["id"])
    await _audit(user, "academy.created", academy["id"], {"name": academy["name"], "slug": slug, "status": "trial", "default_modalities": modalities})
    return _clean(academy)

@router.get("/academies/{academy_id}")
async def academy_detail(academy_id: str, user: dict = Depends(require_superadmin)):
    academy = await db.academies.find_one({"id": academy_id})
    if not academy: raise HTTPException(status_code=404, detail="Academia não encontrada")
    result = _clean(academy); result["admins"] = [_clean(x) for x in await db.users.find({"academy_id": academy_id, "role": "admin"}).sort("name", 1).to_list(100)]; result["student_count"] = await db.students.count_documents({"academy_id": academy_id}); result["subscription"] = _clean(await db.academy_subscriptions.find_one({"academy_id": academy_id})); result["invoices"] = [_clean(x) for x in await db.platform_invoices.find({"academy_id": academy_id}).sort("due_date", -1).to_list(24)]; result["invites"] = [_clean(x) for x in await db.platform_admin_invites.find({"academy_id": academy_id, "status": "pending"}).sort("created_at", -1).to_list(50)]; return result

@router.patch("/academies/{academy_id}")
async def update_academy(academy_id: str, payload: AcademyUpdate, user: dict = Depends(require_superadmin)):
    academy = await db.academies.find_one({"id": academy_id})
    if not academy: raise HTTPException(status_code=404, detail="Academia não encontrada")
    data = {k: v.strip() if isinstance(v, str) else v for k, v in payload.model_dump().items() if v is not None}
    if "slug" in data:
        data["slug"] = _slug(data["slug"])
        if not data["slug"]: raise HTTPException(status_code=400, detail="Informe uma URL válida")
        if await db.academies.find_one({"slug": data["slug"], "id": {"$ne": academy_id}}): raise HTTPException(status_code=400, detail="Esta URL de academia já está em uso")
    if not data: return _clean(academy)
    data["updated_at"] = datetime.now(timezone.utc).isoformat(); await db.academies.update_one({"id": academy_id}, {"$set": data}); await _audit(user, "academy.updated", academy_id, {"fields": sorted(k for k in data if k != "updated_at")}); return _clean(await db.academies.find_one({"id": academy_id}))

@router.patch("/academies/{academy_id}/status")
async def update_status(academy_id: str, payload: AcademyStatusUpdate, user: dict = Depends(require_superadmin)):
    if payload.status not in ACADEMY_STATUSES: raise HTTPException(status_code=400, detail="Status inválido")
    result = await db.academies.update_one({"id": academy_id}, {"$set": {"status": payload.status, "status_reason": (payload.reason or "").strip(), "updated_at": datetime.now(timezone.utc).isoformat()}})
    if not result.matched_count: raise HTTPException(status_code=404, detail="Academia não encontrada")
    modalities = await _ensure_default_modalities(academy_id) if payload.status in {"trial", "active"} else []
    await _audit(user, "academy.status_changed", academy_id, {"status": payload.status, "reason": payload.reason or "", "default_modalities_added": modalities}); return _clean(await db.academies.find_one({"id": academy_id}))

@router.post("/academies/{academy_id}/admin-invites")
async def create_admin_invite(academy_id: str, payload: PlatformAdminInviteCreate, user: dict = Depends(require_superadmin)):
    if payload.role != "admin" or not await db.academies.find_one({"id": academy_id}): raise HTTPException(status_code=400, detail="Academia ou função inválida")
    email = payload.email.lower()
    if await db.users.find_one({"academy_id": academy_id, "email": email}): raise HTTPException(status_code=400, detail="Este e-mail já possui acesso a esta academia")
    token, now = secrets.token_urlsafe(32), datetime.now(timezone.utc); invite = {"id": str(uuid.uuid4()), "academy_id": academy_id, "email": email, "name": payload.name.strip(), "role": "admin", "token": token, "status": "pending", "created_at": now.isoformat(), "expires_at": (now + timedelta(hours=72)).isoformat()}; await db.platform_admin_invites.insert_one(invite); await _audit(user, "academy.admin_invited", academy_id, {"email": email}); return {"id": invite["id"], "email": email, "expires_at": invite["expires_at"], "activation_token": token}

@router.post("/admin-invites/accept")
async def accept_admin_invite(payload: PlatformAdminInviteAccept):
    if len(payload.password) < 8: raise HTTPException(status_code=400, detail="A senha deve ter ao menos 8 caracteres")
    invite = await db.platform_admin_invites.find_one({"token": payload.token, "status": "pending"})
    if not invite or invite.get("expires_at", "") < datetime.now(timezone.utc).isoformat(): raise HTTPException(status_code=400, detail="Convite inválido ou expirado")
    academy = await db.academies.find_one({"id": invite["academy_id"]})
    if not academy or academy.get("status", "active") not in {"active", "trial"}: raise HTTPException(status_code=400, detail="Academia indisponível")
    if await db.users.find_one({"academy_id": invite["academy_id"], "email": invite["email"]}): raise HTTPException(status_code=400, detail="Este convite já foi utilizado")
    now = datetime.now(timezone.utc).isoformat(); await db.users.insert_one({"id": str(uuid.uuid4()), "email": invite["email"], "password_hash": hash_password(payload.password), "name": invite["name"], "role": "admin", "academy_id": invite["academy_id"], "linked_id": None, "created_at": now}); await db.platform_admin_invites.update_one({"id": invite["id"]}, {"$set": {"status": "accepted", "accepted_at": now}}); await _audit(None, "academy.admin_invite_accepted", invite["academy_id"], {"email": invite["email"]}); return {"message": "Acesso criado. Faça login pela URL da academia."}

@router.get("/plans")
async def list_plans(user: dict = Depends(require_superadmin)): return [_clean(p) for p in await db.platform_plans.find({}).sort("value", 1).to_list(500)]

@router.post("/plans")
async def create_plan(payload: PlatformPlanCreate, user: dict = Depends(require_superadmin)):
    if payload.value < 0 or payload.periodicity not in {"monthly", "quarterly", "yearly"}: raise HTTPException(status_code=400, detail="Plano inválido")
    plan = {"id": str(uuid.uuid4()), **payload.model_dump(), "created_at": datetime.now(timezone.utc).isoformat()}; await db.platform_plans.insert_one(plan); await _audit(user, "plan.created", details={"name": plan["name"], "value": plan["value"]}); return _clean(plan)

@router.patch("/plans/{plan_id}")
async def update_plan(plan_id: str, payload: PlatformPlanUpdate, user: dict = Depends(require_superadmin)):
    data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if data.get("value", 0) < 0 or ("periodicity" in data and data["periodicity"] not in {"monthly", "quarterly", "yearly"}): raise HTTPException(status_code=400, detail="Plano inválido")
    result = await db.platform_plans.update_one({"id": plan_id}, {"$set": {**data, "updated_at": datetime.now(timezone.utc).isoformat()}})
    if not result.matched_count: raise HTTPException(status_code=404, detail="Plano não encontrado")
    await _audit(user, "plan.updated", details={"plan_id": plan_id, "fields": sorted(data)}); return _clean(await db.platform_plans.find_one({"id": plan_id}))

@router.put("/academies/{academy_id}/subscription")
async def set_subscription(academy_id: str, payload: AcademySubscriptionUpdate, user: dict = Depends(require_superadmin)):
    plan = await db.platform_plans.find_one({"id": payload.plan_id, "status": "active"})
    if not await db.academies.find_one({"id": academy_id}) or not plan: raise HTTPException(status_code=404, detail="Academia ou plano ativo não encontrado")
    now = datetime.now(timezone.utc).isoformat(); await db.academy_subscriptions.update_one({"academy_id": academy_id}, {"$set": {"academy_id": academy_id, "plan_id": plan["id"], "status": "active", "start_date": payload.start_date or date.today().isoformat(), "updated_at": now}, "$setOnInsert": {"id": str(uuid.uuid4()), "created_at": now}}, upsert=True); invoice = _clean(await _create_invoice(academy_id, plan)); await _audit(user, "academy.subscription_changed", academy_id, {"plan_id": plan["id"]}); return invoice

@router.get("/billing")
async def billing(user: dict = Depends(require_superadmin)):
    academies = {a["id"]: _clean(a) for a in await db.academies.find({}).to_list(5000)}; plans = {p["id"]: _clean(p) for p in await db.platform_plans.find({}).to_list(500)}; subscriptions = await db.academy_subscriptions.find({}).to_list(5000); invoices = await db.platform_invoices.find({}).sort("due_date", -1).to_list(10000)
    for item in subscriptions: item.pop("_id", None); item["academy"] = academies.get(item["academy_id"]); item["plan"] = plans.get(item["plan_id"])
    for item in invoices:
        item.pop("_id", None); item["academy"] = academies.get(item["academy_id"]); item["plan"] = plans.get(item["plan_id"])
        if item.get("status") != "paid" and item.get("due_date", "") < date.today().isoformat(): item["status"] = "overdue"
    return {"subscriptions": subscriptions, "invoices": invoices}

@router.post("/billing/{invoice_id}/pay")
async def pay_invoice(invoice_id: str, payload: PlatformPaymentRegister, user: dict = Depends(require_superadmin)):
    invoice = await db.platform_invoices.find_one({"id": invoice_id})
    if not invoice: raise HTTPException(status_code=404, detail="Cobrança não encontrada")
    update = {"status": "paid", "paid_at": payload.paid_at or date.today().isoformat(), "amount_paid": float(payload.amount_paid if payload.amount_paid is not None else invoice["value"]), "payment_method": payload.payment_method, "notes": payload.notes, "updated_at": datetime.now(timezone.utc).isoformat()}; await db.platform_invoices.update_one({"id": invoice_id}, {"$set": update}); await _audit(user, "billing.payment_registered", invoice["academy_id"], {"invoice_id": invoice_id, "amount": update["amount_paid"], "method": update["payment_method"]}); return _clean(await db.platform_invoices.find_one({"id": invoice_id}))

@router.get("/audit")
async def audit(academy_id: str = "", user: dict = Depends(require_superadmin)):
    return [_clean(x) for x in await db.platform_audit_events.find({"academy_id": academy_id} if academy_id else {}).sort("created_at", -1).to_list(500)]
