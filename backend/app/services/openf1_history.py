"""
Historical telemetry, lap timing, circuit geometry, weather, and race control
fallback powered by OpenF1 REST API (2023+ seasons).

Used automatically when FastF1 cannot load an uncached session (for example,
when Formula 1 live-timing static archives return HTTP 401 without F1TV auth).
"""
from __future__ import annotations

import asyncio
import logging
import time
import weakref
from datetime import datetime, timedelta, timezone
from typing import Any, Awaitable, Callable, Dict, List, Optional, Sequence, Tuple

import httpx
from cachetools import TTLCache

from app.models.schemas import (
    Driver,
    LapTime,
    RaceControlMessage,
    ScheduleEvent,
    TelemetryPoint,
    WeatherData,
)

logger = logging.getLogger(__name__)

OPENF1_BASE = "https://api.openf1.org/v1"

_sessions_cache = TTLCache(maxsize=16, ttl=43200)
_drivers_cache = TTLCache(maxsize=128, ttl=3600)
_laps_raw_cache = TTLCache(maxsize=128, ttl=3600)
_stints_cache = TTLCache(maxsize=128, ttl=3600)
_weather_cache = TTLCache(maxsize=128, ttl=3600)
_rc_cache = TTLCache(maxsize=128, ttl=3600)
_telemetry_cache = TTLCache(maxsize=256, ttl=3600)
_circuit_cache = TTLCache(maxsize=128, ttl=43200)
_replay_meta_cache = TTLCache(maxsize=64, ttl=3600)
_replay_chunk_cache = TTLCache(maxsize=256, ttl=3600)

_SESSION_NAME_ALIASES: Dict[str, Tuple[str, ...]] = {
    "Race": ("Race",),
    "Qualifying": ("Qualifying",),
    "Sprint": ("Sprint",),
    "Sprint Qualifying": ("Sprint Qualifying", "Sprint Shootout"),
    "Sprint Shootout": ("Sprint Shootout", "Sprint Qualifying"),
    "Practice 1": ("Practice 1",),
    "Practice 2": ("Practice 2",),
    "Practice 3": ("Practice 3",),
}


def compute_track_bounds(
    raw_points: Sequence[Tuple[float, float]],
    target_size: float = 840.0,
    pad: float = 80.0,
) -> Dict[str, float]:
    """Compute uniform 1000x1000 SVG projection parameters from raw X/Y points."""
    xs = [p[0] for p in raw_points]
    ys = [p[1] for p in raw_points]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    w = max(max_x - min_x, 1.0)
    h = max(max_y - min_y, 1.0)
    scale = target_size / max(w, h)
    ox = pad + (target_size - w * scale) / 2.0
    oy = pad + (target_size - h * scale) / 2.0
    return {
        "min_x": float(min_x),
        "max_x": float(max_x),
        "min_y": float(min_y),
        "max_y": float(max_y),
        "scale": float(scale),
        "ox": float(ox),
        "oy": float(oy),
    }


def project_xy(x: float, y: float, bounds: Dict[str, float]) -> Tuple[float, float]:
    """Project a raw X/Y point into the normalized 1000x1000 SVG box."""
    px = bounds["ox"] + (x - bounds["min_x"]) * bounds["scale"]
    py = bounds["oy"] + (bounds["max_y"] - y) * bounds["scale"]
    return (round(px, 2), round(py, 2))


def normalize_track_xy(
    raw_points: Sequence[Tuple[float, float]],
    raw_corners: Sequence[Dict[str, Any]] = (),
    target_size: float = 840.0,
    pad: float = 80.0,
) -> Tuple[List[Dict[str, float]], List[Dict[str, Any]]]:
    """Scale rotated track X/Y coordinates and corner markers into a 1000x1000 SVG box."""
    bounds = compute_track_bounds(raw_points, target_size=target_size, pad=pad)

    norm_pts = []
    for x, y in raw_points:
        px, py = project_xy(x, y, bounds)
        norm_pts.append({"x": px, "y": py})
    norm_corners = []
    for c in raw_corners:
        if c.get("x") is not None and c.get("y") is not None:
            cx, cy = project_xy(float(c["x"]), float(c["y"]), bounds)
            norm_corners.append({
                "number": c.get("number"),
                "letter": str(c.get("letter") or "").strip(),
                "x": cx,
                "y": cy,
            })
    return norm_pts, norm_corners


def _parse_iso(value: Optional[str]) -> Optional[datetime]:
    if not value or not isinstance(value, str):
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except ValueError:
        return None


def _fmt_openf1_ts(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3]


def _fmt_duration(seconds: Any) -> Optional[str]:
    if seconds is None:
        return None
    try:
        val = float(seconds)
    except (TypeError, ValueError):
        return None
    if val <= 0:
        return None
    mins = int(val // 60)
    rem = val - mins * 60
    if mins > 0:
        return f"{mins}:{rem:06.3f}"
    return f"{rem:.3f}"


def _norm_token(value: Optional[str]) -> str:
    if not value:
        return ""
    return "".join(ch for ch in value.lower() if ch.isalnum())


_OPENF1_MIN_INTERVAL = 0.38
_LOOP_COORDINATION: "weakref.WeakKeyDictionary[asyncio.AbstractEventLoop, Dict[str, Any]]" = (
    weakref.WeakKeyDictionary()
)


def _get_loop_state() -> Dict[str, Any]:
    loop = asyncio.get_running_loop()
    state = _LOOP_COORDINATION.get(loop)
    if state is None:
        state = {
            "gate": asyncio.Lock(),
            "last_request_ts": 0.0,
            "inflight": {},
        }
        _LOOP_COORDINATION[loop] = state
    return state


async def _coalesce(key: Any, factory: Callable[[], Awaitable[Any]]) -> Any:
    """Coalesce concurrent identical upstream lookups on the active event loop."""
    state = _get_loop_state()
    inflight: Dict[Any, asyncio.Task[Any]] = state["inflight"]
    task = inflight.get(key)
    if task is None or task.done():
        task = asyncio.create_task(factory())
        inflight[key] = task
        try:
            return await asyncio.shield(task)
        finally:
            if inflight.get(key) is task:
                inflight.pop(key, None)
    return await asyncio.shield(task)


async def _get_json(url_or_path: str, params: Optional[Dict[str, Any]] = None) -> Optional[List[Dict[str, Any]]]:
    from app.services import openf1_auth

    url = url_or_path if url_or_path.startswith("http") else f"{OPENF1_BASE}{url_or_path}"
    headers = await openf1_auth.headers() if openf1_auth.configured() else {}
    state = _get_loop_state()
    backoffs = (0.65, 1.3, 2.2, 3.0)

    for attempt in range(4):
        try:
            async with state["gate"]:
                now = time.monotonic()
                wait = _OPENF1_MIN_INTERVAL - (now - state["last_request_ts"])
                if wait > 0:
                    await asyncio.sleep(wait)
                state["last_request_ts"] = time.monotonic()

            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.get(url, params=params, headers=headers)
            if resp.status_code == 429 and attempt < 3:
                await asyncio.sleep(backoffs[attempt])
                continue
            if resp.status_code == 200:
                payload = resp.json()
                return payload if isinstance(payload, list) else None
            logger.debug("OpenF1 historical %s returned HTTP %s", url, resp.status_code)
            return None
        except Exception as exc:
            logger.warning("OpenF1 historical request failed (%s): %s", url_or_path, exc)
            if attempt < 1:
                await asyncio.sleep(0.5)
                continue
            return None
    return None


async def _get_year_sessions(year: int) -> List[Dict[str, Any]]:
    if year < 2023:
        return []
    if year in _sessions_cache:
        return _sessions_cache[year]

    async def _load() -> List[Dict[str, Any]]:
        if year in _sessions_cache:
            return _sessions_cache[year]
        data = await _get_json("/sessions", params={"year": year})
        rows = data if isinstance(data, list) else []
        if rows:
            _sessions_cache[year] = rows
        return rows

    return await _coalesce(("sessions", year), _load)


async def resolve_session(
    year: int,
    round_number: int,
    session_name: str,
    schedule_event: Optional[ScheduleEvent] = None,
) -> Optional[Dict[str, Any]]:
    sessions = await _get_year_sessions(year)
    if not sessions:
        return None

    accepted_names = set(_SESSION_NAME_ALIASES.get(session_name, (session_name,)))
    candidates = [
        s for s in sessions
        if s.get("session_name") in accepted_names
        and "testing" not in str(s.get("meeting_name") or "").lower()
        and "testing" not in str(s.get("circuit_short_name") or "").lower()
    ]
    if not candidates:
        return None

    # 1. Primary: match by schedule date proximity or location/country token
    if schedule_event is not None:
        ref_dt = (
            _parse_iso(schedule_event.session5_date)
            or _parse_iso(schedule_event.event_date)
            or _parse_iso(schedule_event.session1_date)
        )
        if ref_dt is not None:
            best = min(
                candidates,
                key=lambda s: abs((_parse_iso(s.get("date_start")) or ref_dt) - ref_dt),
            )
            best_dt = _parse_iso(best.get("date_start"))
            if best_dt is not None and abs((best_dt - ref_dt).days) <= 6:
                return best

        loc_tok = _norm_token(schedule_event.location)
        country_tok = _norm_token(schedule_event.country)
        circuit_tok = _norm_token(schedule_event.circuit_name or schedule_event.event_name)
        for s in candidates:
            s_loc = _norm_token(s.get("location"))
            s_country = _norm_token(s.get("country_name"))
            s_circuit = _norm_token(s.get("circuit_short_name"))
            if (
                (loc_tok and (loc_tok in s_loc or s_loc in loc_tok))
                or (country_tok and country_tok == s_country)
                or (circuit_tok and s_circuit and (s_circuit in circuit_tok or circuit_tok in s_circuit))
            ):
                return s

    # 2. Chronological GP meeting fallback when schedule metadata isn't decisive
    gp_meetings: List[int] = []
    seen = set()
    for s in sorted(
        (x for x in sessions if "testing" not in str(x.get("meeting_name") or "").lower() and "pre-season" not in str(x.get("circuit_short_name") or "").lower()),
        key=lambda x: str(x.get("date_start") or ""),
    ):
        mk = s.get("meeting_key")
        if isinstance(mk, int) and mk not in seen:
            seen.add(mk)
            gp_meetings.append(mk)

    if 1 <= round_number <= len(gp_meetings):
        target_mk = gp_meetings[round_number - 1]
        for s in candidates:
            if s.get("meeting_key") == target_mk:
                return s

    return None


async def _get_raw_drivers(session_key: int) -> List[Dict[str, Any]]:
    if session_key in _drivers_cache:
        return _drivers_cache[session_key]

    async def _load() -> List[Dict[str, Any]]:
        if session_key in _drivers_cache:
            return _drivers_cache[session_key]
        data = await _get_json("/drivers", params={"session_key": session_key})
        rows = data if isinstance(data, list) else []
        if rows:
            _drivers_cache[session_key] = rows
        return rows

    return await _coalesce(("drivers", session_key), _load)


async def _get_raw_stints(session_key: int) -> List[Dict[str, Any]]:
    if session_key in _stints_cache:
        return _stints_cache[session_key]

    async def _load() -> List[Dict[str, Any]]:
        if session_key in _stints_cache:
            return _stints_cache[session_key]
        data = await _get_json("/stints", params={"session_key": session_key})
        rows = data if isinstance(data, list) else []
        if rows:
            _stints_cache[session_key] = rows
        return rows

    return await _coalesce(("stints", session_key), _load)


async def _get_raw_laps(session_key: int, driver_number: Optional[int] = None) -> List[Dict[str, Any]]:
    cache_key = (session_key, driver_number)
    if cache_key in _laps_raw_cache:
        return _laps_raw_cache[cache_key]

    async def _load() -> List[Dict[str, Any]]:
        if cache_key in _laps_raw_cache:
            return _laps_raw_cache[cache_key]
        params: Dict[str, Any] = {"session_key": session_key}
        if driver_number is not None:
            params["driver_number"] = driver_number
        data = await _get_json("/laps", params=params)
        rows = data if isinstance(data, list) else []
        if rows:
            _laps_raw_cache[cache_key] = rows
        return rows

    return await _coalesce(("laps", cache_key), _load)


async def _resolve_driver_number(session_key: int, driver: str) -> Optional[int]:
    cleaned = driver.strip()
    if cleaned.isdigit():
        return int(cleaned)
    raw_drivers = await _get_raw_drivers(session_key)
    upper = cleaned.upper()
    for d in raw_drivers:
        if str(d.get("name_acronym") or "").upper() == upper:
            num = d.get("driver_number")
            if isinstance(num, int):
                return num
    return None


async def get_drivers(
    year: int,
    round_number: int,
    session_name: str,
    schedule_event: Optional[ScheduleEvent] = None,
) -> List[Driver]:
    sess = await resolve_session(year, round_number, session_name, schedule_event)
    if not sess:
        return []
    raw_drivers = await _get_raw_drivers(int(sess["session_key"]))
    drivers: List[Driver] = []
    seen = set()
    for row in raw_drivers:
        num = str(row.get("driver_number") or "")
        if not num or num in seen:
            continue
        seen.add(num)
        full_name = str(
            row.get("full_name")
            or f"{row.get('first_name') or ''} {row.get('last_name') or ''}".strip()
            or row.get("broadcast_name")
            or f"#{num}"
        )
        raw_color = str(row.get("team_colour") or "888888").strip().lstrip("#")
        color = f"#{raw_color}" if len(raw_color) == 6 else "#888888"
        drivers.append(Driver(
            driver_number=num,
            full_name=full_name,
            abbreviation=str(row.get("name_acronym") or num),
            team_name=str(row.get("team_name") or ""),
            team_color=color,
            nationality=str(row.get("country_code") or ""),
            headshot_url=row.get("headshot_url"),
            points=0,
            position=None,
        ))
    return drivers


def _compound_for_lap(stints_for_driver: List[Dict[str, Any]], lap_number: int) -> Tuple[Optional[str], Optional[int]]:
    for stint in stints_for_driver:
        start = stint.get("lap_start")
        end = stint.get("lap_end")
        if start is None:
            continue
        if lap_number >= int(start) and (end is None or lap_number <= int(end)):
            comp = stint.get("compound")
            age_start = stint.get("tyre_age_at_start")
            tyre_life = None
            if isinstance(age_start, (int, float)):
                tyre_life = int(age_start) + (lap_number - int(start) + 1)
            return (str(comp).strip().upper() if comp else None, tyre_life)
    return (None, None)


async def get_laps(
    year: int,
    round_number: int,
    session_name: str,
    driver: Optional[str] = None,
    schedule_event: Optional[ScheduleEvent] = None,
) -> List[LapTime]:
    sess = await resolve_session(year, round_number, session_name, schedule_event)
    if not sess:
        return []
    sk = int(sess["session_key"])

    driver_num: Optional[int] = None
    if driver:
        driver_num = await _resolve_driver_number(sk, driver)
        if driver_num is None:
            return []

    raw_laps, raw_stints = await asyncio.gather(
        _get_raw_laps(sk, driver_num),
        _get_raw_stints(sk),
    )
    if not raw_laps:
        return []

    stints_by_drv: Dict[int, List[Dict[str, Any]]] = {}
    for stint in raw_stints:
        dn = stint.get("driver_number")
        if isinstance(dn, int):
            stints_by_drv.setdefault(dn, []).append(stint)

    # Personal & overall best durations
    best_by_drv: Dict[int, float] = {}
    overall_best: Optional[float] = None
    for l in raw_laps:
        dur = l.get("lap_duration")
        dn = l.get("driver_number")
        if isinstance(dur, (int, float)) and dur > 0 and isinstance(dn, int):
            if dn not in best_by_drv or dur < best_by_drv[dn]:
                best_by_drv[dn] = float(dur)
            if overall_best is None or dur < overall_best:
                overall_best = float(dur)

    sorted_laps = sorted(
        raw_laps,
        key=lambda l: (int(l.get("driver_number") or 0), int(l.get("lap_number") or 0)),
    )

    pit_in_laps = set()
    for dn, stints in stints_by_drv.items():
        sorted_stints = sorted(stints, key=lambda s: int(s.get("stint_number") or 0))
        for st in sorted_stints[:-1]:
            if st.get("lap_end") is not None:
                pit_in_laps.add((dn, int(st["lap_end"])))

    result: List[LapTime] = []
    for l in sorted_laps:
        dn = int(l.get("driver_number") or 0)
        lap_num = int(l.get("lap_number") or 0)
        if lap_num <= 0:
            continue
        dur = l.get("lap_duration")
        dur_f = float(dur) if isinstance(dur, (int, float)) and dur > 0 else None
        compound, tyre_life = _compound_for_lap(stints_by_drv.get(dn, []), lap_num)
        result.append(LapTime(
            driver_number=str(dn),
            lap_number=lap_num,
            lap_time=_fmt_duration(dur_f),
            sector1=_fmt_duration(l.get("duration_sector_1")),
            sector2=_fmt_duration(l.get("duration_sector_2")),
            sector3=_fmt_duration(l.get("duration_sector_3")),
            compound=compound,
            tyre_life=tyre_life,
            is_personal_best=bool(dur_f is not None and best_by_drv.get(dn) == dur_f),
            is_overall_best=bool(dur_f is not None and overall_best == dur_f),
            pit_in=(dn, lap_num) in pit_in_laps,
            pit_out=bool(l.get("is_pit_out_lap", False)),
        ))
    return result


def _interpolate_location(
    loc_samples: List[Tuple[float, float, float, Optional[float]]],
    target_t: float,
    cursor: int,
) -> Tuple[Optional[float], Optional[float], Optional[float], int]:
    """Two-pointer linear interpolation on (time, x, y, z) location samples."""
    n = len(loc_samples)
    if n == 0:
        return (None, None, None, 0)
    while cursor + 1 < n and loc_samples[cursor + 1][0] <= target_t:
        cursor += 1
    t0, x0, y0, z0 = loc_samples[cursor]
    if cursor + 1 >= n or target_t <= t0:
        return (x0, y0, z0, cursor)
    t1, x1, y1, z1 = loc_samples[cursor + 1]
    span = t1 - t0
    if span <= 0:
        return (x0, y0, z0, cursor)
    frac = max(0.0, min(1.0, (target_t - t0) / span))
    x = x0 + (x1 - x0) * frac
    y = y0 + (y1 - y0) * frac
    z = (z0 + (z1 - z0) * frac) if (z0 is not None and z1 is not None) else z0
    return (x, y, z, cursor)


async def get_telemetry(
    year: int,
    round_number: int,
    session_name: str,
    driver: str,
    lap_number: Optional[int] = None,
    schedule_event: Optional[ScheduleEvent] = None,
) -> List[TelemetryPoint]:
    sess = await resolve_session(year, round_number, session_name, schedule_event)
    if not sess:
        return []
    sk = int(sess["session_key"])
    driver_num = await _resolve_driver_number(sk, driver)
    if driver_num is None:
        return []

    cache_key = (sk, driver_num, lap_number)
    if cache_key in _telemetry_cache:
        return _telemetry_cache[cache_key]

    laps = await _get_raw_laps(sk, driver_num)
    if not laps:
        return []

    laps_sorted = sorted(laps, key=lambda l: int(l.get("lap_number") or 0))
    target_lap: Optional[Dict[str, Any]] = None
    if lap_number is not None:
        for l in laps_sorted:
            if int(l.get("lap_number") or 0) == lap_number:
                target_lap = l
                break
    else:
        valid = [l for l in laps_sorted if l.get("date_start") and isinstance(l.get("lap_duration"), (int, float)) and l["lap_duration"] > 0]
        if valid:
            target_lap = min(valid, key=lambda l: float(l["lap_duration"]))

    if not target_lap or not target_lap.get("date_start"):
        return []

    start_dt = _parse_iso(target_lap["date_start"])
    if start_dt is None:
        return []

    dur = target_lap.get("lap_duration")
    if isinstance(dur, (int, float)) and dur > 0:
        end_dt = start_dt + timedelta(seconds=float(dur) + 0.35)
    else:
        next_start = None
        for l in laps_sorted:
            if int(l.get("lap_number") or 0) > int(target_lap.get("lap_number") or 0) and l.get("date_start"):
                next_start = _parse_iso(l["date_start"])
                if next_start is not None:
                    break
        end_dt = next_start or (start_dt + timedelta(seconds=120.0))

    start_s = _fmt_openf1_ts(start_dt - timedelta(seconds=0.25))
    end_s = _fmt_openf1_ts(end_dt)

    car_url = f"{OPENF1_BASE}/car_data?session_key={sk}&driver_number={driver_num}&date>={start_s}&date<={end_s}"
    loc_url = f"{OPENF1_BASE}/location?session_key={sk}&driver_number={driver_num}&date>={start_s}&date<={end_s}"
    car_raw, loc_raw = await asyncio.gather(_get_json(car_url), _get_json(loc_url))
    if not car_raw:
        return []

    loc_samples: List[Tuple[float, float, float, Optional[float]]] = []
    for loc in loc_raw or []:
        dt = _parse_iso(loc.get("date"))
        lx, ly = loc.get("x"), loc.get("y")
        if dt is None or lx is None or ly is None:
            continue
        t_rel = (dt - start_dt).total_seconds()
        lz = float(loc["z"]) if loc.get("z") is not None else None
        loc_samples.append((t_rel, float(lx), float(ly), lz))
    loc_samples.sort(key=lambda item: item[0])

    car_rows: List[Tuple[float, Dict[str, Any]]] = []
    for row in car_raw:
        dt = _parse_iso(row.get("date"))
        if dt is None:
            continue
        t_rel = (dt - start_dt).total_seconds()
        if t_rel < -0.5:
            continue
        car_rows.append((t_rel, row))
    car_rows.sort(key=lambda item: item[0])
    if not car_rows:
        return []

    if len(car_rows) > 650:
        step = max(1, len(car_rows) // 650)
        car_rows = car_rows[::step]

    points: List[TelemetryPoint] = []
    loc_cursor = 0
    cumulative_dist = 0.0
    prev_t: Optional[float] = None
    prev_speed: Optional[float] = None

    for t_rel, row in car_rows:
        speed = float(row["speed"]) if row.get("speed") is not None else None
        if prev_t is not None and speed is not None and prev_speed is not None:
            dt_sec = max(0.0, t_rel - prev_t)
            cumulative_dist += ((speed + prev_speed) / 2.0) / 3.6 * dt_sec
        if speed is not None:
            prev_t = t_rel
            prev_speed = speed

        x, y, z, loc_cursor = _interpolate_location(loc_samples, t_rel, loc_cursor)
        points.append(TelemetryPoint(
            time=round(max(0.0, t_rel), 3),
            speed=speed,
            rpm=float(row["rpm"]) if row.get("rpm") is not None else None,
            throttle=float(row["throttle"]) if row.get("throttle") is not None else None,
            brake=float(row["brake"]) if row.get("brake") is not None else None,
            gear=int(row["n_gear"]) if row.get("n_gear") is not None else None,
            drs=int(row["drs"]) if row.get("drs") is not None else None,
            distance=round(cumulative_dist, 1),
            x=round(x, 2) if x is not None else None,
            y=round(y, 2) if y is not None else None,
            z=round(z, 2) if z is not None else None,
        ))

    if points:
        _telemetry_cache[cache_key] = points
    return points


async def get_circuit_map(
    year: int,
    round_number: int,
    session_name: str = "Race",
    schedule_event: Optional[ScheduleEvent] = None,
) -> Optional[Dict[str, Any]]:
    sess = await resolve_session(year, round_number, session_name, schedule_event)
    if not sess:
        return None
    sk = int(sess["session_key"])
    if sk in _circuit_cache:
        return _circuit_cache[sk]

    async def _build_circuit() -> Optional[Dict[str, Any]]:
        if sk in _circuit_cache:
            return _circuit_cache[sk]
        raw_laps = await _get_raw_laps(sk)
        valid = [
            l for l in raw_laps
            if l.get("date_start") and isinstance(l.get("lap_duration"), (int, float)) and 40.0 < float(l["lap_duration"]) < 220.0
        ]
        if not valid:
            return None

        fastest = min(valid, key=lambda l: float(l["lap_duration"]))
        driver_num = int(fastest["driver_number"])
        start_dt = _parse_iso(fastest["date_start"])
        if start_dt is None:
            return None
        end_dt = start_dt + timedelta(seconds=float(fastest["lap_duration"]) + 0.5)

        loc_url = (
            f"{OPENF1_BASE}/location?session_key={sk}&driver_number={driver_num}"
            f"&date>={_fmt_openf1_ts(start_dt)}&date<={_fmt_openf1_ts(end_dt)}"
        )
        loc_raw = await _get_json(loc_url)
        if not loc_raw:
            return None

        timed_rows: List[Tuple[datetime, float, float]] = []
        for row in sorted(loc_raw, key=lambda r: str(r.get("date") or "")):
            dt_pt = _parse_iso(row.get("date"))
            if dt_pt is not None and row.get("x") is not None and row.get("y") is not None:
                timed_rows.append((dt_pt, float(row["x"]), float(row["y"])))

        if len(timed_rows) < 20:
            return None

        pts_full = [(x, y) for _, x, y in timed_rows]
        bounds = compute_track_bounds(pts_full)

        if len(pts_full) > 320:
            step = max(1, len(pts_full) // 320)
            sampled_pts = pts_full[::step]
        else:
            sampled_pts = pts_full

        norm_pts = [{"x": px, "y": py} for px, py in (project_xy(x, y, bounds) for x, y in sampled_pts)]

        # Start/finish marker & direction tangent from first points on fastest lap
        start_finish = None
        if len(norm_pts) >= 2:
            p0, p1 = norm_pts[0], norm_pts[1]
            dx, dy = p1["x"] - p0["x"], p1["y"] - p0["y"]
            mag = (dx * dx + dy * dy) ** 0.5 or 1.0
            start_finish = {
                "x": p0["x"],
                "y": p0["y"],
                "dx": round(dx / mag, 4),
                "dy": round(dy / mag, 4),
            }

        # Verified sector split markers derived from fastest lap sector timestamps
        sectors: List[Dict[str, Any]] = []
        s1_dur = fastest.get("duration_sector_1")
        s2_dur = fastest.get("duration_sector_2")
        if isinstance(s1_dur, (int, float)) and s1_dur > 5:
            s1_dt = start_dt + timedelta(seconds=float(s1_dur))
            nearest_s1 = min(timed_rows, key=lambda r: abs((r[0] - s1_dt).total_seconds()))
            if abs((nearest_s1[0] - s1_dt).total_seconds()) <= 2.5:
                sx, sy = project_xy(nearest_s1[1], nearest_s1[2], bounds)
                sectors.append({"sector": 2, "label": "S2", "x": sx, "y": sy})
            if isinstance(s2_dur, (int, float)) and s2_dur > 5:
                s2_dt = s1_dt + timedelta(seconds=float(s2_dur))
                nearest_s2 = min(timed_rows, key=lambda r: abs((r[0] - s2_dt).total_seconds()))
                if abs((nearest_s2[0] - s2_dt).total_seconds()) <= 2.5:
                    sx, sy = project_xy(nearest_s2[1], nearest_s2[2], bounds)
                    sectors.append({"sector": 3, "label": "S3", "x": sx, "y": sy})

        raw_drivers = await _get_raw_drivers(sk)
        ref_abbr = next(
            (str(d.get("name_acronym") or "") for d in raw_drivers if int(d.get("driver_number") or -1) == driver_num),
            str(driver_num),
        )

        payload = {
            "available": True,
            "year": year,
            "round_number": round_number,
            "session": session_name,
            "source": "OpenF1",
            "circuit_name": str(sess.get("location") or sess.get("circuit_short_name") or ""),
            "rotation": 0.0,
            "reference_driver": ref_abbr or str(driver_num),
            "points": norm_pts,
            "corners": [],
            "sectors": sectors,
            "start_finish": start_finish,
            "bounds": bounds,
        }
        _circuit_cache[sk] = payload
        return payload

    return await _coalesce(("circuit", sk), _build_circuit)


async def get_weather(
    year: int,
    round_number: int,
    session_name: str = "Race",
    schedule_event: Optional[ScheduleEvent] = None,
) -> Optional[WeatherData]:
    sess = await resolve_session(year, round_number, session_name, schedule_event)
    if not sess:
        return None
    sk = int(sess["session_key"])
    if sk in _weather_cache:
        return _weather_cache[sk]
    rows = await _get_json("/weather", params={"session_key": sk})
    if not rows:
        return None
    last = rows[-1]
    raw_rain = last.get("rainfall")
    data = WeatherData(
        air_temp=float(last["air_temperature"]) if last.get("air_temperature") is not None else None,
        track_temp=float(last["track_temperature"]) if last.get("track_temperature") is not None else None,
        humidity=float(last["humidity"]) if last.get("humidity") is not None else None,
        pressure=float(last["pressure"]) if last.get("pressure") is not None else None,
        wind_speed=float(last["wind_speed"]) if last.get("wind_speed") is not None else None,
        wind_direction=float(last["wind_direction"]) if last.get("wind_direction") is not None else None,
        rainfall=bool(raw_rain) if raw_rain is not None else None,
    )
    _weather_cache[sk] = data
    return data


async def get_race_control(
    year: int,
    round_number: int,
    session_name: str = "Race",
    schedule_event: Optional[ScheduleEvent] = None,
) -> List[RaceControlMessage]:
    sess = await resolve_session(year, round_number, session_name, schedule_event)
    if not sess:
        return []
    sk = int(sess["session_key"])
    if sk in _rc_cache:
        return _rc_cache[sk]
    rows = await _get_json("/race_control", params={"session_key": sk})
    if not rows:
        return []
    messages = [
        RaceControlMessage(
            time=str(r.get("date") or ""),
            lap=int(r["lap_number"]) if isinstance(r.get("lap_number"), int) and r["lap_number"] > 0 else None,
            category=str(r.get("category") or ""),
            message=str(r.get("message") or ""),
            flag=str(r["flag"]) if r.get("flag") else None,
            scope=str(r["scope"]) if r.get("scope") else None,
        )
        for r in rows
        if r.get("message")
    ]
    if messages:
        _rc_cache[sk] = messages
    return messages


def _bin_positions_by_second(
    rows_by_driver: Dict[str, List[Tuple[float, float, float]]],
    bounds: Dict[str, float],
    start_s: int,
    end_s: int,
) -> List[Dict[str, Any]]:
    """
    Bin raw driver location samples into 1Hz SVG keyframes over [start_s, end_s].
    Interpolates linearly only between recorded samples <= 2.5s apart, or snaps within 1.0s.
    Never invents or extrapolates coordinates across longer data gaps or retired cars.
    """
    driver_ids = sorted(rows_by_driver.keys(), key=lambda d: int(d) if d.isdigit() else 999)
    cursors: Dict[str, int] = {d: 0 for d in driver_ids}
    frames: List[Dict[str, Any]] = []

    for sec in range(start_s, end_s + 1):
        cars: Dict[str, List[float]] = {}
        t_sec = float(sec)
        for drv in driver_ids:
            samples = rows_by_driver[drv]
            n = len(samples)
            if n == 0:
                continue
            idx = cursors[drv]
            while idx < n and samples[idx][0] < t_sec:
                idx += 1
            cursors[drv] = idx

            prev_s = samples[idx - 1] if idx > 0 else None
            next_s = samples[idx] if idx < n else None

            raw_xy: Optional[Tuple[float, float]] = None
            if prev_s is not None and next_s is not None:
                dt_gap = next_s[0] - prev_s[0]
                if 0.0 < dt_gap <= 2.5:
                    frac = (t_sec - prev_s[0]) / dt_gap
                    raw_xy = (
                        prev_s[1] + (next_s[1] - prev_s[1]) * frac,
                        prev_s[2] + (next_s[2] - prev_s[2]) * frac,
                    )
                elif dt_gap == 0.0:
                    raw_xy = (prev_s[1], prev_s[2])
                elif abs(t_sec - prev_s[0]) <= 1.0:
                    raw_xy = (prev_s[1], prev_s[2])
                elif abs(next_s[0] - t_sec) <= 1.0:
                    raw_xy = (next_s[1], next_s[2])
            elif prev_s is not None and abs(t_sec - prev_s[0]) <= 1.0:
                raw_xy = (prev_s[1], prev_s[2])
            elif next_s is not None and abs(next_s[0] - t_sec) <= 1.0:
                raw_xy = (next_s[1], next_s[2])

            if raw_xy is not None:
                px, py = project_xy(raw_xy[0], raw_xy[1], bounds)
                cars[drv] = [px, py]

        frames.append({"t": sec, "cars": cars})
    return frames


async def get_replay_metadata(
    year: int,
    round_number: int,
    session_name: str = "Race",
    schedule_event: Optional[ScheduleEvent] = None,
) -> Dict[str, Any]:
    """Build synchronized metadata, drivers, laps, position changes, and OpenF1 track geometry for visual replay."""
    if year < 2023:
        return {
            "replay_available": False,
            "year": year,
            "round_number": round_number,
            "session": session_name,
            "source": "OpenF1",
            "reason": "Positional track replay is available for 2023+ seasons where multi-car GPS coordinates are archived.",
        }

    sess = await resolve_session(year, round_number, session_name, schedule_event)
    if not sess:
        return {
            "replay_available": False,
            "year": year,
            "round_number": round_number,
            "session": session_name,
            "source": "OpenF1",
            "reason": f"No OpenF1 replay archive found for {year} Round {round_number} {session_name}.",
        }

    sk = int(sess["session_key"])
    if sk in _replay_meta_cache:
        return _replay_meta_cache[sk]["payload"]

    t0_dt = _parse_iso(sess.get("date_start"))
    t1_dt = _parse_iso(sess.get("date_end"))
    now_utc = datetime.now(timezone.utc)
    if t0_dt is None or t0_dt > now_utc:
        return {
            "replay_available": False,
            "year": year,
            "round_number": round_number,
            "session": session_name,
            "source": "OpenF1",
            "reason": "This session has not started yet.",
        }

    circuit, raw_drivers, raw_laps, raw_positions = await asyncio.gather(
        get_circuit_map(year, round_number, session_name, schedule_event),
        _get_raw_drivers(sk),
        _get_raw_laps(sk),
        _get_json("/position", params={"session_key": sk}),
    )

    if not circuit or not circuit.get("available") or not circuit.get("bounds"):
        return {
            "replay_available": False,
            "year": year,
            "round_number": round_number,
            "session": session_name,
            "source": "OpenF1",
            "reason": f"Track coordinate geometry is not available for {year} Round {round_number} {session_name}.",
        }

    if not raw_laps and not raw_positions:
        return {
            "replay_available": False,
            "year": year,
            "round_number": round_number,
            "session": session_name,
            "source": "OpenF1",
            "reason": "Positional car data has not been archived for this session yet.",
        }

    # Build drivers metadata list
    drivers_out: List[Dict[str, Any]] = []
    seen_nums = set()
    for d in raw_drivers:
        num = d.get("driver_number")
        if not isinstance(num, int) or num in seen_nums:
            continue
        seen_nums.add(num)
        raw_col = str(d.get("team_colour") or "").strip().lstrip("#")
        color = f"#{raw_col}" if len(raw_col) == 6 else "#94A3B8"
        drivers_out.append({
            "number": str(num),
            "abbr": str(d.get("name_acronym") or num).upper(),
            "full_name": str(d.get("full_name") or d.get("broadcast_name") or f"Car #{num}").strip(),
            "team": str(d.get("team_name") or "Unknown Team").strip(),
            "color": color,
        })
    drivers_out.sort(key=lambda item: int(item["number"]))

    # Map laps per driver relative to t0_dt
    laps_by_driver: Dict[str, List[Dict[str, Any]]] = {}
    max_lap_end = 0.0
    lap1_starts: List[float] = []
    max_lap_num = 0
    for row in raw_laps:
        num = row.get("driver_number")
        lap_num = row.get("lap_number")
        dt_start = _parse_iso(row.get("date_start"))
        if not isinstance(num, int) or not isinstance(lap_num, int) or lap_num < 1 or dt_start is None:
            continue
        t_start = max(0.0, (dt_start - t0_dt).total_seconds())
        dur = row.get("lap_duration")
        dur_f = float(dur) if isinstance(dur, (int, float)) and dur > 0 else None
        t_end = (t_start + dur_f) if dur_f is not None else None
        if t_end is not None and t_end > max_lap_end:
            max_lap_end = t_end
        elif t_start > max_lap_end:
            max_lap_end = t_start + 90.0
        if lap_num == 1:
            lap1_starts.append(t_start)
        if lap_num > max_lap_num:
            max_lap_num = lap_num
        key = str(num)
        laps_by_driver.setdefault(key, []).append({
            "lap": lap_num,
            "t_start": round(t_start, 2),
            "t_end": round(t_end, 2) if t_end is not None else None,
            "duration": round(dur_f, 3) if dur_f is not None else None,
        })

    for lst in laps_by_driver.values():
        lst.sort(key=lambda item: item["lap"])

    # Compute overall session duration seconds
    sched_dur = (t1_dt - t0_dt).total_seconds() if t1_dt and t1_dt > t0_dt else 0.0
    duration_seconds = max(int(round(max(sched_dur, max_lap_end))), 60)
    race_start_offset = 0
    if lap1_starts:
        race_start_offset = max(0, int(min(lap1_starts)) - 5)

    # Extract timestamped race position changes relative to t0_dt
    pos_events: List[Dict[str, Any]] = []
    for pr in raw_positions or []:
        dt_p = _parse_iso(pr.get("date"))
        num = pr.get("driver_number")
        pos = pr.get("position")
        if dt_p is None or not isinstance(num, int) or not isinstance(pos, int) or pos < 1:
            continue
        t_rel = max(0.0, min(float(duration_seconds), (dt_p - t0_dt).total_seconds()))
        pos_events.append({
            "t": round(t_rel, 2),
            "driver_number": str(num),
            "position": pos,
        })
    pos_events.sort(key=lambda item: item["t"])

    circuit_public = {k: v for k, v in circuit.items() if k != "bounds"}
    payload = {
        "replay_available": True,
        "year": year,
        "round_number": round_number,
        "session": str(sess.get("session_name") or session_name),
        "session_key": sk,
        "source": "OpenF1",
        "t0_iso": t0_dt.isoformat(),
        "duration_seconds": duration_seconds,
        "race_start_offset": race_start_offset,
        "total_laps": max_lap_num,
        "chunk_seconds": 300,
        "circuit": circuit_public,
        "drivers": drivers_out,
        "laps_by_driver": laps_by_driver,
        "position_events": pos_events,
    }
    _replay_meta_cache[sk] = {
        "t0_dt": t0_dt,
        "bounds": circuit["bounds"],
        "duration_seconds": duration_seconds,
        "payload": payload,
    }
    return payload


async def get_replay_positions(
    year: int,
    round_number: int,
    session_name: str,
    start_s: int,
    end_s: int,
    schedule_event: Optional[ScheduleEvent] = None,
) -> Optional[Dict[str, Any]]:
    """Fetch and downsample all drivers' positional trajectories over [start_s, end_s] into 1Hz SVG frames."""
    meta = await get_replay_metadata(year, round_number, session_name, schedule_event)
    if not meta.get("replay_available"):
        return None
    sk = int(meta["session_key"])
    cached_meta = _replay_meta_cache.get(sk)
    if not cached_meta:
        return None

    duration_seconds = int(cached_meta["duration_seconds"])
    s0 = max(0, int(start_s))
    s1 = min(duration_seconds, int(end_s))
    if s1 <= s0:
        return {"start_s": s0, "end_s": s1, "frames": []}

    chunk_key = (sk, s0, s1)
    if chunk_key in _replay_chunk_cache:
        return _replay_chunk_cache[chunk_key]

    t0_dt: datetime = cached_meta["t0_dt"]
    bounds: Dict[str, float] = cached_meta["bounds"]
    # Pad window by +/- 2s so boundary keyframes interpolate cleanly across chunk seams
    fetch_start = t0_dt + timedelta(seconds=max(0, s0 - 2))
    fetch_end = t0_dt + timedelta(seconds=s1 + 2)

    loc_url = (
        f"{OPENF1_BASE}/location?session_key={sk}"
        f"&date>={_fmt_openf1_ts(fetch_start)}&date<={_fmt_openf1_ts(fetch_end)}"
    )
    rows = await _get_json(loc_url)
    rows_by_driver: Dict[str, List[Tuple[float, float, float]]] = {}
    for row in rows or []:
        num = row.get("driver_number")
        dt_pt = _parse_iso(row.get("date"))
        x, y = row.get("x"), row.get("y")
        if not isinstance(num, int) or dt_pt is None or x is None or y is None:
            continue
        t_rel = (dt_pt - t0_dt).total_seconds()
        rows_by_driver.setdefault(str(num), []).append((t_rel, float(x), float(y)))

    for lst in rows_by_driver.values():
        lst.sort(key=lambda item: item[0])

    frames = _bin_positions_by_second(rows_by_driver, bounds, s0, s1)
    result = {
        "session_key": sk,
        "start_s": s0,
        "end_s": s1,
        "frames": frames,
    }
    _replay_chunk_cache[chunk_key] = result
    return result
