"""Server-only OAuth token lifecycle. No credentials or upstream bodies enter logs."""
import asyncio
import time
import httpx
from datetime import datetime, timezone
from app.core.config import settings

lock = asyncio.Lock()
token = None
expires = 0.0
state = {"status": "not_configured", "checked_at": None, "transport": "REST polling", "streaming": False}


def configured():
    return bool(settings.OPENF1_TOKEN.get_secret_value() or (settings.OPENF1_USERNAME.get_secret_value() and settings.OPENF1_PASSWORD.get_secret_value()))


def record(status):
    state.update(status=status, checked_at=datetime.now(timezone.utc).isoformat())


async def headers(force=False):
    global token, expires
    if settings.OPENF1_TOKEN.get_secret_value():
        return {"Authorization": "Bearer " + settings.OPENF1_TOKEN.get_secret_value()}
    if not configured():
        return {}
    async with lock:
        if token and time.monotonic() < expires and not force:
            return {"Authorization": "Bearer " + token}
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.post("https://api.openf1.org/token", data={"username": settings.OPENF1_USERNAME.get_secret_value(), "password": settings.OPENF1_PASSWORD.get_secret_value()})
                response.raise_for_status()
                payload = response.json()
                value = payload["access_token"]
                duration = float(payload["expires_in"])
                if not isinstance(value, str) or not value or duration <= 0:
                    raise ValueError("Invalid token")
                token, expires = value, time.monotonic() + max(0, duration - 60)
                return {"Authorization": "Bearer " + token}
        except (httpx.HTTPError, ValueError, KeyError, TypeError):
            token, expires = None, 0
            record("authentication_failed")
            return {}


def health():
    return {**state, "configured": configured(), "status": ("unverified" if state["status"] == "not_configured" else state["status"]) if configured() else "not_configured", "historical_access": "independent", "message": "Live access requires provider credentials and recent session evidence. REST polling is active; MQTT integration remains unverified."}
