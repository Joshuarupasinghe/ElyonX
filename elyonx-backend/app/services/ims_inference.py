"""
ElyonX IMS - v3 EQ parameter inference service.

The v3 model is parameter-only. It consumes RTA-style features extracted from a
live audio window and returns normalized parametric EQ settings:
  [gain_norm, freq_norm, q_norm] x 6 bands.

This service supports both deployment formats:
  - exported TorchScript .pt from elyonx-models/export_model.py
  - raw .pth checkpoint from elyonx_eq_param_predictor_v3.py
"""

from __future__ import annotations

import json
import logging
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import torch
import torch.nn as nn

from app.core.config import settings

logger = logging.getLogger("elyonx.ims_inference")

EPS = 1e-9
MIN_INFERENCE_RMS_DBFS = -65.0
MIN_INFERENCE_PEAK_DBFS = -50.0
LOW_SIGNAL_WARNING_RMS_DBFS = -55.0
LOW_SIGNAL_WARNING_PEAK_DBFS = -32.0
CLIPPING_WARNING_PEAK_DBFS = -1.0
PREDICTION_SMOOTHING_ALPHA = 0.65
PREDICTION_SMOOTHING_RESET_SEC = 3.0

DEFAULT_INSTRUMENTS = ["kick", "snare", "hihat"]
DEFAULT_EQ_BANDS = [
    {"name": "Sub", "init_hz": 65.0, "min_hz": 35.0, "max_hz": 110.0},
    {"name": "Low", "init_hz": 140.0, "min_hz": 80.0, "max_hz": 260.0},
    {"name": "Low-mid", "init_hz": 320.0, "min_hz": 180.0, "max_hz": 650.0},
    {"name": "Mid", "init_hz": 900.0, "min_hz": 500.0, "max_hz": 1800.0},
    {"name": "Presence", "init_hz": 3200.0, "min_hz": 1500.0, "max_hz": 6000.0},
    {"name": "Air", "init_hz": 9000.0, "min_hz": 5500.0, "max_hz": 14000.0},
]

DEFAULT_METADATA: Dict[str, Any] = {
    "model_version": "v3",
    "model_type": "eq_param_predictor",
    "feature_dim": 134,
    "n_instruments": 3,
    "n_eq_params": 18,
    "instruments": DEFAULT_INSTRUMENTS,
    "eq_bands": DEFAULT_EQ_BANDS,
    "sr": 48000,
    "window_size": 16384,
    "fft_size": 16384,
    "n_rta_bins": 128,
    "feature_fmin": 30.0,
    "feature_fmax": 18000.0,
    "max_gain_db": 15.0,
    "q_min": 0.30,
    "q_max": 10.0,
    "target_rms_dbfs": -18.0,
    "max_allowed_peak": 0.98,
}

DEFAULT_EQ_BAND_POLICY: Dict[str, Any] = {
    "type": "bell",
    "min_hz": 30.0,
    "max_hz": 18000.0,
    "min_gain_db": -9.0,
    "max_gain_db": 9.0,
    "min_q": 0.50,
    "max_q": 4.0,
    "deadband_db": 0.75,
    "priority": 1.0,
}

PRACTICAL_MAX_ACTIVE_BANDS: Dict[str, int] = {
    "kick": 4,
    "snare": 5,
    "hihat": 5,
}

# The neural model predicts the training topology: six peaking filters fitted to
# the raw/EQ spectral ratio. These profiles translate those values into
# conservative, engineer-readable moves for the live UI.
PRACTICAL_EQ_PROFILES: Dict[str, List[Dict[str, Any]]] = {
    "kick": [
        {"type": "lowshelf", "min_hz": 40.0, "max_hz": 90.0, "min_gain_db": -5.0, "max_gain_db": 5.0, "min_q": 0.55, "max_q": 1.30, "deadband_db": 0.80, "priority": 1.50},
        {"type": "bell", "min_hz": 70.0, "max_hz": 160.0, "min_gain_db": -5.0, "max_gain_db": 5.0, "min_q": 0.70, "max_q": 1.80, "deadband_db": 0.80, "priority": 1.30},
        {"type": "bell", "min_hz": 180.0, "max_hz": 420.0, "min_gain_db": -7.0, "max_gain_db": 1.5, "min_q": 0.80, "max_q": 2.80, "deadband_db": 0.90, "priority": 1.35},
        {"type": "bell", "min_hz": 450.0, "max_hz": 1200.0, "min_gain_db": -5.0, "max_gain_db": 1.5, "min_q": 0.80, "max_q": 3.20, "deadband_db": 1.00, "priority": 0.90},
        {"type": "bell", "min_hz": 2500.0, "max_hz": 5500.0, "min_gain_db": -3.0, "max_gain_db": 5.0, "min_q": 0.80, "max_q": 2.60, "deadband_db": 0.90, "priority": 1.40},
        {"type": "highshelf", "min_hz": 6500.0, "max_hz": 12000.0, "min_gain_db": -4.0, "max_gain_db": 3.0, "min_q": 0.60, "max_q": 1.40, "deadband_db": 1.50, "priority": 0.65},
    ],
    "snare": [
        {"type": "lowshelf", "min_hz": 80.0, "max_hz": 140.0, "min_gain_db": -8.0, "max_gain_db": 2.0, "min_q": 0.55, "max_q": 1.30, "deadband_db": 1.00},
        {"type": "bell", "min_hz": 120.0, "max_hz": 260.0, "min_gain_db": -4.0, "max_gain_db": 5.0, "min_q": 0.70, "max_q": 1.80, "deadband_db": 0.80},
        {"type": "bell", "min_hz": 250.0, "max_hz": 650.0, "min_gain_db": -7.0, "max_gain_db": 3.0, "min_q": 0.80, "max_q": 3.00, "deadband_db": 0.90},
        {"type": "bell", "min_hz": 700.0, "max_hz": 1800.0, "min_gain_db": -5.0, "max_gain_db": 4.0, "min_q": 0.80, "max_q": 3.00, "deadband_db": 0.90},
        {"type": "bell", "min_hz": 2500.0, "max_hz": 6000.0, "min_gain_db": -4.0, "max_gain_db": 6.0, "min_q": 0.80, "max_q": 2.80, "deadband_db": 0.80},
        {"type": "highshelf", "min_hz": 6500.0, "max_hz": 14000.0, "min_gain_db": -4.0, "max_gain_db": 5.0, "min_q": 0.60, "max_q": 1.60, "deadband_db": 1.00},
    ],
    "hihat": [
        {"type": "highpass", "min_hz": 120.0, "max_hz": 300.0, "min_gain_db": 0.0, "max_gain_db": 0.0, "min_q": 0.65, "max_q": 1.20, "deadband_db": 0.50},
        {"type": "bell", "min_hz": 250.0, "max_hz": 700.0, "min_gain_db": -8.0, "max_gain_db": 1.0, "min_q": 0.70, "max_q": 2.50, "deadband_db": 0.80},
        {"type": "bell", "min_hz": 700.0, "max_hz": 1800.0, "min_gain_db": -6.0, "max_gain_db": 2.0, "min_q": 0.80, "max_q": 3.00, "deadband_db": 0.80},
        {"type": "bell", "min_hz": 1800.0, "max_hz": 3500.0, "min_gain_db": -5.0, "max_gain_db": 3.0, "min_q": 0.80, "max_q": 3.00, "deadband_db": 0.80},
        {"type": "bell", "min_hz": 4000.0, "max_hz": 8500.0, "min_gain_db": -6.0, "max_gain_db": 4.0, "min_q": 0.80, "max_q": 3.20, "deadband_db": 0.80},
        {"type": "highshelf", "min_hz": 9000.0, "max_hz": 16000.0, "min_gain_db": -5.0, "max_gain_db": 4.0, "min_q": 0.60, "max_q": 1.60, "deadband_db": 0.90},
    ],
}


class EQParamPredictor(nn.Module):
    """Architecture from elyonx_eq_parameter_only_model_v3.py."""

    def __init__(self, feature_dim: int, n_instruments: int, out_dim: int):
        super().__init__()
        self.inst_embedding = nn.Embedding(n_instruments, 16)
        self.net = nn.Sequential(
            nn.Linear(feature_dim + 16, 256),
            nn.LayerNorm(256),
            nn.LeakyReLU(0.15),
            nn.Dropout(0.20),
            nn.Linear(256, 192),
            nn.LayerNorm(192),
            nn.LeakyReLU(0.15),
            nn.Dropout(0.15),
            nn.Linear(192, 128),
            nn.LayerNorm(128),
            nn.LeakyReLU(0.15),
            nn.Dropout(0.10),
            nn.Linear(128, out_dim),
            nn.Tanh(),
        )

    def forward(self, features: torch.Tensor, inst_id: torch.Tensor) -> torch.Tensor:
        emb = self.inst_embedding(inst_id)
        x = torch.cat([features, emb], dim=1)
        return self.net(x)


class FeatureScaler:
    """Small StandardScaler-compatible transformer backed by JSON arrays."""

    def __init__(self, feature_dim: int) -> None:
        self.kind = "identity"
        self.mean = np.zeros(feature_dim, dtype=np.float32)
        self.scale = np.ones(feature_dim, dtype=np.float32)

    def load(self, path: Path) -> None:
        if not path.exists():
            logger.warning(
                "IMS feature scaler not found at %s. Using identity scaling. "
                "Export feature_scaler.joblib with elyonx-models/export_model.py for best accuracy.",
                path,
            )
            return

        with open(path, "r", encoding="utf-8") as f:
            payload = json.load(f)

        mean = np.asarray(payload.get("feature_mean", []), dtype=np.float32)
        scale = np.asarray(payload.get("feature_scale", []), dtype=np.float32)
        if mean.shape != self.mean.shape or scale.shape != self.scale.shape:
            logger.warning(
                "IMS scaler shape mismatch at %s. Expected %s, got mean=%s scale=%s. "
                "Using identity scaling.",
                path,
                self.mean.shape,
                mean.shape,
                scale.shape,
            )
            return

        self.kind = str(payload.get("kind", "standard"))
        self.mean = mean
        self.scale = np.where(scale == 0.0, 1.0, scale).astype(np.float32)
        logger.info("Loaded IMS feature scaler from %s (%s)", path, self.kind)

    def transform_one(self, features: np.ndarray) -> np.ndarray:
        features = np.asarray(features, dtype=np.float32)
        return ((features - self.mean) / self.scale).astype(np.float32)


def _clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(max_value, value))


def _rounded_frequency(freq_hz: float) -> float:
    if freq_hz >= 1000.0:
        return round(freq_hz / 10.0) * 10.0
    return round(freq_hz, 1)


def _rounded_gain(gain_db: float) -> float:
    return round(gain_db * 4.0) / 4.0


def _rounded_q(q_value: float) -> float:
    return round(q_value * 20.0) / 20.0


def _policy_for_band(instrument: str, band_index: int) -> Dict[str, Any]:
    profile = PRACTICAL_EQ_PROFILES.get(instrument, [])
    if band_index < len(profile):
        return {**DEFAULT_EQ_BAND_POLICY, **profile[band_index]}
    return dict(DEFAULT_EQ_BAND_POLICY)


def _practical_band_values(
    instrument: str,
    band_index: int,
    gain_db: float,
    freq_hz: float,
    q_value: float,
) -> Dict[str, Any]:
    policy = _policy_for_band(instrument, band_index)
    filter_type = str(policy["type"])

    freq = _clamp(float(freq_hz), float(policy["min_hz"]), float(policy["max_hz"]))
    q = _clamp(float(q_value), float(policy["min_q"]), float(policy["max_q"]))
    gain = _clamp(float(gain_db), float(policy["min_gain_db"]), float(policy["max_gain_db"]))

    if filter_type in {"highpass", "lowpass"}:
        gain = 0.0

    enabled = abs(float(gain_db)) >= float(policy["deadband_db"])
    if filter_type == "highpass":
        # A high-pass move is useful only when the model wanted to remove low energy.
        enabled = gain_db < -float(policy["deadband_db"])

    if not enabled:
        gain = 0.0

    return {
        "type": filter_type,
        "gain": gain,
        "frequency": freq,
        "q": q,
        "enabled": enabled,
        "strength": abs(float(gain_db)) * float(policy["priority"]),
    }


class EQPrediction:
    """Structured container for model EQ predictions."""

    def __init__(
        self,
        params: np.ndarray,
        instrument: str,
        inference_ms: float,
        eq_bands: List[Dict[str, Any]],
        quality: Optional[Dict[str, Any]] = None,
    ):
        self.instrument = instrument
        self.inference_ms = inference_ms
        self.quality = quality or {
            "status": "ok",
            "warnings": [],
            "usable": True,
            "rms_dbfs": None,
            "peak_dbfs": None,
            "smoothed": False,
        }
        self.bands: List[Dict[str, Any]] = []

        for i, band_def in enumerate(eq_bands):
            gain_db, freq_hz, q_value = params[i]
            practical = _practical_band_values(instrument, i, float(gain_db), float(freq_hz), float(q_value))
            gain = _rounded_gain(float(practical["gain"]))
            q = _rounded_q(max(0.1, float(practical["q"])))
            self.bands.append(
                {
                    "id": i + 1,
                    "name": str(band_def.get("name", f"Band {i + 1}")),
                    "type": practical["type"],
                    "gain": round(gain, 2),
                    "frequency": _rounded_frequency(float(practical["frequency"])),
                    "q": round(q, 2),
                    "enabled": bool(practical["enabled"]),
                    "_strength": float(practical["strength"]),
                }
            )
        self._limit_active_bands()

        for band in self.bands:
            band.pop("_strength", None)

    def to_dict(self) -> dict:
        return {
            "instrument": self.instrument,
            "inference_ms": round(self.inference_ms, 3),
            "bands": self.bands,
            "quality": self.quality,
        }

    def _limit_active_bands(self) -> None:
        max_active = PRACTICAL_MAX_ACTIVE_BANDS.get(self.instrument)
        if max_active is None:
            return

        active_indexes = [i for i, band in enumerate(self.bands) if band["enabled"]]
        if len(active_indexes) <= max_active:
            return

        keep = set(
            sorted(
                active_indexes,
                key=lambda idx: float(self.bands[idx].get("_strength", 0.0)),
                reverse=True,
            )[:max_active]
        )
        for i in active_indexes:
            if i in keep:
                continue
            self.bands[i]["enabled"] = False
            self.bands[i]["gain"] = 0.0


class IMSInferenceService:
    """Singleton service for running v3 EQ parameter model inference."""

    def __init__(self) -> None:
        self._model: Optional[nn.Module] = None
        self._device = torch.device("cpu")
        self._loaded = False
        self._metadata: Dict[str, Any] = dict(DEFAULT_METADATA)
        self._scaler = FeatureScaler(int(DEFAULT_METADATA["feature_dim"]))
        self._smoothed_params: Dict[str, np.ndarray] = {}
        self._smoothed_at: Dict[str, float] = {}

    def load(self, model_path: Optional[str] = None) -> bool:
        """Load a TorchScript export or raw v3 checkpoint from disk."""
        path = Path(model_path or settings.IMS_MODEL_PATH)

        if not path.exists():
            logger.warning(
                "IMS model not found at %s. EQ inference disabled. "
                "Use the bundled v3 checkpoint or run: python elyonx-models/export_model.py",
                path,
            )
            return False

        try:
            logger.info("Loading IMS v3 model from: %s", path)
            if path.suffix.lower() == ".pt":
                self._load_metadata_from_json(Path(settings.IMS_MODEL_CONFIG_PATH))
                self._model = torch.jit.load(str(path), map_location=self._device)
            else:
                self._model = self._load_checkpoint_model(path)

            self._model.eval()
            feature_dim = int(self._metadata["feature_dim"])
            self._scaler = FeatureScaler(feature_dim)
            self._scaler.load(Path(settings.IMS_FEATURE_SCALER_PATH))

            dummy_features = torch.zeros(1, feature_dim, dtype=torch.float32)
            dummy_inst = torch.zeros(1, dtype=torch.long)
            with torch.no_grad():
                self._model(dummy_features, dummy_inst)

            self._loaded = True
            self.reset_smoothing()
            n_params = sum(p.numel() for p in self._model.parameters())
            logger.info(
                "IMS v3 model loaded. Parameters=%s feature_dim=%d bands=%d scaler=%s",
                f"{n_params:,}",
                feature_dim,
                len(self._metadata["eq_bands"]),
                self._scaler.kind,
            )
            return True

        except Exception as exc:
            logger.exception("Failed to load IMS v3 model: %s", exc)
            self._loaded = False
            self._model = None
            return False

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    def reset_smoothing(self, instrument: Optional[str] = None) -> None:
        if instrument is None:
            self._smoothed_params.clear()
            self._smoothed_at.clear()
            return

        self._smoothed_params.pop(instrument, None)
        self._smoothed_at.pop(instrument, None)

    def predict_eq(self, audio_block: np.ndarray, instrument: str) -> Optional[EQPrediction]:
        """Run v3 inference on a mono audio window."""
        if not self._loaded or self._model is None:
            logger.warning("predict_eq called but model is not loaded.")
            return None

        inst_to_idx = {name: i for i, name in enumerate(self._metadata["instruments"])}
        if instrument not in inst_to_idx:
            logger.error("Unknown instrument: %s. Must be one of %s", instrument, list(inst_to_idx))
            return None

        analysis_window = self._select_inference_window(audio_block)
        signal_metrics = self._signal_metrics(analysis_window)
        warnings = self._quality_warnings(signal_metrics)

        if not signal_metrics["usable"]:
            self.reset_smoothing(instrument)
            lookback_sec = len(audio_block) / float(self._metadata["sr"])
            logger.warning(
                "EQ v3 prediction skipped for %s: no usable signal found in %.2fs of audio. "
                "Returning flat recommendation.",
                instrument,
                lookback_sec,
            )
            quality = self._quality_payload(signal_metrics, warnings, smoothed=False)
            return EQPrediction(self._flat_params(), instrument, 0.0, self._metadata["eq_bands"], quality)

        features = self._extract_rta_features(analysis_window)
        features_scaled = self._scaler.transform_one(features)
        x = torch.from_numpy(features_scaled).float().view(1, -1)
        inst_tensor = torch.tensor([inst_to_idx[instrument]], dtype=torch.long)

        t0 = time.perf_counter()
        with torch.no_grad():
            output = self._model(x, inst_tensor)
        elapsed_ms = (time.perf_counter() - t0) * 1000

        if isinstance(output, (tuple, list)):
            output = output[-1]
        pred_norm = output.detach().cpu().squeeze(0).numpy()
        params_np = self._normalized_to_params(pred_norm)
        params_np, smoothed = self._smooth_params(instrument, params_np)
        quality = self._quality_payload(signal_metrics, warnings, smoothed=smoothed)
        prediction = EQPrediction(params_np, instrument, elapsed_ms, self._metadata["eq_bands"], quality)

        band_summary = ", ".join(
            (
                f"{band['name']}={band['type']} {band['gain']:+.2f}dB "
                f"@ {band['frequency']:.1f}Hz Q={band['q']:.2f}"
            )
            if band["enabled"]
            else f"{band['name']}=off"
            for band in prediction.bands
        )
        logger.info(
            "EQ v3 prediction for %s: inference=%.2fms | %s",
            instrument,
            elapsed_ms,
            band_summary,
        )
        return prediction

    def _select_inference_window(self, audio_block: np.ndarray) -> np.ndarray:
        return self._crop_or_pad(
            np.asarray(audio_block, dtype=np.float32),
            int(self._metadata["window_size"]),
        )

    def _load_checkpoint_model(self, path: Path) -> nn.Module:
        checkpoint = torch.load(str(path), map_location=self._device, weights_only=True)
        if not isinstance(checkpoint, dict):
            raise TypeError(f"Expected checkpoint dict, got {type(checkpoint).__name__}")

        state_dict = checkpoint.get("model_state_dict", checkpoint)
        if not isinstance(state_dict, dict):
            raise TypeError("Checkpoint does not contain a valid model_state_dict.")

        metadata = dict(DEFAULT_METADATA)
        for key in (
            "feature_dim",
            "n_instruments",
            "n_eq_params",
            "instruments",
            "eq_bands",
            "sr",
            "window_size",
            "fft_size",
            "n_rta_bins",
            "feature_fmin",
            "feature_fmax",
            "max_gain_db",
            "q_min",
            "q_max",
        ):
            if key in checkpoint:
                metadata[key] = checkpoint[key]
        self._metadata = metadata

        model = EQParamPredictor(
            feature_dim=int(metadata["feature_dim"]),
            n_instruments=int(metadata["n_instruments"]),
            out_dim=int(metadata["n_eq_params"]),
        ).to(self._device)
        model.load_state_dict(state_dict)
        return model

    def _load_metadata_from_json(self, path: Path) -> None:
        metadata = dict(DEFAULT_METADATA)
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                metadata.update(json.load(f))
            logger.info("Loaded IMS model config from %s", path)
        else:
            logger.warning("IMS model config not found at %s. Using v3 defaults.", path)
        self._metadata = metadata

    def _extract_rta_features(self, y: np.ndarray) -> np.ndarray:
        y = self._crop_or_pad(np.asarray(y, dtype=np.float32), int(self._metadata["window_size"]))
        y = self._normalize_for_features(y)

        fft_size = int(self._metadata["fft_size"])
        sr = int(self._metadata["sr"])
        n_rta_bins = int(self._metadata["n_rta_bins"])
        edges = np.geomspace(
            float(self._metadata["feature_fmin"]),
            float(self._metadata["feature_fmax"]),
            n_rta_bins + 1,
        )

        window = np.hanning(len(y)).astype(np.float32)
        spectrum = np.abs(np.fft.rfft(y * window, n=fft_size)).astype(np.float32) + EPS
        freqs = np.fft.rfftfreq(fft_size, d=1.0 / sr).astype(np.float32)

        band_values = []
        for lo, hi in zip(edges[:-1], edges[1:]):
            mask = (freqs >= lo) & (freqs < hi)
            if mask.any():
                val = np.sqrt(np.mean(np.square(spectrum[mask])))
            else:
                val = EPS
            band_values.append(20.0 * np.log10(float(val) + EPS))

        band_values_arr = np.asarray(band_values, dtype=np.float32)
        band_shape = band_values_arr - np.median(band_values_arr)
        band_shape = np.clip(band_shape, -60.0, 60.0)

        centroid, bandwidth, flatness, zcr = self._spectral_extras(y, sr)
        extra = np.array(
            [
                self._dbfs_from_rms(y) / 60.0,
                self._dbfs_from_peak(y) / 60.0,
                centroid,
                bandwidth,
                flatness,
                zcr,
            ],
            dtype=np.float32,
        )
        return np.concatenate([band_shape.astype(np.float32), extra]).astype(np.float32)

    def _crop_or_pad(self, y: np.ndarray, length: int) -> np.ndarray:
        if len(y) == length:
            return y.astype(np.float32)
        if len(y) < length:
            pad_total = length - len(y)
            left = pad_total // 2
            right = pad_total - left
            return np.pad(y, (left, right)).astype(np.float32)

        frame = min(1024, len(y))
        hop = max(1, frame // 2)
        starts = range(0, len(y) - frame + 1, hop)
        energies = [float(np.mean(y[start : start + frame] ** 2)) for start in starts]
        best = int(np.argmax(energies)) if energies else 0
        center = best * hop + frame // 2
        start = max(0, min(center - length // 2, len(y) - length))
        return y[start : start + length].astype(np.float32)

    def _normalize_for_features(self, y: np.ndarray) -> np.ndarray:
        if len(y) == 0:
            return y.astype(np.float32)
        target = 10.0 ** (float(self._metadata["target_rms_dbfs"]) / 20.0)
        z = y * (target / (self._rms(y) + EPS))
        peak = float(np.max(np.abs(z))) + EPS
        max_allowed_peak = float(self._metadata["max_allowed_peak"])
        if peak > max_allowed_peak:
            z = z * (max_allowed_peak / peak)
        return z.astype(np.float32)

    def _spectral_extras(self, y: np.ndarray, sr: int) -> tuple[float, float, float, float]:
        if len(y) == 0:
            return 0.0, 0.0, 0.0, 0.0

        n_fft = 2048
        hop = 512
        padded = np.pad(y.astype(np.float32), (n_fft // 2, n_fft // 2))
        starts = range(0, max(1, len(padded) - n_fft + 1), hop)
        window = np.hanning(n_fft).astype(np.float32)
        freqs = np.fft.rfftfreq(n_fft, d=1.0 / sr).astype(np.float32)

        centroids = []
        bandwidths = []
        flatnesses = []
        zcrs = []
        for start in starts:
            frame = padded[start : start + n_fft]
            if len(frame) < n_fft:
                frame = np.pad(frame, (0, n_fft - len(frame)))

            mag = np.abs(np.fft.rfft(frame * window, n=n_fft)).astype(np.float32) + EPS
            mag_sum = float(np.sum(mag)) + EPS
            centroid_hz = float(np.sum(freqs * mag) / mag_sum)
            bandwidth_hz = float(np.sqrt(np.sum(((freqs - centroid_hz) ** 2) * mag) / mag_sum))
            flatness = float(np.exp(np.mean(np.log(mag))) / (np.mean(mag) + EPS))
            signs = np.signbit(frame)
            zcr = float(np.mean(signs[1:] != signs[:-1])) if len(signs) > 1 else 0.0

            centroids.append(centroid_hz)
            bandwidths.append(bandwidth_hz)
            flatnesses.append(flatness)
            zcrs.append(zcr)

        nyquist = sr / 2.0
        return (
            float(np.mean(centroids)) / nyquist,
            float(np.mean(bandwidths)) / nyquist,
            float(np.mean(flatnesses)),
            float(np.mean(zcrs)),
        )

    def _normalized_to_params(self, vec: np.ndarray) -> np.ndarray:
        eq_bands = self._metadata["eq_bands"]
        n_bands = len(eq_bands)
        vec = np.asarray(vec, dtype=np.float32).reshape(n_bands, 3)
        params = []

        for i, band in enumerate(eq_bands):
            gain_norm = float(np.clip(vec[i, 0], -1.0, 1.0))
            freq_norm = float(np.clip(vec[i, 1], -1.0, 1.0))
            q_norm = float(np.clip(vec[i, 2], -1.0, 1.0))

            gain_db = gain_norm * float(self._metadata["max_gain_db"])
            log_f = np.log(float(band["min_hz"])) + ((freq_norm + 1.0) / 2.0) * (
                np.log(float(band["max_hz"])) - np.log(float(band["min_hz"]))
            )
            log_q = np.log(float(self._metadata["q_min"])) + ((q_norm + 1.0) / 2.0) * (
                np.log(float(self._metadata["q_max"])) - np.log(float(self._metadata["q_min"]))
            )
            params.append([gain_db, float(np.exp(log_f)), float(np.exp(log_q))])

        return np.asarray(params, dtype=np.float32)

    def _flat_params(self) -> np.ndarray:
        params = []
        for band in self._metadata["eq_bands"]:
            params.append([0.0, float(band.get("init_hz", 1000.0)), 1.0])
        return np.asarray(params, dtype=np.float32)

    def _smooth_params(self, instrument: str, params: np.ndarray) -> tuple[np.ndarray, bool]:
        now = time.monotonic()
        previous = self._smoothed_params.get(instrument)
        previous_at = self._smoothed_at.get(instrument, 0.0)

        if (
            previous is None
            or previous.shape != params.shape
            or now - previous_at > PREDICTION_SMOOTHING_RESET_SEC
        ):
            self._smoothed_params[instrument] = params.copy()
            self._smoothed_at[instrument] = now
            return params, False

        alpha = PREDICTION_SMOOTHING_ALPHA
        smoothed = params.copy()
        smoothed[:, 0] = alpha * previous[:, 0] + (1.0 - alpha) * params[:, 0]

        for column in (1, 2):
            prev_log = np.log(np.maximum(previous[:, column], EPS))
            next_log = np.log(np.maximum(params[:, column], EPS))
            smoothed[:, column] = np.exp(alpha * prev_log + (1.0 - alpha) * next_log)

        self._smoothed_params[instrument] = smoothed.copy()
        self._smoothed_at[instrument] = now
        return smoothed.astype(np.float32), True

    def _signal_metrics(self, y: np.ndarray) -> Dict[str, Any]:
        audio = np.asarray(y, dtype=np.float32)
        if audio.size == 0:
            rms_db = -180.0
            peak_db = -180.0
        else:
            rms_db = self._dbfs_from_rms(audio)
            peak_db = self._dbfs_from_peak(audio)

        usable = bool(rms_db >= MIN_INFERENCE_RMS_DBFS or peak_db >= MIN_INFERENCE_PEAK_DBFS)
        return {
            "rms_dbfs": float(rms_db),
            "peak_dbfs": float(peak_db),
            "usable": usable,
        }

    def _quality_warnings(self, metrics: Dict[str, Any]) -> List[str]:
        warnings: List[str] = []

        if not bool(metrics["usable"]):
            warnings.append(
                "Input level is too low for a reliable EQ recommendation. "
                "Raise the RTA mic or preamp level, then analyze again."
            )
            return warnings

        if (
            float(metrics["rms_dbfs"]) < LOW_SIGNAL_WARNING_RMS_DBFS
            or float(metrics["peak_dbfs"]) < LOW_SIGNAL_WARNING_PEAK_DBFS
        ):
            warnings.append(
                "Input level is low, so EQ values may vary between captures."
            )

        if float(metrics["peak_dbfs"]) > CLIPPING_WARNING_PEAK_DBFS:
            warnings.append(
                "Input is close to clipping. Lower the preamp gain before trusting the EQ."
            )

        return warnings

    @staticmethod
    def _quality_payload(metrics: Dict[str, Any], warnings: List[str], smoothed: bool) -> Dict[str, Any]:
        return {
            "status": "warning" if warnings else "ok",
            "warnings": warnings,
            "usable": bool(metrics["usable"]),
            "rms_dbfs": round(float(metrics["rms_dbfs"]), 2),
            "peak_dbfs": round(float(metrics["peak_dbfs"]), 2),
            "smoothed": smoothed,
        }

    def _has_usable_signal(self, y: np.ndarray) -> bool:
        return bool(self._signal_metrics(y)["usable"])

    @staticmethod
    def _rms(x: np.ndarray) -> float:
        return float(np.sqrt(np.mean(np.square(x)) + EPS))

    def _dbfs_from_rms(self, x: np.ndarray) -> float:
        return 20.0 * np.log10(self._rms(x) + EPS)

    @staticmethod
    def _dbfs_from_peak(x: np.ndarray) -> float:
        return 20.0 * np.log10(float(np.max(np.abs(x))) + EPS)


ims_service = IMSInferenceService()
