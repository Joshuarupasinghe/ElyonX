import math

def rms(signal):
    return math.sqrt(sum(x**2 for x in signal) / len(signal))

audio = [0.1, -0.2, 0.3, -0.4]
print(rms(audio))
