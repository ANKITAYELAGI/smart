# backend/websocket/manager.py
from fastapi import WebSocket
import logging

logger = logging.getLogger("websocket_manager")

class ConnectionManager:
    """Manages WebSocket connections and broadcasts messages to all active clients."""

    def __init__(self):
        # List of all currently connected websocket clients
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        """Accepts a new WebSocket connection."""
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"🟢 WebSocket connected ({len(self.active_connections)} clients)")

    def disconnect(self, websocket: WebSocket):
        """Removes a disconnected WebSocket."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"🔴 WebSocket disconnected ({len(self.active_connections)} clients)")

    async def broadcast(self, message: str):
        """Broadcasts a message to all active WebSocket clients."""
        logger.info(f"📡 Broadcasting message to {len(self.active_connections)} clients")
        for connection in list(self.active_connections):  # use copy to avoid runtime modification
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.warning(f"⚠️ Failed to send to a client: {e}")
                self.disconnect(connection)


# Shared instance for global import
manager = ConnectionManager()
