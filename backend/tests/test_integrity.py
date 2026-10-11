import unittest
from unittest.mock import AsyncMock, patch
import pandas as pd
import httpx
from app.services import f1_service as f, openf1_service as o
from app.models.schemas import ScheduleEvent, StandingsEntry
from app.api import routes

class IntegrityTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        f._data_cache.clear()
        o._live_cache.clear()

    async def test_archive_never_substitutes_live(self):
        with patch.object(f, "get_leaderboard", AsyncMock(return_value=[])) as archive, patch.object(o, "get_session_state", AsyncMock()) as live:
            await routes.leaderboard(2024, 6, "Race")
            archive.assert_awaited_once_with(2024, 6, "Race")
            live.assert_not_awaited()
        with patch.object(f, "get_weather", AsyncMock(return_value=None)) as weather, patch.object(o, "get_session_state", AsyncMock()) as live:
            await routes.weather(2024, 6, "Race")
            weather.assert_awaited_once_with(2024, 6, "Race")
            live.assert_not_awaited()

    async def test_owner_driver_snapshot_normalization(self):
        import json
        from pathlib import Path
        snapshot=json.loads((Path(__file__).parent / "owner_snapshot.json").read_text())
        raw=[]
        for i,(name,points,team) in enumerate(snapshot["drivers"]):
            first,last=name.rsplit(" ",1)
            raw.append({"position":str(i+1),"points":str(points),"wins":"0","Driver":{"givenName":first,"familyName":last},"Constructors":[{"name":team}]})
        body={"MRData":{"StandingsTable":{"StandingsLists":[{"season":"2026","DriverStandings":raw}]}}}
        with patch("httpx.AsyncClient.get",AsyncMock(return_value=httpx.Response(200,json=body,request=httpx.Request("GET","https://example.test")))):
            entries=await f._fetch_jolpica_driver_standings(2026)
        self.assertEqual([(e.name,e.points) for e in entries],[(n,p) for n,p,_ in snapshot["drivers"]])
        totals={}
        for entry in entries: totals[entry.team]=totals.get(entry.team,0)+entry.points
        self.assertEqual(totals,{"Mercedes":244,"Ferrari":165,"McLaren":118,"Red Bull Racing":72,"Alpine":41,"Racing Bulls":39,"Haas F1 Team":21,"Williams":11,"Audi":2,"Aston Martin":1,"Cadillac":0})

    async def test_standings_fetches_once_and_caches(self):
        entry = StandingsEntry(position=1, name="Fixture", points=156, wins=3)
        with patch.object(f, "_load_standings_from_disk", return_value=None), patch.object(f, "_save_standings_to_disk"), patch.object(f, "_fetch_jolpica_driver_standings", AsyncMock(return_value=[entry])) as drivers, patch.object(f, "_fetch_jolpica_constructor_standings", AsyncMock(return_value=[entry])) as teams:
            result = await f.get_standings(2026)
            again = await f.get_standings(2026)
        drivers.assert_awaited_once()
        teams.assert_awaited_once()
        self.assertEqual(result["drivers"][0].points, 156)
        self.assertEqual(result, again)

    def test_utc_conversion_and_missing_dates(self):
        self.assertEqual(f._session_date({"Session5Date": "2026-06-07T23:00:00-04:00"}, 5).isoformat(), "2026-06-08T03:00:00+00:00")
        self.assertEqual(f._session_date({"Session5DateUtc": "2026-06-08 03:00:00"}, 5).hour, 3)
        self.assertIsNone(f._session_date({"Session5Date": "2026-06-08 03:00:00"}, 5))
        self.assertIsNone(f._session_date({}, 5))

    async def test_off_week_promotes_next_race(self):
        now = pd.Timestamp.now(tz="UTC")
        past = ScheduleEvent(round_number=1, country="A", location="A", event_name="A", is_completed=True)
        future = ScheduleEvent(round_number=2, country="B", location="B", event_name="B", session1_date=(now + pd.Timedelta(days=5)).isoformat(), session5_date=(now + pd.Timedelta(days=7)).isoformat())
        with patch.object(f, "get_schedule", AsyncMock(return_value=[past, future])):
            result = await f.get_season_context(2026)
        self.assertEqual(result["current_round"], 2)
        self.assertEqual(result["latest_completed_race"]["round_number"], 1)
        self.assertFalse(result["is_active_weekend"])

    async def test_owner_snapshot_supplier_totals(self):
        points = {"Mercedes":244,"Ferrari":165,"McLaren":118,"Red Bull Racing":72,"Alpine":41,"Racing Bulls":39,"Haas F1 Team":21,"Williams":11,"Audi":2,"Aston Martin":1,"Cadillac":0}
        entries = [StandingsEntry(position=i+1, name=n, points=p, wins=0) for i,(n,p) in enumerate(points.items())]
        with patch.object(f, "get_standings", AsyncMock(return_value={"constructors":entries})):
            result = await f.get_engine_standings(2026)
        self.assertEqual({r["name"]:r["points"] for r in result}, {"Mercedes":414,"Ferrari":186,"Ford RBPT":111,"Audi":2,"Honda":1})
        self.assertEqual(sum(len(r["teams"]) for r in result), 11)

    async def test_classification_preserves_dsq_and_position(self):
        session = type("Session", (), {"results":pd.DataFrame([{"Position":4,"DriverNumber":"44","FullName":"Test driver","Abbreviation":"TST","TeamName":"Ferrari","Status":"Disqualified","Laps":30}])})()
        with patch.object(f, "_load_session", AsyncMock(return_value=session)):
            rows = await f.get_leaderboard(2024, 1, "Qualifying")
        self.assertEqual(rows[0].position, 4)
        self.assertEqual(rows[0].status, "Disqualified")
        self.assertEqual(rows[0].laps, 30)
        self.assertIsNone(rows[0].pits)

    async def test_latest_intervals_include_lapped_drivers(self):
        async def provider(path, params):
            return {"/intervals":[{"driver_number":1,"date":"2026-01-01","gap_to_leader":1},{"driver_number":1,"date":"2026-01-02","gap_to_leader":"+1 LAP","interval":"+1 LAP"}],"/drivers":[{"driver_number":1,"full_name":"Test"}],"/position":[{"driver_number":1,"position":2}],"/stints":[],"/pit":None}[path]
        with patch.object(o, "_get", side_effect=provider):
            rows = await o.get_live_timing(123)
        self.assertEqual(rows[0]["gap_to_leader"], "+1 LAP")
        self.assertIsNone(rows[0]["pits"])

    async def test_results_timeout_is_unavailable_not_success(self):
        with patch("httpx.AsyncClient.get", AsyncMock(side_effect=httpx.ReadTimeout("timeout"))):
            result = await f.get_season_results(2026)
        self.assertTrue(result["unavailable"])
        self.assertNotIn("season_results_2026", f._data_cache)

    async def test_results_pagination_and_season_validation(self):
        def result(driver):
            return {"position":"1","number":driver,"Driver":{"driverId":driver,"givenName":"Fixture","familyName":driver},"Constructor":{"name":"Test"},"laps":"10","points":"25","status":"Finished"}
        pages = [{"MRData":{"total":"2","RaceTable":{"season":"2026","Races":[{"round":"1","Results":[result("1")]}]}}}, {"MRData":{"total":"2","RaceTable":{"season":"2026","Races":[{"round":"2","Results":[result("2")]}]}}}]
        responses = [httpx.Response(200,json=p,request=httpx.Request("GET","https://example.test")) for p in pages]
        with patch("httpx.AsyncClient.get",AsyncMock(side_effect=responses)) as fetch:
            data=await f.get_season_results(2026)
            cached=await f.get_season_results(2026)
        self.assertEqual(set(data["results"]),{"1","2"})
        self.assertEqual(fetch.await_count,2)
        self.assertEqual(data,cached)
        f._data_cache.clear()
        pages[0]["MRData"]["RaceTable"]["season"]="2025"
        with patch("httpx.AsyncClient.get",AsyncMock(return_value=httpx.Response(200,json=pages[0],request=httpx.Request("GET","https://example.test")))):
            self.assertTrue((await f.get_season_results(2026))["unavailable"])

    async def test_backend_http_contract(self):
        from fastapi.testclient import TestClient
        from app.main import app
        client=TestClient(app)
        self.assertEqual(client.get("/api/schedule?year=1900").status_code,422)
        self.assertEqual(client.get("/api/leaderboard?year=2026&round=0").status_code,422)
        with patch.object(f,"get_season_results",AsyncMock(return_value={"unavailable":True})):
            self.assertEqual(client.get("/api/results?year=2026").status_code,503)

    def test_historical_constructor_identity(self):
        self.assertEqual(f.normalize_constructor("Alfa Romeo", 2023), "Alfa Romeo")
        self.assertEqual(f.normalize_constructor("Kick Sauber", 2025), "Kick Sauber")

if __name__ == "__main__":
    unittest.main()
