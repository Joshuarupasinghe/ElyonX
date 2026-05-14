"""
ElyonX IMS – Audio Engine
Manages real-time audio capture from the Focusrite Scarlett 2i2 via sounddevice.
Uses a thread-safe NumPy ring buffer to decouple capture from processing,
mirroring the architecture described in the ElyonX interim report (Section 7.2).

Design constraints:
  • Buffer callback must be lock-free and allocation-free.
  • Block size: 1024 samples @ 44100 Hz ≈ 23 ms per block.
  • Ring buffer stores 10 blocks of headroom to prevent drops under load.
"""

import asyncio
import logging
import threading
import time
from typing import Optional, Any, Dict, List, cast

import numpy as np

sd: Any = None
try:
    import sounddevice as sd  # type: ignore
    SOUNDDEVICE_AVAILABLE = True
except ImportError:
    sd = None
    SOUNDDEVICE_AVAILABLE = False

from app.core.config import settings
from app.services.feature_extractor import FeatureExtractor
from app.core.ws_manager import ws_manager
from app.services.session_logger import session_logger

logger = logging.getLogger("elyonx.audio_engine")

# Ring buffer depth: 10 blocks of headroom
_RING_DEPTH = 10


def _latest_audio_history_samples() -> int:
    lookback_samples = int(
        round(settings.AUDIO_SAMPLE_RATE * settings.IMS_ANALYSIS_LOOKBACK_SECONDS)
    )
    return max(settings.IMS_WINDOW_SIZE, lookback_samples)


class RingBuffer:
    """
    Fixed-capacity circular buffer for audio blocks.
    Writer: audio callback thread (sounddevice).
    Reader: async feature extraction task (event loop thread via asyncio).
    Uses a simple index-based approach that is safe for one producer / one consumer.
    """

    def __init__(self, block_size: int, depth: int = _RING_DEPTH) -> None:
        self._buf = np.zeros((depth, block_size), dtype=np.float32)
        self._depth = depth
        self._write_idx = 0
        self._read_idx = 0
        self._count = 0
        self._lock = threading.Lock()

    def write(self, block: np.ndarray) -> None:
        """Write one audio block. Oldest block is silently overwritten if full."""
        with self._lock:
            self._buf[self._write_idx] = block[: self._buf.shape[1]]
            self._write_idx = (self._write_idx + 1) % self._depth
            if self._count < self._depth:
                self._count += 1
            else:
                # Overwrite: advance read pointer to keep newest data
                self._read_idx = (self._read_idx + 1) % self._depth

    def read(self) -> Optional[np.ndarray]:
        """Return the oldest unread block, or None if buffer is empty."""
        with self._lock:
            if self._count == 0:
                return None
            block = self._buf[self._read_idx].copy()
            self._read_idx = (self._read_idx + 1) % self._depth
            self._count -= 1
            return block

    def clear(self) -> None:
        """Reset the buffer so a new capture session starts from fresh audio."""
        with self._lock:
            self._buf.fill(0.0)
            self._write_idx = 0
            self._read_idx = 0
            self._count = 0

    @property
    def available(self) -> int:
        return self._count


class AudioEngine:
    """
    Singleton audio engine.  Lifecycle:
        start()  →  streaming  →  stop()
    """

    def __init__(self) -> None:
        self._stream: Optional[Any] = None  # sd.InputStream
        self._ring = RingBuffer(settings.AUDIO_BLOCK_SIZE)
        self._extractor = FeatureExtractor()
        self._running = False
        self._device_info: Optional[dict] = None
        self._last_block_time: float = 0.0
        self._latest_audio_block: Optional[np.ndarray] = None
        self._latest_audio_window = np.zeros(_latest_audio_history_samples(), dtype=np.float32)
        self._latest_audio_write_idx = 0
        self._latest_audio_samples_seen = 0
        self._latest_audio_lock = threading.Lock()
        self._dropped_blocks: int = 0
        self._processed_blocks: int = 0

    #  Public API 

    def start(self, device_index: Optional[int] = None) -> dict:
        """
        Open the audio input stream.
        If device_index is None, auto-detects the Focusrite Scarlett.
        Returns device info dict.
        """
        if self._running:
            logger.warning("AudioEngine.start() called while already running.")
            return self._device_info or {}

        if not SOUNDDEVICE_AVAILABLE:
            raise RuntimeError(
                "sounddevice is not installed. Run: pip install sounddevice"
            )

        if device_index is None and settings.AUDIO_DEVICE_INDEX is not None:
            device_index = settings.AUDIO_DEVICE_INDEX

        if device_index is None:
            device_index = self._find_device(settings.AUDIO_DEVICE_NAME)

        device_info = cast(Dict[str, Any], sd.query_devices(device_index, "input"))
        max_input_channels = int(device_info.get("max_input_channels", 0) or 0)
        capture_channels = max(settings.AUDIO_CHANNELS, settings.AUDIO_INPUT_CHANNEL + 1)
        if capture_channels > max_input_channels:
            raise RuntimeError(
                f"Device '{device_info.get('name', '')}' has {max_input_channels} input channel(s); "
                f"RTA input channel {settings.AUDIO_INPUT_CHANNEL + 1} is not available."
            )
        logger.info(
            "Opening audio stream on device [%d] '%s'  SR=%d  blocksize=%d  rta_channel=%d",
            device_index,
            device_info["name"],
            settings.AUDIO_SAMPLE_RATE,
            settings.AUDIO_BLOCK_SIZE,
            settings.AUDIO_INPUT_CHANNEL + 1,
        )

        self._reset_capture_state()

        self._stream = sd.InputStream(
            device=device_index,
            samplerate=settings.AUDIO_SAMPLE_RATE,
            blocksize=settings.AUDIO_BLOCK_SIZE,
            channels=capture_channels,
            dtype=settings.AUDIO_DTYPE,
            callback=self._audio_callback,
            latency="low",
        )
        if self._stream is not None:
            self._stream.start()
        self._running = True
        self._device_info = {
            "index": device_index,
            "name": str(device_info.get("name", "")),
            "sample_rate": settings.AUDIO_SAMPLE_RATE,
            "block_size": settings.AUDIO_BLOCK_SIZE,
            "channels": capture_channels,
            "rta_input_channel": settings.AUDIO_INPUT_CHANNEL,
            "latency_ms": round(settings.AUDIO_BLOCK_SIZE / settings.AUDIO_SAMPLE_RATE * 1000, 2),
        }
        logger.info("Audio stream started. Block latency: %.1f ms", self._device_info["latency_ms"])
        return self._device_info

    async def stop(self) -> None:
        """Gracefully stop the audio stream."""
        self._running = False
        if self._stream is not None:
            self._stream.stop()
            self._stream.close()
            self._stream = None
            logger.info(
                "Audio stream stopped. Processed=%d  Dropped=%d",
                self._processed_blocks,
                self._dropped_blocks,
            )

    async def process_loop(self) -> None:
        """
        Async processing loop — runs on the asyncio event loop.
        Drains the ring buffer, extracts features, and broadcasts via WebSocket.
        Target cadence: RTA_FRAMES_PER_SECOND (default 20 FPS = every 50 ms).
        """
        interval = 1.0 / settings.RTA_FRAMES_PER_SECOND
        logger.info("RTA processing loop started  (%.0f FPS target).", settings.RTA_FRAMES_PER_SECOND)

        while self._running:
            loop_start = time.monotonic()

            # Drain all available blocks into one concatenated frame
            blocks = []
            while True:
                block = self._ring.read()
                if block is None:
                    break
                blocks.append(block)

            if blocks:
                audio_frame = np.concatenate(blocks)
                if len(audio_frame) > settings.RTA_FFT_SIZE:
                    # Keep the newest samples so backlog does not add visible lag.
                    audio_frame = audio_frame[-settings.RTA_FFT_SIZE :]
                features = self._extractor.extract(audio_frame)
                self._processed_blocks += len(blocks)
                await ws_manager.broadcast(features)
                await session_logger.log_frame(features)

            # Sleep for remainder of interval (non-blocking)
            elapsed = time.monotonic() - loop_start
            sleep_time = max(0.0, interval - elapsed)
            await asyncio.sleep(sleep_time)

    @property
    def is_running(self) -> bool:
        return self._running

    @property
    def device_info(self) -> Optional[dict]:
        return self._device_info

    @property
    def stats(self) -> dict:
        return {
            "running": self._running,
            "processed_blocks": self._processed_blocks,
            "dropped_blocks": self._dropped_blocks,
            "ring_buffer_available": self._ring.available,
            "active_ws_clients": int(getattr(ws_manager, "active_count", 0)),
        }

    def get_latest_audio(
        self,
        n_samples: int = 1024,
        min_samples: Optional[int] = None,
    ) -> Optional[np.ndarray]:
        """Return the most recent n_samples of captured audio (non-destructive).

        Used by the IMS inference endpoint to get an audio snapshot for
        EQ prediction without draining the ring buffer. By default this waits
        until the full requested window is available; callers can pass
        min_samples to accept a shorter warm-up window.
        """
        if not self._running:
            return None
        if n_samples <= 0:
            return None

        with self._latest_audio_lock:
            window = self._latest_audio_window
            requested = min(int(n_samples), len(window))
            required = requested if min_samples is None else min(int(min_samples), requested)
            if required <= 0:
                return None
            if self._latest_audio_samples_seen >= required:
                available = min(requested, self._latest_audio_samples_seen, len(window))
                end = self._latest_audio_write_idx
                start = (end - available) % len(window)
                if start < end:
                    return window[start:end].copy()
                return np.concatenate((window[start:], window[:end])).astype(np.float32)

        return None

    # Private 

    def _reset_capture_state(self) -> None:
        """Clear buffers and counters so inference never sees stale capture data."""
        self._ring.clear()
        self._latest_audio_block = None
        with self._latest_audio_lock:
            self._latest_audio_window.fill(0.0)
            self._latest_audio_write_idx = 0
            self._latest_audio_samples_seen = 0
        self._last_block_time = 0.0
        self._dropped_blocks = 0
        self._processed_blocks = 0

    def _audio_callback(
        self,
        indata: np.ndarray,
        frames: int,
        time_info,
        status,
    ) -> None:
        """
        sounddevice real-time callback — executes on the audio thread.
        MUST NOT allocate memory or block.
        """
        if status:
            logger.debug("sounddevice status: %s", status)
            self._dropped_blocks += 1

        # Collapse to mono using the configured RTA mic input channel.
        input_channel = settings.AUDIO_INPUT_CHANNEL
        if input_channel >= indata.shape[1]:
            logger.warning(
                "Configured RTA input channel %d is not present in callback with %d channel(s). "
                "Falling back to channel 1 for this block.",
                input_channel + 1,
                indata.shape[1],
            )
            input_channel = 0
        mono = indata[:, input_channel].copy()
        self._ring.write(mono)
        self._latest_audio_block = mono.copy()
        with self._latest_audio_lock:
            window = self._latest_audio_window
            n = min(len(mono), len(window))
            if n > 0:
                block = mono[-n:]
                write_idx = self._latest_audio_write_idx
                end_idx = write_idx + n
                if end_idx <= len(window):
                    window[write_idx:end_idx] = block
                else:
                    first = len(window) - write_idx
                    window[write_idx:] = block[:first]
                    window[: end_idx % len(window)] = block[first:]
                self._latest_audio_write_idx = end_idx % len(window)
                self._latest_audio_samples_seen = min(
                    len(window),
                    self._latest_audio_samples_seen + n,
                )
        self._last_block_time = time.monotonic()

    @staticmethod
    def _find_device(name_substring: str) -> int:
        """
        Search for an audio input device whose name contains name_substring.
        Falls back to the default input device if not found.
        """
        devices = cast(List[Dict[str, Any]], sd.query_devices())
        for idx, dev in enumerate(devices):
            name = str(dev.get("name", ""))
            max_in = int(dev.get("max_input_channels", 0) or 0)
            if name_substring.lower() in name.lower() and max_in > 0:
                logger.info("Auto-detected device [%d]: %s", idx, name)
                return idx

        logger.warning(
            "Device '%s' not found. Falling back to system default input.", name_substring
        )
        default = None
        if sd is not None:
            try:
                default = sd.default.device[0]
            except Exception:
                default = None
        if default is None:
            raise RuntimeError("No default audio input device found.")
        return int(default)

    @staticmethod
    def list_devices() -> list:
        """Return all available audio input devices."""
        if not SOUNDDEVICE_AVAILABLE:
            return []
        devices = cast(List[Dict[str, Any]], sd.query_devices())
        result = []
        for idx, dev in enumerate(devices):
            max_in = int(dev.get("max_input_channels", 0) or 0)
            if max_in > 0:
                hostapi_name = ""
                try:
                    hostapi = dev.get("hostapi")
                    hostapi_name = sd.query_hostapis(int(hostapi))["name"] if hostapi is not None else ""
                except Exception:
                    hostapi_name = ""
                result.append({
                    "index": idx,
                    "name": str(dev.get("name", "")),
                    "max_input_channels": max_in,
                    "default_samplerate": dev.get("default_samplerate"),
                    "hostapi": hostapi_name,
                })
        return result
