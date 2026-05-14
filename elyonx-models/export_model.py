#!/usr/bin/env python3
"""
ElyonX IMS - v3 EQ parameter model exporter.

The v3 model is a parameter-only predictor. It accepts:
  1. scaled RTA feature vectors of shape (batch, 134)
  2. instrument ids of shape (batch,)

and returns one normalized EQ parameter vector of shape (batch, 18):
  [gain_norm, freq_norm, q_norm] x 6 bands.

Usage:
    python export_model.py
    python export_model.py --weights elyonx_eq_param_predictor_v3.pth --output exported
    python export_model.py --scaler feature_scaler.joblib
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path
from typing import Any, Dict, Iterable, Optional

import numpy as np
import torch
import torch.nn as nn


DEFAULT_INSTRUMENTS = ["kick", "snare", "hihat"]
DEFAULT_EQ_BANDS = [
    {"name": "Sub", "init_hz": 65.0, "min_hz": 35.0, "max_hz": 110.0},
    {"name": "Low", "init_hz": 140.0, "min_hz": 80.0, "max_hz": 260.0},
    {"name": "Low-mid", "init_hz": 320.0, "min_hz": 180.0, "max_hz": 650.0},
    {"name": "Mid", "init_hz": 900.0, "min_hz": 500.0, "max_hz": 1800.0},
    {"name": "Presence", "init_hz": 3200.0, "min_hz": 1500.0, "max_hz": 6000.0},
    {"name": "Air", "init_hz": 9000.0, "min_hz": 5500.0, "max_hz": 14000.0},
]

DEFAULT_SR = 48000
DEFAULT_WINDOW_SIZE = 16384
DEFAULT_FFT_SIZE = 16384
DEFAULT_N_RTA_BINS = 128
DEFAULT_FEATURE_FMIN = 30.0
DEFAULT_FEATURE_FMAX = 18000.0
DEFAULT_MAX_GAIN_DB = 15.0
DEFAULT_Q_MIN = 0.30
DEFAULT_Q_MAX = 10.0
DEFAULT_TARGET_RMS_DBFS = -18.0
DEFAULT_MAX_ALLOWED_PEAK = 0.98


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


def _load_checkpoint(weights_path: Path) -> Dict[str, Any]:
    checkpoint = torch.load(str(weights_path), map_location="cpu", weights_only=True)
    if not isinstance(checkpoint, dict):
        raise TypeError(f"Expected checkpoint dict, got {type(checkpoint).__name__}")
    return checkpoint


def _state_dict_from_checkpoint(checkpoint: Dict[str, Any]) -> Dict[str, torch.Tensor]:
    state_dict = checkpoint.get("model_state_dict", checkpoint)
    if not isinstance(state_dict, dict):
        raise TypeError("Checkpoint does not contain a valid model_state_dict.")
    return state_dict


def _infer_feature_dim(checkpoint: Dict[str, Any], state_dict: Dict[str, torch.Tensor]) -> int:
    if "feature_dim" in checkpoint:
        return int(checkpoint["feature_dim"])
    first_weight = state_dict.get("net.0.weight")
    if first_weight is None:
        raise KeyError("Cannot infer feature_dim: missing checkpoint['feature_dim'] and net.0.weight.")
    return int(first_weight.shape[1] - 16)


def _infer_out_dim(checkpoint: Dict[str, Any], state_dict: Dict[str, torch.Tensor]) -> int:
    if "n_eq_params" in checkpoint:
        return int(checkpoint["n_eq_params"])
    final_weight = state_dict.get("net.12.weight")
    if final_weight is None:
        raise KeyError("Cannot infer output dimension: missing checkpoint['n_eq_params'] and net.12.weight.")
    return int(final_weight.shape[0])


def _infer_n_instruments(checkpoint: Dict[str, Any], state_dict: Dict[str, torch.Tensor]) -> int:
    if "n_instruments" in checkpoint:
        return int(checkpoint["n_instruments"])
    embedding = state_dict.get("inst_embedding.weight")
    if embedding is None:
        raise KeyError(
            "Cannot infer instrument count: missing checkpoint['n_instruments'] "
            "and inst_embedding.weight."
        )
    return int(embedding.shape[0])


def _metadata_from_checkpoint(checkpoint: Dict[str, Any], state_dict: Dict[str, torch.Tensor]) -> Dict[str, Any]:
    feature_dim = _infer_feature_dim(checkpoint, state_dict)
    out_dim = _infer_out_dim(checkpoint, state_dict)
    n_instruments = _infer_n_instruments(checkpoint, state_dict)
    instruments = list(checkpoint.get("instruments", DEFAULT_INSTRUMENTS[:n_instruments]))
    eq_bands = list(checkpoint.get("eq_bands", DEFAULT_EQ_BANDS))

    return {
        "model_version": "v3",
        "model_type": "eq_param_predictor",
        "feature_dim": feature_dim,
        "n_instruments": n_instruments,
        "n_eq_params": out_dim,
        "instruments": instruments,
        "eq_bands": eq_bands,
        "sr": int(checkpoint.get("sr", DEFAULT_SR)),
        "window_size": int(checkpoint.get("window_size", DEFAULT_WINDOW_SIZE)),
        "fft_size": int(checkpoint.get("fft_size", DEFAULT_FFT_SIZE)),
        "n_rta_bins": int(checkpoint.get("n_rta_bins", DEFAULT_N_RTA_BINS)),
        "feature_fmin": float(checkpoint.get("feature_fmin", DEFAULT_FEATURE_FMIN)),
        "feature_fmax": float(checkpoint.get("feature_fmax", DEFAULT_FEATURE_FMAX)),
        "max_gain_db": float(checkpoint.get("max_gain_db", DEFAULT_MAX_GAIN_DB)),
        "q_min": float(checkpoint.get("q_min", DEFAULT_Q_MIN)),
        "q_max": float(checkpoint.get("q_max", DEFAULT_Q_MAX)),
        "target_rms_dbfs": DEFAULT_TARGET_RMS_DBFS,
        "max_allowed_peak": DEFAULT_MAX_ALLOWED_PEAK,
    }


def _as_float_list(values: Iterable[Any]) -> list[float]:
    return np.asarray(list(values), dtype=np.float32).tolist()


def _load_scaler(scaler_path: Optional[Path], feature_dim: int) -> Dict[str, Any]:
    if scaler_path is None or not scaler_path.exists():
        if scaler_path is not None:
            print(f"Scaler not found at {scaler_path}; exporting identity scaler.")
        else:
            print("No scaler supplied; exporting identity scaler.")
        return {
            "kind": "identity",
            "feature_mean": [0.0] * feature_dim,
            "feature_scale": [1.0] * feature_dim,
        }

    try:
        import joblib  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "Reading a .joblib scaler requires joblib. Install it or omit --scaler "
            "to export an identity scaler."
        ) from exc

    scaler = joblib.load(scaler_path)
    mean = getattr(scaler, "mean_", None)
    scale = getattr(scaler, "scale_", None)
    if mean is None or scale is None:
        raise TypeError(f"Scaler at {scaler_path} does not look like sklearn.preprocessing.StandardScaler.")

    mean_arr = np.asarray(mean, dtype=np.float32)
    scale_arr = np.asarray(scale, dtype=np.float32)
    if mean_arr.shape != (feature_dim,) or scale_arr.shape != (feature_dim,):
        raise ValueError(
            f"Scaler feature count mismatch: expected {feature_dim}, "
            f"got mean={mean_arr.shape}, scale={scale_arr.shape}."
        )

    scale_arr = np.where(scale_arr == 0.0, 1.0, scale_arr).astype(np.float32)
    return {
        "kind": "standard",
        "source": str(scaler_path),
        "feature_mean": _as_float_list(mean_arr),
        "feature_scale": _as_float_list(scale_arr),
    }


def export(weights_path: Path, output_dir: Path, scaler_path: Optional[Path] = None) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    device = torch.device("cpu")

    print(f"Loading v3 checkpoint: {weights_path}")
    checkpoint = _load_checkpoint(weights_path)
    state_dict = _state_dict_from_checkpoint(checkpoint)
    metadata = _metadata_from_checkpoint(checkpoint, state_dict)

    model = EQParamPredictor(
        feature_dim=int(metadata["feature_dim"]),
        n_instruments=int(metadata["n_instruments"]),
        out_dim=int(metadata["n_eq_params"]),
    ).to(device)
    model.load_state_dict(state_dict)
    model.eval()
    print(f"Model loaded. Parameters: {sum(p.numel() for p in model.parameters()):,}")

    print("\nExporting TorchScript (torch.jit.trace)...")
    example_features = torch.randn(1, int(metadata["feature_dim"]), dtype=torch.float32)
    example_inst = torch.zeros(1, dtype=torch.long)
    scripted = torch.jit.trace(model, (example_features, example_inst))

    scripted_path = output_dir / "elyonx_eq_param_predictor_v3_scripted.pt"
    scripted.save(str(scripted_path))
    print(f"  TorchScript saved: {scripted_path}")

    weights_out = output_dir / "elyonx_eq_param_predictor_v3.pth"
    torch.save(checkpoint, str(weights_out))
    print(f"  Checkpoint saved:  {weights_out}")

    config_path = output_dir / "elyonx_eq_param_predictor_v3_config.json"
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    print(f"  Config saved:      {config_path}")

    scaler_payload = _load_scaler(scaler_path, int(metadata["feature_dim"]))
    scaler_json_path = output_dir / "elyonx_eq_param_predictor_v3_scaler.json"
    with open(scaler_json_path, "w", encoding="utf-8") as f:
        json.dump(scaler_payload, f)
    print(f"  Scaler saved:      {scaler_json_path} ({scaler_payload['kind']})")

    print("\nVerifying TorchScript vs eager output...")
    for inst_idx, inst_name in enumerate(metadata["instruments"]):
        features = torch.randn(1, int(metadata["feature_dim"]), dtype=torch.float32)
        inst_tensor = torch.tensor([inst_idx], dtype=torch.long)
        with torch.no_grad():
            eager_params = model(features, inst_tensor)
            jit_params = scripted(features, inst_tensor)
        diff = (eager_params - jit_params).abs().max().item()
        status = "PASS" if diff < 1e-5 else "FAIL"
        print(f"  [{inst_name:>6}] max diff params={diff:.2e}  {status}")

    print("\nBenchmarking parameter inference latency (CPU)...")
    with torch.no_grad():
        for _ in range(50):
            scripted(example_features, example_inst)

    n_runs = 1000
    start = time.perf_counter()
    with torch.no_grad():
        for _ in range(n_runs):
            scripted(example_features, example_inst)
    elapsed = time.perf_counter() - start

    avg_ms = elapsed / n_runs * 1000.0
    analysis_window_ms = int(metadata["window_size"]) / int(metadata["sr"]) * 1000.0
    print(f"  Analysis window: {analysis_window_ms:.1f} ms")
    print(f"  Avg inference:   {avg_ms:.4f} ms")
    print(f"  RTF:             {avg_ms / analysis_window_ms:.6f}  {'PASS' if avg_ms < analysis_window_ms else 'FAIL'}")
    print(f"\nExport complete. Files in: {output_dir.resolve()}")


if __name__ == "__main__":
    here = Path(__file__).resolve().parent
    default_weights = here / "elyonx_eq_param_predictor_v3.pth"
    default_scaler = here / "feature_scaler.joblib"
    default_output = here / "exported"

    parser = argparse.ArgumentParser(description="Export ElyonX v3 EQ parameter predictor.")
    parser.add_argument(
        "--weights",
        type=str,
        default=str(default_weights),
        help="Path to the v3 .pth checkpoint.",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=str(default_output),
        help="Output directory for TorchScript, config, checkpoint copy, and scaler JSON.",
    )
    parser.add_argument(
        "--scaler",
        type=str,
        default=str(default_scaler) if default_scaler.exists() else None,
        help=(
            "Optional StandardScaler .joblib from training. If omitted or missing, "
            "an identity scaler JSON is exported."
        ),
    )
    args = parser.parse_args()

    scaler = Path(args.scaler) if args.scaler else None
    export(Path(args.weights), Path(args.output), scaler)
