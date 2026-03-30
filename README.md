# ElyonX — ML-powered Intelligent Mixing System

This repository contains ElyonX, an assistant for live FOH mixing. The system can be trained on single-instrument datasets (e.g., rock kick drums) to predict EQ, compressor and gate parameters from real-time RTA input.

## Quickstart — Train a kick model

1. Prepare dataset
   - Create directory: `data/kick_samples/` at the project root.
   - Add rock kick WAV files (mono or stereo; WAV PCM). Example paths:
     - `data/kick_samples/kick1.wav`
     - `data/kick_samples/session1/kicks/*.wav`

2. Install dependencies (use the project's venv)

```bash
# Activate your venv first (Windows example)
.
\venv\Scripts\Activate
python -m pip install -r requirements.txt
```

3. Train

```bash
python train_ml_model.py
```

The training script will produce `models/kick_eq_comp_gate.pth`.

## Usage in GUI

The GUI uses `MLRecommendationEngine` by default. If you have a trained model, place it at `models/kick_eq_comp_gate.pth` and update the engine initialization in `src/gui/main_window.py` like:

```python
from src.intelligence.ml_engine import MLRecommendationEngine
self.engine = MLRecommendationEngine(model_path='models/kick_eq_comp_gate.pth')
```

The GUI shows Real-Time Spectrum (RTA), waveform, indicators (SPL, mud, harsh), and recommended actions (EQ, COMPRESSION, GATE).

## Data layout

- `data/kick_samples/` — training WAV files
- `models/` — trained model artifacts (auto-created by the training script)

## Next steps and notes

- Replace heuristic target generation with ground-truth derived from multitrack stems (e.g., MedleyDB) for better model accuracy.
- Implement cross-adaptive features by extending the dataset features to include descriptors from other channels (MIMO).
- For live deployment, ensure models are causal and optimized for low-latency inference (RTNeural, ONNX, quantization).

If you want, I can wire the GUI to automatically load `models/kick_eq_comp_gate.pth` when present and start a small training run on available WAVs.
