import logging
import time
from typing import Dict, List, Optional

import numpy as np
from scipy.signal import find_peaks

from app.core.config import settings

logger = logging.getLogger("elyonx.feature_extractor")

class FeatureExtractor:
    def __init__(self) -> None:
        self._sr = settings.AUDIO_SAMPLE_RATE
        self._fft_size = settings.RTA_FFT_SIZE
        self._window = np.hanning(self._fft_size).astype(np.float32)
        self._alpha = settings.RTA_SMOOTHING_ALPHA
        
        self._freqs: np.ndarray = np.fft.rfftfreq(self._fft_size, 1 / self._sr)
        
        self._band_masks: List[np.ndarray] = []
        for lo, hi in settings.BAND_DEFINITIONS:
            mask = (self._freqs >= lo) & (self._freqs < hi)
            self._band_masks.append(mask)
        
        n_bins = len(self._freqs)
        self._smoothed_mag: np.ndarray = np.zeros(n_bins, dtype=np.float32)
        
        self._rta_indices = self._logarithmic_indices(n_bins, n_out=512)
        
    def extract(self, audio: np.ndarray) -> dict:
        t0 = time.monotonic()
        
        frame = self._prepare_frame(audio)
        
        spectrum = np.abs(np.fft.rfft(np.asarray(frame, dtype=np.float32) * self._window))
        spectrum = spectrum / (self._fft_size / 2.0)
        
        self._smoothed_mag = (
            self._alpha * self._smoothed_mag 
            + (1 - self._alpha) * spectrum
        )
        
        eps = 1e-10
        mag_db = 20.0 * np.log10(np.maximum(self._smoothed_mag, eps))
        
        rms = float(np.sqrt(np.mean(frame**2)))
        spl_dbfs = float(max(20.0 * np.log10(rms + eps) , settings.SPL_FLOOR_DBFS))
        
        bands =  self._compute_band_levels(mag_db)
        
        imbalance = self._compute_imbalance(bands)
        
        feedback_alerts = self._detect_feedback_peaks(mag_db)
        
        rta_magnitudes = mag_db[self._rta_indices].tolist()
        rta_frequencies = self._freqs[self._rta_indices].tolist()
        
        elapsed_ms = (time.monotonic() - t0) * 1000
        
        return {
            "event": "rta_frame",
            "timestamp_ms": int(time.time() * 1000),
            "processing_time_ms": round(elapsed_ms, 3),
            
            "rta": {
                "frequencies": rta_frequencies,
                "magnitudes_db": rta_magnitudes,
            },
            
            "spl_dbfs": round(spl_dbfs, 2),
            
            "bands": bands,
            
            "imbalance": imbalance,
            
            "feedback": {
                "alerts": feedback_alerts,
                "risk_level": self._risk_level(feedback_alerts),
            }
        }
        
    def _prepare_frame(self, audio: np.ndarray) -> np.ndarray:
        """Trim or zero-pad audio to exactly FFT size"""
        if len(audio) >= self._fft_size:
            return audio[: self._fft_size].astype(np.float32)
        padded = np.zeros(self._fft_size, dtype=np.float32)
        padded[: len(audio)] = audio
        return padded
    
    def _compute_band_levels(self, mag_db: np.ndarray) -> List[dict]:
        """
        Return mean dBFS energy per perceptual band.
        Matches Table 6 from the ElyonX interim report.
        """
        results = []
        for i, (name, mask) in enumerate(zip(settings.BAND_NAMES, self._band_masks)):
            if mask.any():
               energy = float(np.mean(mag_db[mask]))
            else:
               energy = settings.SPL_FLOOR_DBFS
            lo, hi = settings.BAND_DEFINITIONS[i]
            results.append({
                "name": name,
                "lo_hz": lo,
                "hi_hz": hi,
                "energy_db": round(energy, 2),
            })
        return results
    
    def _compute_imbalance(self, bands: List[dict]) -> dict:
        """
        Derive tonal imbalance descriptors from 7-band energy.
        These feed the ML decision engine and GUI warning indicators.
        """
        energy_map = {band["name"]: band["energy_db"] for band in bands}

        sub_bass_energy = energy_map.get("Sub", -80)
        bass_energy = energy_map.get("Bass", -80)
        low_mid_energy = energy_map.get("Low Mid", -80)
        mid_energy = energy_map.get("Mid", -80)
        presence_energy = energy_map.get("Presence", -80)
        air_energy = energy_map.get("Air", -80)
        
        avg_all = float(np.mean([b["energy_db"] for b in bands]))
        
        return {
            "muddiness":   round(float((low_mid_energy + bass_energy) / 2 - avg_all), 2),
            "harshness":   round(float(presence_energy - avg_all), 2),
            "thinness":    round(float(avg_all - (bass_energy + sub_bass_energy) / 2), 2),
            "brightness":  round(float((presence_energy + air_energy) / 2 - avg_all), 2),
            "average_db":  round(avg_all, 2),
        }
        
    def _detect_feedback_peaks(self, mag_db: np.ndarray) -> List[dict]:
        """
        Narrowband peak detector for acoustic feedback.
        Flags sharp peaks that exceed the mean spectrum by FEEDBACK_PEAK_THRESHOLD_DB.
        """
        mean_db = float(np.mean(mag_db))
        threshold = mean_db + settings.FEEDBACK_PEAK_THRESHOLD_DB

        peak_indices, properties = find_peaks(
            mag_db,
            height=threshold,
            width=settings.FEEDBACK_PEAK_WIDTH_BINS,
            prominence=6.0,
        )

        alerts = []
        for idx in peak_indices:
            freq = float(self._freqs[idx])
            # Only flag audible feedback range (80 Hz – 16 kHz)
            if 80.0 <= freq <= 16000.0:
                alerts.append({
                    "frequency_hz": round(freq, 1),
                    "magnitude_db": round(float(mag_db[idx]), 2),
                    "excess_db": round(float(mag_db[idx]) - mean_db, 2),
                })

        return alerts
    
    @staticmethod
    def _risk_level(alerts: List[dict]) -> str:
        if not alerts:
            return "safe"
        if len(alerts) == 1:
            return "warning"
        return "danger"
        
    @staticmethod
    def _logarithmic_indices(n_bins: int, n_out: int) -> np.ndarray:
        """
        Return n_out indices logarithmically spaced over [1, n_bins-1].
        Mimics how an RTA meter displays frequency on a log axis.
        """
        log_indices = np.unique(
            np.round(np.logspace(0, np.log10(n_bins - 1), n_out)).astype(int)
        )
        return np.clip(log_indices, 0, n_bins - 1)
