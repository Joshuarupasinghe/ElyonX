from fastapi import APIRouter, Request
from pydantic import BaseModel, Field
from typing import Optional
from app.core.config import settings
import logging
from datetime import datetime

router = APIRouter()


FOUR_BAND_ALIASES = [
    ("Low", "Low"),
    ("Low-mid", "Low-mid"),
    ("Presence", "High-mid"),
    ("Air", "Highs"),
]


def _shape_eq_bands_for_mode(bands: list) -> list:
    """Return the EQ payload in the topology selected by Settings."""
    if settings.EQ_BAND_MODE != 4:
        return bands

    by_name = {
        str(band.get("name", "")).strip().lower(): band
        for band in bands
        if isinstance(band, dict)
    }
    shaped = []
    for source_name, output_name in FOUR_BAND_ALIASES:
        source = by_name.get(source_name.lower())
        if source is None:
            continue
        next_band = dict(source)
        next_band["id"] = len(shaped) + 1
        next_band["name"] = output_name
        shaped.append(next_band)

    return shaped if len(shaped) == 4 else bands


class AudioConfigResponse(BaseModel):
    sample_rate: int
    block_size: int
    channels: int
    fft_size: int
    rta_fps: int
    smoothing_alpha: float
    band_definitions: list
    band_names: list


class UpdateAudioConfigRequest(BaseModel):
    smoothing_alpha: Optional[float] = Field(None, ge=0.0, le=0.99)
    rta_fps: Optional[int] = Field(None, ge=1, le=60)


@router.get("/config", response_model=AudioConfigResponse, summary="Get current audio config")
async def get_audio_config():
    return AudioConfigResponse(
        sample_rate=settings.AUDIO_SAMPLE_RATE,
        block_size=settings.AUDIO_BLOCK_SIZE,
        channels=settings.AUDIO_CHANNELS,
        fft_size=settings.RTA_FFT_SIZE,
        rta_fps=settings.RTA_FRAMES_PER_SECOND,
        smoothing_alpha=settings.RTA_SMOOTHING_ALPHA,
        band_definitions=settings.BAND_DEFINITIONS,
        band_names=settings.BAND_NAMES,
    )


@router.patch("/config", summary="Update runtime audio config (smoothing, FPS)")
async def update_audio_config(body: UpdateAudioConfigRequest, request: Request):
    """Hot-update certain runtime parameters without restarting the stream."""
    engine = request.app.state.audio_engine

    if body.smoothing_alpha is not None:
        engine._extractor._alpha = body.smoothing_alpha
        settings.RTA_SMOOTHING_ALPHA = body.smoothing_alpha

    if body.rta_fps is not None:
        settings.RTA_FRAMES_PER_SECOND = body.rta_fps

    return {"status": "updated", "config": await get_audio_config()}


class AnalyzeChannelRequest(BaseModel):
    instrument: str = Field(..., description="One of 'kick', 'snare', 'hihat'")

@router.post("/analyze", summary="Run IMS model inference on the current audio block")
async def analyze_channel(body: AnalyzeChannelRequest, request: Request):
    """
    Reads the latest RTA analysis window and runs it through the v3
    parameter-only EQ predictor to generate an EQ recommendation.
    """
    engine = request.app.state.audio_engine
    ims_service = request.app.state.ims_model

    if not engine.is_running:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Audio capture is not running.")

    if not ims_service.is_loaded:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="IMS model is not loaded.")

    # Grab enough recent audio for transient instruments, then inference will
    # choose the strongest model-sized slice inside that lookback.
    lookback_samples = max(
        settings.IMS_WINDOW_SIZE,
        int(round(settings.AUDIO_SAMPLE_RATE * settings.IMS_ANALYSIS_LOOKBACK_SECONDS)),
    )
    audio_block = engine.get_latest_audio(
        lookback_samples,
        min_samples=settings.IMS_WINDOW_SIZE,
    )
    if audio_block is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="No audio available yet.")

    prediction = ims_service.predict_eq(audio_block, body.instrument)
    if prediction is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Inference failed (check instrument type).")

    payload = prediction.to_dict()
    payload["bands"] = _shape_eq_bands_for_mode(payload["bands"])
    payload["band_mode"] = 4 if settings.EQ_BAND_MODE == 4 else 6

    # Broadcast the recommendation to all connected WebSocket clients (like frontend RTA overlay)
    from app.core.ws_manager import ws_manager
    ws_payload = {
        "event": "eq_recommendation",
        **payload
    }
    
    # Broadcast in the background or await it
    import asyncio
    asyncio.create_task(ws_manager.broadcast(ws_payload))

    return payload


@router.post("/reset", summary="Reset EQ and clear cached inference results")
async def reset_eq(request: Request):
    """
    Resets the EQ state by clearing any cached inference results on the server side.
    The frontend will also reset the channel's EQ bands and disable EQ.
    """
    try:
        logger = logging.getLogger("elyonx.audio")
        logger.info("[ElyonX] Reset EQ called - clearing cached inference results")
        request.app.state.ims_model.reset_smoothing()
        
        # Broadcast reset event to all connected WebSocket clients
        from app.core.ws_manager import ws_manager
        ws_payload = {
            "event": "eq_reset",
            "timestamp": str(datetime.now())
        }
        
        import asyncio
        asyncio.create_task(ws_manager.broadcast(ws_payload))
        
        return {
            "status": "reset",
            "message": "EQ reset completed",
            "timestamp": str(datetime.now())
        }
    except Exception as e:
        logger = logging.getLogger("elyonx.audio")
        logger.error(f"[ElyonX] Error during reset: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"Reset failed: {str(e)}")
