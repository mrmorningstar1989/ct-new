"""Authentication: password hashing, JWT, current-user dependency, role checks."""
import os
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, Request, Depends

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 60 * 24  # 24h for smoother UX in MVP
REFRESH_TOKEN_DAYS = 7


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def _secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, email: str, role: str, academy_id: str | None = None) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "academy_id": academy_id,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, _secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_DAYS),
        "type": "refresh",
    }
    return jwt.encode(payload, _secret(), algorithm=JWT_ALGORITHM)


def _decode(token: str) -> dict:
    try:
        return jwt.decode(token, _secret(), algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token invÃ¡lido")


async def get_current_user(request: Request) -> dict:
    # Deferred import to avoid circular
    from .db import db

    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="NÃ£o autenticado")

    payload = _decode(token)
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Tipo de token invÃ¡lido")

    user = await db.users.find_one({"id": payload["sub"]}, {"password_hash": 0, "_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="UsuÃ¡rio nÃ£o encontrado")
    # The database is authoritative: never trust a tenant selected in the JWT.
    # Every non-platform user must belong to an active academy.
    if user.get("role") != "superadmin":
        academy_id = user.get("academy_id")
        if not academy_id:
            raise HTTPException(status_code=403, detail="UsuÃ¡rio sem academia vinculada")
        academy = await db.academies.find_one({"id": academy_id}, {"_id": 0, "status": 1})
        if not academy or academy.get("status", "active") not in {"active", "trial"}:
            raise HTTPException(status_code=403, detail="Academia indisponÃ­vel")
    return user


def require_roles(*roles: str):
    async def _dep(user: dict = Depends(get_current_user)) -> dict:
        if user.get("role") not in roles:
            raise HTTPException(status_code=403, detail="Acesso negado")
        return user
    return _dep


require_admin = require_roles("admin")
require_admin_or_teacher = require_roles("admin", "teacher")
require_superadmin = require_roles("superadmin")

