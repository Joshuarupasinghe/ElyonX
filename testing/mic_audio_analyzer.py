import numpy as np
import sounddevice as sd
import matplotlib.pyplot as plt
from scipy.fft import rfft, rfftfreq
import threading

# -------------------------
# Audio parameters
# -------------------------
SAMPLE_RATE = 44100
BLOCK_SIZE = 1024
CHANNELS = 1

# Shared buffer
fft_data = np.zeros(BLOCK_SIZE // 2 + 1)
lock = threading.Lock()

# -------------------------
# Prepare plot (MAIN THREAD)
# -------------------------
plt.ion()
fig, ax = plt.subplots()

freqs = rfftfreq(BLOCK_SIZE, 1 / SAMPLE_RATE)
line, = ax.plot(freqs, fft_data)

ax.set_xscale("log")
ax.set_xlim(20, 20000)
ax.set_ylim(0, 50)
ax.set_xlabel("Frequency (Hz)")
ax.set_ylabel("Magnitude")
ax.set_title("Real-Time Frequency Spectrum (RTA)")
ax.grid(True)

# -------------------------
# Audio callback (NO GUI)
# -------------------------
def audio_callback(indata, frames, time, status):
    if status:
        print(status)

    audio = indata[:, 0]

    rms = np.sqrt(np.mean(audio**2))
    spl_db = 20 * np.log10(rms + 1e-10)

    fft_mag = np.abs(np.asarray(rfft(audio)))

    with lock:
        fft_data[:] = fft_mag

    print(f"RMS Level: {spl_db:.2f} dB")

# -------------------------
# Start audio stream
# -------------------------
with sd.InputStream(
    samplerate=SAMPLE_RATE,
    blocksize=BLOCK_SIZE,
    channels=CHANNELS,
    callback=audio_callback
):
    print("🎧 Listening... Press Ctrl+C to stop")

    while True:
        with lock:
            line.set_ydata(fft_data)

        fig.canvas.draw_idle()
        fig.canvas.flush_events()
        plt.pause(0.01)
