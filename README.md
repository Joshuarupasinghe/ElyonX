<p align="center">
  <img src="https://img.shields.io/badge/Python-3.11-blue?logo=python&logoColor=white" alt="Python 3.11" />
  <img src="https://img.shields.io/badge/Node.js-18+-green?logo=node.js&logoColor=white" alt="Node.js 18+" />
  <img src="https://img.shields.io/badge/React_Native-0.82-61DAFB?logo=react&logoColor=white" alt="React Native 0.82" />
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/PyTorch-2.5-EE4C2C?logo=pytorch&logoColor=white" alt="PyTorch 2.5" />
  <img src="https://img.shields.io/badge/License-Academic-lightgrey" alt="License" />
</p>

# ElyonX: ML-Powered Intelligent Mixing System for Live Sound

**ElyonX** is a real-time, machine learning-powered **Intelligent Mixing System (IMS)** designed specifically for live front-of-house (FOH) sound engineering. While most intelligent audio tools are built for controlled studio or post-production workflows, ElyonX addresses the unpredictable acoustic dynamics of live performances. By continuously capturing venue sound through a Real-Time Analyzer (RTA) microphone, the system generates adaptive parametric equalization (EQ) recommendations to assist engineers, reduce operator fatigue, and make high-quality live sound more accessible for smaller venues.

---

## Table of Contents

- [Key Features](#key-features)
- [System Architecture & Tech Stack](#system-architecture--tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Hardware Prerequisites](#hardware-prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
  - [ML Model Setup](#ml-model-setup)
- [Backend Deep Dive](#backend-deep-dive)
  - [API Endpoints](#api-endpoints)
  - [WebSocket Telemetry Protocol](#websocket-telemetry-protocol)
  - [Audio Engine](#audio-engine)
  - [Feature Extraction Pipeline](#feature-extraction-pipeline)
  - [OSC Mixer Integration](#osc-mixer-integration)
  - [Authentication & Security](#authentication--security)
- [ML Model Deep Dive](#ml-model-deep-dive)
  - [Architecture](#architecture)
  - [Training Pipeline](#training-pipeline)
  - [Inference Pipeline](#inference-pipeline)
  - [EQ Band Definitions](#eq-band-definitions)
- [Frontend Deep Dive](#frontend-deep-dive)
  - [Screens & Navigation](#screens--navigation)
  - [Component Library](#component-library)
  - [State Management](#state-management)
- [Environment Configuration](#environment-configuration)
- [Testing](#testing)
- [Performance Metrics](#performance-metrics)

---

## Key Features

- **Real-Time Acoustic Sensing** — Captures the combined output of the PA system and room reflections using an RTA microphone (e.g., Behringer ECM8000) routed through a low-latency audio interface.

- **Low-Latency Feature Extraction** — Utilizes a rolling ring buffer to extract spectral features via FFT, including Sound Pressure Level (SPL), 7-band energy areas, and narrowband feedback-peak detection.

- **Machine Learning EQ Prediction** — Employs a PyTorch-based Causal Wave-U-Net regression model trained on 48 kHz datasets to predict optimal EQ adjustments. The model outputs 18 continuous parameters (gain, frequency, and Q) across six bands (Sub, Low, Low-mid, Mid, Presence, and Air) specifically for kick, snare, and hi-hat drum channels.

- **Digital Mixer Integration** — Communicates directly with digital consoles like the Behringer X32 and Midas M32 via Open Sound Control (OSC) over UDP, translating predictions into safe, protocol-specific commands.

- **Interactive Visual Dashboard** — Provides a React Native Windows application featuring a live EQ graph, RTA telemetry overlays, channel faders, and an "AI Assist" toggle that ensures the engineer retains full manual override control.

---

## System Architecture & Tech Stack

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ElyonX Frontend                              │
│   React Native Windows / Web  ·  TypeScript  ·  React Query         │
│   ┌────────────┐ ┌──────────┐ ┌────────────┐ ┌──────────────────┐   │
│   │ EQ Graph   │ │ RTA      │ │ Fader Bank │ │ Channel          │   │
│   │ + Overlay  │ │ Telemetry│ │ + Master   │ │ Selection        │   │
│   └─────┬──────┘ └────┬─────┘ └─────┬──────┘ └────────┬─────────┘   │
│         │ WebSocket    │             │  REST            │            │
│         └──────────────┴─────────────┴──────────────────┘            │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTP / WS
┌──────────────────────────────▼──────────────────────────────────────┐
│                        ElyonX Backend                               │
│   FastAPI  ·  Uvicorn  ·  Python 3.11                               │
│   ┌──────────────┐ ┌───────────────┐ ┌──────────────────────────┐   │
│   │ Audio Engine  │ │ IMS Inference │ │ X32 OSC Service          │   │
│   │ (sounddevice) │ │ (PyTorch v3)  │ │ (UDP / Open Sound Ctrl)  │   │
│   └──────┬───────┘ └───────┬───────┘ └────────────┬─────────────┘   │
│          │                 │                       │                 │
│   ┌──────▼───────┐  ┌─────▼────────┐   ┌─────────▼──────────┐      │
│   │ Feature      │  │ EQ Param     │   │ Behringer X32 /    │      │
│   │ Extractor    │  │ Predictor    │   │ Midas M32 Console  │      │
│   │ (FFT/RTA)    │  │ (NN Model)   │   │ (Network)          │      │
│   └──────────────┘  └──────────────┘   └────────────────────┘      │
└─────────────────────────────────────────────────────────────────────┘
```

| Component             | Technologies Utilized                                                                |
|-----------------------|--------------------------------------------------------------------------------------|
| **Frontend UI**       | React Native Windows, TypeScript, React Query, Vite, react-native-svg                |
| **Backend API**       | Python, FastAPI, WebSockets (for live telemetry), Uvicorn, Pydantic                  |
| **Audio Processing**  | NumPy, SciPy, sounddevice, ring buffer architecture                                  |
| **Machine Learning**  | PyTorch, scikit-learn, TorchScript, librosa (training)                               |
| **Mixer Integration** | Open Sound Control (OSC) over UDP, custom codec                                      |
| **Authentication**    | Google OAuth 2.0, JWT (python-jose), PBKDF2-HMAC-SHA256                              |
| **Database**          | MongoDB (motor async driver)                                                         |

---

## Project Structure

```
ElyonX/
├── elyonx-backend/                 # Python FastAPI backend
│   ├── app/
│   │   ├── api/v1/endpoints/       # REST & WebSocket endpoint handlers
│   │   │   ├── audio.py            #   Audio config, IMS analyze, EQ reset
│   │   │   ├── devices.py          #   Audio device listing & stream start/stop
│   │   │   ├── health.py           #   Health check endpoint
│   │   │   ├── mixer.py            #   X32 mixer control (fader, EQ, mute, solo)
│   │   │   ├── rta.py              #   WebSocket RTA telemetry stream
│   │   │   └── settings.py         #   Runtime settings management
│   │   ├── core/
│   │   │   ├── config.py           #   Pydantic-settings configuration
│   │   │   ├── logging_config.py   #   Logging setup
│   │   │   ├── security.py         #   JWT & password hashing utilities
│   │   │   └── ws_manager.py       #   WebSocket connection manager
│   │   ├── models/
│   │   │   └── user.py             #   MongoDB user document model
│   │   ├── routes/
│   │   │   └── auth.py             #   Auth routes (login, signup, Google OAuth)
│   │   ├── schemas/
│   │   │   ├── audio.py            #   Audio request/response schemas
│   │   │   └── auth.py             #   Auth request/response schemas
│   │   ├── services/
│   │   │   ├── audio_engine.py     #   Real-time audio capture & ring buffer
│   │   │   ├── device_service.py   #   Audio device enumeration
│   │   │   ├── feature_extractor.py#   FFT-based spectral feature extraction
│   │   │   ├── google_auth.py      #   Google OAuth 2.0 handshake
│   │   │   ├── ims_inference.py    #   v3 ML model loading & EQ prediction
│   │   │   ├── session_logger.py   #   RTA session telemetry logger
│   │   │   ├── user_service.py     #   User CRUD operations (MongoDB)
│   │   │   └── x32_osc.py          #   X32/M32 OSC protocol service
│   │   └── main.py                 #   FastAPI app factory & lifespan hooks
│   ├── scripts/
│   │   ├── list_devices.py         #   Utility: list audio input devices
│   │   └── probe_x32.py            #   Utility: probe X32 mixer over OSC
│   ├── tests/                      #   pytest test suite
│   ├── .env.example                #   Environment variable template
│   ├── requirements.txt            #   Production dependencies
│   ├── requirements-dev.txt        #   Dev/test dependencies (ruff, mypy, pytest-cov)
│   ├── pyproject.toml              #   Tool config (pytest, ruff, mypy, coverage)
│   └── run.py                      #   Uvicorn server entry point
│
├── elyonx-frontend/                # React Native Windows / Web frontend
│   ├── src/
│   │   ├── api/
│   │   │   └── backend.ts          #   Typed HTTP client for backend REST API
│   │   ├── auth/                   #   Auth module (login, signup, Google, tokens)
│   │   ├── backend/                #   Backend connection utilities
│   │   ├── components/
│   │   │   ├── ChannelSelection/   #   Channel list, add/edit channel modal
│   │   │   ├── Controls/           #   RotaryKnob, ToggleSwitch, VerticalFader
│   │   │   ├── Equalizer/          #   EQGraph, EQCurve, EQPoint, RTAOverlay
│   │   │   ├── FaderBank/          #   ChannelFader, FaderBank, MasterFader
│   │   │   ├── GlobalControls/     #   TopBar, BottomBar
│   │   │   └── common/             #   Shared UI primitives
│   │   ├── hooks/
│   │   │   └── UseRTATelemetry.ts  #   WebSocket hook for live RTA data
│   │   ├── osc/
│   │   │   ├── OscClient.ts        #   OSC message encoding/UDP transport
│   │   │   └── adapters/           #   Platform-specific UDP adapters
│   │   ├── screens/
│   │   │   ├── MixerScreen.tsx     #   Main mixing dashboard
│   │   │   ├── LoginScreen.tsx     #   Email/password + Google login
│   │   │   ├── SignUpScreen.tsx    #   New user registration
│   │   │   ├── AccountScreen.tsx   #   User profile/account management
│   │   │   └── SettingsPage.tsx    #   Backend, mixer & audio settings
│   │   ├── store/
│   │   │   └── types.ts            #   TypeScript types & interfaces
│   │   ├── theme/                  #   Design tokens, colors, typography
│   │   ├── types/                  #   Shared TypeScript type definitions
│   │   └── utils/                  #   Utility functions
│   ├── App.tsx                     #   Root component & navigation
│   ├── index.js                    #   React Native entry point
│   ├── index.web.tsx               #   Web entry point
│   ├── package.json                #   NPM dependencies & scripts
│   ├── tsconfig.json               #   TypeScript configuration
│   ├── vite.config.ts              #   Vite config for web builds
│   └── metro.config.js             #   Metro bundler config for React Native
│
├── elyonx-models/                  # ML model training, export & artifacts
│   ├── elyonx_eq_parameter_only_model_v3.py   # Full training pipeline
│   ├── elyonx_eq_param_predictor_v3.pth       # Trained model checkpoint
│   ├── feature_scaler.joblib                   # scikit-learn feature scaler
│   ├── export_model.py                         # TorchScript export script
│   └── exported/
│       ├── elyonx_eq_param_predictor_v3.pth          # Exported weights
│       ├── elyonx_eq_param_predictor_v3_scripted.pt  # TorchScript model
│       ├── elyonx_eq_param_predictor_v3_config.json  # Model metadata
│       └── elyonx_eq_param_predictor_v3_scaler.json  # Feature scaler (JSON)
│
├── helpers/                        # Data preparation utilities
│   ├── annotation-generator/       # Training data annotation tools
│   │   ├── kick/                   #   Kick drum annotation data
│   │   └── snare/                  #   Snare drum annotation data
│   ├── drum_shots.zip              # Raw drum sample dataset
│   └── prepare_shots_zip.py        # Dataset preparation script
│
└── .gitignore
```

---

## Getting Started

### Hardware Prerequisites

| Requirement                    | Details                                                         |
|--------------------------------|-----------------------------------------------------------------|
| **Operating System**           | Windows 10 or 11 (8 GB RAM minimum, 16 GB recommended)         |
| **Audio Interface**            | e.g., Focusrite Scarlett 2i2 (low-latency USB audio interface)  |
| **RTA Microphone**             | e.g., Behringer ECM8000 (flat frequency response measurement mic)|
| **Digital Mixer** *(optional)* | Behringer X32 or Midas M32 (connected via Ethernet/UDP)         |

### Backend Setup

```bash
# 1. Navigate to the backend directory
cd elyonx-backend

# 2. Create a Python 3.11 virtual environment
python -m venv .venv

# 3. Activate the environment
#    Windows (PowerShell):
.venv\Scripts\Activate.ps1
#    Windows (CMD):
.venv\Scripts\activate.bat

# 4. Install dependencies
pip install -r requirements.txt

# 5. Configure environment variables
#    Copy the template and fill in your values
cp .env.example .env
#    Edit .env with your Google OAuth credentials, JWT secret, MongoDB URI, etc.

# 6. Start the FastAPI server (development mode with auto-reload)
python run.py

# 7. For production mode (no auto-reload):
python run.py --prod
```

> **API Documentation:** Once running, interactive API docs are available at:
> - Swagger UI: [`http://localhost:8000/api/docs`](http://localhost:8000/api/docs)
> - ReDoc: [`http://localhost:8000/api/redoc`](http://localhost:8000/api/redoc)

### Frontend Setup

```bash
# 1. Navigate to the frontend directory
cd elyonx-frontend

# 2. Ensure Node.js 18+ is installed
node --version   # Should output v18.x.x or higher

# 3. Install dependencies
npm install

# 4. Start the React Native Metro bundler
npx react-native start

# 5. Launch the Windows application (in a separate terminal)
npm run windows

# --- Alternative: Run as a web application ---
npm run web
```

### ML Model Setup

The pre-trained v3 model checkpoint is already included in the repository at `elyonx-models/elyonx_eq_param_predictor_v3.pth`. The backend automatically loads it on startup.

To export the model to TorchScript format for optimized inference:

```bash
cd elyonx-models
python export_model.py
# Optional: specify custom paths
python export_model.py --weights elyonx_eq_param_predictor_v3.pth --output exported
```

To retrain the model from scratch (requires training data):

```bash
cd elyonx-models
python elyonx_eq_parameter_only_model_v3.py
```

> **Note:** Training requires GPU acceleration (CUDA) for reasonable performance and the drum sample dataset placed in the configured `DATA_ROOT` directory.

---

## Backend Deep Dive

### API Endpoints

| Method | Endpoint                               | Description                                      |
|--------|----------------------------------------|--------------------------------------------------|
| `GET`  | `/api/v1/health`                       | Health check                                     |
| `GET`  | `/api/v1/devices`                      | List available audio input devices                |
| `POST` | `/api/v1/devices/start`                | Start audio capture stream                        |
| `POST` | `/api/v1/devices/stop`                 | Stop audio capture stream                         |
| `GET`  | `/api/v1/audio/config`                 | Get current audio/RTA configuration               |
| `PATCH`| `/api/v1/audio/config`                 | Update runtime audio config (smoothing, FPS)      |
| `POST` | `/api/v1/audio/analyze`                | Run IMS ML inference on current audio             |
| `POST` | `/api/v1/audio/reset`                  | Reset EQ and clear cached predictions             |
| `WS`   | `/api/v1/rta/ws`                       | WebSocket for real-time RTA telemetry             |
| `GET`  | `/api/v1/mixer/status`                 | Get mixer connection status                       |
| `POST` | `/api/v1/mixer/connect`                | Connect to X32/M32 mixer via OSC                  |
| `POST` | `/api/v1/mixer/disconnect`             | Disconnect from mixer                             |
| `POST` | `/api/v1/mixer/channels`               | Register a frontend channel with the mixer        |
| `POST` | `/api/v1/mixer/channels/{ch}/fader`    | Set channel fader level                           |
| `POST` | `/api/v1/mixer/channels/{ch}/mute`     | Set channel mute state                            |
| `POST` | `/api/v1/mixer/channels/{ch}/solo`     | Set channel solo state                            |
| `POST` | `/api/v1/mixer/channels/{ch}/gain`     | Set channel trim/headamp gain                     |
| `POST` | `/api/v1/mixer/channels/{ch}/eq`       | Set one EQ band on a channel                      |
| `POST` | `/api/v1/mixer/master/fader`           | Set master stereo fader                           |
| `GET`  | `/api/v1/settings`                     | Get runtime settings                              |
| `PATCH`| `/api/v1/settings`                     | Update runtime settings                           |
| `POST` | `/auth/login`                          | Email/password login                              |
| `POST` | `/auth/signup`                         | New user registration                             |
| `GET`  | `/auth/google`                         | Initiate Google OAuth 2.0 flow                    |
| `GET`  | `/auth/google/callback`                | Google OAuth callback handler                     |
| `GET`  | `/auth/me`                             | Get current authenticated user                    |

### WebSocket Telemetry Protocol

The RTA WebSocket (`ws://localhost:8000/api/v1/rta/ws`) streams real-time spectral analysis data:

**Server → Client** (at ~60 FPS):
```json
{
  "event": "rta_frame",
  "timestamp_ms": 1697500000000,
  "processing_time_ms": 0.45,
  "rta": {
    "frequencies": [20.0, 23.4, "...", 20000.0],
    "magnitudes_db": [-60.2, -58.1, "...", -72.5]
  },
  "spl_dbfs": -28.5,
  "bands": [
    { "name": "Sub", "lo_hz": 20, "hi_hz": 60, "energy_db": -42.5 },
    { "name": "Bass", "lo_hz": 60, "hi_hz": 250, "energy_db": -35.2 }
  ],
  "imbalance": {
    "muddiness": 3.2,
    "harshness": -1.5,
    "thinness": 2.1,
    "brightness": -0.8,
    "average_db": -38.5
  },
  "feedback": {
    "alerts": [],
    "risk_level": "safe"
  }
}
```

**EQ Recommendation Event** (after `/api/v1/audio/analyze` is called):
```json
{
  "event": "eq_recommendation",
  "instrument": "kick",
  "inference_ms": 0.19,
  "bands": [
    { "id": 1, "name": "Sub", "type": "lowshelf", "gain": 2.5, "frequency": 65.0, "q": 0.85, "enabled": true },
    { "id": 2, "name": "Low", "type": "bell", "gain": -1.75, "frequency": 140.0, "q": 1.2, "enabled": true }
  ],
  "quality": {
    "status": "ok",
    "warnings": [],
    "usable": true,
    "rms_dbfs": -22.5,
    "peak_dbfs": -6.3,
    "smoothed": false
  }
}
```

### Audio Engine

The `AudioEngine` service manages real-time audio capture from the audio interface using `sounddevice`:

- **Ring Buffer Architecture** — A thread-safe circular buffer (10 blocks deep) decouples the audio callback thread from the async processing loop, preventing drops under load.
- **Lock-Free Callback** — The sounddevice callback writes to the ring buffer without heap allocation; it must never block or allocate memory.
- **Configurable Input** — Supports selection of specific audio devices by index or name substring matching (defaults to `Focusrite USB Audio`).
- **Sample Rate** — 48 kHz, block size of 256 samples (~5.3 ms per block).
- **Non-Destructive Audio History** — A secondary rolling window stores the last ~3 seconds of audio for IMS inference without draining the ring buffer.

### Feature Extraction Pipeline

The `FeatureExtractor` computes per-frame spectral features:

1. **FFT** — 2048-point Hanning-windowed FFT on each audio frame
2. **Exponential Smoothing** — Magnitude spectrum smoothed with configurable α (default 0.6)
3. **7-Band Energy** — Mean dBFS energy per perceptual band (Sub, Bass, Low-Mid, Mid, Upper-Mid, Presence, Air)
4. **Tonal Imbalance Descriptors** — Muddiness, harshness, thinness, brightness derived from band energies
5. **Feedback Detection** — Narrowband peak detection using `scipy.signal.find_peaks` to flag acoustic feedback
6. **RTA Output** — 512 logarithmically-spaced frequency bins for the frontend RTA display

### OSC Mixer Integration

The `X32OscService` communicates with Behringer X32 / Midas M32 digital mixers:

- **Protocol** — Open Sound Control (OSC) over UDP, port 10023
- **Full Codec** — Custom OSC message encoder/decoder supporting `int32`, `float32`, `string`, and `blob` types
- **Heartbeat** — Periodic `/xremote` keepalive messages to maintain connection (5-second interval)
- **Channel Control** — Fader, mute, solo, gain (trim/headamp), and 4-band parametric EQ
- **EQ Types** — Bell, low shelf, high shelf, high pass, low pass filter types
- **Connection Monitoring** — Staleness detection, latency tracking, and automatic reconnection
- **Channel Registration** — Frontend channels are mapped to physical mixer channels with instrument tagging

### Authentication & Security

- **Google OAuth 2.0** — Server-side flow with HMAC-signed CSRF state parameter
- **JWT Tokens** — HS256-signed access tokens with configurable expiry (default 7 days)
- **Password Hashing** — PBKDF2-HMAC-SHA256 with 260,000 iterations and random 16-byte salt
- **MongoDB User Store** — User profiles with Google OAuth linking and email/password support

---

## ML Model Deep Dive

### Architecture

The v3 EQ Parameter Predictor is a feedforward neural network with instrument embedding:

```
Input: Feature Vector (134-dim) + Instrument ID
                    │                    │
                    │         ┌──────────▼──────────┐
                    │         │ Instrument Embedding │
                    │         │     (3 → 16-dim)     │
                    │         └──────────┬──────────┘
                    │                    │
                    └──────┬─────────────┘
                           │ Concatenate (150-dim)
                    ┌──────▼──────┐
                    │  Linear 256 │ → LayerNorm → LeakyReLU(0.15) → Dropout(0.20)
                    │  Linear 192 │ → LayerNorm → LeakyReLU(0.15) → Dropout(0.15)
                    │  Linear 128 │ → LayerNorm → LeakyReLU(0.15) → Dropout(0.10)
                    │  Linear 18  │ → Tanh
                    └──────┬──────┘
                           │
                   Output: 18 normalized params
                   [gain, freq, Q] × 6 bands
```

### Training Pipeline

The training script (`elyonx_eq_parameter_only_model_v3.py`) implements:

1. **Data Loading** — Reads dry drum samples (kick, snare, hi-hat) at 48 kHz
2. **Audio Cleaning** — RMS gating, trimming, peak normalization, and decay-ratio filtering
3. **Auto-Labeling** — Automated parametric EQ fitting via least-squares optimization on spectral differences
4. **Room Augmentation** — Synthetic room impulse responses with early reflections, decay tails, spectral tilt, microphone bleed, and ambient noise
5. **Feature Engineering** — 128 log-spaced RTA bins + 6 spectral descriptors (RMS, peak, centroid, bandwidth, flatness, ZCR)
6. **Training** — Adam optimizer (lr=2e-4), MSE loss, early stopping (patience=45), max 500 epochs
7. **Export** — Saves `.pth` checkpoint, `feature_scaler.joblib`, and TorchScript `.pt`

**Hyperparameters:**

| Parameter              | Value      |
|------------------------|------------|
| Sample Rate            | 48,000 Hz  |
| Analysis Window        | 16,384 samples (~341 ms) |
| FFT Size               | 16,384     |
| RTA Feature Bins       | 128        |
| Feature Dimension      | 134        |
| EQ Bands               | 6          |
| Output Parameters      | 18         |
| Max Gain               | ±15 dB     |
| Q Range                | 0.3 – 10.0|
| Batch Size             | 16         |
| Train / Val / Test     | 70% / 15% / 15% |

### Inference Pipeline

1. **Audio Window Selection** — Extracts the most energetic 16,384-sample window from the rolling audio history
2. **Signal Quality Check** — Validates RMS (≥ −65 dBFS) and peak (≥ −50 dBFS) levels; returns flat EQ for insufficient signal
3. **RTA Feature Extraction** — 128 log-spaced RMS bands + spectral descriptors, normalized to target −18 dBFS RMS
4. **Feature Scaling** — StandardScaler transform using training-derived mean/variance
5. **Neural Inference** — Forward pass through the PyTorch model (CPU, ~0.19 ms)
6. **De-normalization** — Maps tanh outputs to physical gain (dB), frequency (Hz), and Q values using logarithmic scaling
7. **Temporal Smoothing** — Exponential moving average (α=0.65) across consecutive predictions for stability
8. **Practical Policy Clamping** — Per-instrument, per-band constraints enforce safe ranges (e.g., kick sub-bass ±5 dB, hi-hat high-pass filter)
9. **Active Band Limiting** — Limits concurrent active EQ changes (kick: 4 bands, snare/hihat: 5 bands)

### EQ Band Definitions

| Band      | Init Freq | Range           | Typical Use                      |
|-----------|-----------|-----------------|----------------------------------|
| **Sub**   | 65 Hz     | 35 – 110 Hz     | Sub-bass weight and rumble        |
| **Low**   | 140 Hz    | 80 – 260 Hz     | Bass body and punch               |
| **Low-mid**| 320 Hz   | 180 – 650 Hz    | Mud control, warmth               |
| **Mid**   | 900 Hz    | 500 – 1800 Hz   | Tone clarity, honk removal        |
| **Presence**| 3200 Hz | 1500 – 6000 Hz  | Attack, definition, presence      |
| **Air**   | 9000 Hz   | 5500 – 14000 Hz | Brilliance, shimmer, air          |

---

## Frontend Deep Dive

### Screens & Navigation

| Screen            | Description                                                                          |
|-------------------|--------------------------------------------------------------------------------------|
| **LoginScreen**   | Email/password login with Google OAuth sign-in option                                 |
| **SignUpScreen**  | New user registration with form validation                                           |
| **MixerScreen**   | Main mixing dashboard: EQ graph, RTA overlay, fader bank, channel list, AI assist    |
| **AccountScreen** | User profile management and session info                                             |
| **SettingsPage**  | Backend connection, mixer OSC, audio device, and EQ band mode configuration          |

### Component Library

**Equalizer Components:**
- `EQGraph` — Interactive parametric EQ visualization with draggable band points
- `EQCurve` — SVG-rendered composite EQ frequency response curve (biquad filters)
- `EQPoint` — Draggable control point for each EQ band (frequency, gain, Q)
- `RTAOverlay` — Real-time spectrum analyzer overlay on the EQ graph
- `EQBandPopup` — Detailed per-band editor with numeric inputs
- `EQGainFader` — Vertical gain slider for fine-tuning EQ band gain

**Fader Bank Components:**
- `FaderBank` — Multi-channel fader strip with per-channel controls
- `ChannelFader` — Individual channel fader with mute/solo buttons
- `MasterFader` — Main stereo output level fader

**Control Components:**
- `RotaryKnob` — Skeuomorphic rotary encoder for Q and pan controls
- `VerticalFader` — Precision vertical slider with dB scaling
- `ToggleSwitch` — On/off toggle for EQ enable, AI assist, etc.

**Global Controls:**
- `TopBar` — Application header with user info, settings, and connection indicators
- `BottomBar` — Status bar with stream status, SPL meter, and quick actions

**Channel Selection:**
- `ChannelList` — Scrollable list of registered mixer channels
- `ChannelItem` — Channel card showing name, instrument type, and status
- `AddChannelModal` — Dialog for registering new channels with instrument assignment
- `AddChannelButton` — Quick-add floating action button

### State Management

- **React Query** — Server state management for REST API calls with stale-time set to `Infinity` (OSC pushes handle updates)
- **WebSocket Hook (`UseRTATelemetry`)** — Custom hook managing the RTA WebSocket connection lifecycle, auto-reconnect, and frame parsing
- **Local Component State** — Channel EQ bands, fader positions, and UI selection state managed via `useState` / `useCallback`
- **Auth State** — Token persistence and session restoration via the auth module

---

## Environment Configuration

### Backend (`.env`)

Copy `.env.example` to `.env` and configure:

```env
# Application
APP_NAME=ElyonX IMS Backend
APP_VERSION=1.0.0
DEBUG=true
LOG_LEVEL=INFO

# Google OAuth 2.0
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback

# JWT Authentication
JWT_SECRET_KEY=<generate with: python -c "import secrets; print(secrets.token_hex(32))">
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=1440

# MongoDB
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=elyonx_ims

# Frontend Redirect (after OAuth)
FRONTEND_REDIRECT_URI=http://localhost:3000/auth/callback

# OAuth CSRF State
OAUTH_STATE_SECRET=<generate with: python -c "import secrets; print(secrets.token_hex(16))">

# CORS
# CORS_ORIGINS=["http://localhost:3000","http://localhost:8081"]
```

### Frontend (`.env`)

```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:8000
EXPO_PUBLIC_OSC_TARGET_IP=192.168.1.1
```

---

## Testing

### Backend Tests

```bash
cd elyonx-backend

# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test files
pytest tests/test_audio_engine.py
pytest tests/test_x32_osc.py
pytest tests/test_ims_inference.py
pytest tests/test_api_health.py
pytest tests/test_api_audio.py
pytest tests/test_mixer_api.py
pytest tests/test_auth_api.py
```

### Frontend Tests

```bash
cd elyonx-frontend

# Run unit tests
npm test

# Run with coverage
npm run test:coverage

# Run Windows-specific tests
npm run test:windows

# Run E2E tests (Windows, requires Appium)
npm run e2e:windows
```

### Code Quality

```bash
cd elyonx-backend

# Linting (Ruff)
ruff check .

# Type checking (mypy)
mypy app/

# Frontend linting
cd ../elyonx-frontend
npm run lint

# Frontend type checking
npm run typecheck
```

---

## Performance Metrics

| Metric                      | Value                | Target       |
|-----------------------------|----------------------|--------------|
| **System Latency (RTA)**    | 23.365 ms avg        | < 50 ms      |
| **Inference Speed**         | 0.19 ms per prediction | —          |
| **Inference Throughput**    | > 5,000 req/sec (CPU)| —            |
| **Sub-bass Accuracy**       | ~78%                 | —            |
| **Presence/Attack Accuracy**| ~80%                 | —            |
| **Directional Reliability** | 75–85%               | —            |
| **Audio Block Latency**     | ~5.3 ms @ 48 kHz     | —            |
| **RTA Telemetry FPS**       | Up to 60 FPS         | —            |

- **System Latency:** The real-time RTA telemetry path operates with an average latency of 23.365 ms, successfully remaining well below the 50 ms threshold required for live audio monitoring.
- **Inference Speed:** The model achieves an average prediction time of 0.19 ms per recommendation, yielding a throughput of over 5,000 recommendations per second on standard CPU environments.
- **Prediction Accuracy:** The ML model demonstrated ~78% accuracy for sub-bass correction and ~80% accuracy for presence/attack adjustments.
- **Directional Reliability:** For non-flat audio samples, the model correctly identified the necessary direction of the EQ change (boost vs. cut) 75–85% of the time.
