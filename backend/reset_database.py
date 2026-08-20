"""Destructively reset the application database while preserving one superadmin.

Run from the project root:
    python -m backend.reset_database --email bmunhozdv@gmail.com --confirm RESET_CT_WARRIOR
"""
import argparse
import asyncio
import os
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

# The application keeps its local configuration at the project root. Load it
# before importing db, whose MongoDB client is configured at import time.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from .auth import hash_password
from .db import db, close_db


async def reset(email: str) -> None:
    account = await db.users.find_one({"email": email.lower(), "role": "superadmin"})
    if not account:
        password = os.environ.get("SUPERADMIN_PASSWORD", "")
        if not password:
            raise RuntimeError("Superadmin not found and SUPERADMIN_PASSWORD is not configured")
        account = {
            "id": __import__("uuid").uuid4().hex,
            "email": email.lower(),
            "password_hash": hash_password(password),
            "name": os.environ.get("SUPERADMIN_NAME", "Superadmin"),
            "role": "superadmin",
            "academy_id": None,
            "linked_id": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    account.pop("_id", None)
    account["email"] = email.lower()
    account["role"] = "superadmin"
    account["academy_id"] = None
    account["linked_id"] = None

    collections = await db.list_collection_names()
    for collection in collections:
        await db[collection].delete_many({})
    await db.users.insert_one(account)
    print(f"Database reset complete. Preserved superadmin: {account['email']}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True)
    parser.add_argument("--confirm", required=True)
    args = parser.parse_args()
    if args.confirm != "RESET_CT_WARRIOR":
        raise SystemExit("Confirmation token does not match; nothing was changed.")
    try:
        asyncio.run(reset(args.email))
    finally:
        close_db()


if __name__ == "__main__":
    main()
