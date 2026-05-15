"""
ElyonX IMS – Google OAuth 2.0 Service
Handles the OAuth handshake, token exchange, and ID-token verification
entirely on the backend (server-side flow).
"""

import hashlib
import hmac
import logging
import secrets
import time
from typing import Any, Dict, Optional
from urllib.parse import urlencode

import httpx
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from app.core.config import settings

logger = logging.getLogger("elyonx.auth.google")

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

GOOGLE_SCOPES = "openid email profile"


def _sign_state(nonce: str) -> str:
    """Create an HMAC-SHA256 signature for the OAuth state nonce."""
    return hmac.new(
        settings.OAUTH_STATE_SECRET.encode(),
        nonce.encode(),
        hashlib.sha256,
    ).hexdigest()


def generate_oauth_state() -> str:
    """
    Build a signed state parameter to prevent CSRF.
    Format:  <nonce>.<timestamp>.<hmac>
    """
    nonce = secrets.token_urlsafe(32)
    ts = str(int(time.time()))
    raw = f"{nonce}.{ts}"
    sig = _sign_state(raw)
    return f"{raw}.{sig}"


def verify_oauth_state(state: str, max_age_seconds: int = 600) -> bool:
    """
    Validate the state parameter returned by Google.
    Checks HMAC integrity and expiry (default 10 min).
    """
    try:
        parts = state.rsplit(".", 1)
        if len(parts) != 2:
            return False
        raw, sig = parts
        if not hmac.compare_digest(sig, _sign_state(raw)):
            return False
        _nonce, ts_str = raw.split(".", 1)
        ts = int(ts_str)
        if (time.time() - ts) > max_age_seconds:
            logger.warning("OAuth state expired (age=%d s)", time.time() - ts)
            return False
        return True
    except Exception:
        logger.exception("OAuth state verification failed")
        return False


def build_google_auth_url(state: str) -> str:
    """Construct the Google consent-screen redirect URL."""
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": GOOGLE_SCOPES,
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


async def exchange_code_for_tokens(code: str) -> Dict[str, Any]:
    """
    Exchange the authorization code for Google tokens.
    Returns the raw JSON payload from Google's token endpoint.
    """
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
        if resp.status_code != 200:
            logger.error(
                "Google token exchange failed: %d %s",
                resp.status_code,
                resp.text,
            )
            raise ValueError(f"Token exchange failed: {resp.text}")
        return resp.json()


def verify_google_id_token(token: str) -> Dict[str, Any]:
    """
    Verify the Google ID token using google-auth library.
    Returns the decoded payload containing sub, email, name, picture.
    """
    try:
        id_info = google_id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )
        # Ensure the token was issued by Google
        if id_info.get("iss") not in (
            "accounts.google.com",
            "https://accounts.google.com",
        ):
            raise ValueError("Invalid token issuer")
        return id_info
    except Exception as exc:
        logger.exception("Google ID token verification failed")
        raise ValueError(f"ID token verification failed: {exc}")


async def get_google_user_info(access_token: str) -> Dict[str, Any]:
    """
    Fallback: fetch user info directly from Google's userinfo endpoint
    in case ID-token parsing misses fields.
    """
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if resp.status_code != 200:
            raise ValueError(f"Failed to fetch user info: {resp.text}")
        return resp.json()
