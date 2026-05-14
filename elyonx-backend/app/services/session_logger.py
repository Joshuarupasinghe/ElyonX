"""
ElyonX IMS – MongoDB Session Logger
Persists RTA telemetry frames and session metadata for post-show review.
Uses motor (async MongoDB driver) to avoid blocking the event loop.
"""

import logging
import time
from typing import Optional, Any, cast

from app.core.config import settings

logger = logging.getLogger("elyonx.session_logger")

# Ensure the name exists for type-checkers even if `motor` isn't installed.
AsyncIOMotorClient: Any = None
try:
    from motor.motor_asyncio import AsyncIOMotorClient as _AsyncIOMotorClient  # type: ignore
    AsyncIOMotorClient = _AsyncIOMotorClient
    MOTOR_AVAILABLE = True
except ImportError:
    MOTOR_AVAILABLE = False
    logger.warning("motor not installed — session logging disabled. pip install motor")


class SessionLogger:
    """
    Logs RTA frames and session lifecycle events to MongoDB.
    Designed to be non-blocking: all writes are fire-and-forget via asyncio.
    """

    def __init__(self) -> None:
        self._client: Optional[Any] = None
        self._db: Optional[Any] = None
        self._session_id: Optional[str] = None
        self._frame_count: int = 0

    @property
    def session_id(self) -> Optional[str]:
        return self._session_id

    async def connect(self) -> None:
        if not MOTOR_AVAILABLE:
            return
        self._client = AsyncIOMotorClient(settings.MONGODB_URI, serverSelectionTimeoutMS=3000)
        self._db = cast(Any, self._client)[settings.MONGODB_DB_NAME]
        logger.info("Connected to MongoDB: %s / %s", settings.MONGODB_URI, settings.MONGODB_DB_NAME)

    async def start_session(self, device_info: dict) -> str:
        """Create a new session document and return its ID."""
        import uuid
        self._session_id = str(uuid.uuid4())
        self._frame_count = 0

        if self._db is not None:
            await self._db.sessions.insert_one({
                "_id": self._session_id,
                "started_at": time.time(),
                "device": device_info,
                "frame_count": 0,
            })
        logger.info("Session started: %s", self._session_id)
        return self._session_id

    async def log_frame(self, frame: dict) -> None:
        """Persist one RTA telemetry frame. Non-blocking — errors are swallowed."""
        if self._db is None or self._session_id is None:
            return
        try:
            self._frame_count += 1
            await self._db.rta_frames.insert_one({
                "session_id": self._session_id,
                "seq": self._frame_count,
                **frame,
            })
        except Exception as exc:
            logger.debug("Frame log error (suppressed): %s", exc)

    async def end_session(self) -> None:
        if self._db is None or self._session_id is None:
            return
        await self._db.sessions.update_one(
            {"_id": self._session_id},
            {"$set": {"ended_at": time.time(), "frame_count": self._frame_count}},
        )
        logger.info("Session ended: %s  frames=%d", self._session_id, self._frame_count)

    async def disconnect(self) -> None:
        if self._client is not None:
            self._client.close()


# Singleton
session_logger = SessionLogger()