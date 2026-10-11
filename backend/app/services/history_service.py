"""Season/round domain built from official points, not modern scoring assumptions."""
import asyncio
from datetime import datetime, timezone
from pydantic import ValidationError
from app.models.history import Race, Standing
from app.services import jolpica


def now():
    return datetime.now(timezone.utc).isoformat()


async def races(year, kind):
    field = {"results": "Results", "sprint": "SprintResults", "qualifying": "QualifyingResults"}.get(kind)
    rows = await jolpica.collect(f"{year}/{kind}" if kind else str(year), "RaceTable", "Races", field)
    try:
        if kind in ("results", "sprint") and any("points" not in entry or "status" not in entry for row in rows for entry in row[field]):
            raise ValueError("Incomplete classification")
        parsed = [Race.model_validate(row) for row in rows]
        if any(r.season != year for r in parsed):
            raise ValueError("Wrong season")
        return parsed
    except (ValidationError, ValueError) as exc:
        raise jolpica.ProviderError("invalid_payload") from exc


async def standings(year, round_number, kind):
    field = "DriverStandings" if kind == "drivers" else "ConstructorStandings"
    endpoint = "driverStandings" if kind == "drivers" else "constructorStandings"
    path = f"{year}/{round_number}/{endpoint}" if round_number else f"{year}/{endpoint}"
    groups = await jolpica.collect(path, "StandingsTable", "StandingsLists", field)
    output, actual_round = [], None
    try:
        for group in groups:
            if int(group["season"]) != year or (round_number and int(group["round"]) != round_number):
                raise ValueError("Wrong standings identity")
            if actual_round is not None and actual_round != int(group["round"]):
                raise ValueError("Mixed rounds")
            actual_round = int(group["round"])
            for raw in group[field]:
                entry = Standing.model_validate(raw)
                identity = entry.Driver if kind == "drivers" else entry.Constructor
                if identity is None:
                    raise ValueError("Missing identity")
                output.append({**entry.model_dump(), "id": identity.driverId if kind == "drivers" else identity.constructorId})
        return {"round": actual_round, "rows": output}
    except (KeyError, TypeError, ValueError, ValidationError) as exc:
        raise jolpica.ProviderError("invalid_payload") from exc


def summarize(race_rows, sprint_rows, qualifying_rows, through):
    drivers, constructors, results = {}, {}, []
    seen = set()
    for session, rows, field in [("Race", race_rows, "Results"), ("Sprint", sprint_rows, "SprintResults"), ("Qualifying", qualifying_rows, "QualifyingResults")]:
        for race in rows:
            if through and race.round > through:
                continue
            for item in getattr(race, field):
                did, cid = item.Driver.driverId, item.Constructor.constructorId
                identity = (race.season, race.round, session, did, cid)
                if identity in seen:
                    continue
                seen.add(identity)
                driver = drivers.setdefault(did, {**item.Driver.model_dump(), "teams": {}, "numbers": [], "wins": 0, "podiums": 0, "poles": 0, "fastest_laps": 0, "race_points": 0.0, "sprint_points": 0.0})
                team = constructors.setdefault(cid, {**item.Constructor.model_dump(), "contributions": {}, "wins": 0, "podiums": 0, "poles": 0, "race_points": 0.0, "sprint_points": 0.0})
                driver["teams"][cid] = item.Constructor.name
                if item.number and item.number not in driver["numbers"]:
                    driver["numbers"].append(item.number)
                if session != "Qualifying":
                    key = "race_points" if session == "Race" else "sprint_points"
                    driver[key] += item.points
                    team[key] += item.points
                    team["contributions"][did] = team["contributions"].get(did, 0) + item.points
                # Official finishing rank; DSQ/DNS never counts as a race podium.
                eligible = item.status not in ("Disqualified", "Did not start", "Excluded") and item.positionText not in ("D", "E", "W", "F")
                if session == "Race" and eligible:
                    for target in (driver, team):
                        target["wins"] += int(item.position == 1)
                        target["podiums"] += int(item.position is not None and 1 <= item.position <= 3)
                    driver["fastest_laps"] += int(str((item.FastestLap or {}).get("rank")) == "1")
                # Pole uses starting grid, not qualifying rank (sprint/penalties can differ).
                if session == "Race" and item.grid == 1:
                    driver["poles"] += 1
                    team["poles"] += 1
                results.append({"year": race.season, "round": race.round, "race": race.raceName, "date": race.date, "session": session, **item.model_dump()})
    progression = []
    totals = {}
    for round_number in sorted({r["round"] for r in results if r["session"] != "Qualifying"}):
        for result in results:
            if result["round"] == round_number and result["session"] != "Qualifying":
                did = result["Driver"]["driverId"]
                totals[did] = totals.get(did, 0) + result["points"]
        progression.append({"round": round_number, "points": dict(totals)})
    return {"drivers": drivers, "constructors": constructors, "results": results, "progression": progression}


async def season(year, round_number=None):
    jobs = [races(year, ""), races(year, "results"), races(year, "sprint"), races(year, "qualifying"), standings(year, round_number, "drivers"), standings(year, round_number, "constructors")]
    values = await asyncio.gather(*jobs, return_exceptions=True)
    names = ["schedule", "races", "sprints", "qualifying", "driver_standings", "constructor_standings"]
    errors = {name: getattr(value, "reason", "unavailable") for name, value in zip(names, values) if isinstance(value, Exception)}
    if len(errors) == len(names):
        raise jolpica.ProviderError("unavailable")
    data = dict(zip(names, [None if isinstance(v, Exception) else v for v in values]))
    if round_number and data["schedule"] is not None and round_number not in {r.round for r in data["schedule"]}:
        raise jolpica.ProviderError("round_not_found")
    stats = summarize(data["races"] or [], data["sprints"] or [], data["qualifying"] or [], round_number)
    schedule = {r.round: r.model_dump(exclude={"Results", "SprintResults", "QualifyingResults"}) for r in data["schedule"] or []}
    return {"year": year, "selected_round": round_number, "status": "partial" if errors else "success", "source": "Jolpica", "fetched_at": now(), "cache_seconds": 900, "errors": errors, "schedule": list(schedule.values()), "driver_standings": data["driver_standings"], "constructor_standings": data["constructor_standings"], **stats}


async def career(driver_id):
    groups = await jolpica.collect(f"drivers/{driver_id}/driverStandings", "StandingsTable", "StandingsLists", "DriverStandings")
    records = []
    try:
        for group in groups:
            for raw in group["DriverStandings"]:
                item = Standing.model_validate(raw)
                if not item.Driver or item.Driver.driverId != driver_id:
                    raise ValueError("Wrong driver")
                records.append({"year": int(group["season"]), "round": int(group["round"]), **item.model_dump()})
    except (ValueError, KeyError, ValidationError) as exc:
        raise jolpica.ProviderError("invalid_payload") from exc
    latest = {}
    for record in records:
        if record["year"] not in latest or record["round"] > latest[record["year"]]["round"]:
            latest[record["year"]] = record
    season_records = sorted(latest.values(), key=lambda row: row["year"], reverse=True)
    return {
        "source": "Jolpica",
        "fetched_at": now(),
        "driver_id": driver_id,
        "records": records,
        "season_records": season_records,
        "wins": sum(r["wins"] for r in season_records),
        "championship_points": sum(r["points"] for r in season_records),
        "titles": sum(r.get("position") == 1 and r["year"] < datetime.now().year for r in season_records),
    }
