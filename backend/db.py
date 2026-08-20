"""MongoDB connection, indexes and seeding."""
import os
import uuid
import logging
import re
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient

from .auth import hash_password, verify_password

logger = logging.getLogger(__name__)

_mongo_url = os.environ.get("MONGO_URL")
_db_name = os.environ.get("DB_NAME")
if not _mongo_url or not _db_name:
    raise RuntimeError("MONGO_URL and DB_NAME must be configured")
_client = AsyncIOMotorClient(_mongo_url)
db = _client[_db_name]

DEFAULT_ACADEMY_ID = "default-academy"


async def init_db():
    # Indexes
    # Accounts are scoped to an academy: the same person may enroll and log in
    # independently at more than one academy.
    try:
        await db.users.drop_index("email_1")
    except Exception:
        pass
    await db.users.create_index([("academy_id", 1), ("email", 1)], unique=True)
    await db.academies.create_index("id", unique=True)
    await db.academies.create_index("slug", unique=True, sparse=True)
    # Tenant-scoped indexes keep both lookups and isolation explicit.
    for collection in ("students", "teachers", "modalities", "classes", "enrollments", "plans", "invoices", "attendance", "graduations", "announcements", "cash_transactions", "whatsapp_reminders"):
        await db[collection].create_index([("academy_id", 1), ("id", 1)])
    await db.platform_plans.create_index("id", unique=True)
    await db.academy_subscriptions.create_index("academy_id", unique=True)
    await db.platform_invoices.create_index([("academy_id", 1), ("competency", 1)], unique=True)
    await db.platform_audit_events.create_index([("created_at", -1)])
    await db.platform_audit_events.create_index([("academy_id", 1), ("created_at", -1)])
    await db.platform_admin_invites.create_index("token", unique=True)
    await db.platform_admin_invites.create_index("expires_at", expireAfterSeconds=0)
    await db.login_attempts.create_index("identifier")
    await db.biometric_attendance_jobs.create_index("expires_at", expireAfterSeconds=0)
    await db.biometric_attendance_jobs.create_index([("academy_id", 1), ("class_id", 1), ("date", 1)])
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.students.create_index("email")
    await db.students.create_index("cpf")
    await db.attendance.create_index([("class_id", 1), ("date", 1)])
    await db.invoices.create_index("student_id")
    await db.enrollments.create_index("student_id")

    if os.environ.get("SEED_DEFAULT_ACADEMY", "false").lower() == "true":
        await seed_default_academy()
        await seed_default_data()
    await ensure_academy_slugs()
    await db.academies.update_many({"status": {"$exists": False}}, {"$set": {"status": "active"}})
    if os.environ.get("SEED_DEFAULT_ADMIN", "false").lower() == "true":
        await seed_admin()
    await seed_superadmin()


async def seed_default_academy():
    existing = await db.academies.find_one({"id": DEFAULT_ACADEMY_ID})
    if existing:
        return
    await db.academies.insert_one({
        "id": DEFAULT_ACADEMY_ID,
        "name": os.environ.get("DEFAULT_ACADEMY_NAME", "ZenkaiOS"),
        "slug": os.environ.get("DEFAULT_ACADEMY_SLUG", "zenkaios"),
        "cnpj": "",
        "email": "",
        "phone": "",
        "whatsapp": "",
        "address": "",
        "city": "",
        "state": "",
        "logo_url": "",
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


def academy_slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "academia"


async def ensure_academy_slugs():
    """Give legacy academies stable login URLs without changing their ids."""
    async for academy in db.academies.find({"$or": [{"slug": {"$exists": False}}, {"slug": ""}]}):
        base = academy_slug(academy.get("name", "academia"))
        candidate = base
        suffix = 2
        while await db.academies.find_one({"slug": candidate, "id": {"$ne": academy["id"]}}):
            candidate = f"{base}-{suffix}"
            suffix += 1
        await db.academies.update_one({"id": academy["id"]}, {"$set": {"slug": candidate}})


async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "").lower().strip()
    admin_password = os.environ.get("ADMIN_PASSWORD", "")
    admin_name = os.environ.get("ADMIN_NAME", "Admin")

    # Never create a publicly guessable production account. The initial admin
    # must be provisioned explicitly through Vercel environment variables.
    if not admin_email or not admin_password:
        if os.environ.get("VERCEL_ENV") == "production":
            raise RuntimeError("ADMIN_EMAIL and ADMIN_PASSWORD must be configured in production")
        logger.warning("Admin seed skipped: ADMIN_EMAIL and ADMIN_PASSWORD are not configured")
        return

    existing = await db.users.find_one({"email": admin_email, "academy_id": DEFAULT_ACADEMY_ID})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": admin_name,
            "role": "admin",
            "academy_id": DEFAULT_ACADEMY_ID,
            "linked_id": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Admin seeded: {admin_email}")
    elif os.environ.get("RESET_SEEDED_ADMIN_PASSWORD", "").lower() == "true" and not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}},
        )


async def seed_superadmin():
    """Optional platform account; only created when explicitly configured."""
    email = os.environ.get("SUPERADMIN_EMAIL", "").lower().strip()
    password = os.environ.get("SUPERADMIN_PASSWORD", "")
    if not email or not password or await db.users.find_one({"email": email, "role": "superadmin"}):
        return
    await db.users.insert_one({
        "id": str(uuid.uuid4()), "email": email, "password_hash": hash_password(password),
        "name": os.environ.get("SUPERADMIN_NAME", "Superadmin"), "role": "superadmin",
        "academy_id": None, "linked_id": None, "created_at": datetime.now(timezone.utc).isoformat(),
    })
    logger.info("Superadmin seeded from environment")


async def seed_default_data():
    # Seed default modalities with belt systems if empty
    count = await db.modalities.count_documents({})
    if count > 0:
        return

    now = datetime.now(timezone.utc).isoformat()

    modalities = [
        {
            "id": str(uuid.uuid4()),
            "academy_id": DEFAULT_ACADEMY_ID,
            "name": "Jiu-Jitsu",
            "description": "Arte suave brasileira",
            "status": "active",
            "min_age": 4,
            "max_age": 99,
            "belt_system": [
                {"order": 0, "name": "Branca", "color": "#FFFFFF"},
                {"order": 1, "name": "Cinza", "color": "#9CA3AF"},
                {"order": 2, "name": "Amarela", "color": "#FBBF24"},
                {"order": 3, "name": "Laranja", "color": "#F97316"},
                {"order": 4, "name": "Verde", "color": "#16A34A"},
                {"order": 5, "name": "Azul", "color": "#2563EB"},
                {"order": 6, "name": "Roxa", "color": "#9333EA"},
                {"order": 7, "name": "Marrom", "color": "#92400E"},
                {"order": 8, "name": "Preta", "color": "#000000"},
            ],
            "created_at": now,
        },
        {
            "id": str(uuid.uuid4()),
            "academy_id": DEFAULT_ACADEMY_ID,
            "name": "Muay Thai",
            "description": "Arte das oito armas",
            "status": "active",
            "min_age": 6,
            "max_age": 99,
            "belt_system": [
                {"order": 0, "name": "Iniciante", "color": "#FFFFFF"},
                {"order": 1, "name": "Prajied Branco", "color": "#F3F4F6"},
                {"order": 2, "name": "Prajied Amarelo", "color": "#FBBF24"},
                {"order": 3, "name": "Prajied Verde", "color": "#16A34A"},
                {"order": 4, "name": "Prajied Azul", "color": "#2563EB"},
                {"order": 5, "name": "Prajied Vermelho", "color": "#DC2626"},
                {"order": 6, "name": "Prajied Preto", "color": "#000000"},
            ],
            "created_at": now,
        },
        {
            "id": str(uuid.uuid4()),
            "academy_id": DEFAULT_ACADEMY_ID,
            "name": "Boxe",
            "description": "Nobre arte pugilÃ­stica",
            "status": "active",
            "min_age": 8,
            "max_age": 99,
            "belt_system": [
                {"order": 0, "name": "Iniciante", "color": "#FFFFFF"},
                {"order": 1, "name": "IntermediÃ¡rio", "color": "#FBBF24"},
                {"order": 2, "name": "AvanÃ§ado", "color": "#DC2626"},
                {"order": 3, "name": "Competidor", "color": "#000000"},
            ],
            "created_at": now,
        },
    ]

    await db.modalities.insert_many(modalities)

    # Seed default plans
    plans = [
        {"id": str(uuid.uuid4()), "academy_id": DEFAULT_ACADEMY_ID, "name": "Mensal", "value": 200.0, "periodicity": "monthly", "classes_per_week": 0, "description": "Aulas ilimitadas no mÃªs", "status": "active", "created_at": now},
        {"id": str(uuid.uuid4()), "academy_id": DEFAULT_ACADEMY_ID, "name": "Trimestral", "value": 540.0, "periodicity": "quarterly", "classes_per_week": 0, "description": "3 meses com desconto", "status": "active", "created_at": now},
        {"id": str(uuid.uuid4()), "academy_id": DEFAULT_ACADEMY_ID, "name": "Anual", "value": 1920.0, "periodicity": "yearly", "classes_per_week": 0, "description": "12 meses com 20% desconto", "status": "active", "created_at": now},
        {"id": str(uuid.uuid4()), "academy_id": DEFAULT_ACADEMY_ID, "name": "Aula Avulsa", "value": 50.0, "periodicity": "single", "classes_per_week": 0, "description": "Uma aula Ãºnica", "status": "active", "created_at": now},
    ]
    await db.plans.insert_many(plans)


def close_db():
    _client.close()

