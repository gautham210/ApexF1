from fastapi import APIRouter, Query, HTTPException
from datetime import datetime
from app.services import history_service, jolpica

router = APIRouter()


async def guarded(coro):
    try:
        return {"success": True, "data": await coro}
    except jolpica.ProviderError as exc:
        raise HTTPException(404 if exc.reason == "round_not_found" else 503, detail={"status": "unavailable", "reason": exc.reason}) from exc


@router.get("/history/season")
async def season(year: int = Query(ge=1950, le=datetime.now().year + 1), round: int | None = Query(None, ge=1, le=30)):
    return await guarded(history_service.season(year, round))


@router.get("/history/drivers/{driver_id}/career")
async def career(driver_id: str, year: int | None = Query(None, ge=1950, le=datetime.now().year + 1)):
    import re
    if not re.fullmatch(r"[a-zA-Z0-9_-]{1,80}", driver_id):
        raise HTTPException(422, detail="Invalid driver identity")
    return await guarded(history_service.career(driver_id, year))


@router.get("/news/feed")
async def news():
    from app.services.news_service import get_feed
    return await guarded(get_feed())


@router.get("/history/drivers/{driver_id}/portrait")
async def portrait(driver_id: str, year: int = Query(ge=1950, le=datetime.now().year + 1)):
    import re
    from app.services.media_service import portrait as get_portrait
    if not re.fullmatch(r"[a-zA-Z0-9_-]{1,80}", driver_id):
        raise HTTPException(422, detail="Invalid driver identity")
    return await guarded(get_portrait(year, driver_id))


@router.get("/history/progression")
async def progression(year: int = Query(ge=1950, le=datetime.now().year + 1), kind: str = Query("drivers", pattern="^(drivers|constructors)$")):
    return await guarded(history_service.championship_progression(year, kind))


@router.get("/history/schedule")
async def historical_schedule(year: int = Query(ge=1950, le=datetime.now().year + 1)):
    return await guarded(history_service.races(year, ""))
