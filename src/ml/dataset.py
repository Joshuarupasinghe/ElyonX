import os
import numpy as np
from scipy.io import wavfile
from pathlib import Path

from src.features.analyzer import AudioFeatureExtractor


class KickDataset:
    """Load and preprocess rock kick audio samples for training.

    Produces feature vectors and heuristic targets for EQ, compressor and gate.
    """

    def __init__(self, dataset_path, sample_rate=44100):
        self.dataset_path = dataset_path
        self.sample_rate = sample_rate
        self.extractor = AudioFeatureExtractor(sample_rate)
        self.samples = []
        self.features = []
        self.targets = []

    def load_samples(self):
        if not os.path.exists(self.dataset_path):
            print(f"Dataset path {self.dataset_path} not found")
            return

        for wav_file in Path(self.dataset_path).glob("**/*.wav"):
            try:
                sr, audio = wavfile.read(wav_file)
                if audio is None:
                    continue
                # Convert to mono
                if audio.ndim > 1:
                    audio = audio[:, 0]
                # Convert to float32 in -1..1 if needed
                if audio.dtype.kind != 'f':
                    # Assume int16 or int32
                    maxv = float(np.iinfo(audio.dtype).max)
                    audio = audio.astype(np.float32) / maxv

                self.samples.append(audio)
            except Exception as e:
                print(f"Error loading {wav_file}: {e}")

    def _compute_extra_features(self, freqs, fft_mag, audio):
        # Spectral centroid
        mag = fft_mag
        if mag.sum() > 0:
            centroid = float((freqs * mag).sum() / mag.sum())
        else:
            centroid = 0.0

        # Crest factor (peak / rms)
        rms = np.sqrt(np.mean(audio ** 2)) + 1e-12
        peak = np.max(np.abs(audio)) + 1e-12
        crest = float(peak / rms)

        return centroid, crest

    def extract_features_batch(self):
        for audio in self.samples:
            feats = self.extractor.process_block(audio)
            band_energies = feats['band_energies']
            freqs = feats['spectrum_freqs']
            fft_mag = feats['spectrum_mag']

            centroid, crest = self._compute_extra_features(freqs, fft_mag, audio)

            feature_vec = np.array([
                band_energies.get('sub', 0.0),
                band_energies.get('low', 0.0),
                band_energies.get('low_mid', 0.0),
                band_energies.get('mid', 0.0),
                band_energies.get('high_mid', 0.0),
                band_energies.get('presence', 0.0),
                band_energies.get('brilliance', 0.0),
                feats.get('spl_db', -100.0),
                centroid,
                crest
            ], dtype=np.float32)

            self.features.append(feature_vec)

    def generate_targets(self):
        # Create heuristic targets using dataset-wide normalization
        features_array = np.array(self.features)
        if features_array.size == 0:
            return

        # For EQ: target is to move each band toward mean energy
        mean_feats = np.mean(features_array, axis=0)

        for feat in features_array:
            # EQ targets (7 bands): convert energy delta to dB adjustments
            eq_delta = mean_feats[:7] - feat[:7]
            eq_db = np.clip(eq_delta * 20.0, -6.0, 6.0)  # map to +/-6 dB

            # Compressor heuristics
            spl_db = float(feat[7])
            crest = float(feat[9])

            # threshold: a bit below current SPL to reduce peaks
            comp_threshold = float(np.clip(spl_db - 8.0, -40.0, 0.0))
            # ratio: higher when crest is high (more transient)
            comp_ratio = float(np.clip(1.5 + (crest - 1.0) * 1.5, 1.5, 8.0))
            # attack/release (ms): faster attack for higher crest
            comp_attack = float(np.clip(2.0 if crest > 4.0 else 10.0, 1.0, 50.0))
            comp_release = float(np.clip(80.0 if crest > 3.0 else 180.0, 20.0, 500.0))
            # makeup: small positive gain to recover loudness
            comp_makeup = float(np.clip(( -comp_threshold ) * 0.05, -3.0, 6.0))

            # Gate heuristics
            rms = 10 ** (spl_db / 20.0) if spl_db > -100 else 0.0
            gate_threshold = float(np.clip(spl_db - 20.0, -80.0, -6.0))
            gate_hold = 40.0
            gate_release = 80.0

            target = np.concatenate([
                eq_db,  # 7
                np.array([comp_threshold, comp_ratio, comp_attack, comp_release, comp_makeup], dtype=np.float32),  # 5
                np.array([gate_threshold, gate_hold, gate_release], dtype=np.float32)  # 3
            ])

            self.targets.append(target)

    def get_dataset(self):
        return np.array(self.features, dtype=np.float32), np.array(self.targets, dtype=np.float32)
