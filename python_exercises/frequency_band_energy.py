import numpy as np

signal = np.random.randn(1024)
fft = np.fft.rfft(signal)
magnitude = np.abs(fft)

print(magnitude[:10])

def band_energy(fft_mag, sample_rate):
    freqs = np.fft.rfftfreq(len(fft_mag)*2 - 2, 1/sample_rate)

    low = fft_mag[(freqs >= 20) & (freqs < 250)].mean()
    mid = fft_mag[(freqs >= 250) & (freqs < 4000)].mean()
    high = fft_mag[freqs >= 4000].mean()

    return low, mid, high

low, mid, high = band_energy(magnitude, 48000)
print(low, mid, high)
