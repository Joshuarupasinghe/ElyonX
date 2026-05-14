"""
ElyonX IMS – Authentication Routes
Handles Google OAuth 2.0 login flow, JWT issuance, and user profile retrieval.

Routes:
    GET  /auth/google/login    → Redirect to Google consent screen
    GET  /auth/google/callback → Handle Google redirect, issue JWT
    GET  /auth/me              → Get current authenticated user profile
    POST /auth/logout          → Client-side logout (invalidate instructions)
"""

import logging
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse

from app.core.config import settings
from app.core.security import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.schemas.auth import (
    AuthErrorResponse,
    AuthResponse,
    EmailLoginRequest,
    EmailSignUpRequest,
    TokenResponse,
    UserResponse,
)
from app.services.google_auth import (
    build_google_auth_url,
    exchange_code_for_tokens,
    generate_oauth_state,
    get_google_user_info,
    verify_google_id_token,
    verify_oauth_state,
)
from app.services.user_service import (
    create_local_user,
    create_or_update_user,
    find_user_by_email,
    find_user_by_google_id,
    find_user_by_id,
    record_successful_login,
)

logger = logging.getLogger("elyonx.routes.auth")

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _user_id(user_doc: dict) -> str:
    """Return the stable public user id for JWT subject and API responses."""
    if user_doc.get("_id") is not None:
        return str(user_doc["_id"])
    if user_doc.get("google_id"):
        return str(user_doc["google_id"])
    return str(user_doc["email"])


def _to_user_response(user_doc: dict) -> UserResponse:
    """Convert a Mongo user document into the public auth user shape."""
    return UserResponse(
        user_id=_user_id(user_doc),
        google_id=user_doc.get("google_id"),
        email=user_doc["email"],
        name=user_doc["name"],
        profile_picture=user_doc.get("profile_picture"),
        auth_provider=user_doc.get("auth_provider", "local"),
        is_active=user_doc.get("is_active", True),
    )


def _create_auth_response(user_doc: dict) -> AuthResponse:
    """Create a JWT and response envelope for an authenticated user."""
    user = _to_user_response(user_doc)
    jwt_payload = {
        "sub": user.user_id,
        "email": user.email,
        "name": user.name,
        "picture": user.profile_picture or "",
        "google_id": user.google_id or "",
        "auth_provider": user.auth_provider,
    }
    app_token = create_access_token(data=jwt_payload)
    expires_in = settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
    return AuthResponse(
        access_token=app_token,
        token_type="bearer",
        expires_in=expires_in,
        user=user,
    )


def _invalid_credentials() -> HTTPException:
    """Return a generic login failure to avoid account enumeration."""
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password",
        headers={"WWW-Authenticate": "Bearer"},
    )


# ── GET /auth/google/login ─────────────────────────────────────────────

@router.get(
    "/google/login",
    summary="Start Google OAuth login",
    response_class=RedirectResponse,
)
async def google_login():
    """
    Initiates the Google OAuth 2.0 flow.
    Generates a signed CSRF state token and redirects the user
    to the Google consent screen.
    """
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
        )

    state = generate_oauth_state()
    auth_url = build_google_auth_url(state)
    logger.info("Redirecting to Google OAuth consent screen")
    return RedirectResponse(url=auth_url, status_code=status.HTTP_302_FOUND)


# -- POST /auth/signup ------------------------------------------------------

@router.post(
    "/signup",
    summary="Create an email/password account",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    responses={409: {"model": AuthErrorResponse}},
)
async def signup(payload: EmailSignUpRequest):
    """Create a local account and return an application JWT."""
    existing_user = await find_user_by_email(payload.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    password_hash = hash_password(payload.password)
    user_doc = await create_local_user(
        email=payload.email,
        name=payload.full_name,
        password_hash=password_hash,
    )

    logger.info("Email signup successful for: %s", payload.email)
    return _create_auth_response(user_doc)


# -- POST /auth/login -------------------------------------------------------

@router.post(
    "/login",
    summary="Login with email and password",
    response_model=AuthResponse,
    responses={401: {"model": AuthErrorResponse}, 403: {"model": AuthErrorResponse}},
)
async def login(payload: EmailLoginRequest):
    """Authenticate a local account and return an application JWT."""
    user_doc = await find_user_by_email(payload.email)
    if not user_doc or not verify_password(payload.password, user_doc.get("password_hash")):
        raise _invalid_credentials()

    if not user_doc.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is disabled",
        )

    await record_successful_login(_user_id(user_doc))
    logger.info("Email login successful for: %s", payload.email)
    return _create_auth_response(user_doc)


# ── GET /auth/google/callback ─────────────────────────────────────────

@router.get(
    "/google/callback",
    summary="Google OAuth callback",
    responses={
        200: {"model": TokenResponse},
        400: {"model": AuthErrorResponse},
        401: {"model": AuthErrorResponse},
    },
)
async def google_callback(
    code: str = Query(None, description="Authorization code from Google"),
    state: str = Query(None, description="CSRF state parameter"),
    error: str = Query(None, description="Error from Google"),
):
    """
    Handles the Google OAuth redirect.

    1. Validates the CSRF state parameter
    2. Exchanges the auth code for Google tokens
    3. Verifies the Google ID token
    4. Creates or updates the user in the database
    5. Issues an application JWT
    6. Redirects the frontend with the JWT as a query parameter
    """
    # Handle Google-side errors
    if error:
        logger.warning("Google OAuth error: %s", error)
        redirect_params = urlencode({"error": error})
        return RedirectResponse(
            url=f"{settings.FRONTEND_REDIRECT_URI}?{redirect_params}",
            status_code=status.HTTP_302_FOUND,
        )

    # Validate required parameters
    if not code or not state:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing authorization code or state parameter",
        )

    # Verify CSRF state
    if not verify_oauth_state(state):
        logger.warning("Invalid or expired OAuth state parameter")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired state parameter (possible CSRF attack)",
        )

    try:
        # Step 1: Exchange auth code for tokens
        token_data = await exchange_code_for_tokens(code)
        id_token_raw = token_data.get("id_token")
        access_token_google = token_data.get("access_token")

        if not id_token_raw:
            raise ValueError("No ID token returned from Google")

        # Step 2: Verify the Google ID token
        try:
            google_user = verify_google_id_token(id_token_raw)
        except ValueError:
            # Fallback: use the access token to fetch user info
            if not access_token_google:
                raise
            logger.warning("ID token verification failed, falling back to userinfo endpoint")
            google_user = await get_google_user_info(access_token_google)

        # Step 3: Extract user information
        google_id = google_user.get("sub")
        email = google_user.get("email")
        name = google_user.get("name", email.split("@")[0] if email else "User")
        profile_picture = google_user.get("picture")

        if not google_id or not email:
            raise ValueError("Missing required user fields from Google")

        logger.info("Google auth successful for: %s (%s)", email, google_id)

        # Step 4: Create or update user in database
        user_doc = await create_or_update_user(
            google_id=google_id,
            email=email,
            name=name,
            profile_picture=profile_picture,
        )

        # Step 5: Generate application JWT
        auth_response = _create_auth_response(user_doc)

        # Step 6: Redirect to frontend with token
        redirect_params = urlencode({
            "token": auth_response.access_token,
            "expires_in": str(auth_response.expires_in),
        })
        redirect_url = f"{settings.FRONTEND_REDIRECT_URI}?{redirect_params}"
        logger.info("Issuing JWT and redirecting to frontend for user: %s", email)
        return RedirectResponse(
            url=redirect_url,
            status_code=status.HTTP_302_FOUND,
        )

    except ValueError as exc:
        logger.exception("Google OAuth callback failed")
        redirect_params = urlencode({"error": str(exc)})
        return RedirectResponse(
            url=f"{settings.FRONTEND_REDIRECT_URI}?{redirect_params}",
            status_code=status.HTTP_302_FOUND,
        )
    except Exception as exc:
        logger.exception("Unexpected error during Google OAuth callback")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication failed. Please try again.",
        )


# ── GET /auth/me ───────────────────────────────────────────────────────

@router.get(
    "/me",
    summary="Get current user profile",
    response_model=UserResponse,
    responses={401: {"model": AuthErrorResponse}},
)
async def get_me(current_user: dict = Depends(get_current_user)):
    """
    Returns the authenticated user's profile.
    Requires a valid JWT in the Authorization header.
    """
    subject = current_user.get("sub")
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: missing subject",
        )

    # Fetch full user from database
    user_doc = await find_user_by_id(subject)
    if not user_doc:
        user_doc = await find_user_by_google_id(subject)

    if not user_doc:
        # User exists in token but not in DB (edge case: DB was wiped)
        auth_provider = current_user.get("auth_provider", "google")
        google_id = current_user.get("google_id") or (
            subject if auth_provider == "google" else None
        )
        return UserResponse(
            user_id=subject,
            google_id=google_id,
            email=current_user.get("email", ""),
            name=current_user.get("name", ""),
            profile_picture=current_user.get("picture"),
            auth_provider=auth_provider,
            is_active=True,
        )

    return _to_user_response(user_doc)


# ── POST /auth/logout ─────────────────────────────────────────────────

@router.post(
    "/logout",
    summary="Logout (client-side)",
    status_code=status.HTTP_200_OK,
)
async def logout(current_user: dict = Depends(get_current_user)):
    """
    Logout endpoint.

    Since JWTs are stateless, the actual token invalidation happens
    client-side (the frontend deletes the stored token).
    This endpoint confirms the logout action and can be extended
    to maintain a server-side token blocklist if needed.
    """
    logger.info("User logged out: %s", current_user.get("email", "unknown"))
    return {
        "status": "success",
        "message": "Logged out successfully. Please discard your token.",
    }
