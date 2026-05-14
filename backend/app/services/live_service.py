import asyncio
import logging
from datetime import datetime
from app.websockets.manager import manager
from app.services import f1_service
from app.core.config import settings

logger = logging.getLogger(__name__)
_live_task: asyncio.Task | None = None


async def _live_loop():
    """Background loop that pushes live timing updates via WebSocket."""
    while True:
        try:
            session_info = await f1_service.get_current_session_info()
            if session_info and session_info.is_live:
                year = session_info.year
                rnd = session_info.round_number
                leaderboard = await f1_service.get_leaderboard(year, rnd)
                weather = await f1_service.get_weather(year, rnd)
                payload = {
                    "type": "live_update",
                    "timestamp": datetime.utcnow().isoformat(),
                    "session": session_info.model_dump(),
                    "leaderboard": [e.model_dump() for e in leaderboard],
                    "weather": weather.model_dump() if weather else None,
                }
                await manager.broadcast(payload, channel="live")
                logger.debug(f"Broadcast live update to {manager.count('live')} clients")
        except Exception as e:
            logger.error(f"Live loop error: {e}")

        await asyncio.sleep(settings.LIVE_DATA_REFRESH_SECONDS)


def start_live_service():
    global _live_task
    if _live_task is None or _live_task.done():
        _live_task = asyncio.create_task(_live_loop())
        logger.info("Live data service started")


def stop_live_service():
    global _live_task
    if _live_task and not _live_task.done():
        _live_task.cancel()
        logger.info("Live data service stopped")
