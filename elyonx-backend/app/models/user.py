"""
ElyonX IMS – User Model (MongoDB document shape)
Stores user profile data sourced from Google OAuth.
"""

from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field


class UserInDB(BaseModel):
    """Represents a user document stored in MongoDB."""

    google_id: Optional[str] = Field(None, description="Google account unique identifier")
    email: str = Field(..., description="Primary email from Google profile")
    name: str = Field(..., description="Display name from Google profile")
    profile_picture: Optional[str] = Field(
        None, description="URL of the user's Google avatar"
    )
    auth_provider: str = Field(
        "local", description="Primary authentication provider for this account"
    )
    password_hash: Optional[str] = Field(
        None, description="PBKDF2 password hash for local accounts"
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp of first sign-up",
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp of last profile update",
    )
    last_login: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp of most recent authentication",
    )
    is_active: bool = Field(True, description="Whether the account is active")

    class Config:
        json_schema_extra = {
            "example": {
                "google_id": "118234567890123456789",
                "email": "engineer@elyonx.com",
                "name": "Joshua R",
                "profile_picture": "https://lh3.googleusercontent.com/a/...",
                "auth_provider": "google",
                "is_active": True,
            }
        }
