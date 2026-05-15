from pathlib import Path
from typing import Any, List, Optional
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_PROJECT_ROOT = _BACKEND_ROOT.parent

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_BACKEND_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "ElyonX Backend"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    @field_validator("DEBUG", mode="before")
    @classmethod
    def _coerce_debug(cls, value: Any) -> Any:
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"release", "prod", "production", "off", "false", "0", "no"}:
                return False
            if normalized in {"debug", "dev", "development", "on", "true", "1", "yes"}:
                return True
        return value

    CORS_ORIGINS: List[str] = [
        "http://localhost:8081",   # Expo Metro bundler
        "http://localhost:3000",   # React web dev
        "http://localhost:19006",  # Expo web
        "*",                       # Open for LAN access (tighten in production)
    ]
    
    AUDIO_SAMPLE_RATE: int = 48000          # Hz — matches Focusrite 2i2 default
    AUDIO_BLOCK_SIZE: int = 256             # Samples per block (~5.3 ms @ 48 kHz)
    AUDIO_CHANNELS: int = 1                 # Mono RTA mic input
    AUDIO_DTYPE: str = "float32"
    AUDIO_DEVICE_INDEX: Optional[int] = None     # Optional explicit sounddevice index
    AUDIO_DEVICE_NAME: str = "Focusrite USB Audio"     # Substring match for device search
    AUDIO_INPUT_CHANNEL: int = 0            # Channel index on the interface (0-based
    
    RTA_FFT_SIZE: int = 2048                # FFT window size (power of 2)
    RTA_HOP_SIZE: int = 256                 # Hop between frames
    RTA_WINDOW: str = "hann"               # Window function
    RTA_MIN_FREQ: float = 20.0             # Hz
    RTA_MAX_FREQ: float = 20000.0          # Hz
    RTA_SMOOTHING_ALPHA: float = 0.6       # Exponential smoothing factor (0–1)
    RTA_FRAMES_PER_SECOND: int = 60        # Target FPS for telemetry broadcast

    BAND_DEFINITIONS: List[List[float]] = [
        [20,    60],    # Sub-bass
        [60,    250],   # Bass
        [250,   500],   # Low-mid
        [500,   2000],  # Mid
        [2000,  4000],  # Upper-mid
        [4000,  8000],  # Presence
        [8000,  20000], # Air / Brilliance
    ]
    BAND_NAMES: List[str] = [
        "Sub", "Bass", "Low-Mid", "Mid", "Upper-Mid", "Presence", "Air"
    ]
    
    SPL_FLOOR_DBFS: float = -100.0  # Flooer clamp to avoid log(0)
    
    FEEDBACK_PEAK_THRESHOLD_DB: float = -20.0   # Relative to mean spectrum (dB)
    FEEDBACK_PEAK_WIDTH_BINS: int = 3            # Min peak width to flag
    
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "elyonx_ims"
    
    _PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
    IMS_MODEL_PATH: str = str(
        _PROJECT_ROOT / "elyonx-models" / "elyonx_eq_param_predictor_v3.pth"
    )
    IMS_MODEL_CONFIG_PATH: str = str(
        _PROJECT_ROOT / "elyonx-models" / "exported" / "elyonx_eq_param_predictor_v3_config.json"
    )
    IMS_FEATURE_SCALER_PATH: str = str(
        _PROJECT_ROOT / "elyonx-models" / "exported" / "elyonx_eq_param_predictor_v3_scaler.json"
    )
    IMS_WINDOW_SIZE: int = 16384            # v3 RTA analysis window (~341 ms @ 48 kHz)
    IMS_ANALYSIS_LOOKBACK_SECONDS: float = 3.0  # Rolling audio history searched for usable signal
    IMS_BLOCK_SIZE: int = IMS_WINDOW_SIZE   # Backward-compatible alias used by older callers

    OSC_TARGET_IP: str = "192.168.1.100"
    OSC_TARGET_PORT: int = 10023
    OSC_CONNECT_TIMEOUT_SECONDS: float = 1.5
    OSC_HEARTBEAT_INTERVAL_SECONDS: float = 5.0
    OSC_STALE_TIMEOUT_SECONDS: float = 15.0
    MIDI_PORT_NAME: str = ""
    EQ_BAND_MODE: int = 4

    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/auth/google/callback"

    JWT_SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 7 * 24 * 60   # 7 days
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    FRONTEND_REDIRECT_URI: str = "elyonx://auth/callback"

    OAUTH_STATE_SECRET: str = ""

settings = Settings()
    
    
    
