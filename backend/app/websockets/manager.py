"""
WebSocket connection manager.

Maintains channels of connected clients and broadcasts JSON payloads.
Handles stale connection cleanup automatically.
"""
import asyncio
import json
import logging
from typing import Dict, Set, Any
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        # channel -> set of WebSocket connections
        self._channels: Dict[str, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket, channel: str = "live"):
        await ws.accept()
        async with self._lock:
            if channel not in self._channels:
                self._channels[channel] = set()
            self._channels[channel].add(ws)
        logger.debug(f"WS connected to channel '{channel}' ({self.count(channel)} total)")

    async def disconnect(self, ws: WebSocket, channel: str = "live"):
        async with self._lock:
            ch = self._channels.get(channel, set())
            ch.discard(ws)
        logger.debug(f"WS disconnected from channel '{channel}' ({self.count(channel)} remaining)")

    def count(self, channel: str = "live") -> int:
        return len(self._channels.get(channel, set()))

    async def broadcast(self, payload: Any, channel: str = "live"):
        """Send JSON payload to all clients on a channel. Removes stale connections."""
        text = json.dumps(payload, default=str)
        stale: Set[WebSocket] = set()

        async with self._lock:
            clients = set(self._channels.get(channel, set()))

        for ws in clients:
            try:
                await ws.send_text(text)
            except Exception:
                stale.add(ws)

        if stale:
            async with self._lock:
                ch = self._channels.get(channel, set())
                for ws in stale:
                    ch.discard(ws)

    async def send_to(self, ws: WebSocket, payload: Any):
        """Send payload to a single client."""
        try:
            await ws.send_text(json.dumps(payload, default=str))
        except Exception as e:
            logger.warning(f"Failed to send to single WS client: {e}")


# Singleton used across the app
manager = ConnectionManager()
