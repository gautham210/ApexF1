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
_JOLPICA_BASE = "https://api.jolpi.ca/ergast/f1"
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
    """Get the current or most recent session."""
    cache_key = "current_session"
    if cache_key in _data_cache:
        return _data_cache[cache_key]

    try:
        year = datetime.now().year
        schedule = fastf1.get_event_schedule(year, include_testing=False)
        now = pd.Timestamp.utcnow().tz_localize(None)
        event_dates = pd.to_datetime(schedule["EventDate"]).dt.tz_localize(None)
        past = schedule[event_dates <= now]
        if past.empty:
            return None
        latest = past.iloc[-1]
        info = SessionInfo(
            year=int(latest["RoundNumber"]) and year,
            round_number=int(latest["RoundNumber"]),
            country=str(latest.get("Country", "")),
            circuit=str(latest.get("Location", "")),
            session_name=str(latest.get("EventName", "")),
            session_type="Race",
            date=str(latest.get("EventDate", "")),
            status="Completed",
            is_live=False,
        )
        _data_cache[cache_key] = info
        return info
    except Exception as e:
        logger.error(f"get_current_session_info error: {e}")
        return None


async def get_schedule(year: int) -> List[ScheduleEvent]:
    """Return the full race calendar for a given year."""
    cache_key = f"schedule_{year}"
    if cache_key in _data_cache:
        return _data_cache[cache_key]

    try:
        schedule = fastf1.get_event_schedule(year, include_testing=False)
        now = pd.Timestamp.utcnow().tz_localize(None)
        events = []
        for _, row in schedule.iterrows():
            event_date = row.get("EventDate")
            try:
                ed_naive = pd.Timestamp(event_date).tz_localize(None) if pd.notna(event_date) else None
                is_completed = ed_naive is not None and ed_naive < now
            except Exception:
                is_completed = False
            events.append(ScheduleEvent(
                round_number=int(row.get("RoundNumber", 0)),
                country=str(row.get("Country", "")),
                location=str(row.get("Location", "")),
                event_name=str(row.get("EventName", "")),
                event_date=str(event_date) if pd.notna(event_date) else None,
                session1=str(row.get("Session1", "")) or None,
                session1_date=str(row.get("Session1Date", "")) if pd.notna(row.get("Session1Date")) else None,
                session2=str(row.get("Session2", "")) or None,
                session2_date=str(row.get("Session2Date", "")) if pd.notna(row.get("Session2Date")) else None,
                session3=str(row.get("Session3", "")) or None,
                session3_date=str(row.get("Session3Date", "")) if pd.notna(row.get("Session3Date")) else None,
                session4=str(row.get("Session4", "")) or None,
                session4_date=str(row.get("Session4Date", "")) if pd.notna(row.get("Session4Date")) else None,
                session5=str(row.get("Session5", "")) or None,
                session5_date=str(row.get("Session5Date", "")) if pd.notna(row.get("Session5Date")) else None,
                is_completed=is_completed,
                is_upcoming=not is_completed,
            ))
        _data_cache[cache_key] = events
        return events
    except Exception as e:
        logger.error(f"get_schedule error: {e}")
        return []


import asyncio

def _load_session_sync(year: int, round_number: int, session_name: str = "Race", full=True):
    """Load and cache a FastF1 session synchronously."""
    cache_key = f"session_{year}_{round_number}_{session_name}_{full}"
    if cache_key in _session_cache:
        return _session_cache[cache_key]
    try:
        session = fastf1.get_session(year, round_number, session_name)
        if full:
            session.load(telemetry=True, weather=True, messages=True, laps=True)
        else:
            session.load(telemetry=False, weather=False, messages=False, laps=False)
        _session_cache[cache_key] = session
        return session
    except Exception as e:
        logger.error(f"_load_session error ({year} R{round_number} {session_name}): {e}")
        return None

async def _load_session(year: int, round_number: int, session_name: str = "Race", full=True):
    """Async wrapper with 2.5s timeout to prevent hanging endpoints."""
    cache_key = f"session_{year}_{round_number}_{session_name}_{full}"
    if cache_key in _session_cache:
        return _session_cache[cache_key]
    
    try:
        return await asyncio.wait_for(asyncio.to_thread(_load_session_sync, year, round_number, session_name, full), timeout=30.0)
    except asyncio.TimeoutError:
        logger.warning(f"Session load timed out for {year} R{round_number}")
        return None
    except Exception as e:
        return None


async def get_leaderboard(year: int, round_number: int, session_name: str = "Race") -> List[LeaderboardEntry]:
    cache_key = f"leaderboard_{year}_{round_number}_{session_name}"
    if cache_key in _data_cache:
        return _data_cache[cache_key]

    try:
        session = await _load_session(year, round_number, session_name, full=False)
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
                position=pos,
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
        session = await _load_session(year, round_number, session_name)
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
        session = await _load_session(year, round_number, session_name)
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
        session = await _load_session(year, round_number, session_name, full=False)
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
        session = await _load_session(year, round_number, session_name)
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
        session = await _load_session(year, round_number, "Race", full=False)
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
    return os.path.join(_DISK_CACHE_DIR, f"{kind}_{year}.json")


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
            return json.load(f)
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
        standings_raw = lists[0]["DriverStandings"]
        entries: List[StandingsEntry] = []
        for item in standings_raw:
            driver = item["Driver"]
            constructor_name = item["Constructors"][0]["name"] if item.get("Constructors") else ""
            team_normalized = _CONSTRUCTOR_NAME_MAP.get(constructor_name, constructor_name)
            full_name = f"{driver['givenName']} {driver['familyName']}"
            entries.append(StandingsEntry(
                position=int(item["position"]),
                name=full_name,
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
        standings_raw = lists[0]["ConstructorStandings"]
        entries: List[StandingsEntry] = []
        for item in standings_raw:
            constructor_name = item["Constructor"]["name"]
            team_normalized = _CONSTRUCTOR_NAME_MAP.get(constructor_name, constructor_name)
            entries.append(StandingsEntry(
                position=int(item["position"]),
                name=team_normalized,
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

# Multiple RSS feeds tried in order until one succeeds
_NEWS_FEEDS = [
    ("https://www.motorsport.com/rss/f1/news/", "Motorsport.com"),
    ("https://www.autosport.com/rss/f1/news/", "Autosport"),
    ("https://www.racefans.net/feed/", "RaceFans"),
]

async def get_news() -> List[Dict[str, str]]:
    cache_key = "news_feed"
    if cache_key in _news_cache:
        return _news_cache[cache_key]
        
    news_items = []
    for feed_url, source_name in _NEWS_FEEDS:
        try:
            async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
                resp = await client.get(feed_url)
                resp.raise_for_status()
                root = ET.fromstring(resp.text)
                
                for item in root.findall('.//item')[:6]:
                    title_el = item.find('title')
                    link_el = item.find('link')
                    date_el = item.find('pubDate')
                    title = title_el.text.strip() if title_el is not None and title_el.text else ""
                    link = link_el.text.strip() if link_el is not None and link_el.text else ""
                    pub_date = date_el.text.strip() if date_el is not None and date_el.text else ""
                    if title and link:
                        news_items.append({
                            "title": title,
                            "source": source_name,
                            "tag": "F1 News",
                            "link": link,
                            "published": pub_date,
                        })
            if news_items:
                # Deduplicate by first 60 chars of title (case-insensitive)
                seen: set = set()
                unique = []
                for item in news_items:
                    key = item["title"][:60].lower()
                    if key not in seen:
                        seen.add(key)
                        unique.append(item)
                news_items = unique[:8]
                _news_cache[cache_key] = news_items
                return news_items
        except Exception as e:
            logger.warning(f"get_news feed {feed_url} failed: {e}")
            continue
        
    logger.error("All news feeds failed")
    return news_items


_ENGINE_SUPPLIER_COLORS: Dict[str, str] = {
    "Mercedes": "#27F4D2",
    "Ferrari":  "#E8002D",
    "Ford RBPT":"#3671C6",
    "Honda":    "#229971",
    "Audi":     "#C0C0C0",
}

async def get_engine_standings(year: int):
    cache_key = f"engine_standings_{year}"
    if cache_key in _data_cache:
        return _data_cache[cache_key]

    # 2026 Power Unit mappings — official FIA grid
    ENGINE_MAP: Dict[str, str] = {
        # Mercedes PU — Mercedes, McLaren, Alpine, Williams
        "Mercedes":         "Mercedes",
        "McLaren":          "Mercedes",
        "Alpine":           "Mercedes",  # Alpine switched from Renault to Mercedes PU for 2026
        "Williams":         "Mercedes",
        # Ferrari PU — Ferrari, Haas, Cadillac
        "Ferrari":          "Ferrari",
        "Haas F1 Team":     "Ferrari",
        "Cadillac":         "Ferrari",
        # Ford RBPT PU — Red Bull Racing, Racing Bulls
        "Red Bull Racing":  "Ford RBPT",
        "Racing Bulls":     "Ford RBPT",  # was "RB"
        # Honda PU — Aston Martin
        "Aston Martin":     "Honda",
        # Audi PU — Audi (was Kick Sauber)
        "Audi":             "Audi",
    }
    
    standings = await _fetch_jolpica_constructor_standings(year)
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
        "fastest_qualifier": {"name": "—", "stat": "TBD"},
        "biggest_gainer": {"name": "—", "stat": "TBD"},
        "recent_winner": {"name": "—", "stat": "TBD"},
        "constructor_leader": {"name": "—", "stat": "TBD"},
    }
    
    try:
        drivers = await _fetch_jolpica_driver_standings(year)
        constructors = await _fetch_jolpica_constructor_standings(year)
        
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
                                
            # Fetch ALL qualifying results for the season to count poles
            url_qual = f"{_JOLPICA_BASE}/{year}/qualifying.json?limit=50"
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url_qual)
                if resp.status_code == 200:
                    data = resp.json()
                    races = data["MRData"]["RaceTable"]["Races"]
                    pole_counts: Dict[str, int] = {}
                    for r in races:
                        try:
                            qual_results = r.get("QualifyingResults", [])
                            if qual_results:
                                # position "1" is pole — sort by position
                                sorted_q = sorted(qual_results, key=lambda x: int(x.get("position", 99)))
                                driver = sorted_q[0]["Driver"]
                                name = f"{driver['givenName']} {driver['familyName']}"
                                pole_counts[name] = pole_counts.get(name, 0) + 1
                        except Exception as _e: logger.warning(f"insights sub-fetch error: {_e}")
                    if pole_counts:
                        fastest = max(pole_counts.items(), key=lambda x: x[1])
                        insights["fastest_qualifier"] = {"name": fastest[0], "stat": f"{fastest[1]} Pole{'s' if fastest[1] > 1 else ''} This Season"}

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

    completed = sorted([e for e in schedule if e.is_completed], key=lambda x: x.round_number)
    upcoming = sorted([e for e in schedule if not e.is_completed], key=lambda x: x.round_number)

    latest_completed = completed[-1] if completed else None
    next_race = upcoming[0] if upcoming else None

    ctx = {
        "year": year,
        "completed_rounds": len(completed),
        "total_rounds": len(schedule),
        "current_round": latest_completed.round_number if latest_completed else (next_race.round_number if next_race else 1),
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
    Parallel-fetches season context, standings, insights, news, schedule.
    Frontend must NEVER independently compute these — consume this endpoint only.
    """
    cache_key = f"dashboard_context_{year}"
    if cache_key in _data_cache:
        return _data_cache[cache_key]

    results = await asyncio.gather(
        get_season_context(year),
        get_standings(year),
        get_insights(year),
        get_news(),
        return_exceptions=True,
    )

    season_ctx  = results[0] if isinstance(results[0], dict) else {}
    standings   = results[1] if isinstance(results[1], dict) else {}
    insights    = results[2] if isinstance(results[2], dict) else {}
    news        = results[3] if isinstance(results[3], list) else []

    drivers      = standings.get("drivers", [])
    constructors = standings.get("constructors", [])
    # upcoming comes from season_context (already computed, no duplicate schedule fetch)
    upcoming     = season_ctx.get("upcoming_schedule", [])

    result = {
        "season_context": season_ctx,
        "driver_standings":      [e.model_dump() for e in drivers[:15]],
        "constructor_standings": [e.model_dump() for e in constructors[:10]],
        "insights": insights,
        "news": news[:6],
        "upcoming_schedule": upcoming,
    }

    _data_cache[cache_key] = result
    return result
