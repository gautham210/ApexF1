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
    def setUp(self):
        j.cache.clear()
        j.last_request = 0
        j.gate = asyncio.Lock()
        auth.lock = asyncio.Lock()
        auth.token, auth.expires = None, 0

    def test_transfer_contributions_and_sprints(self):
        races=[Race.model_validate(race()), Race.model_validate(race(2,team="beta",points="18",position="2",grid="4"))]
        sprint=Race.model_validate(race(2,team="beta",points="8",session="SprintResults"))
        result=h.summarize(races,[sprint],[],None)
        self.assertEqual(result["constructors"]["alpha"]["contributions"],{"fixture":25})
        self.assertEqual(result["constructors"]["beta"]["contributions"],{"fixture":26})
        self.assertEqual(result["drivers"]["fixture"]["wins"],1)
        self.assertEqual(result["drivers"]["fixture"]["podiums"],2)
        self.assertEqual(result["drivers"]["fixture"]["poles"],1)
        self.assertEqual(result["progression"][-1]["points"]["fixture"],51)
        self.assertEqual(h.summarize(races,[sprint],[],1)["progression"][-1]["points"]["fixture"],25)

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

    async def test_media_disabled_and_wrong_year(self):
        from app.services import media_service as m
        with patch.object(m.settings,"OPENF1_IMAGES_ENABLED",False),patch.object(o,"_get",AsyncMock()) as fetch:
            result=await m.portrait(2024,"fixture")
            self.assertIsNone(result["url"])
            fetch.assert_not_awaited()

    async def test_http_validation(self):
        from fastapi.testclient import TestClient
        from app.main import app
        client=TestClient(app)
        self.assertEqual(client.get("/api/history/season?year=1949").status_code,422)
        self.assertEqual(client.get("/api/history/season?year=2024&round=0").status_code,422)
        with patch.object(h,"season",AsyncMock(side_effect=j.ProviderError())):
            self.assertEqual(client.get("/api/history/season?year=2024").status_code,503)
