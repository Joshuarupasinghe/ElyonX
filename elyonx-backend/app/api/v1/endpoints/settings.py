"""
ElyonX IMS - runtime settings endpoints.
Expose mixer, audio-device, and EQ topology settings that were previously
only configurable from backend config values.
"""

from ipaddress import ip_address
from typing import List, Literal, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

from app.core.config import settings
from app.services.audio_engine import AudioEngine

router = APIRouter()


class AudioDeviceOption(BaseModel):
    index: int
    name: str
    max_input_channels: int
    default_samplerate: Optional[float] = None
    hostapi: str = ""


class MixerSettingsResponse(BaseModel):
    osc_target_ip: str
    osc_target_port: int


class AudioSettingsResponse(BaseModel):
    selected_device_index: Optional[int]
    selected_device_name: str
    fallback_device_name: str
    rta_input_channel: int
    max_input_channels: int
    stream_active: bool


class EqualizerSettingsResponse(BaseModel):
    band_mode: Literal[4, 6]
    labels: List[str]


class RuntimeSettingsResponse(BaseModel):
    mixer: MixerSettingsResponse
    audio: AudioSettingsResponse
    equalizer: EqualizerSettingsResponse
    available_audio_devices: List[AudioDeviceOption]
    requires_capture_restart: bool = False


class UpdateRuntimeSettingsRequest(BaseModel):
    osc_target_ip: Optional[str] = None
    osc_target_port: Optional[int] = Field(None, ge=1, le=65535)
    audio_device_index: Optional[int] = Field(None, ge=0)
    audio_device_name: Optional[str] = None
    rta_input_channel: Optional[int] = Field(None, ge=0)
    eq_band_mode: Optional[Literal[4, 6]] = None

    @field_validator("osc_target_ip")
    @classmethod
    def validate_osc_target_ip(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        normalized = value.strip()
        try:
            ip_address(normalized)
        except ValueError as exc:
            raise ValueError("OSC target must be a valid IP address.") from exc
        return normalized

    @field_validator("audio_device_name")
    @classmethod
    def validate_audio_device_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        normalized = value.strip()
        if not normalized:
            raise ValueError("Audio device name cannot be empty.")
        return normalized


def _list_devices() -> List[dict]:
    return AudioEngine.list_devices()


def _find_device_by_index(devices: List[dict], index: Optional[int]) -> Optional[dict]:
    if index is None:
        return None
    for device in devices:
        if int(device.get("index", -1)) == index:
            return device
    return None


def _find_device_by_name(devices: List[dict], name: str) -> Optional[dict]:
    needle = name.lower()
    for device in devices:
        device_name = str(device.get("name", ""))
        if needle in device_name.lower():
            return device
    return None


def _device_options(devices: List[dict]) -> List[AudioDeviceOption]:
    return [
        AudioDeviceOption(
            index=int(device.get("index", 0)),
            name=str(device.get("name", "")),
            max_input_channels=int(device.get("max_input_channels", 0) or 0),
            default_samplerate=device.get("default_samplerate"),
            hostapi=str(device.get("hostapi", "")),
        )
        for device in devices
    ]


def _eq_labels() -> List[str]:
    if settings.EQ_BAND_MODE == 4:
        return ["Low", "Low-mid", "High-mid", "Highs"]
    return ["Sub", "Low", "Low-mid", "Mid", "Presence", "Air"]


def _build_response(request: Request, requires_capture_restart: bool = False) -> RuntimeSettingsResponse:
    devices = _list_devices()
    selected_device = _find_device_by_index(devices, settings.AUDIO_DEVICE_INDEX)
    fallback_device = _find_device_by_name(devices, settings.AUDIO_DEVICE_NAME)
    display_device = selected_device or fallback_device

    max_input_channels = int(
        (display_device or {}).get(
            "max_input_channels",
            max(settings.AUDIO_CHANNELS, settings.AUDIO_INPUT_CHANNEL + 1),
        )
        or max(settings.AUDIO_CHANNELS, settings.AUDIO_INPUT_CHANNEL + 1)
    )
    selected_device_name = str(
        (display_device or {}).get("name", settings.AUDIO_DEVICE_NAME)
    )

    engine = request.app.state.audio_engine
    return RuntimeSettingsResponse(
        mixer=MixerSettingsResponse(
            osc_target_ip=settings.OSC_TARGET_IP,
            osc_target_port=settings.OSC_TARGET_PORT,
        ),
        audio=AudioSettingsResponse(
            selected_device_index=settings.AUDIO_DEVICE_INDEX,
            selected_device_name=selected_device_name,
            fallback_device_name=settings.AUDIO_DEVICE_NAME,
            rta_input_channel=settings.AUDIO_INPUT_CHANNEL,
            max_input_channels=max_input_channels,
            stream_active=engine.is_running,
        ),
        equalizer=EqualizerSettingsResponse(
            band_mode=4 if settings.EQ_BAND_MODE == 4 else 6,
            labels=_eq_labels(),
        ),
        available_audio_devices=_device_options(devices),
        requires_capture_restart=requires_capture_restart,
    )


@router.get("/", response_model=RuntimeSettingsResponse, summary="Get runtime settings")
async def get_runtime_settings(request: Request) -> RuntimeSettingsResponse:
    return _build_response(request)


@router.patch("/", response_model=RuntimeSettingsResponse, summary="Update runtime settings")
async def update_runtime_settings(
    body: UpdateRuntimeSettingsRequest,
    request: Request,
) -> RuntimeSettingsResponse:
    devices = _list_devices()
    engine = request.app.state.audio_engine
    audio_setting_changed = False
    osc_setting_changed = False

    if body.osc_target_ip is not None:
        settings.OSC_TARGET_IP = body.osc_target_ip
        osc_setting_changed = True

    if body.osc_target_port is not None:
        settings.OSC_TARGET_PORT = body.osc_target_port
        osc_setting_changed = True

    if "audio_device_index" in body.model_fields_set:
        if body.audio_device_index is not None and devices:
            selected = _find_device_by_index(devices, body.audio_device_index)
            if selected is None:
                raise HTTPException(
                    status_code=400,
                    detail=f"Audio device index {body.audio_device_index} is not available.",
                )
        settings.AUDIO_DEVICE_INDEX = body.audio_device_index
        audio_setting_changed = True

    if body.audio_device_name is not None:
        settings.AUDIO_DEVICE_NAME = body.audio_device_name
        if "audio_device_index" not in body.model_fields_set:
            settings.AUDIO_DEVICE_INDEX = None
        audio_setting_changed = True

    if body.rta_input_channel is not None:
        selected_device = _find_device_by_index(devices, settings.AUDIO_DEVICE_INDEX)
        fallback_device = _find_device_by_name(devices, settings.AUDIO_DEVICE_NAME)
        active_device = selected_device or fallback_device
        max_channels = int((active_device or {}).get("max_input_channels", 0) or 0)
        if max_channels > 0 and body.rta_input_channel >= max_channels:
            raise HTTPException(
                status_code=400,
                detail=f"RTA input channel must be between 0 and {max_channels - 1}.",
            )
        settings.AUDIO_INPUT_CHANNEL = body.rta_input_channel
        audio_setting_changed = True

    if body.eq_band_mode is not None:
        settings.EQ_BAND_MODE = body.eq_band_mode

    if osc_setting_changed:
        mixer_service = getattr(request.app.state, "mixer_service", None)
        if mixer_service is not None:
            await mixer_service.disconnect()
            mixer_service.configure(settings.OSC_TARGET_IP, settings.OSC_TARGET_PORT)

    return _build_response(
        request,
        requires_capture_restart=bool(audio_setting_changed and engine.is_running),
    )
