"""
ElyonX IMS – Auth Schemas (request / response DTOs)
"""

from typing import Optional

from pydantic import BaseModel, Field, field_validator


class TokenResponse(BaseModel):
    """Returned to the frontend after successful authentication."""
    access_token: str = Field(..., description="Application JWT")
    token_type: str = Field(default="bearer")
    expires_in: int = Field(..., description="Token lifetime in seconds")


class UserResponse(BaseModel):
    """Public user profile returned by /auth/me."""
    user_id: str
    google_id: Optional[str] = None
    email: str
    name: str
    profile_picture: Optional[str] = None
    auth_provider: str = "local"
    is_active: bool = True


class AuthResponse(TokenResponse):
    """Token plus the authenticated user profile."""
    user: UserResponse


class EmailLoginRequest(BaseModel):
    """Email/password login payload."""
    email: str = Field(..., min_length=3, max_length=254)
    password: str = Field(..., min_length=1, max_length=256)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class EmailSignUpRequest(BaseModel):
    """Email/password signup payload."""
    full_name: str = Field(..., min_length=1, max_length=120)
    email: str = Field(..., min_length=3, max_length=254)
    password: str = Field(..., min_length=8, max_length=256)

    @field_validator("full_name")
    @classmethod
    def normalize_full_name(cls, value: str) -> str:
        normalized = " ".join(value.strip().split())
        if not normalized:
            raise ValueError("Full name is required")
        return normalized

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if "@" not in normalized or "." not in normalized.rsplit("@", 1)[-1]:
            raise ValueError("Enter a valid email address")
        return normalized


class AuthErrorResponse(BaseModel):
    """Standard error envelope."""
    detail: str
