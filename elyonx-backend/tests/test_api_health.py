from fastapi.testclient import TestClient

from app.core.config import settings


def test_health_reports_backend_status(client: TestClient) -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "version": settings.APP_VERSION,
        "stream_active": False,
        "ws_clients": 0,
    }


def test_audio_config_endpoint_returns_runtime_defaults(client: TestClient) -> None:
    response = client.get("/api/v1/audio/config")

    assert response.status_code == 200
    payload = response.json()
    assert payload["sample_rate"] == settings.AUDIO_SAMPLE_RATE
    assert payload["block_size"] == settings.AUDIO_BLOCK_SIZE
    assert payload["channels"] == settings.AUDIO_CHANNELS
    assert payload["fft_size"] == settings.RTA_FFT_SIZE
