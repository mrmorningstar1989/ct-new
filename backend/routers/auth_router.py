"""Authentication endpoints."""
import os
import uuid
from datetime import datetime, timezone, timedelta, date
from fastapi import APIRouter, HTTPException, Response, Request, Depends

from ..auth import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    get_current_user,
)
from ..db import db
from ..models import LoginRequest, PublicStudentRegistration

router = APIRouter(prefix="/api/auth", tags=["auth"])

MAX_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


def _set_auth_cookies(response: Response, access: str, refresh: str):
    # Local HTTP development needs non-Secure cookies. Production keeps the
    # browser's Secure requirement unless explicitly configured otherwise.
    cookie_secure = os.environ.get("COOKIE_SECURE", "true").lower() == "true"
    # Same-origin is the default Vercel deployment and is protected against
    # cross-site POSTs by Lax. External browser clients may opt in to `none`.
    cookie_samesite = os.environ.get("COOKIE_SAMESITE", "lax").lower()
    if cookie_samesite not in {"lax", "strict", "none"}:
        raise RuntimeError("COOKIE_SAMESITE must be lax, strict, or none")
    if cookie_samesite == "none" and not cookie_secure:
        raise RuntimeError("COOKIE_SAMESITE=none requires COOKIE_SECURE=true")
    response.set_cookie(
        key="access_token", value=access, httponly=True, secure=cookie_secure,
        samesite=cookie_samesite, max_age=60 * 60 * 24, path="/",
    )
    response.set_cookie(
        key="refresh_token", value=refresh, httponly=True, secure=cookie_secure,
        samesite=cookie_samesite, max_age=60 * 60 * 24 * 7, path="/",
    )


def _user_out(u: dict) -> dict:
    return {
        "id": u["id"],
        "email": u["email"],
        "name": u["name"],
        "role": u["role"],
        "academy_id": u.get("academy_id"),
        "linked_id": u.get("linked_id"),
    }


@router.post("/login")
async def login(payload: LoginRequest, request: Request, response: Response):
    email = payload.email.lower()
    ip = request.client.host if request.client else "unknown"
    academy_slug = (payload.academy_slug or "").lower().strip()
    identifier = f"{ip}:{academy_slug}:{email}"

    if academy_slug:
        academy = await db.academies.find_one({"slug": academy_slug, "status": "active"}, {"_id": 0})
        if not academy:
            raise HTTPException(status_code=404, detail="Academia indisponÃ­vel")
        user_query = {"email": email, "academy_id": academy["id"]}
    else:
        # The root login is reserved for platform administrators. Academy users
        # must authenticate through their academy's unique URL.
        user_query = {"email": email, "role": "superadmin"}

    # Brute force check
    attempt = await db.login_attempts.find_one({"identifier": identifier})
    if attempt and attempt.get("count", 0) >= MAX_ATTEMPTS:
        locked_until = attempt.get("locked_until")
        if locked_until:
            locked_dt = datetime.fromisoformat(locked_until)
            if locked_dt > datetime.now(timezone.utc):
                raise HTTPException(status_code=429, detail="Muitas tentativas. Aguarde 15 minutos.")

    user = await db.users.find_one(user_query)
    if not user or not verify_password(payload.password, user["password_hash"]):
        # Increment attempts
        new_count = (attempt.get("count", 0) + 1) if attempt else 1
        locked_until = None
        if new_count >= MAX_ATTEMPTS:
            locked_until = (datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)).isoformat()
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$set": {"count": new_count, "locked_until": locked_until}},
            upsert=True,
        )
        raise HTTPException(status_code=401, detail="Email ou senha incorretos")

    await db.login_attempts.delete_one({"identifier": identifier})

    access = create_access_token(user["id"], user["email"], user["role"], user.get("academy_id"))
    refresh = create_refresh_token(user["id"])
    _set_auth_cookies(response, access, refresh)

    return _user_out(user)


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return _user_out(user)


@router.get("/public/academies/{academy_slug}")
async def public_academy(academy_slug: str):
    academy = await db.academies.find_one(
        {"slug": academy_slug.lower().strip(), "status": "active"},
        {"_id": 0, "id": 1, "name": 1, "slug": 1, "logo_url": 1, "city": 1, "state": 1},
    )
    if not academy:
        raise HTTPException(status_code=404, detail="Academia nÃ£o encontrada")
    return academy


@router.post("/public/academies/{academy_slug}/register")
async def public_register(academy_slug: str, payload: PublicStudentRegistration, response: Response):
    """Create a pending student enrollment for the academy named in the URL."""
    academy = await db.academies.find_one({"slug": academy_slug.lower().strip(), "status": "active"})
    if not academy:
        raise HTTPException(status_code=404, detail="Academia nÃ£o encontrada ou indisponÃ­vel")
    if not payload.selfie_data_url.startswith("data:image/") or len(payload.selfie_data_url) > 2_800_000:
        raise HTTPException(status_code=400, detail="Envie uma selfie em imagem de atÃ© 2 MB")
    biometric_enabled = os.environ.get("BIOMETRIC_FEATURE_ENABLED", "false").lower() == "true"
    try:
        born = date.fromisoformat(payload.birth_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Data de nascimento invÃ¡lida")
    is_minor = (date.today() - born).days < 18 * 365.25
    if biometric_enabled and payload.biometric_consent and is_minor and not payload.guardian_biometric_consent:
        raise HTTPException(status_code=400, detail="Para menores, o consentimento do responsÃ¡vel legal Ã© obrigatÃ³rio")

    parq_keys = {
        "q1_heart_condition", "q2_chest_pain_activity", "q3_chest_pain_month",
        "q4_balance_loss", "q5_bone_joint", "q6_medication", "q7_other_reason",
    }
    if any(payload.parq.get(key) not in (True, False) for key in parq_keys):
        raise HTTPException(status_code=400, detail="Responda todas as perguntas do PAR-Q")
    if not all(value.strip() for value in (payload.emergency_contact.name, payload.emergency_contact.relationship, payload.emergency_contact.phone)):
        raise HTTPException(status_code=400, detail="Preencha o contato de emergÃªncia")
    required_anamnesis = {"height_cm", "weight_kg", "blood_type", "diseases", "allergies", "medications", "surgeries", "injuries", "family_history", "exercise_frequency", "goals"}
    if any(not str(payload.anamnesis.get(key, "")).strip() for key in required_anamnesis):
        raise HTTPException(status_code=400, detail="Preencha todos os campos obrigatÃ³rios da anamnese")
    if payload.anamnesis.get("smoker") not in (True, False) or payload.anamnesis.get("alcohol") not in (True, False) or payload.anamnesis.get("doctor_clearance") not in (True, False):
        raise HTTPException(status_code=400, detail="Conclua as respostas obrigatÃ³rias da anamnese")

    email = payload.email.lower()
    academy_id = academy["id"]
    if await db.users.find_one({"email": email, "academy_id": academy_id}):
        raise HTTPException(status_code=400, detail="JÃ¡ existe uma conta com este e-mail nesta academia")

    now = datetime.now(timezone.utc).isoformat()
    counter = await db.counters.find_one_and_update(
        {"_id": f"student_matricula:{academy_id}"}, {"$inc": {"seq": 1}}, upsert=True, return_document=True,
    )
    matricula = f"ZK{(counter or {}).get('seq', 1):05d}"
    student_id = str(uuid.uuid4())
    student = {
        "id": student_id, "academy_id": academy_id, "matricula": matricula,
        "full_name": payload.full_name.strip(), "email": email, "cpf": payload.cpf,
        "birth_date": payload.birth_date, "phone": payload.phone, "whatsapp": payload.phone,
        "address": payload.address, "city": payload.city, "state": payload.state.upper(),
        "emergency_contact": payload.emergency_contact.model_dump(), "photo_url": payload.selfie_data_url,
        "parq": {**payload.parq, "filled_at": now},
        "anamnesis": {**payload.anamnesis, "filled_at": now},
        "biometric_consent": {
            "granted": payload.biometric_consent if biometric_enabled else False,
            "guardian_granted": payload.guardian_biometric_consent if biometric_enabled and is_minor else None,
            "purpose": "sugestÃ£o de presenÃ§a com confirmaÃ§Ã£o humana",
            "version": "2026-08-20", "granted_at": now if biometric_enabled and payload.biometric_consent else None,
        },
        "status": "pending", "created_at": now, "updated_at": now,
        "registration_source": "self_service",
    }
    user_doc = {
        "id": str(uuid.uuid4()), "email": email, "password_hash": hash_password(payload.password),
        "name": payload.full_name.strip(), "role": "student", "academy_id": academy_id,
        "linked_id": student_id, "created_at": now,
    }
    await db.students.insert_one(student)
    await db.users.insert_one(user_doc)
    access = create_access_token(user_doc["id"], email, "student", academy_id)
    refresh = create_refresh_token(user_doc["id"])
    _set_auth_cookies(response, access, refresh)
    return {**_user_out(user_doc), "registration_status": "pending"}

