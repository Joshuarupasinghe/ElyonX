import numpy as np

from app.services.ims_inference import IMSInferenceService


def test_select_inference_window_uses_loudest_slice_from_lookback() -> None:
    service = IMSInferenceService()
    window_size = int(service._metadata["window_size"])
    lookback = np.zeros(window_size * 3, dtype=np.float32)
    lookback[window_size : window_size + 1024] = 0.25

    selected = service._select_inference_window(lookback)

    assert len(selected) == window_size
    assert np.max(np.abs(selected)) == 0.25
