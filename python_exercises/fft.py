import numpy as np

signal = np.random.randn(1024)
fft = np.fft.rfft(signal)
magnitude = np.abs(fft)

print(magnitude[:10])
