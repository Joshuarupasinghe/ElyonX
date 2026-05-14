"""
ElyonX IMS – Device REST Endpoints
Provides device listing, capture start/stop, and status.
"""

import asyncio
import logging
from typing import List

from fastapi import APIRouter, HTTPException, Request

from app.schemas.audio import (
    AudioDeviceInfo,
    DeviceStatusResponse,
    StartCaptureRequest,
    StartCaptureResponse,
    StopCaptureResponse,
)

from app.services.device_service import DeviceService
from app.services.session_logger import session_logger

logger = logging.getLogger("elyonx.api.devices")
router = APIRouter()


def _get_service(request: Request) -> DeviceService:
    return DeviceService(request.app.state.audio_engine)


# GET /devices

@router.get(
    "/",
    summary="List all available audio input devices",
    description=(
        "Returns every audio input device detected by sounddevice. "
        "Use the returned `index` to start capture on a specific device."
    ),
)
async def list_devices(request: Request) -> List[dict]:
    svc = _get_service(request)
    devices = svc.list_input_devices()
    if not devices:
        raise HTTPException(
            status_code=503,
            detail="No audio input devices found. Is the Focusrite connected?",
        )
    return devices


# GET /devices/focusrite 

@router.get(
    "/focusrite",
    summary="Auto-detect the Focusrite Scarlett 2i2",
)
async def get_focusrite(request: Request) -> dict:
    svc = _get_service(request)
    device = svc.find_focusrite()
    if device is None:
        raise HTTPException(
            status_code=404,
            detail="Focusrite Scarlett not found. Check USB connection and driver.",
        )
    return device


# GET /devices/status

@router.get(
    "/status",
    response_model=DeviceStatusResponse,
    summary="Current capture stream status",
)
async def get_status(request: Request) -> DeviceStatusResponse:
    svc = _get_service(request)
    status = svc.get_status()
    return DeviceStatusResponse(**status)


# POST /devices/start

@router.post(
    "/start",
    response_model=StartCaptureResponse,
    summary="Start audio capture from Focusrite / RTA mic",
    description=(
        "Opens a low-latency sounddevice InputStream on the specified device. "
        "If device_index is omitted, auto-detects the Focusrite Scarlett. "
        "Also starts the async RTA processing loop and WebSocket broadcast."
    ),
)
async def start_capture(body: StartCaptureRequest, request: Request) -> StartCaptureResponse:
    engine = request.app.state.audio_engine

    if engine.is_running:
        return StartCaptureResponse(
            status="already_running",
            device=engine.device_info or {},
            session_id=session_logger.session_id,
        )

    try:
        device_info = engine.start(device_index=body.device_index)
        session_id = await session_logger.start_session(device_info)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        logger.exception("Failed to start audio capture")
        raise HTTPException(status_code=500, detail=f"Capture failed: {exc}")

    # Launch the async processing loop as a background task
    asyncio.create_task(engine.process_loop(), name="rta_process_loop")
    logger.info("RTA process loop launched.")

    return StartCaptureResponse(status="started", device=device_info)


# POST /devices/stop

@router.post(
    "/stop",
    response_model=StopCaptureResponse,
    summary="Stop audio capture and processing",
)
async def stop_capture(request: Request) -> StopCaptureResponse:
    engine = request.app.state.audio_engine
    stats = engine.stats
    await engine.stop()
    return StopCaptureResponse(status="stopped", stats=stats)