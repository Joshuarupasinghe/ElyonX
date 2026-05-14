#!/usr/bin/env python3
"""
ElyonX – List Audio Devices
Run this FIRST to identify your Focusrite Scarlett device index.

Usage:
    python scripts/list_devices.py

Expected output:
    [2] Scarlett 2i2 USB  |  in:2  out:2  SR:44100  API:Windows WASAPI
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

try:
    import sounddevice as sd
except ImportError:
    print("ERROR: sounddevice not installed. Run: pip install sounddevice")
    sys.exit(1)

from typing import Any, Dict, cast

print("\n" + "=" * 65)
print("  ElyonX – Available Audio INPUT Devices")
print("=" * 65)

devices = sd.query_devices()
found_focusrite = False

for idx, dev in enumerate(devices):
    dev = cast(Dict[str, Any], dev)
    if int(dev.get("max_input_channels", 0)) > 0:
        hostapi = cast(Dict[str, Any], sd.query_hostapis(dev.get("hostapi", 0)))
        hostapi_name = hostapi.get("name", "")
        name = str(dev.get("name", ""))
        marker = "  ◄── FOCUSRITE" if ("scarlett" in name.lower() or "focusrite" in name.lower()) else ""
        if marker:
            found_focusrite = True
        print(
            f"  [{idx:2d}]  {name:<40}"
            f"  in:{int(dev.get('max_input_channels', 0))}  "
            f"SR:{int(dev.get('default_samplerate', 0))}  "
            f"API:{hostapi_name}"
            f"{marker}"
        )

if not found_focusrite:
    print("\n  ⚠  Focusrite Scarlett NOT detected.")
    print("     • Check USB cable is connected.")
    print("     • On Windows: install Focusrite ASIO driver.")
    print("     • On macOS: grant microphone permissions to Terminal.")

print("=" * 65)
print(f"\n  Default input device: [{sd.default.device[0]}]")
print()