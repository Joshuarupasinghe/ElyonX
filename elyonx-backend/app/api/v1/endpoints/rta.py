"""
ElyonX IMS – RTA WebSocket Endpoint
Upgrades an HTTP connection to a WebSocket and registers the client with
the ConnectionManager. All RTA telemetry frames are pushed from the
AudioEngine's process_loop() via ws_manager.broadcast().

WebSocket URL:  ws://<host>:<port>/api/v1/rta/ws

Protocol:
  Server → Client  (every ~50 ms):
    {
      "event": "rta_frame",
      "timestamp_ms": <unix ms>,
      "processing_time_ms": <float>,
      "rta": { "frequencies": [...], "magnitudes_db": [...] },
      "spl_dbfs": <float>,
      "bands": [ { "name": "Sub", "low_hz": 20, "high_hz": 60, "energy_db": -42.5 }, ... ],
      "imbalance": { "muddiness": ..., "harshness": ..., ... },
      "feedback": { "alerts": [...], "risk_level": "safe" }
    }

  Server → Client  (on connect, if stream not running):
    { "event": "stream_offline", "message": "Audio capture is not active." }

  Client → Server:
    Not expected at this stage. Reserved for future parameter pushback.
"""

import logging
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.ws_manager import ws_manager

logger = logging.getLogger("elyonx.api.rta")
router = APIRouter()


@router.websocket("/ws")
async def rta_websocket(websocket: WebSocket):
    """
    WebSocket endpoint for real-time RTA telemetry.
    Connects the React Native frontend to the live audio analysis stream.
    """
    client_id = str(uuid.uuid4())[:8]
    await ws_manager.connect(websocket, client_id)

    # Notify client if audio is not yet capturing
    engine = websocket.app.state.audio_engine
    if not engine.is_running:
        await websocket.send_json({
            "event": "stream_offline",
            "message": (
                "Audio capture is not active. "
                "POST /api/v1/devices/start to begin streaming."
            ),
        })

    try:
        # Keep connection alive; data is pushed via ws_manager.broadcast()
        while True:
            # We still need to drain incoming frames to detect disconnect
            data = await websocket.receive_text()
            # Future: handle client messages (e.g., parameter overrides)
            logger.debug("WS[%s] received: %s", client_id, data[:80])
    except WebSocketDisconnect:
        logger.info("WS[%s] cleanly disconnected.", client_id)
    except Exception as exc:
        logger.warning("WS[%s] unexpected error: %s", client_id, exc)
    finally:
        await ws_manager.disconnect(client_id)