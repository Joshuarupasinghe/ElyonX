"""
ElyonX IMS – User Service
Database operations for user documents (MongoDB via Motor).
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from bson.errors import InvalidId
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorCollection

from app.core.config import settings
from app.models.user import UserInDB

logger = logging.getLogger("elyonx.services.user")

# ── MongoDB connection ─────────────────────────────────────────────────
_client: Optional[AsyncIOMotorClient] = None


def _get_collection() -> AsyncIOMotorCollection:
    """Lazy-init the MongoDB client and return the users collection."""
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(settings.MONGODB_URI)
    db = _client[settings.MONGODB_DB_NAME]
    return db["users"]


def normalize_email(email: str) -> str:
    """Normalize email addresses for lookup and uniqueness."""
    return email.strip().lower()


async def find_user_by_id(user_id: str) -> Optional[dict]:
    """Look up a user by their MongoDB object id."""
    try:
        object_id = ObjectId(user_id)
    except (InvalidId, TypeError):
        return None

    coll = _get_collection()
    return await coll.find_one({"_id": object_id})


async def find_user_by_google_id(google_id: str) -> Optional[dict]:
    """Look up a user by their Google sub ID."""
    coll = _get_collection()
    return await coll.find_one({"google_id": google_id})


async def find_user_by_email(email: str) -> Optional[dict]:
    """Look up a user by email address."""
    coll = _get_collection()
    return await coll.find_one({"email": normalize_email(email)})


async def record_successful_login(user_id: str) -> None:
    """Update the user's last-login timestamp."""
    try:
        object_id = ObjectId(user_id)
    except (InvalidId, TypeError):
        return

    coll = _get_collection()
    await coll.update_one(
        {"_id": object_id},
        {"$set": {"last_login": datetime.now(timezone.utc)}},
    )


async def create_local_user(
    email: str,
    name: str,
    password_hash: str,
) -> dict:
    """Create a user that authenticates with an email/password pair."""
    coll = _get_collection()
    now = datetime.now(timezone.utc)

    user = UserInDB(
        email=normalize_email(email),
        name=name,
        auth_provider="local",
        password_hash=password_hash,
        created_at=now,
        updated_at=now,
        last_login=now,
    )
    doc = user.model_dump()
    result = await coll.insert_one(doc)
    doc["_id"] = result.inserted_id
    logger.info("Created local user: %s", email)
    return doc


async def create_or_update_user(
    google_id: str,
    email: str,
    name: str,
    profile_picture: Optional[str] = None,
) -> dict:
    """
    Upsert a user document.
    If the user already exists (by google_id), update their profile
    and last_login timestamp. Otherwise, create a new document.
    """
    coll = _get_collection()
    now = datetime.now(timezone.utc)

    normalized_email = normalize_email(email)
    existing = await find_user_by_google_id(google_id)
    if existing:
        update_fields = {
            "email": normalized_email,
            "name": name,
            "profile_picture": profile_picture,
            "auth_provider": existing.get("auth_provider", "google"),
            "updated_at": now,
            "last_login": now,
        }
        await coll.update_one(
            {"google_id": google_id},
            {"$set": update_fields},
        )
        existing.update(update_fields)
        logger.info("Updated existing user: %s (%s)", email, google_id)
        return existing

    existing_by_email = await find_user_by_email(normalized_email)
    if existing_by_email:
        update_fields = {
            "google_id": google_id,
            "name": name,
            "profile_picture": profile_picture,
            "updated_at": now,
            "last_login": now,
        }
        await coll.update_one(
            {"_id": existing_by_email["_id"]},
            {"$set": update_fields},
        )
        existing_by_email.update(update_fields)
        logger.info("Linked Google login to existing user: %s (%s)", email, google_id)
        return existing_by_email

    # New user
    user = UserInDB(
        google_id=google_id,
        email=normalized_email,
        name=name,
        profile_picture=profile_picture,
        auth_provider="google",
        created_at=now,
        updated_at=now,
        last_login=now,
    )
    doc = user.model_dump()
    result = await coll.insert_one(doc)
    doc["_id"] = result.inserted_id
    logger.info("Created new user: %s (%s)", email, google_id)
    return doc
