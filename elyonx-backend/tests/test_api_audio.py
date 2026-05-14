from __future__ import annotations

from typing import Any

import numpy as np
from fastapi.testclient import TestClient

from app.core.config import settings
from tests.conftest import DummyIMSModel


class RunningEngine:
    is_running = True

    def __init__(self, audio_block: np.ndarray | None = None) -> None:
        self.audio_block = audio_block

    def get_latest_audio(self, n_samples: int, min_samples: int | None = None) -> np.ndarray | None:
        return self.audio_block


def test_analyze_requires_active_capture(client: TestClient) -> None:
    response = client.post("/api/v1/audio/analyze", json={"instrument": "kick"})

    assert response.status_code == 400
    assert response.json()["detail"] == "Audio capture is not running."


def test_analyze_requires_loaded_model(client: TestClient, test_app: Any) -> None:
    test_app.state.audio_engine = RunningEngine(np.ones(settings.IMS_WINDOW_SIZE, dtype=np.float32))
    test_app.state.ims_model = DummyIMSModel(loaded=False)

    response = client.post("/api/v1/audio/analyze", json={"instrument": "kick"})

    assert response.status_code == 503
    assert response.json()["detail"] == "IMS model is not loaded."


def test_analyze_returns_four_band_payload_for_x32_mode(
    client: TestClient,
    test_app: Any,
    monkeypatch,
) -> None:
    monkeypatch.setattr(settings, "EQ_BAND_MODE", 4)
    test_app.state.audio_engine = RunningEngine(np.ones(settings.IMS_WINDOW_SIZE, dtype=np.float32))

    response = client.post("/api/v1/audio/analyze", json={"instrument": "kick"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["instrument"] == "kick"
    assert payload["band_mode"] == 4
    assert [band["name"] for band in payload["bands"]] == [
        "Low",
        "Low-mid",
        "High-mid",
        "Highs",
    ]
    assert [band["id"] for band in payload["bands"]] == [1, 2, 3, 4]


def test_reset_eq_clears_model_smoothing(client: TestClient, test_app: Any) -> None:
    response = client.post("/api/v1/audio/reset")

    assert response.status_code == 200
    assert response.json()["status"] == "reset"
    assert test_app.state.ims_model.reset_called is True
