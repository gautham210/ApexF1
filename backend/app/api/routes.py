import logging
import re
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect
from app.services import f1_service, openf1_service
from app.websockets.manager import manager
from app.models.schemas import APIResponse

logger = logging.getLogger(__name__)
router = APIRouter()

_CURRENT_YEAR = datetime.now().year

_SESSION_ALIASES = {
    "race": "Race",
    "r": "Race",
    "qualifying": "Qualifying",
    "q": "Qualifying",
    "quali": "Qualifying",
    "sprint": "Sprint",
    "s": "Sprint",
    "sprint qualifying": "Sprint Qualifying",
    "sq": "Sprint Qualifying",
    "sprint shootout": "Sprint Shootout",
    "ss": "Sprint Shootout",
    "practice 1": "Practice 1",
    "fp1": "Practice 1",
    "practice 2": "Practice 2",
    "fp2": "Practice 2",
    "practice 3": "Practice 3",
    "fp3": "Practice 3",
}

_DRIVER_RE = re.compile(r"^[A-Za-z0-9_]{1,16}$")


def _validate_year(year: int) -> int:
    if year < 2018 or year > _CURRENT_YEAR + 1:
        raise HTTPException(status_code=422, detail=f"year must be between 2018 and {_CURRENT_YEAR + 1}")
    return year


def _validate_round(round: int) -> int:
    if round < 1 or round > 24:
        raise HTTPException(status_code=422, detail="round must be between 1 and 24")
    return round


def _validate_session(session: str) -> str:
    canonical = _SESSION_ALIASES.get(session.strip().lower())
    if not canonical:
        raise HTTPException(
            status_code=422,
            detail="session must be one of Race, Qualifying, Sprint, Sprint Qualifying, Sprint Shootout, Practice 1, Practice 2, Practice 3",
        )
    return canonical


def _validate_driver(driver: Optional[str]) -> Optional[str]:
    if driver is None or not str(driver).strip():
        return None
    cleaned = str(driver).strip()
    if not _DRIVER_RE.match(cleaned):
        raise HTTPException(status_code=422, detail="driver must be an alphanumeric driver number or abbreviation")
    return cleaned


# ─── Session State (OpenF1 primary) ──────────────────────────────────────────

@router.get("/session/state", response_model=APIResponse)
async def session_state():
    """
    Real session state from OpenF1.
    Returns: state, is_live, session_info.
    Frontend must use this to determine whether to show LIVE indicators.
    """
    data = await openf1_service.get_session_state()
    return APIResponse(success=True, data=data)


@router.get("/session/current", response_model=APIResponse)
async def current_session():
    """Legacy endpoint — returns FastF1 session info."""
    data = await f1_service.get_current_session_info()
    return APIResponse(success=True, data=data.model_dump() if data else None)


# ─── Schedule (FastF1) ───────────────────────────────────────────────────────

@router.get("/schedule", response_model=APIResponse)
async def schedule(year: int = Query(default=_CURRENT_YEAR)):
    _validate_year(year)
    from app.services.jolpica import ProviderError
    try:
        data = await f1_service.get_schedule(year)
    except ProviderError as exc:
        raise HTTPException(503, detail={"status": "unavailable", "reason": exc.reason}) from exc
    return APIResponse(success=True, data=[e.model_dump() for e in data])


# ─── Drivers ─────────────────────────────────────────────────────────────────

@router.get("/drivers", response_model=APIResponse)
async def drivers(
    year: int = Query(default=_CURRENT_YEAR),
    round: int = Query(default=1),
    session: str = Query(default="Race"),
):
    _validate_year(year)
    _validate_round(round)
    canonical_session = _validate_session(session)
    data = await f1_service.get_drivers(year, round, canonical_session)
    return APIResponse(success=True, data=[d.model_dump() for d in data])


# ─── Live Timing (OpenF1 primary, FastF1 fallback) ───────────────────────────

@router.get("/leaderboard", response_model=APIResponse)
async def leaderboard(
    year: int = Query(default=_CURRENT_YEAR),
    round: int = Query(default=1),
    session: str = Query(default="Race"),
):
    """
    Requested classification: Jolpica race results, with FastF1 fallback.
    Live timing uses /live/snapshot and /ws/live.
    """
    _validate_year(year)
    _validate_round(round)
    canonical_session = _validate_session(session)

    # Explicit event coordinates always resolve that archive; live has dedicated endpoints.
    data = await f1_service.get_leaderboard(year, round, canonical_session)
    return APIResponse(success=True, data=[e.model_dump() for e in data])


@router.get("/live/snapshot", response_model=APIResponse)
async def live_snapshot():
    """
    Full live snapshot: timing + weather + race control.
    Returns empty data with is_live=False when no session is active.
    """
    state_info = await openf1_service.get_session_state()
    if not state_info.get("is_live") or not state_info.get("session_key"):
        return APIResponse(success=True, data={
            "is_live": False,
            "state": state_info.get("state", "ARCHIVE"),
            "session_info": {
                "session_name": state_info.get("session_name"),
                    "date_start": state_info.get("date_start"),
                    "session_key": state_info.get("session_key"),
                "display_name": state_info.get("display_name"),
                "circuit": state_info.get("circuit"),
                "country": state_info.get("country"),
                "year": state_info.get("year"),
                "track_status": state_info.get("track_status", "UNKNOWN"),
            },
            "leaderboard": [],
            "weather": None,
            "race_control": [],
        })

    snapshot = await openf1_service.get_live_snapshot(state_info["session_key"])
    return APIResponse(success=True, data={
        "is_live": True,
        "state": state_info.get("state"),
        "session_info": {
            "session_name": state_info.get("session_name"),
                    "date_start": state_info.get("date_start"),
                    "session_key": state_info.get("session_key"),
            "display_name": state_info.get("display_name"),
            "circuit": state_info.get("circuit"),
            "country": state_info.get("country"),
            "year": state_info.get("year"),
            "track_status": state_info.get("track_status", "GREEN"),
        },
        **snapshot,
    })


@router.get("/live/race-control", response_model=APIResponse)
async def live_race_control():
    state_info = await openf1_service.get_session_state()
    if not state_info.get("session_key"):
        return APIResponse(success=False, data=None, error="Live session unavailable")
    data = await openf1_service.get_race_control_messages(state_info["session_key"])
    return APIResponse(success=data is not None, data=data, error="Race control unavailable" if data is None else None)


@router.get("/live/stints", response_model=APIResponse)
async def live_stints():
    state_info = await openf1_service.get_session_state()
    if not state_info.get("session_key"):
        return APIResponse(success=False, data=None, error="Live session unavailable")
    data = await openf1_service.get_stints(state_info["session_key"])
    return APIResponse(success=data is not None, data=data, error="Tyre stints unavailable" if data is None else None)


# ─── Archive data (FastF1 only) ───────────────────────────────────────────────

@router.get("/laps", response_model=APIResponse)
async def laps(
    year: int = Query(default=_CURRENT_YEAR),
    round: int = Query(default=1),
    session: str = Query(default="Race"),
    driver: Optional[str] = Query(default=None),
):
    _validate_year(year)
    _validate_round(round)
    canonical_session = _validate_session(session)
    cleaned_driver = _validate_driver(driver)
    data = await f1_service.get_laps(year, round, canonical_session, cleaned_driver)
    return APIResponse(success=True, data=[l.model_dump() for l in data])


@router.get("/telemetry", response_model=APIResponse)
async def telemetry(
    year: int = Query(default=_CURRENT_YEAR),
    round: int = Query(default=1),
    session: str = Query(default="Race"),
    driver: str = Query(default="1"),
    lap: Optional[int] = Query(default=None),
):
    _validate_year(year)
    _validate_round(round)
    canonical_session = _validate_session(session)
    cleaned_driver = _validate_driver(driver)
    if not cleaned_driver:
        raise HTTPException(status_code=422, detail="driver is required")
    if lap is not None and (lap < 1 or lap > 150):
        raise HTTPException(status_code=422, detail="lap must be between 1 and 150")
    data = await f1_service.get_telemetry(year, round, canonical_session, cleaned_driver, lap)
    return APIResponse(success=True, data=[p.model_dump() for p in data])


@router.get("/circuit-map", response_model=APIResponse)
async def circuit_map(
    year: int = Query(default=_CURRENT_YEAR),
    round: int = Query(default=1),
    session: str = Query(default="Race"),
):
    _validate_year(year)
    _validate_round(round)
    canonical_session = _validate_session(session)
    data = await f1_service.get_circuit_map(year, round, canonical_session)
    return APIResponse(success=True, data=data)


@router.get("/weather", response_model=APIResponse)
async def weather(
    year: int = Query(default=_CURRENT_YEAR),
    round: int = Query(default=1),
    session: str = Query(default="Race"),
):
    _validate_year(year)
    _validate_round(round)
    canonical_session = _validate_session(session)

    data = await f1_service.get_weather(year, round, canonical_session)
    return APIResponse(success=True, data=data.model_dump() if data else None)


@router.get("/race-control", response_model=APIResponse)
async def race_control(
    year: int = Query(default=_CURRENT_YEAR),
    round: int = Query(default=1),
    session: str = Query(default="Race"),
):
    _validate_year(year)
    _validate_round(round)
    canonical_session = _validate_session(session)
    data = await f1_service.get_race_control(year, round, canonical_session)
    return APIResponse(success=True, data=[m.model_dump() for m in data])


@router.get("/standings", response_model=APIResponse)
async def standings(year: int = Query(default=_CURRENT_YEAR)):
    _validate_year(year)
    from app.services.jolpica import ProviderError
    try:
        data = await f1_service.get_standings(year)
    except ProviderError as exc:
        raise HTTPException(503, detail={"status": "unavailable", "reason": exc.reason}) from exc
    return APIResponse(
        success=data["status"] != "unavailable",
        data={
            "drivers": [e.model_dump() for e in data["drivers"]],
            "constructors": [e.model_dump() for e in data["constructors"]],
            "status": data["status"],
            "errors": data["errors"],
            "round": data["round"],
            "source": data["source"],
            "fetched_at": data["fetched_at"],
        },
        error="Championship standings unavailable" if data["status"] == "unavailable" else None,
    )


@router.get("/constructors", response_model=APIResponse)
async def constructors(year: int = Query(default=_CURRENT_YEAR)):
    _validate_year(year)
    from app.services.jolpica import ProviderError
    try:
        data = await f1_service.get_standings(year)
    except ProviderError as exc:
        raise HTTPException(503, detail={"status": "unavailable", "reason": exc.reason}) from exc
    if not data["constructors"]:
        raise HTTPException(503, detail={"status": "unavailable", "reason": data["errors"].get("constructor_standings", "no_standings")})
    return APIResponse(success=True, data=[e.model_dump() for e in data["constructors"]])


@router.get("/track-status", response_model=APIResponse)
async def track_status(
    year: int = Query(default=_CURRENT_YEAR),
    round: int = Query(default=1),
    session: str = Query(default="Race"),
):
    _validate_year(year)
    _validate_round(round)
    canonical_session = _validate_session(session)
    messages = await f1_service.get_race_control(year, round, canonical_session)
    flags = [m for m in messages if m.flag]
    latest_flag = flags[-1].flag if flags else "UNKNOWN"
    return APIResponse(success=True, data={"status": latest_flag, "messages": [m.model_dump() for m in flags[-5:]]})


@router.get("/tyres", response_model=APIResponse)
async def tyres(
    year: int = Query(default=_CURRENT_YEAR),
    round: int = Query(default=1),
    session: str = Query(default="Race"),
):
    _validate_year(year)
    _validate_round(round)
    canonical_session = _validate_session(session)
    all_laps = await f1_service.get_laps(year, round, canonical_session)
    by_driver: dict[str, list] = {}
    for lap in all_laps:
        by_driver.setdefault(lap.driver_number, []).append(lap)

    tyre_data: dict[str, list] = {}
    for drv, drv_laps in by_driver.items():
        drv_laps.sort(key=lambda item: item.lap_number)
        stints: list[dict] = []
        current: Optional[dict] = None
        for lap in drv_laps:
            compound = lap.compound if lap.compound and lap.compound.upper() not in ("NONE", "NAN", "UNKNOWN") else None
            if current is None or lap.pit_out or (compound and current["compound"] and compound != current["compound"]):
                current = {
                    "lap": lap.lap_number,
                    "start_lap": lap.lap_number,
                    "end_lap": lap.lap_number,
                    "compound": compound or "UNKNOWN",
                    "age": lap.tyre_life,
                    "laps": 1,
                }
                stints.append(current)
            else:
                current["end_lap"] = lap.lap_number
                current["laps"] += 1
                if current["compound"] == "UNKNOWN" and compound:
                    current["compound"] = compound
                if lap.tyre_life is not None:
                    current["age"] = lap.tyre_life
        tyre_data[drv] = stints
    return APIResponse(success=True, data=tyre_data)


@router.get("/insights", response_model=APIResponse)
async def insights(year: int = Query(default=_CURRENT_YEAR)):
    _validate_year(year)
    data = await f1_service.get_insights(year)
    unavailable = data.get("status") == "unavailable"
    return APIResponse(
        success=not unavailable,
        data=data,
        error="Historical insights unavailable" if unavailable else None,
    )


@router.get("/news", response_model=APIResponse)
async def news():
    from app.services.jolpica import ProviderError
    try:
        data = await f1_service.get_news()
        return APIResponse(success=True, data=data)
    except ProviderError as exc:
        raise HTTPException(503, detail="News provider unavailable") from exc


@router.get("/engine-standings", response_model=APIResponse)
async def engine_standings(year: int = Query(default=_CURRENT_YEAR)):
    _validate_year(year)
    from app.services.jolpica import ProviderError
    try:
        data = await f1_service.get_engine_standings(year)
    except ProviderError as exc:
        raise HTTPException(503, detail={"status": "unavailable", "reason": exc.reason}) from exc
    return APIResponse(success=True, data=data)


@router.get("/dashboard-context", response_model=APIResponse)
async def dashboard_context(year: int = Query(default=_CURRENT_YEAR)):
    _validate_year(year)
    data = await f1_service.get_dashboard_context(year)
    return APIResponse(success=True, data=data)


# ─── WebSocket ────────────────────────────────────────────────────────────────

@router.websocket("/ws/live")
async def websocket_live(ws: WebSocket):
    """
    WebSocket endpoint for live timing.

    On connect: immediately sends current state snapshot.
    Stays connected to receive push updates from the live broadcaster.
    Frontend should reconnect automatically on disconnect.
    """
    from app.core.config import settings
    # Origin validation against CSWSH:
    # Browser clients always send Origin. Untrusted or malformed origins are rejected with code 1008.
    # In production, missing Origin is rejected unless WS_ALLOW_NO_ORIGIN is enabled.
    # Note: Origin validation prevents CSWSH; it is NOT client authentication.
    origin = ws.headers.get("origin")
    allowed_origins = {o.rstrip("/") for o in settings.cors_origins_list if o}

    if origin:
        clean_origin = origin.strip().rstrip("/")
        if clean_origin not in allowed_origins:
            logger.warning(f"Rejected WS connection from untrusted origin: {origin}")
            await ws.close(code=1008)
            return
    else:
        if not settings.WS_ALLOW_NO_ORIGIN:
            logger.warning("Rejected WS connection missing Origin header")
            await ws.close(code=1008)
            return

    await manager.connect(ws, channel="live")
    try:
        # Send immediate state snapshot on connect
        state_info = await openf1_service.get_session_state()
        if state_info.get("is_live") and state_info.get("session_key"):
            snapshot = await openf1_service.get_live_snapshot(state_info["session_key"])
            initial = {
                "type": "live_update",
                "state": state_info.get("state"),
                "is_live": True,
                "session_info": {
                    "session_name": state_info.get("session_name"),
                    "date_start": state_info.get("date_start"),
                    "session_key": state_info.get("session_key"),
                    "display_name": state_info.get("display_name"),
                    "circuit": state_info.get("circuit"),
                    "country": state_info.get("country"),
                    "year": state_info.get("year"),
                    "track_status": state_info.get("track_status", "GREEN"),
                },
                **snapshot,
            }
        else:
            initial = {
                "type": "session_state",
                "state": state_info.get("state", "ARCHIVE"),
                "is_live": False,
                "session_info": {
                    "session_name": state_info.get("session_name"),
                    "date_start": state_info.get("date_start"),
                    "session_key": state_info.get("session_key"),
                    "display_name": state_info.get("display_name"),
                    "circuit": state_info.get("circuit"),
                    "country": state_info.get("country"),
                    "year": state_info.get("year"),
                    "track_status": state_info.get("track_status", "UNKNOWN"),
                },
                "leaderboard": [],
                "weather": None,
                "race_control": [],
            }
        await manager.send_to(ws, initial)

        # Keep connection alive — updates come from the broadcaster
        while True:
            # Heartbeat: wait for client ping or disconnect
            try:
                msg = await ws.receive_text()
                if msg == "ping":
                    await ws.send_text('{"type":"pong"}')
            except WebSocketDisconnect:
                break

    except WebSocketDisconnect:
        pass
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"WS error: {e}")
    finally:
        await manager.disconnect(ws, channel="live")


@router.get("/results", response_model=APIResponse)
async def season_results(year: int = Query(default=_CURRENT_YEAR)):
    _validate_year(year)
    data = await f1_service.get_season_results(year)
    if data.get("unavailable"):
        raise HTTPException(status_code=503, detail="Official classifications unavailable from provider")
    return APIResponse(success=True, data=data)


@router.get("/live/health")
async def live_health():
    from app.services.openf1_auth import health
    return {"success": True, "data": health()}
