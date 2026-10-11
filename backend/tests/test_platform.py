import asyncio
import unittest
from unittest.mock import patch, AsyncMock
from datetime import datetime, timezone, timedelta
import httpx
from app.services import history_service as h, jolpica as j, news_service as n, openf1_service as o, openf1_auth as auth
from app.models.history import Race


def race(round_number=1, year=2024, team="alpha", points="25", position="1", grid="1", status="Finished", session="Results"):
    return {"season": str(year), "round": str(round_number), "raceName": "Fixture Grand Prix", "date": "2024-03-02", "Circuit": {"circuitId": "test", "circuitName": "Test", "Location": {"locality": "Test", "country": "Test"}}, session: [{"Driver":{"driverId":"fixture", "givenName":"Fixture", "familyName":"Driver"}, "Constructor":{"constructorId":team,"name":team}, "number":"7", "position":position,"grid":grid,"points":points,"laps":"50","status":status}]}


class PlatformTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        unfinished=[task for task in j.pending.values() if not task.done()]
        if unfinished:
            raise AssertionError("A previous test left Jolpica request tasks running")
        j.pending.clear()
        j.cache.clear()
        j.last_request = 0
        j.gate = asyncio.Lock()
        auth.lock = asyncio.Lock()
        auth.token, auth.expires = None, 0

    async def asyncTearDown(self):
        await asyncio.sleep(0)
        unfinished=[task for task in j.pending.values() if not task.done()]
        if unfinished:
            for task in unfinished:
                task.cancel()
            await asyncio.gather(*unfinished, return_exceptions=True)
            self.fail("Test left Jolpica request tasks running")

    def test_transfer_contributions_and_sprints(self):
        races=[Race.model_validate(race()), Race.model_validate(race(2,team="beta",points="18",position="2",grid="4"))]
        sprint=Race.model_validate(race(2,team="beta",points="8",session="SprintResults"))
        result=h.summarize(races,[sprint],[],None)
        self.assertEqual(result["constructors"]["alpha"]["contributions"],{"fixture":25})
        self.assertEqual(result["constructors"]["beta"]["contributions"],{"fixture":26})
        self.assertEqual(result["drivers"]["fixture"]["wins"],1)
        self.assertEqual(result["drivers"]["fixture"]["podiums"],2)
        self.assertEqual(result["drivers"]["fixture"]["grid_p1_starts"],1)
        self.assertEqual(result["progression"][-1]["points"]["fixture"],51)
        self.assertEqual(h.summarize(races,[sprint],[],1)["progression"][-1]["points"]["fixture"],25)

    def test_grid_p1_start_is_not_qualifying_p1(self):
        result=h.summarize([Race.model_validate(race(grid="1"))],[],[],None,"unavailable","unavailable")
        driver=result["drivers"]["fixture"]
        self.assertEqual(driver["grid_p1_starts"],1)
        self.assertIsNone(driver["qualifying_p1"])
        self.assertEqual(result["metric_coverage"]["qualifying_p1"],"unavailable")
        dns=h.summarize([Race.model_validate(race(grid="1",status="Did not start"))],[],[],None,"unavailable","unavailable")
        self.assertEqual(dns["drivers"]["fixture"]["grid_p1_starts"],0)

    def test_qualifying_classification_p1_counts_qualifying_p1(self):
        qualifying=Race.model_validate(race(grid=None,position="1",session="QualifyingResults"))
        result=h.summarize([],[],[qualifying],None,"complete","unavailable")
        self.assertEqual(result["drivers"]["fixture"]["qualifying_p1"],1)
        self.assertEqual(result["constructors"]["alpha"]["qualifying_p1"],1)

    def test_qualifying_p1_uses_constructor_for_that_event(self):
        race_result=Race.model_validate(race(team="alpha",grid="1"))
        qualifying=Race.model_validate(race(team="beta",grid=None,position="1",session="QualifyingResults"))
        result=h.summarize([race_result],[],[qualifying],None,"complete","unavailable")
        self.assertEqual(result["drivers"]["fixture"]["qualifying_p1"],1)
        self.assertEqual(result["constructors"]["alpha"]["qualifying_p1"],0)
        self.assertEqual(result["constructors"]["beta"]["qualifying_p1"],1)

    def test_sprint_p1_does_not_increment_qualifying_statistics(self):
        sprint=Race.model_validate(race(grid="1",position="1",session="SprintResults"))
        result=h.summarize([], [sprint], [], None, "unavailable", "unavailable")
        self.assertIsNone(result["drivers"]["fixture"]["qualifying_p1"])
        self.assertEqual(result["drivers"]["fixture"]["grid_p1_starts"],0)

    def test_missing_qualifying_data_is_explicit_and_not_a_zero(self):
        result=h.summarize([Race.model_validate(race())],[],[],None,"unavailable","unavailable")
        self.assertIsNone(result["drivers"]["fixture"]["qualifying_p1"])
        self.assertIsNone(result["constructors"]["alpha"]["qualifying_p1"])

    def test_missing_fastest_lap_coverage_is_not_reported_as_zero(self):
        result=h.summarize([Race.model_validate(race())],[],[],None,"unavailable","unavailable")
        self.assertIsNone(result["drivers"]["fixture"]["fastest_laps"])
        self.assertEqual(result["metric_coverage"]["fastest_laps"],"unavailable")

    def test_historical_points_not_recalculated_and_disqualified(self):
        data=h.summarize([Race.model_validate(race(year=1950,points="4.5")),Race.model_validate(race(2,year=1950,points="0",position="2",status="Disqualified"))],[],[],None)
        self.assertEqual(data["drivers"]["fixture"]["race_points"],4.5)
        self.assertEqual(data["drivers"]["fixture"]["podiums"],1)

    async def test_pagination_single_flight_and_bound(self):
        async def page(path,offset):
            await asyncio.sleep(.005)
            return {"total":"2","RaceTable":{"Races":[race(offset+1)]}}
        with patch.object(j,"page",side_effect=page) as fetch:
            a,b=await asyncio.gather(j.collect("2024/results","RaceTable","Races","Results"),j.collect("2024/results","RaceTable","Races","Results"))
        self.assertEqual(a,b)
        self.assertEqual(fetch.await_count,2)
        with patch.object(j,"page",AsyncMock(return_value={"total":"1","RaceTable":{"Races":[]}})):
            with self.assertRaises(j.ProviderError): await j.collect("bad","RaceTable","Races","Results")

    async def test_reject_wrong_season_and_missing_points(self):
        with patch.object(j,"collect",AsyncMock(return_value=[race(year=2023)])):
            with self.assertRaises(j.ProviderError): await h.races(2024,"results")
        invalid=race();del invalid["Results"][0]["points"]
        with patch.object(j,"collect",AsyncMock(return_value=[invalid])):
            with self.assertRaises(j.ProviderError): await h.races(2024,"results")

    async def test_paginated_classifications_reject_duplicate_events_and_rows(self):
        event=race()
        with patch.object(j,"collect",AsyncMock(return_value=[event,event])):
            with self.assertRaises(j.ProviderError): await h.races(2024,"results")
        duplicate=race()
        duplicate["Results"].append(dict(duplicate["Results"][0]))
        with patch.object(j,"collect",AsyncMock(return_value=[duplicate])):
            with self.assertRaises(j.ProviderError): await h.races(2024,"results")

    async def test_pagination_rejects_offsets_that_exceed_total(self):
        payload={"total":"1","RaceTable":{"Races":[race(),race(2)]}}
        with patch.object(j,"page",AsyncMock(return_value=payload)):
            with self.assertRaises(j.ProviderError):
                await j.collect("oversized","RaceTable","Races")

    async def test_round_standings_keep_official_deductions(self):
        group={"season":"2024","round":"2","DriverStandings":[{"position":"1","points":"10","wins":"1","Driver":race()["Results"][0]["Driver"],"Constructors":[]}]}
        with patch.object(j,"collect",AsyncMock(return_value=[group])):
            self.assertEqual((await h.standings(2024,2,"drivers"))["rows"][0]["points"],10)
            with self.assertRaises(j.ProviderError): await h.standings(2024,1,"drivers")

    async def test_partial_and_unavailable_are_distinct(self):
        with patch.object(h,"races",AsyncMock(side_effect=j.ProviderError())),patch.object(h,"standings",AsyncMock(return_value={"round":None,"rows":[]})):
            self.assertEqual((await h.season(2024))["status"],"partial")
        with patch.object(h,"races",AsyncMock(side_effect=j.ProviderError())),patch.object(h,"standings",AsyncMock(side_effect=j.ProviderError())):
            with self.assertRaises(j.ProviderError): await h.season(2024)

    async def test_latest_driver_and_constructor_standings_must_share_round(self):
        async def standings(year,round_number,kind):
            actual_round=2 if kind == "drivers" else 1
            return {"round":actual_round,"rows":[]}
        with patch.object(h,"races",AsyncMock(return_value=[])),patch.object(h,"standings",side_effect=standings):
            data=await h.season(2024)
        self.assertEqual(data["status"],"partial")
        self.assertEqual(data["errors"]["constructor_standings"],"round_mismatch")
        self.assertIsNone(data["constructor_standings"])

    async def test_rate_limit_is_explicit(self):
        with patch("httpx.AsyncClient.get",AsyncMock(return_value=httpx.Response(429,request=httpx.Request("GET","https://example.test")))):
            with self.assertRaises(j.ProviderError) as failure: await j.page("2024/results")
        self.assertEqual(failure.exception.reason,"rate_limited")

    def test_news_safe_urls_dates_dedup_and_xml(self):
        for url in ["javascript:alert(1)","data:image/png,test","http://localhost/x","https://user:pass@example.com","http://127.0.0.1/x"]:
            self.assertIsNone(n.safe_url(url))
        xml=b'<rss><channel><item><title>A real fixture</title><link>https://example.com/news?utm_source=x</link><pubDate>Fri, 10 Oct 2025 10:00:00 GMT</pubDate><description>&lt;b&gt;Summary&lt;/b&gt;</description></item></channel></rss>'
        parsed=n.parse_feed(xml,"Fixture","https://example.com/rss","2026-01-01")
        self.assertEqual(parsed[0]["link"],"https://example.com/news")
        self.assertEqual(parsed[0]["summary"],"Summary")
        self.assertTrue(parsed[0]["published"].startswith("2025-10-10"))
        self.assertEqual(len(n.deduplicate(parsed+parsed)),1)
        with self.assertRaises(ValueError):n.parse_feed(b'<!DOCTYPE rss><rss/>',"Fixture","https://example.com","")

    def test_live_requires_auth_and_recent_evidence(self):
        now=datetime(2026,1,1,tzinfo=timezone.utc)
        session={"session_key":1,"session_name":"Race","year":2026}
        messages=[{"date":now.isoformat(),"message":"SESSION STARTED"}]
        self.assertFalse(o.classify_session(session,messages,False,now)["is_live"])
        self.assertTrue(o.classify_session(session,messages,True,now)["is_live"])
        self.assertEqual(o.classify_session(session,messages,True,now+timedelta(minutes=4))["state"],"STALE")
        messages[0]["message"]="SESSION ENDED"
        self.assertFalse(o.classify_session(session,messages,True,now)["is_live"])

    async def test_token_renewal_never_exposes_credentials(self):
        from pydantic import SecretStr
        with patch.object(auth.settings,"OPENF1_USERNAME",SecretStr("fixture")),patch.object(auth.settings,"OPENF1_PASSWORD",SecretStr("private-fixture")),patch.object(auth.settings,"OPENF1_TOKEN",SecretStr("")),patch("httpx.AsyncClient.post",AsyncMock(return_value=httpx.Response(200,json={"access_token":"fixture-token","expires_in":3600},request=httpx.Request("POST","https://example.test")))) as post:
            first=await auth.headers();await auth.headers();await auth.headers(force=True)
            self.assertEqual(post.await_count,2)
            self.assertIn("Authorization",first)
            self.assertNotIn("private-fixture",str(auth.health()))
            self.assertNotIn("fixture-token",str(auth.health()))

    async def test_career_uses_final_snapshot_per_season(self):
        def entry(round_number, points, wins, position):
            return {"season": "2020", "round": str(round_number), "DriverStandings": [{"position": str(position), "points": str(points), "wins": str(wins), "Driver": race()["Results"][0]["Driver"], "Constructors": []}]}
        with patch.object(j,"collect",AsyncMock(return_value=[entry(1,25,1,1),entry(2,50,2,1),entry(3,80,3,2)])):
            career=await h.career("fixture")
        self.assertEqual(career["championship_points"],80)
        self.assertEqual(career["wins"],3)
        self.assertEqual(len(career["season_records"]),1)
        self.assertEqual(career["titles"],0)

    async def test_career_counts_only_a_verified_final_round_title(self):
        standings=[{"season":"2025","round":"3","DriverStandings":[{"position":"1","points":"100","wins":"4","Driver":race()["Results"][0]["Driver"],"Constructors":[]}]}]
        schedule=[{"season":"2025","round":str(round_number)} for round_number in range(1,4)]
        async def collect(path,table,collection,nested=None):
            return standings if path == "drivers/fixture/driverStandings" else schedule
        with patch.object(j,"collect",side_effect=collect):
            career=await h.career("fixture")
        self.assertEqual(career["titles"],1)
        self.assertEqual(career["title_coverage"],"complete")

    async def test_career_excludes_an_in_progress_season_title(self):
        standings=[{"season":"2026","round":"1","DriverStandings":[{"position":"1","points":"25","wins":"1","Driver":race()["Results"][0]["Driver"],"Constructors":[]}]}]
        schedule=[{"season":"2026","round":"1"},{"season":"2026","round":"2"}]
        async def collect(path,table,collection,nested=None):
            return standings if path == "drivers/fixture/driverStandings" else schedule
        with patch.object(j,"collect",side_effect=collect):
            career=await h.career("fixture")
        self.assertEqual(career["titles"],0)

    async def test_career_title_unavailable_when_finality_cannot_be_verified(self):
        standings=[{"season":"2025","round":"3","DriverStandings":[{"position":"1","points":"100","wins":"4","Driver":race()["Results"][0]["Driver"],"Constructors":[]}]}]
        async def collect(path,table,collection,nested=None):
            if path == "drivers/fixture/driverStandings": return standings
            raise j.ProviderError("unavailable")
        with patch.object(j,"collect",side_effect=collect):
            career=await h.career("fixture")
        self.assertIsNone(career["titles"])
        self.assertEqual(career["title_coverage"],"partial")

    async def test_media_disabled_and_wrong_year(self):
        from app.services import media_service as m
        with patch.object(m.settings,"OPENF1_IMAGES_ENABLED",False),patch.object(o,"_get",AsyncMock()) as fetch:
            result=await m.portrait(2024,"fixture")
            self.assertIsNone(result["url"])
            fetch.assert_not_awaited()

    def test_http_validation_and_lifespan_cleanup(self):
        from fastapi.testclient import TestClient
        from app.main import app
        with patch("app.main.start_live_service") as start,patch("app.main.stop_live_service") as stop:
            with TestClient(app) as client:
                self.assertEqual(client.get("/api/history/season?year=1949").status_code,422)
                self.assertEqual(client.get("/api/history/season?year=2024&round=0").status_code,422)
                with patch.object(h,"season",AsyncMock(side_effect=j.ProviderError())):
                    self.assertEqual(client.get("/api/history/season?year=2024").status_code,503)
            start.assert_called_once()
            stop.assert_called_once()
