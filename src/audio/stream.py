import numpy as np
import sounddevice as sd
import threading
from collections import deque
from src.utils.config import SAMPLE_RATE, BLOCK_SIZE, CHANNELS, BUFFER_DURATION_SEC

class AudioInputStream:
    def __init__(self, device_index=None):
        self.device_index = device_index
        self.sample_rate = SAMPLE_RATE
        self.block_size = BLOCK_SIZE
        self.channels = CHANNELS
        
        # Ring buffer to hold audio data
        # We calculate max length based on duration / block_duration
        # Alternatively, we can just store raw samples in a large numpy array, 
        # but a deque of blocks is easier for the callback to push to.
        # Let's use a numpy-based ring buffer for contiguous reads which is better for FFT.
        
        self.buffer_size = int(SAMPLE_RATE * BUFFER_DURATION_SEC)
        self.audio_buffer = np.zeros(self.buffer_size, dtype=np.float32)
        self.write_index = 0
        self.lock = threading.Lock()
        
        self.stream = None
        self.running = False
        self.latest_rms = 0.0

    def _audio_callback(self, indata, frames, time, status):
        if status:
            print(f"Audio Status: {status}")
            
        # indata is shape (frames, channels)
        data = indata[:, 0]  # Take first channel
        
        # Simple RMS calculation for extremely fast feedback (optional)
        self.latest_rms = np.sqrt(np.mean(data**2))

        with self.lock:
            # Write to ring buffer
            # Handle wrapping if data goes past the end
            end_index = self.write_index + frames
            
            if end_index <= self.buffer_size:
                self.audio_buffer[self.write_index:end_index] = data
            else:
                # Split write
                first_part_len = self.buffer_size - self.write_index
                self.audio_buffer[self.write_index:] = data[:first_part_len]
                
                remaining_len = frames - first_part_len
                self.audio_buffer[:remaining_len] = data[first_part_len:]
                
            self.write_index = (self.write_index + frames) % self.buffer_size

    def start(self):
        if self.running:
            return
            
        print(f"Starting Audio Stream: Rate={self.sample_rate}, Block={self.block_size}")
        try:
            self.stream = sd.InputStream(
                samplerate=self.sample_rate,
                blocksize=self.block_size,
                channels=self.channels,
                device=self.device_index,
                callback=self._audio_callback
            )
            self.stream.start()
            self.running = True
        except Exception as e:
            print(f"Error starting audio stream: {e}")
            raise

    def stop(self):
        if not self.running:
            return
            
        if self.stream:
            self.stream.stop()
            self.stream.close()
            self.stream = None
            
        self.running = False
        print("Audio Stream Stopped")

    def read(self, num_samples):
        """
        Read the *latest* num_samples from the buffer.
        Returns a numpy array of shape (num_samples,).
        """
        with self.lock:
            if num_samples > self.buffer_size:
                raise ValueError("Requested samples exceed buffer size")

            # Validate enough data exists? 
            # In a ring buffer, we assume it's always 'full' of zeros initially.
            
            # Read backwards from write_index
            start_index = self.write_index - num_samples
            
            if start_index >= 0:
                return self.audio_buffer[start_index:self.write_index].copy()
            else:
                # Wrap around
                # e.g. write_index=100, num=150. start=-50.
                # return buffer[-50:] + buffer[0:100]
                part1 = self.audio_buffer[start_index:] # -50 to end
                part2 = self.audio_buffer[:self.write_index]
                return np.concatenate((part1, part2))

if __name__ == "__main__":
    # Quick Test
    import time
    stream = AudioInputStream()
    stream.start()
    time.sleep(1)
    samples = stream.read(1024)
    print(f"Read {len(samples)} samples. Max: {np.max(samples):.4f}")
    stream.stop()
