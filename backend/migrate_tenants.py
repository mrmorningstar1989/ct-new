"""One-time, non-destructive tenant backfill for legacy ZenkaiOS data.

Run from backend only after taking a database backup:
    python -m backend.migrate_tenants
"""
import asyncio
from .db import db, DEFAULT_ACADEMY_ID

TENANT_COLLECTIONS = (
    "users", "students", "teachers", "modalities", "classes", "enrollments", "plans",
    "invoices", "attendance", "graduations", "announcements", "cash_transactions",
    "whatsapp_reminders", "cron_runs",
)


async def main():
    for name in TENANT_COLLECTIONS:
        result = await db[name].update_many(
            {"academy_id": {"$exists": False}}, {"$set": {"academy_id": DEFAULT_ACADEMY_ID}}
        )
        print(f"{name}: {result.modified_count} record(s) updated")


if __name__ == "__main__":
    asyncio.run(main())

