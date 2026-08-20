"""FastAPI entry point for ZenkaiOS Academy Management System."""

from pathlib import Path
from dotenv import load_dotenv

# .env estÃ¡ na raiz do projeto, um nÃ­vel acima de backend
ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from .db import init_db, close_db
from .routers import (
    auth_router,
    students,
    teachers,
    modalities,
    classes,
    enrollments,
    plans,
    invoices,
    attendance,
    graduations,
    dashboard,
    announcements,
    notifications,
    academy,
    reminders,
    platform,
    biometrics,
)


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger(__name__)

app = FastAPI(title="ZenkaiOS - Academy Management")


def validate_production_settings() -> None:
    """Fail at startup instead of exposing an incompletely configured API."""
    if os.environ.get("VERCEL_ENV") != "production":
        return

    required = ["MONGO_URL", "DB_NAME", "JWT_SECRET"]
    if os.environ.get("SEED_DEFAULT_ADMIN", "false").lower() == "true":
        required.extend(["ADMIN_EMAIL", "ADMIN_PASSWORD"])
    missing = [name for name in required if not os.environ.get(name)]
    if missing:
        raise RuntimeError(f"Missing production environment variables: {', '.join(missing)}")
    if len(os.environ["JWT_SECRET"]) < 32:
        raise RuntimeError("JWT_SECRET must have at least 32 characters in production")
    if os.environ.get("COOKIE_SECURE", "true").lower() != "true":
        raise RuntimeError("COOKIE_SECURE must be true in production")
    origins = {origin.strip() for origin in os.environ.get("CORS_ORIGINS", "").split(",") if origin.strip()}
    if "*" in origins:
        raise RuntimeError("CORS_ORIGINS cannot include * when credentials are enabled")


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[
    origin.strip()
    for origin in os.environ.get(
        "CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip()
],
    allow_methods=["*"],
    allow_headers=["*"],
)


# Include routers - all prefixed with /api
app.include_router(auth_router.router)
app.include_router(students.router)
app.include_router(teachers.router)
app.include_router(modalities.router)
app.include_router(classes.router)
app.include_router(enrollments.router)
app.include_router(plans.router)
app.include_router(invoices.router)
app.include_router(attendance.router)
app.include_router(graduations.router)
app.include_router(dashboard.router)
app.include_router(announcements.router)
app.include_router(notifications.router)
app.include_router(academy.router)
app.include_router(reminders.router)
app.include_router(platform.router)
app.include_router(biometrics.router)


@app.on_event("startup")
async def on_startup():
    validate_production_settings()
    await init_db()
    logger.info("Startup complete: DB initialized and admin seeded")


@app.on_event("shutdown")
async def on_shutdown():
    close_db()


@app.get("/api/")
async def root():
    return {"message": "ZenkaiOS API", "status": "ok"}

