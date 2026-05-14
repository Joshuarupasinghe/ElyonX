from __future__ import annotations

from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

from app.core.config import settings
from app.routes import auth as auth_routes


def test_signup_uses_isolated_test_database(client: TestClient, monkeypatch) -> None:
    created_user = {
        "_id": "local-user-1",
        "email": "foh@elyonx.com",
        "name": "FOH Engineer",
        "auth_provider": "local",
        "password_hash": "hashed",
        "is_active": True,
    }
    monkeypatch.setattr(auth_routes, "find_user_by_email", AsyncMock(return_value=None))
    monkeypatch.setattr(auth_routes, "create_local_user", AsyncMock(return_value=created_user))
    monkeypatch.setattr(auth_routes, "hash_password", lambda password: f"hashed:{password}")

    response = client.post(
        "/auth/signup",
        json={
            "full_name": "  FOH Engineer  ",
            "email": "  FOH@ELYONX.COM  ",
            "password": "super-secret",
        },
    )

    assert settings.MONGODB_DB_NAME == "elyonx_ims_test"
    assert response.status_code == 201
    payload = response.json()
    assert payload["token_type"] == "bearer"
    assert payload["user"]["email"] == "foh@elyonx.com"
    assert payload["user"]["name"] == "FOH Engineer"


def test_login_rejects_unknown_user_without_leaking_account_state(
    client: TestClient,
    monkeypatch,
) -> None:
    monkeypatch.setattr(auth_routes, "find_user_by_email", AsyncMock(return_value=None))

    response = client.post(
        "/auth/login",
        json={"email": "missing@example.com", "password": "wrong"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"
