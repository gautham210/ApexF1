from fastapi import APIRouter, HTTPException, Query
from app.services import f1_service
from app.models.schemas import APIResponse
from datetime import datetime

router = APIRouter()

_CURRENT_YEAR = datetime.now().year

def _validate_year(year: int) -> int:
    if year < 2018 or year > _CURRENT_YEAR + 1:
        raise HTTPException(status_code=422, detail=f"year must be between 2018 and {_CURRENT_YEAR + 1}")
    return year

def _validate_round(round: int) -> int:
    if round < 1 or round > 24:
        raise HTTPException(status_code=422, detail="round must be between 1 and 24")
    return round


@router.get("/session/current", response_model=APIResponse)
async def current_session():
    data = await f1_service.get_current_session_info()
    return APIResponse(success=True, data=data.model_dump() if data else None)


@router.get("/schedule", response_model=APIResponse)
async def schedule(year: int = Query(default=_CURRENT_YEAR)):
    _validate_year(year)
    data = await f1_service.get_schedule(year)
    return APIResponse(success=True, data=[e.model_dump() for e in data])


@router.get("/drivers", response_model=APIResponse)
async def drivers(
    year: int = Query(default=_CURRENT_YEAR),
    round: int = Query(default=1),
):
    _validate_year(year); _validate_round(round)
    data = await f1_service.get_drivers(year, round)
    return APIResponse(success=True, data=[d.model_dump() for d in data])


@router.get("/leaderboard", response_model=APIResponse)
async def leaderboard(
    year: int = Query(default=_CURRENT_YEAR),
    round: int = Query(default=1),
    session: str = Query(default="Race"),
):
    _validate_year(year); _validate_round(round)
    data = await f1_service.get_leaderboard(year, round, session)
    return APIResponse(success=True, data=[e.model_dump() for e in data])


@router.get("/laps", response_model=APIResponse)
async def laps(
    year: int = Query(default=_CURRENT_YEAR),
    round: int = Query(default=1),
    session: str = Query(default="Race"),
    driver: str = Query(default=None),
):
    _validate_year(year); _validate_round(round)
    data = await f1_service.get_laps(year, round, session, driver)
    return APIResponse(success=True, data=[l.model_dump() for l in data])


@router.get("/telemetry", response_model=APIResponse)
async def telemetry(
    year: int = Query(default=_CURRENT_YEAR),
    round: int = Query(default=1),
    session: str = Query(default="Race"),
    driver: str = Query(default="1"),
    lap: int = Query(default=None),
):
    _validate_year(year); _validate_round(round)
    if lap is not None and (lap < 1 or lap > 100):
        raise HTTPException(status_code=422, detail="lap must be between 1 and 100")
    data = await f1_service.get_telemetry(year, round, session, driver, lap)
    return APIResponse(success=True, data=[p.model_dump() for p in data])


@router.get("/weather", response_model=APIResponse)
async def weather(
    year: int = Query(default=_CURRENT_YEAR),
    round: int = Query(default=1),
    session: str = Query(default="Race"),
):
    _validate_year(year); _validate_round(round)
    data = await f1_service.get_weather(year, round, session)
    return APIResponse(success=True, data=data.model_dump() if data else None)


@router.get("/race-control", response_model=APIResponse)
async def race_control(
    year: int = Query(default=_CURRENT_YEAR),
    round: int = Query(default=1),
    session: str = Query(default="Race"),
):
    _validate_year(year); _validate_round(round)
    data = await f1_service.get_race_control(year, round, session)
    return APIResponse(success=True, data=[m.model_dump() for m in data])


@router.get("/standings", response_model=APIResponse)
async def standings(year: int = Query(default=_CURRENT_YEAR)):
    _validate_year(year)
    data = await f1_service.get_standings(year)
    return APIResponse(
        success=True,
        data={
            "drivers": [e.model_dump() for e in data["drivers"]],
            "constructors": [e.model_dump() for e in data["constructors"]],
        },
    )


@router.get("/constructors", response_model=APIResponse)
async def constructors(year: int = Query(default=_CURRENT_YEAR)):
    _validate_year(year)
    data = await f1_service.get_standings(year)
    return APIResponse(success=True, data=[e.model_dump() for e in data["constructors"]])


@router.get("/track-status", response_model=APIResponse)
async def track_status(
    year: int = Query(default=_CURRENT_YEAR),
    round: int = Query(default=1),
    session: str = Query(default="Race"),
):
    _validate_year(year); _validate_round(round)
    messages = await f1_service.get_race_control(year, round, session)
    flags = [m for m in messages if m.flag]
    latest_flag = flags[-1].flag if flags else "GREEN"
    return APIResponse(success=True, data={"status": latest_flag, "messages": [m.model_dump() for m in flags[-5:]]})


@router.get("/tyres", response_model=APIResponse)
async def tyres(
    year: int = Query(default=_CURRENT_YEAR),
    round: int = Query(default=1),
    session: str = Query(default="Race"),
):
    _validate_year(year); _validate_round(round)
    all_laps = await f1_service.get_laps(year, round, session)
    tyre_data: dict = {}
    for lap in all_laps:
        drv = lap.driver_number
        if drv not in tyre_data:
            tyre_data[drv] = []
        if lap.pit_out:
            tyre_data[drv].append({"lap": lap.lap_number, "compound": lap.compound, "age": 0})
    return APIResponse(success=True, data=tyre_data)


@router.get("/insights", response_model=APIResponse)
async def insights(year: int = Query(default=_CURRENT_YEAR)):
    _validate_year(year)
    data = await f1_service.get_insights(year)
    return APIResponse(success=True, data=data)


@router.get("/news", response_model=APIResponse)
async def news():
    data = await f1_service.get_news()
    return APIResponse(success=True, data=data)


@router.get("/engine-standings", response_model=APIResponse)
async def engine_standings(year: int = Query(default=_CURRENT_YEAR)):
    _validate_year(year)
    data = await f1_service.get_engine_standings(year)
    return APIResponse(success=True, data=data)


@router.get("/dashboard-context", response_model=APIResponse)
async def dashboard_context(year: int = Query(default=_CURRENT_YEAR)):
    _validate_year(year)
    data = await f1_service.get_dashboard_context(year)
    return APIResponse(success=True, data=data)
