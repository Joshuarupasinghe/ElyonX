import asyncio
import json
import logging
from typing import Dict, Set
from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger("elyonx.ws_manager")

class ConnectionManager:
    def __init__(self) -> None:
        self._active_connections: Dict[str, WebSocket] = {}
        self.lock = asyncio.Lock()
        
    async def connect(self, websocket: WebSocket, client_id: str) -> None:
        await websocket.accept()
        async with self.lock:
            self._active_connections[client_id] = websocket
        logger.info("WS client connected: %s  (total=%d)", client_id, len(self._active_connections))
        
    async def disconnect(self, client_id: str) -> None:
        async with self.lock:
            self._active_connections.pop(client_id, None)
        logger.info("WS client disconnected: %s  (total=%d)", client_id, len(self._active_connections))
    
    async def broadcast(self, payload: dict) -> None:
        if not self._active_connections:
            return
        
        message = json.dumps(payload) # Convert the Python dict into a text message
        dead: Set[str] = set() # Track clients that failed to receive the message
        
        async with self.lock:
            clients = dict(self._active_connections)  # Make a copy to avoid issues during iteration
        
        for client_id, ws in clients.items():
            try:
                await ws.send_text(message)
            except Exception as e:
                logger.error("Failed to send message to client %s: %s", client_id, e)
                dead.add(client_id)
        
        if dead:
            async with self.lock:
                for client_id in dead:
                    self._active_connections.pop(client_id, None)
                logger.warning("Removed %d dead WS clients: %s", len(dead), ", ".join(dead))
                
    @property
    def active_connections(self) -> int:
        return len(self._active_connections)
    
    
ws_manager = ConnectionManager()