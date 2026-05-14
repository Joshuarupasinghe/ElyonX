from typing import List, Optional
from pydantic import BaseModel, Field


# Device Schemas 

class AudioDeviceInfo(BaseModel):
    index: int
    name: str
    max_input_channels: int
    default_samplerate: float
    hostapi: str


class StartCaptureRequest(BaseModel):
    device_index: Optional[int] = Field(
        default=None,
        description="Audio device index. If omitted, auto-detects Focusrite Scarlett.",
    )


class StartCaptureResponse(BaseModel):
    status: str
    device: dict
    session_id: Optional[str] = None


class StopCaptureResponse(BaseModel):
    status: str
    stats: dict


class DeviceStatusResponse(BaseModel):
    stream_active: bool
    device: Optional[dict]
    stats: dict


# RTA / Feature Schemas

class BandEnergy(BaseModel):
    name: str
    low_hz: float
    high_hz: float
    energy_db: float


class ImbalanceIndicators(BaseModel):
    muddiness: float    # Positive → muddy low-mids
    harshness: float    # Positive → harsh presence
    thinness: float     # Positive → thin/lacking bass
    brightness: float   # Positive → bright/airy
    average_db: float


class FeedbackAlert(BaseModel):
    frequency_hz: float
    magnitude_db: float
    excess_db: float


class FeedbackInfo(BaseModel):
    alerts: List[FeedbackAlert]
    risk_level: str   # "safe" | "warning" | "danger"


class RTASpectrum(BaseModel):
    frequencies: List[float]
    magnitudes_db: List[float]


class RTAFrame(BaseModel):
    """
    Complete telemetry payload broadcast over WebSocket per frame.
    Matches the dict produced by FeatureExtractor.extract().
    """
    event: str = "rta_frame"
    timestamp_ms: int
    processing_time_ms: float
    rta: RTASpectrum
    spl_dbfs: float
    bands: List[BandEnergy]
    imbalance: ImbalanceIndicators
    feedback: FeedbackInfo


# Health

class HealthResponse(BaseModel):
    status: str
    version: str
    stream_active: bool
    ws_clients: int