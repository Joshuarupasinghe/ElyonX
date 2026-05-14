from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient


class FakeStatus:
    def __init__(self, **overrides: Any) -> None:
        self.payload = {
            "connected": True,
            "state": "connected",
            "host": "192.168.1.60",
            "port": 10023,
            "mixer_name": "FOH-X32",
            "firmware": "V4.09",
            "model": "X32",
            "last_seen_at": 1000.0,
            "latency_ms": 2.5,
            "error": None,
            "registered_channels": [],
        }
        self.payload.update(overrides)

    def to_dict(self) -> dict[str, Any]:
        return self.payload


class FakeMixerService:
    def __init__(self) -> None:
        self.calls: list[tuple[str, tuple[Any, ...], dict[str, Any]]] = []
        self.current_status = FakeStatus()

    def status(self) -> FakeStatus:
        return self.current_status

    async def connect(self, host: str, port: int) -> FakeStatus:
        self.calls.append(("connect", (host, port), {}))
        self.current_status = FakeStatus(host=host, port=port)
        return self.current_status

    async def disconnect(self) -> FakeStatus:
        self.calls.append(("disconnect", (), {}))
        self.current_status = FakeStatus(connected=False, state="disconnected")
        return self.current_status

    async def register_channel(self, channel: int, **kwargs: Any) -> FakeStatus:
        self.calls.append(("register_channel", (channel,), kwargs))
        self.current_status = FakeStatus(
            registered_channels=[
                {
                    "channel": channel,
                    "name": kwargs.get("name"),
                    "instrument": kwargs.get("instrument"),
                    "input_source": kwargs.get("input_source"),
                    "registered_at": 1001.0,
                }
            ]
        )
        return self.current_status

    async def set_channel_fader(self, channel: int, db: float) -> None:
        self.calls.append(("set_channel_fader", (channel, db), {}))

    async def set_master_fader(self, db: float) -> None:
        self.calls.append(("set_master_fader", (db,), {}))

    async def set_channel_gain(self, channel: int, db: float, *, target: str) -> None:
        self.calls.append(("set_channel_gain", (channel, db), {"target": target}))

    async def set_channel_mute(self, channel: int, *, muted: bool) -> None:
        self.calls.append(("set_channel_mute", (channel,), {"muted": muted}))

    async def set_channel_solo(self, channel: int, *, solo: bool) -> None:
        self.calls.append(("set_channel_solo", (channel,), {"solo": solo}))

    async def set_channel_eq_band(self, channel: int, band: int, **kwargs: Any) -> None:
        self.calls.append(("set_channel_eq_band", (channel, band), kwargs))


def test_mixer_connect_uses_settings_endpoint_values(client: TestClient, test_app: Any) -> None:
    fake = FakeMixerService()
    test_app.state.mixer_service = fake

    response = client.post(
        "/api/v1/mixer/connect",
        json={"host": "192.168.1.77", "port": 10023},
    )

    assert response.status_code == 200
    assert response.json()["connected"] is True
    assert fake.calls == [("connect", ("192.168.1.77", 10023), {})]


def test_mixer_register_channel_preserves_selected_input_number(
    client: TestClient,
    test_app: Any,
) -> None:
    fake = FakeMixerService()
    test_app.state.mixer_service = fake

    response = client.post(
        "/api/v1/mixer/channels",
        json={
            "channel": 7,
            "name": "Snare",
            "instrument": "snare",
            "input_source": 7,
        },
    )

    assert response.status_code == 200
    assert response.json()["registered_channels"][0]["channel"] == 7
    assert fake.calls[0] == (
        "register_channel",
        (7,),
        {"name": "Snare", "instrument": "snare", "input_source": 7},
    )


def test_mixer_control_endpoints_forward_to_service(client: TestClient, test_app: Any) -> None:
    fake = FakeMixerService()
    test_app.state.mixer_service = fake

    assert client.post("/api/v1/mixer/channels/3/fader", json={"db": -5}).status_code == 200
    assert client.post("/api/v1/mixer/master/fader", json={"db": 0}).status_code == 200
    assert (
        client.post(
            "/api/v1/mixer/channels/3/gain",
            json={"db": 4.5, "target": "trim"},
        ).status_code
        == 200
    )
    assert (
        client.post(
            "/api/v1/mixer/channels/3/eq",
            json={
                "band": 2,
                "type": "bell",
                "frequency": 1200,
                "gain": -3,
                "q": 1.1,
                "enabled": True,
            },
        ).status_code
        == 200
    )

    assert fake.calls == [
        ("set_channel_fader", (3, -5.0), {}),
        ("set_master_fader", (0.0,), {}),
        ("set_channel_gain", (3, 4.5), {"target": "trim"}),
        (
            "set_channel_eq_band",
            (3, 2),
            {
                "eq_type": "bell",
                "frequency": 1200.0,
                "gain": -3.0,
                "q": 1.1,
                "enabled": True,
            },
        ),
    ]
