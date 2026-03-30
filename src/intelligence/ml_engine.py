from dataclasses import dataclass
from typing import List, Dict, Any
import numpy as np



@dataclass
class MLAction:
    action_type: str
    params: Dict[str, Any]
    reason: str
    confidence: float


class MLRecommendationEngine:
    """ML-based engine that predicts EQ, compressor and gate parameters from RTA input.

    Expects features dict with keys: 'band_energies', 'spl_db', 'spectrum_freqs', 'spectrum_mag'
    """

    def __init__(self, model_path: str = None, device: str = 'cpu'):
        self.device = device
        self.band_names = ["sub", "low", "low_mid", "mid", "high_mid", "presence", "brilliance"]

        # Lazy import of torch and model to avoid import-time failures on systems
        # without a working torch install (common on some Windows setups).
        self.model = None
        try:
            import torch
            from src.ml.model import EQCompressorGateNet

            self.torch = torch
            self.model = EQCompressorGateNet().to(device)
            if model_path:
                try:
                    self.model.load_state_dict(torch.load(model_path, map_location=device))
                except Exception as e:
                    print(f"Failed loading model: {e}")
            self.model.eval()
        except Exception:
            # Torch not available or failed to initialize. Fall back to heuristic mode.
            self.model = None
            self.torch = None

    def _make_feature_vector(self, features: Dict) -> np.ndarray:
        band_energies = features.get('band_energies', {})
        spl_db = features.get('spl_db', -100.0)

        # compute centroid & crest if spectrum provided
        centroid = 0.0
        crest = 1.0
        if 'spectrum_freqs' in features and 'spectrum_mag' in features:
            freqs = features['spectrum_freqs']
            mag = features['spectrum_mag']
            if mag.sum() > 0:
                centroid = float((freqs * mag).sum() / mag.sum())

        # crest from band energies and SPL as fallback
        # We set crest to 1.0 when unknown to avoid extreme params

        feat = np.array([
            band_energies.get('sub', 0.0),
            band_energies.get('low', 0.0),
            band_energies.get('low_mid', 0.0),
            band_energies.get('mid', 0.0),
            band_energies.get('high_mid', 0.0),
            band_energies.get('presence', 0.0),
            band_energies.get('brilliance', 0.0),
            spl_db,
            centroid,
            crest
        ], dtype=np.float32).reshape(1, -1)

        return feat

    def analyze(self, features: Dict) -> List[MLAction]:
        # If model is available, use it. Otherwise fall back to heuristics similar
        # to the original rule-based engine so the GUI remains functional.
        actions: List[MLAction] = []

        if self.model is not None and self.torch is not None:
            feat = self._make_feature_vector(features)
            X = self.torch.FloatTensor(feat).to(self.device)
            with self.torch.no_grad():
                out = self.model(X).cpu().numpy()[0]

            # EQ outputs
            eq_out = out[:7]
            for i, band in enumerate(self.band_names):
                val = float(eq_out[i])
                if abs(val) < 0.5:
                    continue
                action = MLAction(
                    action_type=('EQ_BOOST' if val > 0 else 'EQ_CUT'),
                    params={'band': band, 'db': round(val, 1)},
                    reason='ML predicted EQ adjustment for kick',
                    confidence=min(abs(val) / 6.0, 1.0)
                )
                actions.append(action)

            # Compressor outputs
            comp = out[7:12]
            comp_params = {
                'threshold_db': float(comp[0]),
                'ratio': float(comp[1]),
                'attack_ms': float(comp[2]),
                'release_ms': float(comp[3]),
                'makeup_db': float(comp[4])
            }
            comp_conf = min(max(abs(comp[1]) / 8.0, 0.0), 1.0)
            actions.append(MLAction('COMPRESSION', comp_params, 'ML predicted compressor settings', comp_conf))

            # Gate outputs
            gate = out[12:15]
            gate_params = {
                'threshold_db': float(gate[0]),
                'hold_ms': float(gate[1]),
                'release_ms': float(gate[2])
            }
            gate_conf = 0.8 if gate_params['threshold_db'] < -30.0 else 0.6
            actions.append(MLAction('GATE', gate_params, 'ML predicted gate settings', gate_conf))

            return actions

        # Heuristic fallback
        # Use analyzer 'issues' and band energies to suggest simple actions
        issues = features.get('issues', {})
        spl_db = features.get('spl_db', -100.0)
        band_energies = features.get('band_energies', {})

        mud_sev = issues.get('muddiness', 0.0)
        if mud_sev > 0.4:
            actions.append(MLAction('EQ_CUT', {'band': 'low_mid', 'db': -2.0}, 'Heuristic: muddiness', 0.6))

        harsh_sev = issues.get('harshness', 0.0)
        if harsh_sev > 0.4:
            actions.append(MLAction('EQ_CUT', {'band': 'high_mid', 'db': -2.0}, 'Heuristic: harshness', 0.6))

        if spl_db > -6.0:
            actions.append(MLAction('FADER', {'target': 'MASTER', 'db': -2.0}, 'Heuristic: levels peaking', 0.9))

        return actions
