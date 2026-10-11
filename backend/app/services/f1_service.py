from app.services.metadata import team_display_name, NUMBERS_2026
import fastf1
import pandas as pd
import numpy as np
import logging
import json
import os
import time
import httpx
from typing import Optional, Dict, Any, List
from datetime import datetime
from cachetools import TTLCache
from app.models.schemas import (
    SessionInfo, LeaderboardEntry, LapTime,
    TelemetryPoint, WeatherData, RaceControlMessage,
    Driver, Constructor, ScheduleEvent, StandingsEntry
)

logger = logging.getLogger(__name__)

# In-memory TTL caches
_session_cache: TTLCache = TTLCache(maxsize=20, ttl=600)   # sessions live 10 min
_data_cache: TTLCache = TTLCache(maxsize=200, ttl=300)     # general data: 5 min
_news_cache: TTLCache = TTLCache(maxsize=5, ttl=600)       # news: 10 min

# Disk cache directory (alongside existing fastf1 cache)
_DISK_CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "cache", "standings")
os.makedirs(_DISK_CACHE_DIR, exist_ok=True)

# Jolpica/Ergast API base (no API key required)
from app.services.jolpica import BASE as _JOLPICA_BASE
_JOLPICA_CACHE_TTL_SECONDS = 3600  # 1 hour

# Constructor name normalization map — canonical mapping from ALL Jolpica/Ergast/FastF1
# variant strings to our internal canonical name used in TEAM_COLORS.
_CONSTRUCTOR_NAME_MAP: Dict[str, str] = {
    # Mercedes
    "Mercedes": "Mercedes",
    "Mercedes-AMG Petronas F1 Team": "Mercedes",
    # Ferrari
    "Ferrari": "Ferrari",
    "Scuderia Ferrari": "Ferrari",
    "Scuderia Ferrari HP": "Ferrari",
    # McLaren
    "McLaren": "McLaren",
    "McLaren F1 Team": "McLaren",
    # Red Bull
    "Red Bull": "Red Bull Racing",
    "Red Bull Racing": "Red Bull Racing",
    "Red Bull Racing Honda RBPT": "Red Bull Racing",
    # Aston Martin
    "Aston Martin": "Aston Martin",
    "Aston Martin Aramco F1 Team": "Aston Martin",
    "Aston Martin F1 Team": "Aston Martin",
    # Alpine
    "Alpine F1 Team": "Alpine",
    "Alpine": "Alpine",
    "Alpine BWT F1 Team": "Alpine",
    "BWT Alpine F1 Team": "Alpine",
    # Williams
    "Williams": "Williams",
    "Williams Racing": "Williams",
    # Racing Bulls / RB
    "RB F1 Team": "Racing Bulls",
    "RB": "Racing Bulls",
    "Racing Bulls": "Racing Bulls",
    "Visa Cash App RB F1 Team": "Racing Bulls",
    "AlphaTauri": "Racing Bulls",
    "Alpha Tauri": "Racing Bulls",
    "Scuderia AlphaTauri Honda": "Racing Bulls",
    # Haas
    "Haas F1 Team": "Haas F1 Team",
    "Haas": "Haas F1 Team",
    "MoneyGram Haas F1 Team": "Haas F1 Team",
    # Kick Sauber / Audi
    "Kick Sauber": "Audi",
    "Sauber": "Audi",
    "Stake F1 Team Kick Sauber": "Audi",
    "Alfa Romeo": "Audi",
    "Audi": "Audi",
    # Cadillac
    "Cadillac F1 Team": "Cadillac",
    "Cadillac": "Cadillac",
    "Andretti Global": "Cadillac",
}

TEAM_COLORS: Dict[str, str] = {
    "Red Bull Racing": "#3671C6",
    "Ferrari": "#E8002D",
    "Mercedes": "#27F4D2",
    "McLaren": "#FF8000",
    "Aston Martin": "#229971",
    "Alpine": "#FF87BC",
    "Williams": "#64C4FF",
    "Racing Bulls": "#6692FF",   # was "RB"
    "Haas F1 Team": "#B6BABD",
    "Audi": "#C0C0C0",           # was "Kick Sauber"
    "Cadillac": "#BA0000",
}

COMPOUND_COLORS: Dict[str, str] = {
    "SOFT": "#FF3333",
    "MEDIUM": "#FFD700",
    "HARD": "#FFFFFF",
    "INTERMEDIATE": "#39B54A",
    "WET": "#0067FF",
    "UNKNOWN": "#888888",
}


def normalize_constructor(name: str, year: int) -> str:
    if year < 2026 and name in ("Sauber", "Kick Sauber", "Stake F1 Team Kick Sauber", "Alfa Romeo"):
        return name
    if year < 2025 and name in ("AlphaTauri", "Alpha Tauri", "Scuderia AlphaTauri Honda", "RB", "RB F1 Team"):
        return name
    return _CONSTRUCTOR_NAME_MAP.get(name, name)


def _session_date(row, number):
    """FastF1 UTC columns are naive UTC; local columns must retain their offset."""
    value = row.get(f"Session{number}DateUtc")
    if value is not None and pd.notna(value):
        return pd.to_datetime(value, utc=True)
    value = row.get(f"Session{number}Date")
    if value is None or pd.isna(value):
        return None
    stamp = pd.Timestamp(value)
    return stamp.tz_convert("UTC") if stamp.tzinfo else None


def _safe_val(val, default=None):
    """Safely convert pandas/numpy values to Python native types."""
    if val is None:
        return default
    try:
        if pd.isna(val):
            return default
    except Exception:
        pass
    if isinstance(val, (np.integer,)):
        return int(val)
    if isinstance(val, (np.floating,)):
        return float(val)
    if isinstance(val, pd.Timedelta):
        return val.total_seconds()
    return val


def _timedelta_to_str(td) -> Optional[str]:
    """Convert timedelta to lap time string like 1:23.456"""
    try:
        if pd.isna(td):
            return None
    except Exception:
        pass
    if isinstance(td, pd.Timedelta):
        total_seconds = td.total_seconds()
        if total_seconds < 0:
            return None
        minutes = int(total_seconds // 60)
        seconds = total_seconds % 60
        if minutes > 0:
            return f"{minutes}:{seconds:06.3f}"
        return f"{seconds:.3f}"
    return None


async def get_current_session_info() -> Optional[SessionInfo]:
    year = datetime.now().year
    context = await get_season_context(year)
    event = context.get("next_race") or context.get("latest_completed_race")
    if not event:
        return None
    return SessionInfo(year=year, round_number=event["round_number"],
        country=event["country"], circuit=event["location"], session_name="Race",
        session_type="Race", date=event.get("session5_date"),
        status="UPCOMING" if context.get("next_race") else "ARCHIVE", is_live=False)


async def get_schedule(year: int) -> List[ScheduleEvent]:
    """Return the full race calendar for a given year."""
    cache_key = f"schedule_{year}"
    if cache_key in _data_cache:
        return _data_cache[cache_key]

    try:
        schedule = await asyncio.to_thread(fastf1.get_event_schedule, year, include_testing=False)
        now = pd.Timestamp.now(tz="UTC")
        events = []
        for _, row in schedule.iterrows():
            s5_date = _session_date(row, 5)
            is_completed = s5_date is not None and s5_date + pd.Timedelta(hours=4) <= now
            event_date = row.get("EventDate")
            events.append(ScheduleEvent(
                round_number=int(row.get("RoundNumber", 0)),
                country=str(row.get("Country", "")),
                location=str(row.get("Location", "")),
                event_name=str(row.get("EventName", "")),
                event_date=str(event_date) if pd.notna(event_date) else None,
                session1=str(row.get("Session1", "")) or None,
                session1_date=_session_date(row, 1).isoformat() if _session_date(row, 1) is not None else None,
                session2=str(row.get("Session2", "")) or None,
                session2_date=_session_date(row, 2).isoformat() if _session_date(row, 2) is not None else None,
                session3=str(row.get("Session3", "")) or None,
                session3_date=_session_date(row, 3).isoformat() if _session_date(row, 3) is not None else None,
                session4=str(row.get("Session4", "")) or None,
                session4_date=_session_date(row, 4).isoformat() if _session_date(row, 4) is not None else None,
                session5=str(row.get("Session5", "")) or None,
                session5_date=_session_date(row, 5).isoformat() if _session_date(row, 5) is not None else None,
                is_completed=is_completed,
                is_upcoming=not is_completed,
            ))
        _data_cache[cache_key] = events
        return events
    except Exception as e:
        logger.error(f"get_schedule error: {e}")
        return []


import asyncio

def _load_session_sync(year: int, round_number: int, session_name: str = "Race", 
                       laps: bool = False, telemetry: bool = False, weather: bool = False, messages: bool = False):
    """Load and cache a FastF1 session synchronously, loading only requested data channels."""
    cache_key = f"session_{year}_{round_number}_{session_name}_{laps}_{telemetry}_{weather}_{messages}"
    if cache_key in _session_cache:
        return _session_cache[cache_key]
    try:
        session = fastf1.get_session(year, round_number, session_name)
        session.load(laps=laps, telemetry=telemetry, weather=weather, messages=messages)
        _session_cache[cache_key] = session
        return session
    except Exception as e:
        logger.error(f"_load_session error ({year} R{round_number} {session_name}): {e}")
        return None

async def _load_session(year: int, round_number: int, session_name: str = "Race", 
                        laps: bool = False, telemetry: bool = False, weather: bool = False, messages: bool = False):
    """Async wrapper with 30s timeout to prevent hanging endpoints, with granular data loading."""
    cache_key = f"session_{year}_{round_number}_{session_name}_{laps}_{telemetry}_{weather}_{messages}"
    if cache_key in _session_cache:
        return _session_cache[cache_key]
    
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(_load_session_sync, year, round_number, session_name, laps, telemetry, weather, messages), 
            timeout=30.0
        )
    except asyncio.TimeoutError:
        logger.warning(f"Session load timed out for {year} R{round_number} {session_name}")
        return None
    except Exception as e:
        logger.error(f"_load_session async error ({year} R{round_number} {session_name}): {e}")
        return None


async def get_leaderboard(year: int, round_number: int, session_name: str = "Race") -> List[LeaderboardEntry]:
    if session_name in ("Race", "R"):
        official = await get_season_results(year)
        rows = official.get("results", {}).get(str(round_number), [])
        if rows:
            return [LeaderboardEntry(**row) for row in rows]
    cache_key = f"leaderboard_{year}_{round_number}_{session_name}"
    if cache_key in _data_cache:
        return _data_cache[cache_key]

    try:
        session = await _load_session(year, round_number, session_name, laps=False, telemetry=False, weather=False, messages=False)
        if session is None:
            # Do NOT return fake data — return empty list so frontend shows error state
            return []

        results = session.results
        if results is None or results.empty:
            return []

        entries = []
        for pos, (_, row) in enumerate(results.iterrows(), start=1):
            team = str(row.get("TeamName", ""))
            entries.append(LeaderboardEntry(
                position=int(row["Position"]) if pd.notna(row.get("Position")) else 0,
                status=_safe_val(row.get("Status")),
                laps=_safe_val(row.get("Laps")),
                driver_number=str(row.get("DriverNumber", "")),
                driver_name=str(row.get("FullName", "")),
                abbreviation=str(row.get("Abbreviation", "")),
                team=team,
                team_color=TEAM_COLORS.get(team, "#888888"),
                gap_to_leader=str(row.get("Time", "")) if pd.notna(row.get("Time")) else None,
                points=_safe_val(row.get("Points"), 0),
            ))
        _data_cache[cache_key] = entries
        return entries
    except Exception as e:
        logger.error(f"get_leaderboard error: {e}")
        return []


async def get_laps(year: int, round_number: int, session_name: str = "Race",
                   driver: Optional[str] = None) -> List[LapTime]:
    cache_key = f"laps_{year}_{round_number}_{session_name}_{driver or 'all'}"
    if cache_key in _data_cache:
        return _data_cache[cache_key]

    try:
        session = await _load_session(year, round_number, session_name, laps=True, telemetry=False, weather=False, messages=False)
        if session is None:
            return []

        laps = session.laps
        if driver:
            laps = laps[laps["DriverNumber"] == driver]

        best_lap_time = laps["LapTime"].min()
        result = []
        for _, lap in laps.iterrows():
            lap_time = _safe_val(lap.get("LapTime"))
            result.append(LapTime(
                driver_number=str(lap.get("DriverNumber", "")),
                lap_number=int(_safe_val(lap.get("LapNumber"), 0)),
                lap_time=_timedelta_to_str(lap.get("LapTime")),
                sector1=_timedelta_to_str(lap.get("Sector1Time")),
                sector2=_timedelta_to_str(lap.get("Sector2Time")),
                sector3=_timedelta_to_str(lap.get("Sector3Time")),
                compound=str(lap.get("Compound", "UNKNOWN")),
                tyre_life=int(_safe_val(lap.get("TyreLife"), 0)),
                is_personal_best=bool(lap.get("IsPersonalBest", False)),
                is_overall_best=(lap.get("LapTime") == best_lap_time),
                pit_in=bool(lap.get("PitInTime") and not pd.isna(lap.get("PitInTime"))),
                pit_out=bool(lap.get("PitOutTime") and not pd.isna(lap.get("PitOutTime"))),
            ))
        _data_cache[cache_key] = result
        return result
    except Exception as e:
        logger.error(f"get_laps error: {e}")
        return []


async def get_telemetry(year: int, round_number: int, session_name: str,
                        driver: str, lap_number: Optional[int] = None) -> List[TelemetryPoint]:
    cache_key = f"telemetry_{year}_{round_number}_{session_name}_{driver}_{lap_number}"
    if cache_key in _data_cache:
        return _data_cache[cache_key]

    try:
        session = await _load_session(year, round_number, session_name, laps=True, telemetry=True, weather=False, messages=False)
        if session is None:
            return []

        driver_laps = session.laps.pick_driver(driver)
        if driver_laps.empty:
            return []
        if lap_number:
            lap = driver_laps[driver_laps["LapNumber"] == lap_number].iloc[0]
        else:
            lap = driver_laps.pick_fastest()

        try:
            telemetry = lap.get_telemetry()
        except:
            return []
        
        if telemetry.empty:
            return []

        # Downsample to ~500 points max
        if len(telemetry) > 500:
            telemetry = telemetry.iloc[::len(telemetry)//500]

        points = []
        for _, row in telemetry.iterrows():
            t = row.get("Time")
            time_s = t.total_seconds() if isinstance(t, pd.Timedelta) else 0
            points.append(TelemetryPoint(
                time=round(time_s, 3),
                speed=_safe_val(row.get("Speed")),
                rpm=_safe_val(row.get("RPM")),
                throttle=_safe_val(row.get("Throttle")),
                brake=float(row.get("Brake", 0)),
                gear=int(_safe_val(row.get("nGear"), 0)),
                drs=int(_safe_val(row.get("DRS"), 0)),
                distance=_safe_val(row.get("Distance")),
                x=_safe_val(row.get("X")),
                y=_safe_val(row.get("Y")),
                z=_safe_val(row.get("Z")),
            ))
        _data_cache[cache_key] = points
        return points
    except Exception as e:
        logger.error(f"get_telemetry error: {e}")
        return []


async def get_weather(year: int, round_number: int, session_name: str = "Race") -> Optional[WeatherData]:
    cache_key = f"weather_{year}_{round_number}_{session_name}"
    if cache_key in _data_cache:
        return _data_cache[cache_key]

    try:
        session = await _load_session(year, round_number, session_name, laps=False, telemetry=False, weather=True, messages=False)
        if session is None or session.weather_data is None or session.weather_data.empty:
            return None  # Do NOT fabricate weather data

        last = session.weather_data.iloc[-1]
        data = WeatherData(
            air_temp=_safe_val(last.get("AirTemp")),
            track_temp=_safe_val(last.get("TrackTemp")),
            humidity=_safe_val(last.get("Humidity")),
            pressure=_safe_val(last.get("Pressure")),
            wind_speed=_safe_val(last.get("WindSpeed")),
            wind_direction=_safe_val(last.get("WindDirection")),
            rainfall=bool(last.get("Rainfall", False)),
        )
        _data_cache[cache_key] = data
        return data
    except Exception as e:
        logger.error(f"get_weather error: {e}")
        return None


async def get_race_control(year: int, round_number: int, session_name: str = "Race") -> List[RaceControlMessage]:
    cache_key = f"race_control_{year}_{round_number}_{session_name}"
    if cache_key in _data_cache:
        return _data_cache[cache_key]

    try:
        session = await _load_session(year, round_number, session_name, laps=False, telemetry=False, weather=False, messages=True)
        if session is None or session.race_control_messages is None:
            return []

        messages = []
        for _, row in session.race_control_messages.iterrows():
            messages.append(RaceControlMessage(
                time=str(row.get("Time", "")),
                lap=int(_safe_val(row.get("Lap"), 0)) or None,
                category=str(row.get("Category", "")),
                message=str(row.get("Message", "")),
                flag=str(row.get("Flag", "")) or None,
                scope=str(row.get("Scope", "")) or None,
            ))
        _data_cache[cache_key] = messages
        return messages
    except Exception as e:
        logger.error(f"get_race_control error: {e}")
        return []


async def get_drivers(year: int, round_number: int) -> List[Driver]:
    cache_key = f"drivers_{year}_{round_number}"
    if cache_key in _data_cache:
        return _data_cache[cache_key]

    try:
        session = await _load_session(year, round_number, "Race", laps=False, telemetry=False, weather=False, messages=False)
        if session is None:
            return []

        drivers = []
        for _, row in session.results.iterrows():
            team = str(row.get("TeamName", ""))
            drivers.append(Driver(
                driver_number=str(row.get("DriverNumber", "")),
                full_name=str(row.get("FullName", "")),
                abbreviation=str(row.get("Abbreviation", "")),
                team_name=team,
                team_color=TEAM_COLORS.get(team, "#888888"),
                nationality=str(row.get("CountryCode", "")),
                points=_safe_val(row.get("Points"), 0),
                position=int(_safe_val(row.get("Position"), 0)) or None,
            ))
        _data_cache[cache_key] = drivers
        return drivers
    except Exception as e:
        logger.error(f"get_drivers error: {e}")
        return []


def _standings_disk_cache_path(year: int, kind: str) -> str:
    return os.path.join(_DISK_CACHE_DIR, f"v2_{kind}_{year}.json")


def _load_standings_from_disk(year: int, kind: str) -> Optional[list]:
    """Return cached standings list if file exists and is < TTL seconds old."""
    path = _standings_disk_cache_path(year, kind)
    try:
        if not os.path.exists(path):
            return None
        age = time.time() - os.path.getmtime(path)
        if age > _JOLPICA_CACHE_TTL_SECONDS:
            return None
        with open(path, "r", encoding="utf-8") as f:
            raw = json.load(f)
            return [StandingsEntry(**entry).model_dump() for entry in raw] if isinstance(raw, list) else None
    except Exception as e:
        logger.warning(f"Disk cache read error ({path}): {e}")
        return None


def _save_standings_to_disk(year: int, kind: str, data: list) -> None:
    path = _standings_disk_cache_path(year, kind)
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f)
    except Exception as e:
        logger.warning(f"Disk cache write error ({path}): {e}")


async def _fetch_jolpica_driver_standings(year: int) -> List[StandingsEntry]:
    """Fetch driver championship standings from Jolpica (Ergast-compatible) API."""
    url = f"{_JOLPICA_BASE}/{year}/driverStandings.json"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
        lists = data["MRData"]["StandingsTable"]["StandingsLists"]
        if not lists:
            return []
        if int(lists[0]["season"]) != year:
            raise ValueError("Provider returned another season")
        standings_raw = lists[0]["DriverStandings"]
        entries: List[StandingsEntry] = []
        for item in standings_raw:
            driver = item["Driver"]
            constructor_name = item["Constructors"][0]["name"] if item.get("Constructors") else ""
            team_normalized = normalize_constructor(constructor_name, year)
            full_name = f"{driver['givenName']} {driver['familyName']}"
            entries.append(StandingsEntry(
                position=int(item["position"]),
                name=full_name,
                driver_id=driver.get("driverId"),
                code=driver.get("code"),
                number=NUMBERS_2026.get(driver.get("driverId")) if year == 2026 else None,
                points=float(item["points"]),
                wins=int(item["wins"]),
                team=team_normalized,
                nationality=driver.get("nationality", ""),
                color=TEAM_COLORS.get(team_normalized, "#888888"),
            ))
        return entries
    except Exception as e:
        logger.error(f"Jolpica driver standings fetch error: {e}")
        return []


async def _fetch_jolpica_constructor_standings(year: int) -> List[StandingsEntry]:
    """Fetch constructor championship standings from Jolpica API."""
    url = f"{_JOLPICA_BASE}/{year}/constructorStandings.json"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
        lists = data["MRData"]["StandingsTable"]["StandingsLists"]
        if not lists:
            return []
        if int(lists[0]["season"]) != year:
            raise ValueError("Provider returned another season")
        standings_raw = lists[0]["ConstructorStandings"]
        entries: List[StandingsEntry] = []
        for item in standings_raw:
            constructor_name = item["Constructor"]["name"]
            team_normalized = normalize_constructor(constructor_name, year)
            entries.append(StandingsEntry(
                position=int(item["position"]),
                name=team_normalized,
                constructor_id=item["Constructor"].get("constructorId"),
                display_name=team_display_name(team_normalized, year),
                points=float(item["points"]),
                wins=int(item["wins"]),
                color=TEAM_COLORS.get(team_normalized, "#888888"),
            ))
        return entries
    except Exception as e:
        logger.error(f"Jolpica constructor standings fetch error: {e}")
        return []


async def get_standings(year: int) -> Dict[str, List[StandingsEntry]]:
    """Return driver and constructor championship standings via Jolpica API.
    
    Data source priority:
      1. In-memory TTL cache (60s)
      2. Disk cache (1h) — survives server restart
      3. Live Jolpica API call
      4. Empty list (DO NOT generate fake data)
    """
    cache_key = f"standings_{year}"
    if cache_key in _data_cache:
        return _data_cache[cache_key]

    # Try disk cache first
    cached_drivers_raw = _load_standings_from_disk(year, "drivers")
    cached_constructors_raw = _load_standings_from_disk(year, "constructors")

    if cached_drivers_raw is not None and cached_constructors_raw is not None:
        logger.info(f"Standings for {year} loaded from disk cache")
        driver_standings = [StandingsEntry(**d) for d in cached_drivers_raw]
        constructor_standings = [StandingsEntry(**c) for c in cached_constructors_raw]
        result = {"drivers": driver_standings, "constructors": constructor_standings}
        _data_cache[cache_key] = result
        return result

    # Live fetch from Jolpica API
    logger.info(f"Fetching live standings for {year} from Jolpica API")
    driver_standings = await _fetch_jolpica_driver_standings(year)
    constructor_standings = await _fetch_jolpica_constructor_standings(year)

    if driver_standings:
        _save_standings_to_disk(year, "drivers", [e.model_dump() for e in driver_standings])
    if constructor_standings:
        _save_standings_to_disk(year, "constructors", [e.model_dump() for e in constructor_standings])

    result = {"drivers": driver_standings, "constructors": constructor_standings}
    if driver_standings or constructor_standings:
        _data_cache[cache_key] = result
    return result

import xml.etree.ElementTree as ET

async def get_news(year: int = 2026, country: str = None) -> List[Dict[str, str]]:
    from app.services.news_service import get_feed
    from app.services.jolpica import ProviderError
    return (await get_feed())["articles"][:12]


_ENGINE_SUPPLIER_COLORS: Dict[str, str] = {
    "Mercedes":   "#27F4D2",
    "Ferrari":    "#E8002D",
    "Ford RBPT":  "#3671C6",
    "Honda":      "#229971",
    "Audi":       "#C0C0C0",
    "Honda RBPT": "#3671C6",
    "Renault":    "#FF87BC",
    "Other":      "#888888",
}

async def get_engine_standings(year: int):
    cache_key = f"engine_standings_{year}"
    if cache_key in _data_cache:
        return _data_cache[cache_key]

    # Year-aware Engine / Power Unit mappings
    if year >= 2026:
        ENGINE_MAP = {
            "Mercedes": "Mercedes", "McLaren": "Mercedes", "Alpine": "Mercedes", "Williams": "Mercedes",
            "Ferrari": "Ferrari", "Haas F1 Team": "Ferrari", "Cadillac": "Ferrari",
            "Red Bull Racing": "Ford RBPT", "Racing Bulls": "Ford RBPT",
            "Aston Martin": "Honda",
            "Audi": "Audi"
        }
    elif year == 2025:
        ENGINE_MAP = {
            "Mercedes": "Mercedes", "McLaren": "Mercedes", "Williams": "Mercedes",
            "Ferrari": "Ferrari", "Haas F1 Team": "Ferrari", "Kick Sauber": "Ferrari", "Sauber": "Ferrari", "Alfa Romeo": "Ferrari",
            "Red Bull Racing": "Honda RBPT", "Racing Bulls": "Honda RBPT", "RB": "Honda RBPT", "RB F1 Team": "Honda RBPT",
            "Aston Martin": "Mercedes",
            "Alpine": "Renault"
        }
    elif year == 2024:
        ENGINE_MAP = {
            "Mercedes": "Mercedes", "McLaren": "Mercedes", "Williams": "Mercedes", "Aston Martin": "Mercedes",
            "Ferrari": "Ferrari", "Haas F1 Team": "Ferrari", "Kick Sauber": "Ferrari", "Sauber": "Ferrari", "Alfa Romeo": "Ferrari",
            "Red Bull Racing": "Honda RBPT", "Racing Bulls": "Honda RBPT", "RB": "Honda RBPT", "RB F1 Team": "Honda RBPT",
            "Alpine": "Renault"
        }
    
    else:
        return []  # Historical supplier relationships not verified for this season.

    standings = (await get_standings(year))["constructors"]
    engines: Dict[str, Any] = {}
    team_points: Dict[str, Dict[str, Any]] = {}  # for contribution tracking
    
    for c in standings:
        engine = ENGINE_MAP.get(c.name, "Other")
        if engine not in engines:
            engines[engine] = {"name": engine, "points": 0.0, "wins": 0, "teams": [], "team_points": {}}
        engines[engine]["points"] += c.points
        engines[engine]["wins"] += c.wins
        engines[engine]["teams"].append(c.name)
        engines[engine]["team_points"][c.name] = c.points
        
    engine_list = list(engines.values())
    engine_list.sort(key=lambda x: x["points"], reverse=True)
    for i, eng in enumerate(engine_list):
        eng["position"] = i + 1
        eng["color"] = _ENGINE_SUPPLIER_COLORS.get(eng["name"], "#888888")
        # Compute percentage breakdown
        total = eng["points"] or 1
        eng["breakdown"] = [
            {"team": t, "points": p, "pct": round(p / total * 100, 1)}
            for t, p in eng["team_points"].items()
        ]
        del eng["team_points"]
        
    _data_cache[cache_key] = engine_list
    return engine_list


async def get_insights(year: int) -> Dict[str, Any]:
    cache_key = f"insights_{year}"
    if cache_key in _data_cache:
        return _data_cache[cache_key]
        
    insights = {
        "driver_in_form": {"name": "—", "stat": "TBD"},
        "qualifying_p1_leader": {"name": "—", "stat": "Unavailable"},
        "biggest_gainer": {"name": "—", "stat": "TBD"},
        "recent_winner": {"name": "—", "stat": "TBD"},
        "constructor_leader": {"name": "—", "stat": "TBD"},
    }
    
    try:
        standings = await get_standings(year)
        drivers = standings["drivers"]
        constructors = standings["constructors"]
        
        if constructors:
            leader = constructors[0]
            insights["constructor_leader"] = {"name": leader.name, "stat": f"{int(leader.points)} pts"}
            
        if drivers:
            leader = drivers[0]
            insights["driver_in_form"] = {"name": leader.name, "stat": "Championship Leader"}
            
        schedule = await get_schedule(year)
        past_races = [r for r in schedule if r.is_completed]
        
        if past_races:
            last_race = past_races[-1]
            url = f"{_JOLPICA_BASE}/{year}/{last_race.round_number}/results.json"
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    races = data["MRData"]["RaceTable"]["Races"]
                    if races:
                        results = races[0]["Results"]
                        if results:
                            winner = results[0]
                            # Use event_name or location — NEVER country (country = "United States" for Miami)
                            gp_label = last_race.event_name or f"{last_race.location or last_race.country} Grand Prix"
                            w_name = f"{winner['Driver']['givenName']} {winner['Driver']['familyName']}"
                            insights["recent_winner"] = {"name": w_name, "stat": f"{gp_label} Winner"}
                            
                            max_gained = 0
                            gainer_name = "—"
                            for res in results:
                                try:
                                    grid = int(res["grid"])
                                    pos = int(res["position"])
                                    gained = grid - pos
                                    if gained > max_gained and grid > 0:
                                        max_gained = gained
                                        gainer_name = f"{res['Driver']['givenName']} {res['Driver']['familyName']}"
                                except Exception as _e: logger.warning(f"insights sub-fetch error: {_e}")
                            if max_gained > 0:
                                insights["biggest_gainer"] = {"name": gainer_name, "stat": f"+{max_gained} Positions"}
                                
            # Qualifying P1 classification is not an all-era official pole tally.
            url_qual = f"{_JOLPICA_BASE}/{year}/qualifying/1.json?limit=100"
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url_qual)
                if resp.status_code == 200:
                    data = resp.json()
                    races = data["MRData"]["RaceTable"]["Races"]
                    qualifying_p1_counts: Dict[str, int] = {}
                    for r in races:
                        try:
                            qual_results = r.get("QualifyingResults", [])
                            first = next((row for row in qual_results if str(row.get("position")) == "1"), None)
                            if first and first.get("status", "").casefold() not in {"disqualified", "did not start", "excluded"}:
                                driver = first["Driver"]
                                name = f"{driver['givenName']} {driver['familyName']}"
                                qualifying_p1_counts[name] = qualifying_p1_counts.get(name, 0) + 1
                        except Exception as _e: logger.warning(f"insights sub-fetch error: {_e}")
                    if qualifying_p1_counts:
                        leader = max(qualifying_p1_counts.items(), key=lambda x: x[1])
                        insights["qualifying_p1_leader"] = {"name": leader[0], "stat": f"{leader[1]} Qualifying P1 Classification{'s' if leader[1] > 1 else ''} This Season"}

        _data_cache[cache_key] = insights
    except Exception as e:
        logger.error(f"get_insights error: {e}")
        
    return insights


async def get_season_context(year: int) -> Dict[str, Any]:
    """
    Canonical season state resolver — SINGLE SOURCE OF TRUTH.
    Determines: current_round, latest completed race, next race.
    Uses official schedule event dates ONLY — never infers from standings or cache.
    """
    cache_key = f"season_context_{year}"
    if cache_key in _data_cache:
        return _data_cache[cache_key]

    schedule = await get_schedule(year)
    if not schedule:
        return {
            "year": year, "completed_rounds": 0, "total_rounds": 0,
            "current_round": 1, "latest_completed_race": None, "next_race": None,
        }

    now = pd.Timestamp.now(tz="UTC")

    # Filter schedule
    completed = sorted([e for e in schedule if e.is_completed], key=lambda x: x.round_number)
    upcoming = sorted([e for e in schedule if not e.is_completed], key=lambda x: x.round_number)

    # Use the same normalized schedule consumed by every route.
    active_event = None
    for event in upcoming:
        start = pd.to_datetime(event.session1_date, utc=True) if event.session1_date else None
        end = pd.to_datetime(event.session5_date, utc=True) if event.session5_date else None
        if start is not None and end is not None and start <= now < end + pd.Timedelta(hours=4):
            active_event = event
            break

    latest_completed = completed[-1] if completed else None
    
    if active_event:
        # During an active weekend, the current round is the active round
        current_round = active_event.round_number
        next_race = active_event
    else:
        next_race = upcoming[0] if upcoming else None
        current_round = next_race.round_number if next_race else (latest_completed.round_number if latest_completed else 1)

    ctx = {
        "year": year,
        "completed_rounds": len(completed),
        "total_rounds": len(schedule),
        "current_round": current_round,
        "is_active_weekend": active_event is not None,
        "latest_completed_race": latest_completed.model_dump() if latest_completed else None,
        "next_race": next_race.model_dump() if next_race else None,
        # Include first 5 upcoming races for dashboard panel (avoids separate schedule fetch)
        "upcoming_schedule": [e.model_dump() for e in upcoming[:5]],
    }

    _data_cache[cache_key] = ctx
    return ctx


async def get_dashboard_context(year: int) -> Dict[str, Any]:
    """
    Single aggregated response for the Dashboard page.
    Synthesizes season context, standings, insights, news, and schedule.
    Provides historically accurate context-aware news based on the selected year and event.
    """
    cache_key = f"dashboard_context_{year}"
    if cache_key in _data_cache:
        return _data_cache[cache_key]

    season_ctx = await get_season_context(year)
    active_event = season_ctx.get("next_race")  # If active weekend, next_race is the active one!
    country = active_event.get("country") if active_event else None

    results = await asyncio.gather(
        get_standings(year),
        get_insights(year),
        get_news(year, country),
        return_exceptions=True,
    )

    standings   = results[0] if isinstance(results[0], dict) else {}
    insights    = results[1] if isinstance(results[1], dict) else {}
    news        = results[2] if isinstance(results[2], list) else []

    drivers      = standings.get("drivers", [])
    constructors = standings.get("constructors", [])
    upcoming     = season_ctx.get("upcoming_schedule", [])

    result = {
        "season_context": season_ctx,
        "driver_standings":      [e.model_dump() for e in drivers],
        "constructor_standings": [e.model_dump() for e in constructors],
        "insights": insights,
        "news": news[:6],
        "news_status": "unavailable" if isinstance(results[2], Exception) else "available",
        "upcoming_schedule": upcoming,
    }

    _data_cache[cache_key] = result
    return result


async def get_season_results(year: int) -> Dict[str, Any]:
    """Paginated official classifications, independent of telemetry ingestion."""
    key = f"season_results_{year}"
    if key in _data_cache:
        return _data_cache[key]
    races = {}
    offset = 0
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            while True:
                if offset > 5000:
                    raise ValueError("Provider pagination exceeds season bounds")
                response = await client.get(f"{_JOLPICA_BASE}/{year}/results.json", params={"limit": 100, "offset": offset})
                response.raise_for_status()
                payload = response.json()["MRData"]
                table = payload["RaceTable"]
                if int(table["season"]) != year:
                    raise ValueError("Provider returned another season")
                count = 0
                for race in table["Races"]:
                    round_number = str(int(race["round"]))
                    entries = races.setdefault(round_number, {})
                    for result in race["Results"]:
                        driver = result["Driver"]
                        entry = LeaderboardEntry(
                            position=int(result["position"]), driver_number=str(result["number"]),
                            driver_name=f"{driver['givenName']} {driver['familyName']}",
                            abbreviation=driver.get("code", ""), team=result["Constructor"]["name"],
                            team_color=TEAM_COLORS.get(result["Constructor"]["name"], "#888888"),
                            status=result.get("status"), laps=int(result["laps"]), points=float(result["points"]),
                            best_lap=result.get("FastestLap", {}).get("Time", {}).get("time"),
                        )
                        entries[driver["driverId"]] = entry.model_dump()
                        count += 1
                offset += count
                if offset >= int(payload["total"]):
                    break
                if count == 0:
                    raise ValueError("Incomplete provider pagination")
        data = {"year": year, "source": "Jolpica", "fetched_at": pd.Timestamp.now(tz="UTC").isoformat(),
                "results": {r: sorted(entries.values(), key=lambda e: e["position"]) for r, entries in races.items()}}
        _data_cache[key] = data
        return data
    except (httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
        logger.warning("Season classifications unavailable: %s", type(exc).__name__)
        return {"year": year, "source": "Jolpica", "results": {}, "unavailable": True}
