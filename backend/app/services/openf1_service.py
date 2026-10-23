"""
OpenF1 Service — PRIMARY live data provider.

OpenF1 (https://openf1.org) provides real-time F1 data including:
timing, intervals, tyres, pit stops, race control, weather, track status.

This service is used ONLY for live/active sessions.
FastF1 is used ONLY for historical/archived sessions.

Session State Machine:
  UPCOMING     — weekend is in the future
  WEEKEND      — within the weekend window, between sessions
  FP1/FP2/FP3 — practice session active right now
  QUALIFYING   — qualifying session active right now
  SPRINT_Q     — sprint qualifying active
  SPRINT       — sprint race active
  RACE         — grand prix race active
  RED_FLAG     — session interrupted
  SC           — safety car deployed
  VSC          — virtual safety car
  CHECKERED    — session finished, within cooldown window
  ARCHIVE      — session completed, historical data only
"""
import httpx
import logging
import asyncio
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from cachetools import TTLCache

logger = logging.getLogger(__name__)

OPENF1_BASE = "https://api.openf1.org/v1"

# Short TTL caches for live data
_live_cache: TTLCache = TTLCache(maxsize=50, ttl=4)      # 4s — live timing
_session_cache: TTLCache = TTLCache(maxsize=10, ttl=30)  # 30s — session state
_medium_cache: TTLCache = TTLCache(maxsize=50, ttl=15)   # 15s — intervals/stints

# Track status code → human label
TRACK_STATUS_MAP = {
    "1": "GREEN",
    "2": "YELLOW",
    "3": "SC",        # Safety Car
    "4": "SC",
    "5": "RED",       # Red Flag
    "6": "VSC",       # Virtual Safety Car
    "7": "VSC",
}

# Session type → display label
SESSION_DISPLAY = {
    "Practice 1": "FP1",
    "Practice 2": "FP2",
    "Practice 3": "FP3",
    "Qualifying": "QUALIFYING",
    "Sprint Qualifying": "SPRINT Q",
    "Sprint": "SPRINT",
    "Race": "RACE",
}


async def _get(path: str, params: dict = None, timeout: float = 8.0) -> Any:
    from app.services import openf1_auth
    headers = await openf1_auth.headers()
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(f"{OPENF1_BASE}{path}", params=params or {}, headers=headers)
            if response.status_code == 401 and openf1_auth.configured():
                headers = await openf1_auth.headers(force=True)
                if headers:
                    response = await client.get(f"{OPENF1_BASE}{path}", params=params or {}, headers=headers)
            if response.status_code in (401, 403):
                openf1_auth.record("unauthorized")
                return None
            if response.status_code == 429:
                openf1_auth.record("rate_limited")
                return None
            response.raise_for_status()
            payload = response.json()
            if not isinstance(payload, list) or any(not isinstance(row, dict) for row in payload):
                raise ValueError("Invalid response")
            openf1_auth.record("available")
            return payload
    except (httpx.HTTPError, ValueError):
        openf1_auth.record("unavailable")
        logger.warning("OpenF1 request unavailable: %s", path)
        return None


async def get_latest_session() -> Optional[Dict]:
    """
    Fetch the latest session from OpenF1.
    Returns session dict or None if OpenF1 is unavailable.
    """
    cache_key = "openf1_latest_session"
    if cache_key in _session_cache:
        return _session_cache[cache_key]

    data = await _get("/sessions", {"session_key": "latest"})
    if not data or not isinstance(data, list) or len(data) == 0:
        return None

    session = data[-1]
    _session_cache[cache_key] = session
    return session


def classify_session(session, messages, authenticated, now=None, timing=None):
    """A scheduled time window is not proof of a live feed."""
    now = now or datetime.now(timezone.utc)
    result = {"state": "UNAVAILABLE", "is_live": False, "session": session,
              "session_key": session.get("session_key") if session else None,
              "session_name": (session or {}).get("session_name", "Unknown"),
              "display_name": (session or {}).get("session_name", "Unavailable"),
              "date_start": (session or {}).get("date_start"),
              "circuit": (session or {}).get("circuit_short_name"),
              "country": (session or {}).get("country_name"),
              "year": (session or {}).get("year"), "round": None, "track_status": "UNKNOWN"}
    if not session or not authenticated:
        return result
    if session.get("is_cancelled") is True:
        result["state"] = "CANCELLED"
        return result
    valid = []
    for message in messages:
        try:
            stamp = datetime.fromisoformat(message["date"].replace("Z", "+00:00"))
            if stamp.tzinfo and stamp <= now:
                valid.append((stamp, message))
        except (ValueError, KeyError, TypeError):
            continue
    valid.sort(key=lambda x: x[0], reverse=True)
    terminal = next((m for _, m in valid if any(word in m.get("message", "").upper() for word in ("SESSION ENDED", "SESSION FINISHED", "SESSION ABORTED", "SESSION CANCELLED"))), None)
    restarted = next((stamp for stamp,m in valid if "SESSION STARTED" in m.get("message", "").upper() or "SESSION RESUMED" in m.get("message", "").upper()), None)
    if terminal and (not restarted or datetime.fromisoformat(terminal["date"].replace("Z", "+00:00")) >= restarted):
        result["state"] = "COMPLETED" if "CANCELLED" not in terminal.get("message", "") else "CANCELLED"
        return result
    recent_timing = []
    for row in timing or []:
        try:
            stamp = datetime.fromisoformat(row["date"].replace("Z", "+00:00"))
            if stamp.tzinfo and stamp <= now:
                recent_timing.append(stamp)
        except (ValueError, KeyError, TypeError):
            continue
    newest_timing = max(recent_timing, default=None)
    control_fresh = valid and (now - valid[0][0]).total_seconds() <= 180
    timing_fresh = newest_timing and (now - newest_timing).total_seconds() <= 180
    if not control_fresh and not timing_fresh:
        result["state"] = "STALE"
        return result
    evidence = max([s for s in [valid[0][0] if control_fresh else None, newest_timing if timing_fresh else None] if s])
    result.update(is_live=True, state=SESSION_DISPLAY.get(session.get("session_name"), "LIVE"), observed_at=evidence.isoformat())
    flags = [m.get("flag") for _,m in valid if m.get("scope") == "Track" and m.get("flag")]
    if flags:
        result["track_status"] = {"RED":"RED", "YELLOW":"YELLOW", "DOUBLE YELLOW":"YELLOW", "GREEN":"GREEN", "CLEAR":"GREEN", "CHEQUERED":"CHECKERED"}.get(flags[0], "UNKNOWN")
        if flags[0] == "RED": result["state"] = "RED_FLAG"
    return result


async def get_session_state() -> Dict[str, Any]:
    from app.services import openf1_auth
    key = "openf1_session_state"
    if key in _session_cache:
        return _session_cache[key]
    if not openf1_auth.configured():
        return classify_session(None, [], False)
    session = await get_latest_session()
    session_key = session.get("session_key") if session else None
    messages, intervals, positions = await asyncio.gather(
        get_race_control_messages(session_key) if session_key else asyncio.sleep(0, result=[]),
        _get("/intervals", {"session_key": session_key}) if session_key else asyncio.sleep(0, result=[]),
        _get("/position", {"session_key": session_key}) if session_key else asyncio.sleep(0, result=[]),
    )
    timing = intervals or positions or []
    result = classify_session(session, messages or [], openf1_auth.state["status"] == "available", timing=timing)
    _session_cache[key] = result
    return result


async def get_live_timing(session_key: int) -> List[Dict]:
    """
    Get live timing intervals from OpenF1.
    Returns list of driver interval dicts sorted by gap to leader.
    """
    cache_key = f"live_timing_{session_key}"
    if cache_key in _live_cache:
        return _live_cache[cache_key]

    # Fetch intervals (gaps between drivers)
    intervals = await _get("/intervals", {"session_key": session_key})
    timing_errors = {}
    if intervals is None:
        timing_errors["intervals"] = "unavailable"
        intervals = []

    # Fetch drivers for this session
    drivers = await _get("/drivers", {"session_key": session_key})
    driver_map: Dict[int, Dict] = {}
    if drivers:
        for d in drivers:
            num = d.get("driver_number")
            if num is not None:
                driver_map[int(num)] = d

    # Fetch latest stints for tyre data
    stints = await _get("/stints", {"session_key": session_key})
    stint_map: Dict[int, Dict] = {}
    if stints:
        for s in stints:
            num = s.get("driver_number")
            if num is not None:
                existing = stint_map.get(int(num))
                if not existing or s.get("stint_number", 0) > existing.get("stint_number", 0):
                    stint_map[int(num)] = s

    # Fetch latest positions
    positions = await _get("/position", {"session_key": session_key})
    position_map: Dict[int, int] = {}
    if positions:
        for p in positions:
            num = p.get("driver_number")
            pos = p.get("position")
            if num is not None and pos is not None:
                position_map[int(num)] = int(pos)

    # Fetch pit stops
    pits = await _get("/pit", {"session_key": session_key})
    pit_map: Dict[int, int] = {}
    if pits:
        for p in pits:
            num = p.get("driver_number")
            if num is not None:
                pit_map[int(num)] = pit_map.get(int(num), 0) + 1

    for channel, value in (("drivers", drivers), ("stints", stints), ("positions", positions), ("pit_stops", pits)):
        if value is None:
            timing_errors[channel] = "unavailable"
    lap_key = f"live_laps_{session_key}"
    laps = _medium_cache.get(lap_key)
    if laps is None:
        laps = await _get("/laps", {"session_key": session_key})
        if laps is not None:
            _medium_cache[lap_key] = laps
    if laps is None:
        timing_errors["laps"] = "unavailable"
    latest_laps = {}
    best_laps = {}
    for lap in laps or []:
        num, duration = lap.get("driver_number"), lap.get("lap_duration")
        if num is None or not isinstance(duration, (int, float)) or duration <= 0:
            continue
        if num not in latest_laps or lap.get("lap_number", 0) > latest_laps[num].get("lap_number", 0):
            latest_laps[num] = lap
        best_laps[num] = min(best_laps.get(num, duration), duration)
    def lap_time(seconds):
        return f"{int(seconds // 60)}:{seconds % 60:06.3f}" if seconds is not None else None
    _medium_cache[f"timing_errors_{session_key}"] = timing_errors

    # Build leaderboard
    result = []
    seen_drivers = set()

    for interval in sorted(intervals, key=lambda item: item.get("date", ""), reverse=True):
        num = interval.get("driver_number")
        if num is None:
            continue
        num = int(num)
        if num in seen_drivers:
            continue
        seen_drivers.add(num)

        driver = driver_map.get(num, {})
        stint = stint_map.get(num, {})
        pos = position_map.get(num)

        gap = interval.get("gap_to_leader")
        gap_str = None
        if gap is not None:
            if gap == 0:
                gap_str = "LEADER"
            else:
                gap_str = f"+{gap:.3f}" if isinstance(gap, (int, float)) else str(gap)

        interval_val = interval.get("interval")
        interval_str = (f"+{interval_val:.3f}" if interval_val > 0 else None) if isinstance(interval_val, (int, float)) else interval_val

        compound = stint.get("compound", "UNKNOWN")
        if compound:
            compound = compound.upper()

        result.append({
            "position": pos,
            "driver_number": str(num),
            "driver_name": driver.get("full_name", f"Driver #{num}"),
            "abbreviation": driver.get("name_acronym", f"#{num}"),
            "team": driver.get("team_name", "—"),
            "team_color": f"#{driver.get('team_colour', '888888')}",
            "gap_to_leader": gap_str,
            "interval": interval_str,
            "last_lap": lap_time(latest_laps.get(num, {}).get("lap_duration")),
            "best_lap": lap_time(best_laps.get(num)),
            "lap_number": latest_laps.get(num, {}).get("lap_number"),
            "sector1": latest_laps.get(num, {}).get("duration_sector_1"),
            "sector2": latest_laps.get(num, {}).get("duration_sector_2"),
            "sector3": latest_laps.get(num, {}).get("duration_sector_3"),
            "current_tyre": compound,
            "tyre_age": None,  # Starting age is not current tyre age.
            "tyre_age_at_start": stint.get("tyre_age_at_start"),
            "pits": pit_map.get(num, 0) if pits is not None else None,
            "status": None,
            "drs": None,
            "speed": None,
        })

    # Sort by position
    result.sort(key=lambda x: (x["position"] is None, x["position"] or 0))

    # Fill in missing positions for drivers not in interval data
    for num, driver in driver_map.items():
        if num not in seen_drivers:
            stint = stint_map.get(num, {})
            compound = stint.get("compound", "UNKNOWN")
            if compound:
                compound = compound.upper()
            result.append({
                "position": position_map.get(num),
                "driver_number": str(num),
                "driver_name": driver.get("full_name", f"Driver #{num}"),
                "abbreviation": driver.get("name_acronym", f"#{num}"),
                "team": driver.get("team_name", "—"),
                "team_color": f"#{driver.get('team_colour', '888888')}",
                "gap_to_leader": None,
                "interval": None,
                "last_lap": lap_time(latest_laps.get(num, {}).get("lap_duration")),
                "best_lap": lap_time(best_laps.get(num)),
                "lap_number": latest_laps.get(num, {}).get("lap_number"),
                "sector1": latest_laps.get(num, {}).get("duration_sector_1"),
                "sector2": latest_laps.get(num, {}).get("duration_sector_2"),
                "sector3": latest_laps.get(num, {}).get("duration_sector_3"),
                "current_tyre": compound,
                "tyre_age": None,  # Starting age is not current tyre age.
            "tyre_age_at_start": stint.get("tyre_age_at_start"),
                "pits": pit_map.get(num, 0) if pits is not None else None,
                "status": None,
                "drs": None,
                "speed": None,
            })

    result.sort(key=lambda x: (x["position"] is None, x["position"] or 0))
    _live_cache[cache_key] = result
    return result


async def get_live_weather(session_key: int) -> Optional[Dict]:
    """Get latest weather reading for the session."""
    cache_key = f"live_weather_{session_key}"
    if cache_key in _medium_cache:
        return _medium_cache[cache_key]

    data = await _get("/weather", {"session_key": session_key})
    if not data or not isinstance(data, list) or len(data) == 0:
        return None

    latest = data[-1]
    result = {
        "air_temp": latest.get("air_temperature"),
        "track_temp": latest.get("track_temperature"),
        "humidity": latest.get("humidity"),
        "pressure": latest.get("pressure"),
        "wind_speed": latest.get("wind_speed"),
        "wind_direction": latest.get("wind_direction"),
        "rainfall": bool(latest["rainfall"]) if latest.get("rainfall") is not None else None,
        "observed_at": latest.get("date"),
    }
    _medium_cache[cache_key] = result
    return result


async def get_race_control_messages(session_key: int) -> Optional[List[Dict]]:
    """Get race control messages for the session."""
    cache_key = f"race_control_{session_key}"
    if cache_key in _medium_cache:
        return _medium_cache[cache_key]

    data = await _get("/race_control", {"session_key": session_key})
    if data is None or not isinstance(data, list):
        return None

    messages = []
    for msg in data[-20:]:  # last 20 messages
        messages.append({
            "time": msg.get("date"),
            "date": msg.get("date"),
            "lap": msg.get("lap_number"),
            "category": msg.get("category"),
            "message": msg.get("message", ""),
            "flag": msg.get("flag"),
            "scope": msg.get("scope"),
        })

    result = list(reversed(messages))  # newest first
    _medium_cache[cache_key] = result
    return result


async def get_stints(session_key: int) -> Optional[Dict[str, List[Dict]]]:
    """Get tyre stint data by driver."""
    cache_key = f"stints_{session_key}"
    if cache_key in _medium_cache:
        return _medium_cache[cache_key]

    data = await _get("/stints", {"session_key": session_key})
    if data is None or not isinstance(data, list):
        return None

    result: Dict[str, List[Dict]] = {}
    for stint in data:
        num = str(stint.get("driver_number", ""))
        if not num:
            continue
        if num not in result:
            result[num] = []
        result[num].append({
            "stint_number": stint.get("stint_number"),
            "compound": (stint.get("compound") or "UNKNOWN").upper(),
            "lap_start": stint.get("lap_start"),
            "lap_end": stint.get("lap_end"),
            "tyre_age_at_start": stint.get("tyre_age_at_start"),
        })

    _medium_cache[cache_key] = result
    return result


async def get_live_snapshot(session_key: int) -> Dict[str, Any]:
    """
    Single combined payload: timing + weather + race control + track status.
    Used by the WebSocket broadcaster for delta updates.
    """
    timing, weather, race_control = await asyncio.gather(
        get_live_timing(session_key),
        get_live_weather(session_key),
        get_race_control_messages(session_key),
        return_exceptions=True,
    )

    errors = dict(_medium_cache.get(f"timing_errors_{session_key}", {}))
    for channel, value in (("timing", timing), ("weather", weather), ("race_control", race_control)):
        if isinstance(value, Exception) or value is None:
            errors[channel] = "unavailable"
    return {
        "status": "partial" if errors else "success",
        "errors": errors,
        "session_key": session_key,
        "leaderboard": timing if isinstance(timing, list) else [],
        "weather": weather if isinstance(weather, dict) else None,
        "race_control": race_control if isinstance(race_control, list) else [],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
