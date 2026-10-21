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
        rounds = [race.round for race in parsed]
        if len(rounds) != len(set(rounds)):
            raise ValueError("Duplicate event in paginated response")
        if field:
            identities = [
                (race.round, item.Driver.driverId)
                for race in parsed
                for item in getattr(race, field)
            ]
            if len(identities) != len(set(identities)):
                raise ValueError("Duplicate classification in paginated response")
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
        ids = [row["id"] for row in output]
        if len(ids) != len(set(ids)):
            raise ValueError("Duplicate standings identity")
        return {"round": actual_round, "rows": output}
    except (KeyError, TypeError, ValueError, ValidationError) as exc:
        raise jolpica.ProviderError("invalid_payload") from exc


def _classified(item):
    excluded_status = {"disqualified", "did not start", "not classified", "excluded", "withdrawn"}
    excluded_positions = {"D", "E", "W", "F", "R", "N", "NC", "EX"}
    status = item.get("status") if isinstance(item, dict) else item.status
    position_text = item.get("positionText") if isinstance(item, dict) else item.positionText
    return (
        (status or "").strip().casefold() not in excluded_status
        and (position_text or "").strip().upper() not in excluded_positions
    )


def summarize(
    race_rows,
    sprint_rows,
    qualifying_rows,
    through,
    qualifying_coverage="unavailable",
    fastest_lap_coverage="unavailable",
):
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
                driver = drivers.setdefault(did, {**item.Driver.model_dump(), "teams": {}, "numbers": [], "wins": 0, "podiums": 0, "qualifying_p1": None, "grid_p1_starts": 0, "fastest_laps": None, "race_points": 0.0, "sprint_points": 0.0})
                team = constructors.setdefault(cid, {**item.Constructor.model_dump(), "contributions": {}, "wins": 0, "podiums": 0, "qualifying_p1": None, "grid_p1_starts": 0, "fastest_laps": None, "race_points": 0.0, "sprint_points": 0.0})
                driver["teams"][cid] = item.Constructor.name
                if item.number and item.number not in driver["numbers"]:
                    driver["numbers"].append(item.number)
                if session != "Qualifying":
                    key = "race_points" if session == "Race" else "sprint_points"
                    driver[key] += item.points
                    team[key] += item.points
                    team["contributions"][did] = team["contributions"].get(did, 0) + item.points
                # Official finishing rank; DSQ/DNS never counts as a race podium.
                eligible = _classified(item)
                if session == "Race" and eligible:
                    for target in (driver, team):
                        target["wins"] += int(item.position == 1)
                        target["podiums"] += int(item.position is not None and 1 <= item.position <= 3)
                    fastest_lap = (item.FastestLap or {}).get("rank")
                    if fastest_lap is not None:
                        driver["fastest_laps"] = (driver["fastest_laps"] or 0) + int(str(fastest_lap) == "1")
                        team["fastest_laps"] = (team["fastest_laps"] or 0) + int(str(fastest_lap) == "1")
                did_not_start = (item.status or "").strip().casefold() in {
                    "did not start", "dns", "did not qualify", "withdrawn"
                }
                if session == "Race" and item.grid == 1 and not did_not_start:
                    driver["grid_p1_starts"] += 1
                    team["grid_p1_starts"] += 1
                if session == "Qualifying" and item.position == 1 and eligible:
                    driver["qualifying_p1"] = (driver["qualifying_p1"] or 0) + 1
                    team["qualifying_p1"] = (team["qualifying_p1"] or 0) + 1
                results.append({"year": race.season, "round": race.round, "race": race.raceName, "date": race.date, "session": session, **item.model_dump()})
    progression = []
    totals = {}
    for round_number in sorted({r["round"] for r in results if r["session"] != "Qualifying"}):
        for result in results:
            if result["round"] == round_number and result["session"] != "Qualifying":
                did = result["Driver"]["driverId"]
                totals[did] = totals.get(did, 0) + result["points"]
        progression.append({"round": round_number, "points": dict(totals)})
    if qualifying_coverage == "complete":
        for target in [*drivers.values(), *constructors.values()]:
            if target["qualifying_p1"] is None:
                target["qualifying_p1"] = 0
    if fastest_lap_coverage == "unavailable":
        for target in [*drivers.values(), *constructors.values()]:
            target["fastest_laps"] = None
    return {
        "drivers": drivers,
        "constructors": constructors,
        "results": results,
        "progression": progression,
        "metric_coverage": {
            "qualifying_p1": qualifying_coverage,
            "fastest_laps": fastest_lap_coverage,
        },
    }


def dashboard_insights(data):
    """Derive Home insight cards only from the canonical season response."""
    errors = data.get("errors", {})

    def value(domain, name=None, stat=None, *, status=None):
        state = status or ("available" if domain not in errors and name and stat else "unavailable")
        return {
            "name": name if state != "unavailable" else "Unavailable",
            "stat": stat if state != "unavailable" else f"{domain.replace('_', ' ').title()} unavailable",
            "status": state,
        }

    drivers = (data.get("driver_standings") or {}).get("rows") or []
    constructors = (data.get("constructor_standings") or {}).get("rows") or []
    driver_leader = min(
        (row for row in drivers if row.get("position") is not None),
        key=lambda row: row["position"], default=None,
    )
    constructor_leader = min(
        (row for row in constructors if row.get("position") is not None),
        key=lambda row: row["position"], default=None,
    )
    driver_insight = value(
        "driver_standings",
        " ".join(filter(None, [driver_leader["Driver"].get("givenName"), driver_leader["Driver"].get("familyName")])) if driver_leader else None,
        f"Official championship leader · {driver_leader['points']} pts" if driver_leader else None,
    )
    constructor_insight = value(
        "constructor_standings",
        constructor_leader["Constructor"].get("name") if constructor_leader else None,
        f"Official championship leader · {constructor_leader['points']} pts" if constructor_leader else None,
    )

    race_rows = [row for row in data.get("results", []) if row.get("session") == "Race"]
    latest_round = max((row["round"] for row in race_rows), default=None)
    latest_race_rows = [row for row in race_rows if row["round"] == latest_round]
    winner = next((row for row in latest_race_rows if row.get("position") == 1 and _classified(row)), None)
    if winner:
        driver = winner["Driver"]
        recent_winner = value(
            "races", " ".join(filter(None, [driver.get("givenName"), driver.get("familyName")])),
            f"{winner['race']} winner · Round {winner['round']}",
        )
    else:
        recent_winner = value("races")

    gainers = []
    for row in latest_race_rows:
        grid, position = row.get("grid"), row.get("position")
        if grid is None or grid < 1 or position is None or not _classified(row):
            continue
        gained = grid - position
        if gained > 0:
            name = " ".join(filter(None, [row["Driver"].get("givenName"), row["Driver"].get("familyName")]))
            gainers.append((gained, name))
    biggest_gainer = value(
        "races",
        max(gainers, key=lambda item: (item[0], item[1]))[1] if gainers else None,
        f"Gained {max(gainers, key=lambda item: (item[0], item[1]))[0]} places · Round {latest_round}" if gainers else None,
    )

    coverage = data.get("metric_coverage", {}).get("qualifying_p1", "unavailable")
    qualifying_leader = None
    if coverage != "unavailable":
        qualified = [
            (entry.get("qualifying_p1"), " ".join(filter(None, [entry.get("givenName"), entry.get("familyName")])))
            for entry in (data.get("drivers") or {}).values()
            if entry.get("qualifying_p1") is not None
        ]
        if qualified:
            count, name = max(qualified, key=lambda item: (item[0], item[1]))
            suffix = " · partial coverage" if coverage == "partial" else ""
            qualifying_leader = value(
                "qualifying", name,
                f"{count} Qualifying P1 classification{'s' if count != 1 else ''}{suffix}",
                status="partial" if coverage == "partial" else "available",
            )
    if qualifying_leader is None:
        qualifying_leader = value("qualifying", status="unavailable")

    return {
        "driver_in_form": driver_insight,
        "qualifying_p1_leader": qualifying_leader,
        "biggest_gainer": biggest_gainer,
        "recent_winner": recent_winner,
        "constructor_leader": constructor_insight,
    }


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
    driver_standings_round = (data["driver_standings"] or {}).get("round")
    constructor_standings_round = (data["constructor_standings"] or {}).get("round")
    if (
        not round_number
        and driver_standings_round is not None
        and constructor_standings_round is not None
        and driver_standings_round != constructor_standings_round
    ):
        errors["constructor_standings"] = "round_mismatch"
        data["constructor_standings"] = None
    standings_round = driver_standings_round if driver_standings_round is not None else constructor_standings_round
    stats_through = round_number or standings_round
    schedule_rows = data["schedule"] or []
    expected_rounds = {
        row.round for row in schedule_rows if stats_through is None or row.round <= stats_through
    }
    qualifying_rounds = {
        race.round
        for race in data["qualifying"] or []
        if (stats_through is None or race.round <= stats_through) and race.QualifyingResults
    }
    if data["qualifying"] is None or not qualifying_rounds:
        qualifying_coverage = "unavailable"
    elif expected_rounds and expected_rounds.issubset(qualifying_rounds):
        qualifying_coverage = "complete"
    else:
        qualifying_coverage = "partial"
    race_classifications = [item for race in data["races"] or [] if stats_through is None or race.round <= stats_through for item in race.Results]
    fastest_lap_rows = [item for item in race_classifications if (item.FastestLap or {}).get("rank") is not None]
    if not fastest_lap_rows:
        fastest_lap_coverage = "unavailable"
    elif len(fastest_lap_rows) == len(race_classifications):
        fastest_lap_coverage = "complete"
    else:
        fastest_lap_coverage = "partial"
    stats = summarize(
        data["races"] or [], data["sprints"] or [], data["qualifying"] or [], stats_through,
        qualifying_coverage, fastest_lap_coverage,
    )
    from app.services.event_identity import reconcile_jolpica_schedule_entry
    schedule = {
        r.round: reconcile_jolpica_schedule_entry(
            year,
            r.model_dump(exclude={"Results", "SprintResults", "QualifyingResults"}),
        )
        for r in data["schedule"] or []
    }
    return {"year": year, "selected_round": round_number, "status": "partial" if errors else "success", "source": "Jolpica", "fetched_at": now(), "cache_seconds": 900, "errors": errors, "schedule": list(schedule.values()), "driver_standings": data["driver_standings"], "constructor_standings": data["constructor_standings"], **stats}


async def career(driver_id: str, year: int | None = None):
    if year is not None:
        groups = await jolpica.collect(f"{year}/drivers/{driver_id}/driverStandings", "StandingsTable", "StandingsLists", "DriverStandings")
    else:
        try:
            groups = await jolpica.collect(f"drivers/{driver_id}/driverStandings", "StandingsTable", "StandingsLists", "DriverStandings")
        except jolpica.ProviderError:
            seasons_data = await jolpica.collect(f"drivers/{driver_id}/seasons", "SeasonTable", "Seasons")
            if not seasons_data:
                raise jolpica.ProviderError("round_not_found")
            years = sorted({int(s["season"]) for s in seasons_data if "season" in s and str(s["season"]).isdigit()}, reverse=True)
            async def fetch_season(y):
                try:
                    return await jolpica.collect(f"{y}/drivers/{driver_id}/driverStandings", "StandingsTable", "StandingsLists", "DriverStandings")
                except jolpica.ProviderError:
                    return []
            batches = await asyncio.gather(*(fetch_season(y) for y in years))
            groups = [item for batch in batches for item in batch]
            if not groups:
                raise jolpica.ProviderError("unavailable")
    records = []
    try:
        snapshot_ids = set()
        for group in groups:
            for raw in group["DriverStandings"]:
                item = Standing.model_validate(raw)
                if not item.Driver or item.Driver.driverId != driver_id:
                    raise ValueError("Wrong driver")
                year, round_number = int(group["season"]), int(group["round"])
                identity = (year, round_number)
                if identity in snapshot_ids:
                    raise ValueError("Duplicate career standings snapshot")
                snapshot_ids.add(identity)
                records.append({"year": year, "round": round_number, **item.model_dump()})
    except (ValueError, KeyError, ValidationError) as exc:
        raise jolpica.ProviderError("invalid_payload") from exc
    latest = {}
    for record in records:
        if record["year"] not in latest or record["round"] > latest[record["year"]]["round"]:
            latest[record["year"]] = record
    season_records = sorted(latest.values(), key=lambda row: row["year"], reverse=True)
    title_candidates = [record for record in season_records if record.get("position") == 1]

    async def final_round(year):
        try:
            schedule = await jolpica.collect(str(year), "RaceTable", "Races")
            rounds = [int(row["round"]) for row in schedule if int(row["season"]) == year]
            if len(rounds) != len(set(rounds)) or not rounds:
                return year, None
            return year, max(rounds)
        except (jolpica.ProviderError, KeyError, TypeError, ValueError):
            return year, None

    final_rounds = dict(await asyncio.gather(*(final_round(record["year"]) for record in title_candidates)))
    titles_complete = all(final_rounds.get(record["year"]) is not None for record in title_candidates)
    title_count = sum(
        record["round"] == final_rounds.get(record["year"])
        for record in title_candidates
        if final_rounds.get(record["year"]) is not None
    )
    return {
        "source": "Jolpica",
        "fetched_at": now(),
        "driver_id": driver_id,
        "records": records,
        "season_records": season_records,
        "wins": sum(r["wins"] for r in season_records),
        "championship_points": sum(r["points"] for r in season_records),
        "titles": title_count if titles_complete else None,
        "title_coverage": "complete" if titles_complete else ("partial" if title_candidates else "complete"),
    }
