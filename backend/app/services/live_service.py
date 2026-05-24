"""
Live data broadcaster service.

Uses OpenF1 as primary live source. Broadcasts to WebSocket clients.
Polls every LIVE_DATA_REFRESH_SECONDS when a live session is active.
Falls back gracefully when no session is live (no fake LIVE states).
"""
import asyncio
import logging
from datetime import datetime, timezone
from app.websockets.manager import manager
from app.services import openf1_service
from app.core.config import settings

logger = logging.getLogger(__name__)
_live_task: asyncio.Task | None = None


async def _live_loop():
    """
    Central broadcast loop.

    - Checks session state via OpenF1 every cycle
    - If live: fetches full timing snapshot and broadcasts to 'live' channel
    - If not live: broadcasts a lightweight state-only packet (no fake timing data)
    - Never shows LIVE unless OpenF1 confirms an active session
    """
    last_state = None

    while True:
        try:
            state_info = await openf1_service.get_session_state()
            state = state_info.get("state", "ARCHIVE")
            is_live = state_info.get("is_live", False)

            if is_live and state_info.get("session_key"):
                # Fetch full live snapshot
                snapshot = await openf1_service.get_live_snapshot(state_info["session_key"])
                payload = {
                    "type": "live_update",
                    "state": state,
                    "is_live": True,
                    "session_info": {
                        "session_name": state_info.get("session_name"),
                        "display_name": state_info.get("display_name"),
                        "circuit": state_info.get("circuit"),
                        "country": state_info.get("country"),
                        "year": state_info.get("year"),
                        "track_status": state_info.get("track_status", "GREEN"),
                    },
                    **snapshot,
                }
                await manager.broadcast(payload, channel="live")
                logger.debug(f"[LiveBroadcast] {state} → {manager.count('live')} clients, {len(snapshot.get('leaderboard', []))} drivers")

            elif state in ("CHECKERED",):
                # Session just ended — broadcast once with no live data
                payload = {
                    "type": "session_state",
                    "state": state,
                    "is_live": False,
                    "session_info": {
                        "session_name": state_info.get("session_name"),
                        "display_name": state_info.get("display_name"),
                        "circuit": state_info.get("circuit"),
                        "country": state_info.get("country"),
                        "year": state_info.get("year"),
                        "track_status": "GREEN",
                    },
                    "leaderboard": [],
                    "weather": None,
                    "race_control": [],
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
                await manager.broadcast(payload, channel="live")

            elif state != last_state:
                # State changed (e.g. ARCHIVE → UPCOMING) — notify clients
                payload = {
                    "type": "session_state",
                    "state": state,
                    "is_live": False,
                    "session_info": {
                        "session_name": state_info.get("session_name"),
                        "display_name": state_info.get("display_name"),
                        "circuit": state_info.get("circuit"),
                        "country": state_info.get("country"),
                        "year": state_info.get("year"),
                        "track_status": "GREEN",
                    },
                    "leaderboard": [],
                    "weather": None,
                    "race_control": [],
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
                await manager.broadcast(payload, channel="live")

            last_state = state

        except Exception as e:
            logger.error(f"[LiveBroadcast] loop error: {e}")

        await asyncio.sleep(settings.LIVE_DATA_REFRESH_SECONDS)


def start_live_service():
    global _live_task
    if _live_task is None or _live_task.done():
        _live_task = asyncio.create_task(_live_loop())
        logger.info("Live broadcast service started (OpenF1 primary)")


def stop_live_service():
    global _live_task
    if _live_task and not _live_task.done():
        _live_task.cancel()
        logger.info("Live broadcast service stopped")
