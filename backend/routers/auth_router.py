"""Authentication endpoints."""
import os
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Response, Request, Depends

from auth import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    get_current_user,
)
from db import db, DEFAULT_ACADEMY_ID
from models import LoginRequest, RegisterRequest

router = APIRouter(prefix="/api/auth", tags=["auth"])

MAX_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


def _set_auth_cookies(response: Response, access: str, refresh: str):
    # Local HTTP development needs non-Secure cookies. Production keeps the
    # browser's Secure requirement unless explicitly configured otherwise.
    cookie_secure = os.environ.get("COOKIE_SECURE", "true").lower() == "true"
    cookie_samesite = "none" if cookie_secure else "lax"
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
    identifier = f"{ip}:{email}"

    # Brute force check
    attempt = await db.login_attempts.find_one({"identifier": identifier})
    if attempt and attempt.get("count", 0) >= MAX_ATTEMPTS:
        locked_until = attempt.get("locked_until")
        if locked_until:
            locked_dt = datetime.fromisoformat(locked_until)
            if locked_dt > datetime.now(timezone.utc):
                raise HTTPException(status_code=429, detail="Muitas tentativas. Aguarde 15 minutos.")

    user = await db.users.find_one({"email": email})
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


@router.post("/register")
async def register(payload: RegisterRequest, response: Response):
    """Public register limited to students role. Admins create teachers/staff internally."""
    email = payload.email.lower()
    role = "student"  # force

    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email já cadastrado")

    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": email,
        "password_hash": hash_password(payload.password),
        "name": payload.name,
        "role": role,
        "academy_id": DEFAULT_ACADEMY_ID,
        "linked_id": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)

    access = create_access_token(user_id, email, role, DEFAULT_ACADEMY_ID)
    refresh = create_refresh_token(user_id)
    _set_auth_cookies(response, access, refresh)
    return _user_out(user_doc)
