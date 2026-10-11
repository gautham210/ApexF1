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
    """Make an OpenF1 API request. Returns parsed JSON or None on failure."""
    url = f"{OPENF1_BASE}{path}"
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.get(url, params=params or {})
            r.raise_for_status()
            return r.json()
    except Exception as e:
        logger.warning(f"OpenF1 request failed [{path}]: {e}")
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


async def get_session_state() -> Dict[str, Any]:
    """
    Determine the true current session state.

    Returns a dict with:
      - state: one of UPCOMING/WEEKEND/FP1/FP2/FP3/QUALIFYING/SPRINT_Q/SPRINT/RACE/
               RED_FLAG/SC/VSC/CHECKERED/ARCHIVE
      - is_live: bool (True only when a session is genuinely active)
      - session: OpenF1 session dict or None
      - session_key: int or None
      - session_name: str
      - display_name: str  (e.g. "FP1", "RACE")
      - circuit: str
      - country: str
      - year: int
      - round: int
      - track_status: str (GREEN/YELLOW/SC/VSC/RED)
    """
    cache_key = "openf1_session_state"
    if cache_key in _session_cache:
        return _session_cache[cache_key]

    session = await get_latest_session()
    if not session:
        result = {
            "state": "ARCHIVE",
            "is_live": False,
            "session": None,
            "session_key": None,
            "session_name": "Unknown",
            "display_name": "—",
            "circuit": "—",
            "country": "—",
            "year": datetime.now(timezone.utc).year,
            "round": 0,
            "track_status": "UNKNOWN",
        }
        _session_cache[cache_key] = result
        return result

    now = datetime.now(timezone.utc)

    # Parse session window from OpenF1 data
    date_start_str = session.get("date_start")
    date_end_str = session.get("date_end")

    session_key = session.get("session_key")
    session_name = session.get("session_name", "Race")
    display_name = SESSION_DISPLAY.get(session_name, session_name.upper())
    circuit = session.get("circuit_short_name", session.get("circuit_key", "—"))
    country = session.get("country_name", "—")
    year = session.get("year", now.year)
    meeting_key = session.get("meeting_key")

    state = "ARCHIVE"
    is_live = False
    track_status = "UNKNOWN"

    if date_start_str and date_end_str:
        try:
            # OpenF1 returns UTC ISO strings
            def _parse(s):
                s = s.replace("Z", "+00:00")
                return datetime.fromisoformat(s)

            date_start = _parse(date_start_str)
            date_end = _parse(date_end_str)

            # Add a generous buffer: session may run over
            session_end_with_buffer = date_end.replace(
                tzinfo=date_end.tzinfo or timezone.utc
            )
            date_start = date_start.replace(tzinfo=date_start.tzinfo or timezone.utc)

            if now < date_start:
                # Session hasn't started yet — check if it's today/imminent
                delta_hours = (date_start - now).total_seconds() / 3600
                state = "UPCOMING" if delta_hours > 6 else "WEEKEND"
            elif date_start <= now <= session_end_with_buffer:
                # Session window is active — check track status for red flag etc.
                is_live = True
                state = display_name.replace(" ", "_").upper()

                # Race-control is the documented provider endpoint; no /track_status API exists.
                messages = await get_race_control_messages(session_key)
                track_flags = [m for m in messages if m.get("scope") == "Track" and m.get("flag")]
                if track_flags:
                    flag = track_flags[0]["flag"]
                    track_status = {"RED": "RED", "YELLOW": "YELLOW", "DOUBLE YELLOW": "YELLOW", "GREEN": "GREEN", "CLEAR": "GREEN", "CHEQUERED": "CHECKERED"}.get(flag, "UNKNOWN")
                    if track_status == "RED":
                        state = "RED_FLAG"
                    elif track_status == "CHECKERED":
                        state = "CHECKERED"
                        is_live = False
            else:
                # Session ended — CHECKERED within 30 min, then ARCHIVE
                elapsed_minutes = (now - session_end_with_buffer).total_seconds() / 60
                state = "CHECKERED" if elapsed_minutes < 30 else "ARCHIVE"

        except Exception as e:
            logger.warning(f"Session state parse error: {e}")
            state = "ARCHIVE"

    result = {
        "state": state,
        "is_live": is_live,
        "session": session,
        "session_key": session_key,
        "meeting_key": meeting_key,
        "session_name": session_name,
        "display_name": display_name,
        "circuit": circuit,
        "country": country,
        "year": year,
        "round": None,
        "track_status": track_status,
        "date_start": date_start_str,
        "date_end": date_end_str,
    }
    _session_cache[cache_key] = result
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
    if not intervals:
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
        pos = position_map.get(num, 99)

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
            "last_lap": None,  # requires laps endpoint (heavier)
            "best_lap": None,
            "current_tyre": compound,
            "tyre_age": stint.get("tyre_age_at_start"),
            "pits": pit_map.get(num, 0) if pits is not None else None,
            "status": None,
            "drs": False,
            "speed": None,
        })

    # Sort by position
    result.sort(key=lambda x: x["position"])

    # Fill in missing positions for drivers not in interval data
    for num, driver in driver_map.items():
        if num not in seen_drivers:
            stint = stint_map.get(num, {})
            compound = stint.get("compound", "UNKNOWN")
            if compound:
                compound = compound.upper()
            result.append({
                "position": position_map.get(num, 99),
                "driver_number": str(num),
                "driver_name": driver.get("full_name", f"Driver #{num}"),
                "abbreviation": driver.get("name_acronym", f"#{num}"),
                "team": driver.get("team_name", "—"),
                "team_color": f"#{driver.get('team_colour', '888888')}",
                "gap_to_leader": None,
                "interval": None,
                "last_lap": None,
                "best_lap": None,
                "current_tyre": compound,
                "tyre_age": stint.get("tyre_age_at_start"),
                "pits": pit_map.get(num, 0) if pits is not None else None,
                "status": None,
                "drs": False,
                "speed": None,
            })

    result.sort(key=lambda x: x["position"])
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


async def get_race_control_messages(session_key: int) -> List[Dict]:
    """Get race control messages for the session."""
    cache_key = f"race_control_{session_key}"
    if cache_key in _medium_cache:
        return _medium_cache[cache_key]

    data = await _get("/race_control", {"session_key": session_key})
    if not data or not isinstance(data, list):
        return []

    messages = []
    for msg in data[-20:]:  # last 20 messages
        messages.append({
            "time": msg.get("date"),
            "lap": msg.get("lap_number"),
            "category": msg.get("category"),
            "message": msg.get("message", ""),
            "flag": msg.get("flag"),
            "scope": msg.get("scope"),
        })

    result = list(reversed(messages))  # newest first
    _medium_cache[cache_key] = result
    return result


async def get_stints(session_key: int) -> Dict[str, List[Dict]]:
    """Get tyre stint data by driver."""
    cache_key = f"stints_{session_key}"
    if cache_key in _medium_cache:
        return _medium_cache[cache_key]

    data = await _get("/stints", {"session_key": session_key})
    if not data or not isinstance(data, list):
        return {}

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
            "tyre_age_at_start": stint.get("tyre_age_at_start", 0),
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

    return {
        "leaderboard": timing if isinstance(timing, list) else [],
        "weather": weather if isinstance(weather, dict) else None,
        "race_control": race_control if isinstance(race_control, list) else [],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
