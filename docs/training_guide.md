# How to Train ElyonX for Specific Instruments

To balance a specific instrument (e.g., Kick Drum, Vocals, Guitar), we move beyond general "Muddiness detection" to **Target Spectrum Matching**. This involves capturing an "Ideal" reference signature and training the system to match live input to that target.

## The Logic: Spectrum Matching (EQ Matching)
Instead of a "Black Box" Neural Network, the most robust way to do this for live audio is **Comparative Analysis**:
`Correction_EQ = Target_Spectrum - Live_Spectrum`

## Step-by-Step Training Workflow

### Phase 1: Capture the "Gold Standard" (The Target)
You need to teach ElyonX what a "Good" instrument sounds like.

1.  **Source High-Quality Audio**: Find a reference track or stem of the instrument mixed perfectly (e.g., a professional live recording of a Kick Drum).
2.  **Ingest into ElyonX**:
    *   *Option A (File):* Load the `.wav` file into the analysis engine.
    *   *Option B (Live):* Play the track through the RTA mic (in a quiet room) or virtual loopback.
3.  **Generate Signature**:
    *   The system runs the FFT loop for ~10 seconds.
    *   It averages the energy across all frequency bands.
    *   **Save Output**: `profiles/kick_drum_ideal.json` (Stores normalized magnitude per band).

### Phase 2: Live Inference (The Mixing)
Now you are at the venue with the live band.

1.  **Solo the Instrument**: Ask the drummer to play just the Kick Drum.
2.  **Load Profile**: Select "Kick Drum" from the ElyonX GUI.
3.  **Real-Time Analysis**:
    *   ElyonX captures the *Live Room Sound* of the Kick.
    *   It compares `Live_Low_Mid` vs `Target_Low_Mid`.
4.  **Generate Parameters**:
    *   *Example:* Target has Low-Mid energy of **0.2**, Live has **0.5** (Muddy).
    *   *Difference:* +0.3 excess energy.
    *   *Action:* **CUT 250Hz by 4dB**.
5.  **Feedback**: The GUI displays "Reduce Low-Mids to match Target Profile".

## Code Implementation Strategy

To implement this, we need to extend `AudioFeatureExtractor` and `RecommendationEngine`.

### 1. Define the Profile Structure (JSON)
```json
{
  "instrument_name": "Kick Drum",
  "target_energies": {
    "sub": 0.8,
    "low": 0.9,
    "low_mid": 0.4,
    "mid": 0.3,
    "high_mid": 0.6,
    "presence": 0.4,
    "brilliance": 0.1
  }
}
```

### 2. Add "Capture Mode" to Feature Extractor
Create a function that accumulates spectral data over N frames and averages it.

### 3. Update Decision Engine
Add a new method `match_target(live_features, target_profile)`:
```python
def match_target(live_features, target_profile):
    actions = []
    for band, target_val in target_profile.items():
        live_val = live_features[band]
        delta = live_val - target_val
        
        if delta > threshold:
            actions.append(f"CUT {band} (Delta: {delta})")
        elif delta < -threshold:
            actions.append(f"BOOST {band}")
    return actions
```

## Summary
"Training" in this context is **Calibrating**. You define a Target, measure the Reality, and the Model calculates the Bridge between them.
