import os

# Audio Settings
SAMPLE_RATE = 44100
BLOCK_SIZE = 1024  # Size of each audio chunk processed
CHANNELS = 1
DEVICE_Index = None # None uses default device

# Analysis Settings
BUFFER_DURATION_SEC = 5 # Keep last 5 seconds in memory for analysis windows
ANALYSIS_WINDOW_MS = 100 # Window size for feature extraction
FFT_SIZE = 2048 # Frequency resolution

# Safety Logic
MAX_GAIN_CHANGE_DB = 6.0 # Maximum allowed gain change in one step
MIN_CONFIDENCE_THRESHOLD = 0.7 # ML confidence required to suggest changes

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG_DIR = os.path.join(BASE_DIR, "logs")
