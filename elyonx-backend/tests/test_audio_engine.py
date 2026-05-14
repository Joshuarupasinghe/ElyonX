import math

import numpy as np

from app.core.config import settings
from app.services.audio_engine import AudioEngine


def _capture_block(value: float) -> np.ndarray:
    return np.full(
        (settings.AUDIO_BLOCK_SIZE, settings.AUDIO_CHANNELS),
        value,
        dtype=np.float32,
    )


def test_latest_audio_waits_for_full_requested_window() -> None:
    engine = AudioEngine()
    engine._running = True

    engine._audio_callback(_capture_block(0.25), settings.AUDIO_BLOCK_SIZE, None, None)

    assert engine.get_latest_audio(settings.IMS_WINDOW_SIZE) is None


def test_latest_audio_returns_full_window_after_enough_capture() -> None:
    engine = AudioEngine()
    engine._running = True

    blocks_needed = math.ceil(settings.IMS_WINDOW_SIZE / settings.AUDIO_BLOCK_SIZE)
    for index in range(blocks_needed):
        engine._audio_callback(
            _capture_block(float(index + 1)),
            settings.AUDIO_BLOCK_SIZE,
            None,
            None,
        )

    window = engine.get_latest_audio(settings.IMS_WINDOW_SIZE)

    assert window is not None
    assert len(window) == settings.IMS_WINDOW_SIZE
    assert np.all(window[: settings.AUDIO_BLOCK_SIZE] == 1.0)
    assert np.all(window[-settings.AUDIO_BLOCK_SIZE :] == float(blocks_needed))


def test_reset_capture_state_prevents_stale_restart_audio() -> None:
    engine = AudioEngine()
    engine._running = True

    blocks_needed = math.ceil(settings.IMS_WINDOW_SIZE / settings.AUDIO_BLOCK_SIZE)
    for _ in range(blocks_needed):
        engine._audio_callback(_capture_block(0.25), settings.AUDIO_BLOCK_SIZE, None, None)

    assert engine.get_latest_audio(settings.IMS_WINDOW_SIZE) is not None

    engine._reset_capture_state()

    assert engine.get_latest_audio(settings.IMS_WINDOW_SIZE) is None


def test_latest_audio_can_return_warmup_window_with_minimum_samples() -> None:
    engine = AudioEngine()
    engine._running = True

    blocks_needed = math.ceil(settings.IMS_WINDOW_SIZE / settings.AUDIO_BLOCK_SIZE)
    for index in range(blocks_needed):
        engine._audio_callback(
            _capture_block(float(index + 1)),
            settings.AUDIO_BLOCK_SIZE,
            None,
            None,
        )

    lookback_samples = int(settings.AUDIO_SAMPLE_RATE * settings.IMS_ANALYSIS_LOOKBACK_SECONDS)
    window = engine.get_latest_audio(lookback_samples, min_samples=settings.IMS_WINDOW_SIZE)

    assert window is not None
    assert len(window) == blocks_needed * settings.AUDIO_BLOCK_SIZE
    assert np.all(window[-settings.AUDIO_BLOCK_SIZE :] == float(blocks_needed))


def test_latest_audio_returns_chronological_window_after_history_wrap() -> None:
    engine = AudioEngine()
    engine._running = True
    engine._latest_audio_window = np.zeros(settings.AUDIO_BLOCK_SIZE * 3, dtype=np.float32)
    engine._latest_audio_write_idx = 0
    engine._latest_audio_samples_seen = 0

    for value in range(1, 6):
        engine._audio_callback(
            _capture_block(float(value)),
            settings.AUDIO_BLOCK_SIZE,
            None,
            None,
        )

    window = engine.get_latest_audio(settings.AUDIO_BLOCK_SIZE * 3)

    assert window is not None
    assert np.all(window[: settings.AUDIO_BLOCK_SIZE] == 3.0)
    assert np.all(window[settings.AUDIO_BLOCK_SIZE : settings.AUDIO_BLOCK_SIZE * 2] == 4.0)
    assert np.all(window[-settings.AUDIO_BLOCK_SIZE :] == 5.0)
