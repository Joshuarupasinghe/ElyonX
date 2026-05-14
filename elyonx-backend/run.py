#!/usr/bin/env python3
"""
ElyonX IMS – Server Entry Point
Starts the Uvicorn ASGI server.

Usage:
    python run.py                   # Development (auto-reload)
    python run.py --prod            # Production (no reload)
"""

import sys
import uvicorn

if __name__ == "__main__":
    prod = "--prod" in sys.argv

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=not prod,
        log_level="info",
        # Use uvloop on Linux/macOS for best WS performance
        loop="uvloop" if sys.platform != "win32" else "asyncio",
        ws_ping_interval=20,
        ws_ping_timeout=30,
    )