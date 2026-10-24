"""Exact-session media metadata. Display is opt-in pending third-party rights review."""
import unicodedata
from datetime import datetime
from cachetools import TTLCache
from app.services import history_service, openf1_service
from app.services.news_service import safe_url
from app.core.config import settings

cache = TTLCache(maxsize=100, ttl=3600)


def normalized(name):
    return " ".join(unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().casefold().split())


async def portrait(year, driver_id):
    key = (year, driver_id)
    if key in cache:
        return cache[key]
    result = {"year": year, "driver_id": driver_id, "url": None, "source": "OpenF1", "source_url": "https://openf1.org/docs/#drivers", "status": "unavailable", "session_key": None}
    if not settings.OPENF1_IMAGES_ENABLED:
        return {**result, "status": "media_not_enabled"}
    if year < 2023:
        return result
    races = await history_service.races(year, "results")
    candidates = sorted([r for r in races if any(e.Driver.driverId == driver_id for e in r.Results)], key=lambda r:r.round, reverse=True)
    if not candidates:
        return result
    race = candidates[0]
    driver = next(e for e in race.Results if e.Driver.driverId == driver_id)
    if not race.time:
        return result
    sessions = await openf1_service._get("/sessions", {"year": year, "session_name": "Race", "date_start": f"{race.date}T{race.time}"})
    stamp = datetime.fromisoformat(f"{race.date}T{race.time}".replace("Z", "+00:00"))
    exact = []
    for session in sessions or []:
        try:
            if session.get("year") == year and session.get("session_name") == "Race" and datetime.fromisoformat(session["date_start"].replace("Z", "+00:00")) == stamp:
                exact.append(session)
        except (KeyError, ValueError, TypeError):
            continue
    if len(exact) != 1:
        return result
    session_key = exact[0]["session_key"]
    rows = await openf1_service._get("/drivers", {"session_key": session_key, "driver_number": driver.number})
    matches = [d for d in rows or [] if d.get("session_key") == session_key and normalized(d.get("full_name", "")) == normalized(f"{driver.Driver.givenName} {driver.Driver.familyName}")]
    if len(matches) == 1:
        url = safe_url(matches[0].get("headshot_url"))
        result.update(url=url, status="available" if url else "unavailable", session_key=session_key)
    cache[key] = result
    return result
