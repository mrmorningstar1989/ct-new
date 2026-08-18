"""FastAPI entry point for CT Warrior Academy Management System."""

from pathlib import Path
from dotenv import load_dotenv

# .env está na raiz do projeto, um nível acima de backend
ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from db import init_db, close_db
from routers import (
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
)


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger(__name__)

app = FastAPI(title="CT Warrior - Academy Management")


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


@app.on_event("startup")
async def on_startup():
    await init_db()
    logger.info("Startup complete: DB initialized and admin seeded")


@app.on_event("shutdown")
async def on_shutdown():
    close_db()


@app.get("/api/")
async def root():
    return {"message": "CT Warrior API", "status": "ok"}
