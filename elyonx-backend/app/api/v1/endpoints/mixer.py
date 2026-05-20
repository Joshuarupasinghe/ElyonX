from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Body, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

from app.core.config import settings
from app.services.x32_osc import (
    GainTarget,
    MixerCommandError,
    MixerConnectionError,
    X32OscService,
)

router = APIRouter()


class RegisteredMixerChannelResponse(BaseModel):
    channel: int
    name: str | None = None
    instrument: str | None = None
    input_source: int | None = None
    registered_at: float


class MixerStatusResponse(BaseModel):
    connected: bool
    state: Literal["disconnected", "connecting", "connected", "error"]
    host: str
    port: int
    mixer_name: str | None = None
    firmware: str | None = None
    model: str | None = None
    last_seen_at: float | None = None
    latency_ms: float | None = None
    error: str | None = None
    responsive: bool = False
    last_seen_age_seconds: float | None = None
    last_error_at: float | None = None
    last_sent_at: float | None = None
    last_sent_address: str | None = None
    last_datagram_from: str | None = None
    packets_sent: int = 0
    packets_received: int = 0
    transport_open: bool = False
    registered_channels: list[RegisteredMixerChannelResponse] = Field(default_factory=list)


class ConnectMixerRequest(BaseModel):
    host: str | None = None
    port: int | None = Field(None, ge=1, le=65535)


class RegisterChannelRequest(BaseModel):
    channel: int = Field(..., ge=1, le=32)
    name: str | None = Field(None, max_length=32)
    instrument: str | None = Field(None, max_length=32)
    input_source: int | None = Field(None, ge=1, le=32)

    @field_validator("name", "instrument")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class FaderRequest(BaseModel):
    db: float = Field(..., ge=-90.0, le=10.0)


class GainRequest(BaseModel):
    db: float = Field(..., ge=-18.0, le=60.0)
    target: GainTarget = "trim"


class ToggleRequest(BaseModel):
    enabled: bool


class EQBandRequest(BaseModel):
    band: int = Field(..., ge=1, le=4)
    type: Literal["bell", "lowshelf", "highshelf", "highpass", "lowpass"] | None = None
    frequency: float | None = Field(None, ge=20.0, le=20000.0)
    gain: float | None = Field(None, ge=-18.0, le=18.0)
    q: float | None = Field(None, ge=0.1, le=30.0)
    enabled: bool | None = None


def _get_mixer_service(request: Request) -> X32OscService:
    service = getattr(request.app.state, "mixer_service", None)
    if service is None:
        service = X32OscService()
        request.app.state.mixer_service = service
    return service


def _status_response(service: X32OscService) -> MixerStatusResponse:
    return MixerStatusResponse.model_validate(service.status().to_dict())


def _raise_http(exc: Exception) -> None:
    if isinstance(exc, MixerConnectionError):
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if isinstance(exc, MixerCommandError):
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/status", response_model=MixerStatusResponse, summary="Get mixer connection status")
async def get_mixer_status(request: Request) -> MixerStatusResponse:
    service = _get_mixer_service(request)
    return _status_response(service)


@router.post("/connect", response_model=MixerStatusResponse, summary="Connect to configured X32 mixer")
async def connect_mixer(
    request: Request,
    body: ConnectMixerRequest | None = Body(default=None),
) -> MixerStatusResponse:
    service = _get_mixer_service(request)
    host = body.host if body and body.host else settings.OSC_TARGET_IP
    port = body.port if body and body.port else settings.OSC_TARGET_PORT
    settings.OSC_TARGET_IP = host
    settings.OSC_TARGET_PORT = port

    try:
        status = await service.connect(host, port)
    except Exception as exc:  # noqa: BLE001 - mapped into HTTP errors below
        _raise_http(exc)
    return MixerStatusResponse.model_validate(status.to_dict())


@router.post("/disconnect", response_model=MixerStatusResponse, summary="Disconnect mixer OSC transport")
async def disconnect_mixer(request: Request) -> MixerStatusResponse:
    service = _get_mixer_service(request)
    status = await service.disconnect()
    return MixerStatusResponse.model_validate(status.to_dict())


@router.post("/channels", response_model=MixerStatusResponse, summary="Register a frontend channel with X32")
async def register_channel(body: RegisterChannelRequest, request: Request) -> MixerStatusResponse:
    service = _get_mixer_service(request)
    try:
        status = await service.register_channel(
            body.channel,
            name=body.name,
            instrument=body.instrument,
            input_source=body.input_source,
        )
    except Exception as exc:  # noqa: BLE001
        _raise_http(exc)
    return MixerStatusResponse.model_validate(status.to_dict())


@router.post("/channels/{channel}/fader", summary="Set an input channel fader")
async def set_channel_fader(channel: int, body: FaderRequest, request: Request) -> dict[str, str]:
    service = _get_mixer_service(request)
    try:
        await service.set_channel_fader(channel, body.db)
    except Exception as exc:  # noqa: BLE001
        _raise_http(exc)
    return {"status": "sent"}


@router.post("/master/fader", summary="Set the main stereo master fader")
async def set_master_fader(body: FaderRequest, request: Request) -> dict[str, str]:
    service = _get_mixer_service(request)
    try:
        await service.set_master_fader(body.db)
    except Exception as exc:  # noqa: BLE001
        _raise_http(exc)
    return {"status": "sent"}


@router.post("/channels/{channel}/gain", summary="Set channel trim or physical headamp gain")
async def set_channel_gain(channel: int, body: GainRequest, request: Request) -> dict[str, str]:
    service = _get_mixer_service(request)
    try:
        await service.set_channel_gain(channel, body.db, target=body.target)
    except Exception as exc:  # noqa: BLE001
        _raise_http(exc)
    return {"status": "sent"}


@router.post("/channels/{channel}/mute", summary="Set channel mute state")
async def set_channel_mute(channel: int, body: ToggleRequest, request: Request) -> dict[str, str]:
    service = _get_mixer_service(request)
    try:
        await service.set_channel_mute(channel, muted=body.enabled)
    except Exception as exc:  # noqa: BLE001
        _raise_http(exc)
    return {"status": "sent"}


@router.post("/channels/{channel}/solo", summary="Set channel solo state")
async def set_channel_solo(channel: int, body: ToggleRequest, request: Request) -> dict[str, str]:
    service = _get_mixer_service(request)
    try:
        await service.set_channel_solo(channel, solo=body.enabled)
    except Exception as exc:  # noqa: BLE001
        _raise_http(exc)
    return {"status": "sent"}


@router.post("/channels/{channel}/eq", summary="Set one X32 channel EQ band")
async def set_channel_eq(channel: int, body: EQBandRequest, request: Request) -> dict[str, str]:
    service = _get_mixer_service(request)
    try:
        await service.set_channel_eq_band(
            channel,
            body.band,
            eq_type=body.type,
            frequency=body.frequency,
            gain=body.gain,
            q=body.q,
            enabled=body.enabled,
        )
    except Exception as exc:  # noqa: BLE001
        _raise_http(exc)
    return {"status": "sent"}
