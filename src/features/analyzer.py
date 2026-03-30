import numpy as np
from scipy.fft import rfft, rfftfreq
from src.utils.config import SAMPLE_RATE, CHANNELS

class AudioFeatureExtractor:
    def __init__(self, sample_rate=SAMPLE_RATE):
        self.sample_rate = sample_rate
        
        # Frequency Band Definitions (Hz)
        self.bands_def = {
            "sub": (20, 60),
            "low": (60, 250),
            "low_mid": (250, 500), # Mud zone
            "mid": (500, 2000),
            "high_mid": (2000, 4000), # Harshness zone
            "presence": (4000, 6000),
            "brilliance": (6000, 20000)
        }

    def compute_spl(self, audio_data):
        """
        Compute Sound Pressure Level (SPL) approximation in dBFS.
        Real calibration requires a reference, here we assume -1.0 to 1.0 range.
        """
        # RMS calculation
        rms = np.sqrt(np.mean(audio_data**2))
        
        # Avoid log(0)
        if rms < 1e-10:
            return -100.0, 0.0
            
        db = 20 * np.log10(rms)
        return db, rms

    def compute_fft(self, audio_data):
        """
        Compute Real FFT.
        Returns: freqs, magnitudes (normalized)
        """
        n = len(audio_data)
        window = np.hanning(n)
        
        # Apply window to reduce spectral leakage
        fft_complex = rfft(audio_data * window)
        fft_mag = np.abs(fft_complex)
        
        # Normalize by window energy correction and length
        # Simple normalization: 2/N for peaks
        fft_mag = fft_mag * 2 / n
        
        freqs = rfftfreq(n, 1 / self.sample_rate)
        return freqs, fft_mag

    def compute_band_energies(self, freqs, fft_mag):
        """
        Integrate energy within defined frequency bands.
        """
        energies = {}
        
        for name, (f_min, f_max) in self.bands_def.items():
            # Find indices for this band
            idx = np.where((freqs >= f_min) & (freqs < f_max))[0]
            
            if len(idx) > 0:
                # Sum magnitude or power?
                # Power is mag^2. Let's use average magnitude for intuitive "level"
                avg_mag = np.mean(fft_mag[idx])
                energies[name] = avg_mag
            else:
                energies[name] = 0.0
                
        return energies

    def detect_spectral_balance(self, energies):
        """
        Identify potential issues based on band ratios.
        Returns: dict of issues with boolean flags and severity (0-1).
        """
        issues = {}
        
        # 1. Muddiness: Excess Low-Mid vs Low and Mid
        # Heuristic reference: Low-Mid shouldn't dominate Low/Mid significantly
        lm_val = energies.get("low_mid", 0)
        low_val = energies.get("low", 1e-6)
        mid_val = energies.get("mid", 1e-6)
        
        # Normalized Ratio
        mud_ratio = lm_val / ( (low_val + mid_val) / 2 + 1e-6 )
        
        if mud_ratio > 1.2: # Threshold tweaked experimentally
            issues["muddiness"] = min((mud_ratio - 1.2), 1.0) # Clip severity
        else:
            issues["muddiness"] = 0.0
            
        # 2. Harshness: Excess High-Mid (2k-4k)
        hm_val = energies.get("high_mid", 0)
        mid_ref = energies.get("mid", 1e-6)
        
        harsh_ratio = hm_val / (mid_ref + 1e-6)
        
        if harsh_ratio > 1.1:
            issues["harshness"] = min((harsh_ratio - 1.1), 1.0)
        else:
            issues["harshness"] = 0.0
            
        return issues

    def process_block(self, audio_data):
        """
        Main pipeline for a block of audio.
        """
        spl_db, rms = self.compute_spl(audio_data)
        freqs, fft_mag = self.compute_fft(audio_data)
        energies = self.compute_band_energies(freqs, fft_mag)
        issues = self.detect_spectral_balance(energies)
        
        return {
            "spl_db": spl_db,
            "rms": rms,
            "spectrum_freqs": freqs,
            "spectrum_mag": fft_mag,
            "band_energies": energies,
            "issues": issues
        }

if __name__ == "__main__":
    # Test with synthetic signal
    fs = 44100
    t = np.linspace(0, 1, fs)
    # Generate: 60Hz hum + 300Hz mud + 1000Hz signal
    sig = 0.5 * np.sin(2*np.pi * 60 * t) + \
          0.8 * np.sin(2*np.pi * 300 * t) + \
          0.3 * np.sin(2*np.pi * 1000 * t)
          
    extractor = AudioFeatureExtractor(fs)
    features = extractor.process_block(sig)
    
    print(f"SPL: {features['spl_db']:.2f} dB")
    print("Band Energies:", {k: f"{v:.4f}" for k, v in features['band_energies'].items()})
    print("Issues:", features['issues'])
