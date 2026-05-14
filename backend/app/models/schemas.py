from pydantic import BaseModel
from typing import Optional, List, Any, Dict
from datetime import datetime


class Driver(BaseModel):
    driver_number: str
    full_name: str
    abbreviation: str
    team_name: str
    team_color: str
    nationality: str
    headshot_url: Optional[str] = None
    points: Optional[float] = 0
    position: Optional[int] = None


class Constructor(BaseModel):
    constructor_id: str
    name: str
    nationality: str
    color: str
    points: Optional[float] = 0
    position: Optional[int] = None
    drivers: Optional[List[str]] = []


class LapTime(BaseModel):
    driver_number: str
    lap_number: int
    lap_time: Optional[str] = None
    sector1: Optional[str] = None
    sector2: Optional[str] = None
    sector3: Optional[str] = None
    compound: Optional[str] = None
    tyre_life: Optional[int] = None
    is_personal_best: Optional[bool] = False
    is_overall_best: Optional[bool] = False
    pit_in: Optional[bool] = False
    pit_out: Optional[bool] = False


class LeaderboardEntry(BaseModel):
    position: int
    driver_number: str
    driver_name: str
    abbreviation: str
    team: str
    team_color: str
    gap_to_leader: Optional[str] = None
    interval: Optional[str] = None
    last_lap: Optional[str] = None
    best_lap: Optional[str] = None
    current_tyre: Optional[str] = None
    tyre_age: Optional[int] = None
    pits: Optional[int] = 0
    sector1: Optional[str] = None
    sector2: Optional[str] = None
    sector3: Optional[str] = None
    status: Optional[str] = "ON_TRACK"
    drs: Optional[bool] = False
    speed: Optional[float] = None


class TelemetryPoint(BaseModel):
    time: float
    speed: Optional[float] = None
    rpm: Optional[float] = None
    throttle: Optional[float] = None
    brake: Optional[float] = None
    gear: Optional[int] = None
    drs: Optional[int] = None
    distance: Optional[float] = None
    x: Optional[float] = None
    y: Optional[float] = None
    z: Optional[float] = None


class SessionInfo(BaseModel):
    year: int
    round_number: int
    country: str
    circuit: str
    session_name: str
    session_type: str
    date: Optional[str] = None
    status: Optional[str] = None
    is_live: bool = False


class RaceControlMessage(BaseModel):
    time: Optional[str] = None
    lap: Optional[int] = None
    category: Optional[str] = None
    message: str
    flag: Optional[str] = None
    scope: Optional[str] = None


class WeatherData(BaseModel):
    air_temp: Optional[float] = None
    track_temp: Optional[float] = None
    humidity: Optional[float] = None
    pressure: Optional[float] = None
    wind_speed: Optional[float] = None
    wind_direction: Optional[float] = None
    rainfall: Optional[bool] = False


class ScheduleEvent(BaseModel):
    round_number: int
    country: str
    location: str
    event_name: str
    event_date: Optional[str] = None
    session1: Optional[str] = None
    session1_date: Optional[str] = None
    session2: Optional[str] = None
    session2_date: Optional[str] = None
    session3: Optional[str] = None
    session3_date: Optional[str] = None
    session4: Optional[str] = None
    session4_date: Optional[str] = None
    session5: Optional[str] = None
    session5_date: Optional[str] = None
    is_completed: bool = False
    is_upcoming: bool = False


class StandingsEntry(BaseModel):
    position: int
    name: str
    points: float
    wins: Optional[int] = 0
    team: Optional[str] = None
    nationality: Optional[str] = None
    color: Optional[str] = None


class APIResponse(BaseModel):
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None
    timestamp: str = ""

    def __init__(self, **data):
        if not data.get("timestamp"):
            data["timestamp"] = datetime.utcnow().isoformat()
        super().__init__(**data)
