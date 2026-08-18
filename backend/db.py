"""MongoDB connection, indexes and seeding."""
import os
import uuid
import logging
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient

from auth import hash_password, verify_password

logger = logging.getLogger(__name__)

_mongo_url = os.environ["MONGO_URL"]
_client = AsyncIOMotorClient(_mongo_url)
db = _client[os.environ["DB_NAME"]]

DEFAULT_ACADEMY_ID = "default-academy"


async def init_db():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.academies.create_index("id", unique=True)
    # Tenant-scoped indexes keep both lookups and isolation explicit.
    for collection in ("students", "teachers", "modalities", "classes", "enrollments", "plans", "invoices", "attendance", "graduations", "announcements", "cash_transactions", "whatsapp_reminders"):
        await db[collection].create_index([("academy_id", 1), ("id", 1)])
    await db.login_attempts.create_index("identifier")
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.students.create_index("email")
    await db.students.create_index("cpf")
    await db.attendance.create_index([("class_id", 1), ("date", 1)])
    await db.invoices.create_index("student_id")
    await db.enrollments.create_index("student_id")

    await seed_default_academy()
    await seed_admin()
    await seed_superadmin()
    await seed_default_data()


async def seed_default_academy():
    existing = await db.academies.find_one({"id": DEFAULT_ACADEMY_ID})
    if existing:
        return
    await db.academies.insert_one({
        "id": DEFAULT_ACADEMY_ID,
        "name": os.environ.get("DEFAULT_ACADEMY_NAME", "CT Warrior"),
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


async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    admin_name = os.environ.get("ADMIN_NAME", "Admin")

    existing = await db.users.find_one({"email": admin_email})
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
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}},
        )


async def seed_superadmin():
    """Optional platform account; only created when explicitly configured."""
    email = os.environ.get("SUPERADMIN_EMAIL", "").lower().strip()
    password = os.environ.get("SUPERADMIN_PASSWORD", "")
    if not email or not password or await db.users.find_one({"email": email}):
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
            "description": "Nobre arte pugilística",
            "status": "active",
            "min_age": 8,
            "max_age": 99,
            "belt_system": [
                {"order": 0, "name": "Iniciante", "color": "#FFFFFF"},
                {"order": 1, "name": "Intermediário", "color": "#FBBF24"},
                {"order": 2, "name": "Avançado", "color": "#DC2626"},
                {"order": 3, "name": "Competidor", "color": "#000000"},
            ],
            "created_at": now,
        },
    ]

    await db.modalities.insert_many(modalities)

    # Seed default plans
    plans = [
        {"id": str(uuid.uuid4()), "academy_id": DEFAULT_ACADEMY_ID, "name": "Mensal", "value": 200.0, "periodicity": "monthly", "classes_per_week": 0, "description": "Aulas ilimitadas no mês", "status": "active", "created_at": now},
        {"id": str(uuid.uuid4()), "academy_id": DEFAULT_ACADEMY_ID, "name": "Trimestral", "value": 540.0, "periodicity": "quarterly", "classes_per_week": 0, "description": "3 meses com desconto", "status": "active", "created_at": now},
        {"id": str(uuid.uuid4()), "academy_id": DEFAULT_ACADEMY_ID, "name": "Anual", "value": 1920.0, "periodicity": "yearly", "classes_per_week": 0, "description": "12 meses com 20% desconto", "status": "active", "created_at": now},
        {"id": str(uuid.uuid4()), "academy_id": DEFAULT_ACADEMY_ID, "name": "Aula Avulsa", "value": 50.0, "periodicity": "single", "classes_per_week": 0, "description": "Uma aula única", "status": "active", "created_at": now},
    ]
    await db.plans.insert_many(plans)


def close_db():
    _client.close()
