import logging
from typing import List, Optional

from app.services.audio_engine import AudioEngine

logger = logging.getLogger("elyonx.device_service")


class DeviceService:
    def __init__(self, engine: AudioEngine) -> None:
        self._engine = engine

    def list_input_devices(self) -> List[dict]:
        """Return all available audio input devices on this machine."""
        return AudioEngine.list_devices()

    def find_focusrite(self) -> Optional[dict]:
        """Convenience: find the Scarlett 2i2 specifically."""
        for dev in AudioEngine.list_devices():
            if "scarlett" in dev["name"].lower() or "focusrite" in dev["name"].lower():
                return dev
        return None

    def start_capture(self, device_index: Optional[int] = None) -> dict:
        return self._engine.start(device_index=device_index)

    async def stop_capture(self) -> None:
        await self._engine.stop()

    def get_status(self) -> dict:
        return {
            "stream_active": self._engine.is_running,
            "device": self._engine.device_info,
            "stats": self._engine.stats,
        }