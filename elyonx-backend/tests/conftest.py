from __future__ import annotations

from collections.abc import Generator
from typing import Any

import numpy as np
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import create_app
from app.services.audio_engine import AudioEngine


class DummyPrediction:
    def __init__(self, instrument: str = "kick") -> None:
        self.instrument = instrument

    def to_dict(self) -> dict[str, Any]:
        return {
            "instrument": self.instrument,
            "inference_ms": 1.25,
            "quality": {
                "status": "ok",
                "warnings": [],
                "usable": True,
                "rms_dbfs": -18.0,
                "peak_dbfs": -6.0,
                "smoothed": False,
            },
            "bands": [
                {
                    "id": 1,
                    "name": "Sub",
                    "type": "lowshelf",
                    "frequency": 65.0,
                    "gain": 2.0,
                    "q": 0.9,
                    "enabled": True,
                },
                {
                    "id": 2,
                    "name": "Low",
                    "type": "bell",
                    "frequency": 140.0,
                    "gain": -2.5,
                    "q": 1.2,
                    "enabled": True,
                },
                {
                    "id": 3,
                    "name": "Low-mid",
                    "type": "bell",
                    "frequency": 320.0,
                    "gain": -3.0,
                    "q": 1.4,
                    "enabled": True,
                },
                {
                    "id": 4,
                    "name": "Mid",
                    "type": "bell",
                    "frequency": 900.0,
                    "gain": 0.0,
                    "q": 1.0,
                    "enabled": False,
                },
                {
                    "id": 5,
                    "name": "Presence",
                    "type": "bell",
                    "frequency": 3200.0,
                    "gain": 3.0,
                    "q": 1.5,
                    "enabled": True,
                },
                {
                    "id": 6,
                    "name": "Air",
                    "type": "highshelf",
                    "frequency": 9000.0,
                    "gain": 1.0,
                    "q": 0.8,
                    "enabled": True,
                },
            ],
        }


class DummyIMSModel:
    def __init__(self, loaded: bool = True, prediction: DummyPrediction | None = None) -> None:
        self.is_loaded = loaded
        self.prediction = prediction or DummyPrediction()
        self.reset_called = False

    def predict_eq(self, audio_block: np.ndarray, instrument: str) -> DummyPrediction:
        self.prediction.instrument = instrument
        return self.prediction

    def reset_smoothing(self) -> None:
        self.reset_called = True


@pytest.fixture(autouse=True)
def separate_test_database(monkeypatch: pytest.MonkeyPatch) -> Generator[None]:
    from app.services import user_service

    monkeypatch.setattr(settings, "MONGODB_DB_NAME", "elyonx_ims_test")
    if user_service._client is not None:
        user_service._client.close()
    monkeypatch.setattr(user_service, "_client", None)

    yield

    if user_service._client is not None:
        user_service._client.close()
    user_service._client = None


@pytest.fixture()
def test_app() -> FastAPI:
    app = create_app()
    app.state.audio_engine = AudioEngine()
    app.state.ims_model = DummyIMSModel()
    return app


@pytest.fixture()
def client(test_app: FastAPI) -> TestClient:
    return TestClient(test_app)
