"""
Historical telemetry, lap timing, circuit geometry, weather, and race control
fallback powered by OpenF1 REST API (2023+ seasons).

Used automatically when FastF1 cannot load an uncached session (for example,
when Formula 1 live-timing static archives return HTTP 401 without F1TV auth).
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Sequence, Tuple

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


def normalize_track_xy(
    raw_points: Sequence[Tuple[float, float]],
    raw_corners: Sequence[Dict[str, Any]] = (),
    target_size: float = 840.0,
    pad: float = 80.0,
) -> Tuple[List[Dict[str, float]], List[Dict[str, Any]]]:
    """Scale rotated track X/Y coordinates and corner markers into a 1000x1000 SVG box."""
    xs = [p[0] for p in raw_points]
    ys = [p[1] for p in raw_points]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    w = max(max_x - min_x, 1.0)
    h = max(max_y - min_y, 1.0)
    scale = target_size / max(w, h)
    ox = pad + (target_size - w * scale) / 2.0
    oy = pad + (target_size - h * scale) / 2.0

    norm_pts = [
        {"x": round(ox + (x - min_x) * scale, 2), "y": round(oy + (max_y - y) * scale, 2)}
        for x, y in raw_points
    ]
    norm_corners = [
        {
            "number": c.get("number"),
            "letter": str(c.get("letter") or "").strip(),
            "x": round(ox + (float(c["x"]) - min_x) * scale, 2),
            "y": round(oy + (max_y - float(c["y"])) * scale, 2),
        }
        for c in raw_corners
        if c.get("x") is not None and c.get("y") is not None
    ]
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


async def _get_json(url_or_path: str, params: Optional[Dict[str, Any]] = None) -> Optional[List[Dict[str, Any]]]:
    from app.services import openf1_auth

    url = url_or_path if url_or_path.startswith("http") else f"{OPENF1_BASE}{url_or_path}"
    headers = await openf1_auth.headers() if openf1_auth.configured() else {}

    for attempt in range(2):
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(url, params=params, headers=headers)
            if resp.status_code == 429 and attempt == 0:
                await asyncio.sleep(0.45)
                continue
            if resp.status_code == 200:
                payload = resp.json()
                return payload if isinstance(payload, list) else None
            logger.debug("OpenF1 historical %s returned HTTP %s", url, resp.status_code)
            return None
        except Exception as exc:
            logger.warning("OpenF1 historical request failed (%s): %s", url_or_path, exc)
            return None
    return None


async def _get_year_sessions(year: int) -> List[Dict[str, Any]]:
    if year < 2023:
        return []
    if year in _sessions_cache:
        return _sessions_cache[year]
    data = await _get_json("/sessions", params={"year": year})
    rows = data if isinstance(data, list) else []
    if rows:
        _sessions_cache[year] = rows
    return rows


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
    data = await _get_json("/drivers", params={"session_key": session_key})
    rows = data if isinstance(data, list) else []
    if rows:
        _drivers_cache[session_key] = rows
    return rows


async def _get_raw_stints(session_key: int) -> List[Dict[str, Any]]:
    if session_key in _stints_cache:
        return _stints_cache[session_key]
    data = await _get_json("/stints", params={"session_key": session_key})
    rows = data if isinstance(data, list) else []
    if rows:
        _stints_cache[session_key] = rows
    return rows


async def _get_raw_laps(session_key: int, driver_number: Optional[int] = None) -> List[Dict[str, Any]]:
    cache_key = (session_key, driver_number)
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

    pts_raw: List[Tuple[float, float]] = []
    for row in sorted(loc_raw, key=lambda r: str(r.get("date") or "")):
        if row.get("x") is not None and row.get("y") is not None:
            pts_raw.append((float(row["x"]), float(row["y"])))

    if len(pts_raw) < 20:
        return None
    if len(pts_raw) > 320:
        step = max(1, len(pts_raw) // 320)
        pts_raw = pts_raw[::step]

    norm_pts, _ = normalize_track_xy(pts_raw)

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
    }
    _circuit_cache[sk] = payload
    return payload


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

