import unittest
from unittest.mock import AsyncMock, patch
import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

from app.main import app, _client_ip
from app.models.schemas import ScheduleEvent
from app.services import f1_service as f
from app.services import openf1_history


class OverhaulBackendTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        f._data_cache.clear()
        f._session_cache.clear()
        f._failed_session_cache.clear()
        openf1_history._sessions_cache.clear()
        openf1_history._drivers_cache.clear()
        openf1_history._laps_raw_cache.clear()
        openf1_history._stints_cache.clear()
        openf1_history._telemetry_cache.clear()
        openf1_history._circuit_cache.clear()

    def test_client_ip_prefers_rightmost_forwarded_hop(self):
        scope = {
            "type": "http",
            "headers": [(b"x-forwarded-for", b"1.2.3.4, 198.51.100.22")],
            "client": ("10.0.0.1", 12345),
        }
        req = type("Req", (), {"headers": {"x-forwarded-for": "1.2.3.4, 198.51.100.22"}, "client": type("C", (), {"host": "10.0.0.1"})()})()
        self.assertEqual(_client_ip(req), "198.51.100.22")
        _ = scope

    def test_route_validation_rejects_invalid_session_and_driver(self):
        client = TestClient(app)
        self.assertEqual(client.get("/api/leaderboard?year=2025&round=1&session=InvalidSession").status_code, 422)
        self.assertEqual(client.get("/api/telemetry?year=2025&round=1&session=Race&driver=../etc").status_code, 422)
        self.assertEqual(client.get("/api/circuit-map?year=1900&round=1").status_code, 422)
        with patch.object(f, "get_circuit_map", AsyncMock(return_value={"available": False, "points": [], "corners": []})):
            resp = client.get("/api/circuit-map?year=2025&round=1&session=fp1")
            self.assertEqual(resp.status_code, 200)
            self.assertFalse(resp.json()["data"]["available"])

    async def test_active_weekend_remains_true_during_live_race_window(self):
        now = pd.Timestamp.now(tz="UTC")
        active_race = ScheduleEvent(
            round_number=5,
            country="Italy",
            location="Imola",
            event_name="Emilia Romagna Grand Prix",
            session1_date=(now - pd.Timedelta(days=2)).isoformat(),
            session5_date=(now - pd.Timedelta(hours=1)).isoformat(),
            is_completed=False,
        )
        with patch.object(f, "get_schedule", AsyncMock(return_value=[active_race])):
            ctx = await f.get_season_context(2026)
        self.assertTrue(ctx["is_active_weekend"])
        self.assertEqual(ctx["current_round"], 5)
        self.assertEqual(ctx["next_race"]["round_number"], 5)

    async def test_laps_and_tyres_preserve_starting_stint_and_missing_values(self):
        df = pd.DataFrame([
            {
                "DriverNumber": "3",
                "Driver": "VER",
                "LapNumber": 1,
                "LapTime": pd.Timedelta(seconds=95.1),
                "Sector1Time": pd.Timedelta(seconds=30.1),
                "Sector2Time": pd.Timedelta(seconds=35.0),
                "Sector3Time": pd.Timedelta(seconds=30.0),
                "Compound": "MEDIUM",
                "TyreLife": np.nan,
                "IsPersonalBest": False,
                "PitInTime": pd.NaT,
                "PitOutTime": pd.NaT,
            },
            {
                "DriverNumber": "3",
                "Driver": "VER",
                "LapNumber": 18,
                "LapTime": pd.Timedelta(seconds=93.2),
                "Sector1Time": pd.Timedelta(seconds=29.5),
                "Sector2Time": pd.Timedelta(seconds=34.2),
                "Sector3Time": pd.Timedelta(seconds=29.5),
                "Compound": "HARD",
                "TyreLife": 1.0,
                "IsPersonalBest": True,
                "PitInTime": pd.NaT,
                "PitOutTime": pd.Timedelta(minutes=30),
            },
        ])
        session_stub = type("Session", (), {"laps": df})()
        with patch.object(f, "_load_session", AsyncMock(return_value=session_stub)):
            laps_by_abbr = await f.get_laps(2026, 1, "Race", driver="VER")
        self.assertEqual(len(laps_by_abbr), 2)
        self.assertIsNone(laps_by_abbr[0].tyre_life)
        self.assertFalse(laps_by_abbr[0].pit_in)
        self.assertTrue(laps_by_abbr[1].pit_out)

        client = TestClient(app)
        with patch.object(f, "get_laps", AsyncMock(return_value=laps_by_abbr)):
            resp = client.get("/api/tyres?year=2026&round=1&session=Race")
        self.assertEqual(resp.status_code, 200)
        stints = resp.json()["data"]["3"]
        self.assertEqual(len(stints), 2)
        self.assertEqual(stints[0]["compound"], "MEDIUM")
        self.assertIsNone(stints[0]["age"])
        self.assertEqual(stints[1]["compound"], "HARD")
        self.assertEqual(stints[1]["age"], 1)

    async def test_telemetry_handles_missing_lap_and_nullable_sensors(self):
        tel_df = pd.DataFrame([
            {
                "Time": pd.Timedelta(seconds=1.5),
                "Speed": 285.0,
                "RPM": 11200.0,
                "Throttle": 100.0,
                "Brake": False,
                "nGear": np.nan,
                "DRS": np.nan,
                "Distance": 120.0,
                "X": 100.0,
                "Y": 200.0,
                "Z": 10.0,
            }
        ])

        class LapRow:
            def get_telemetry(self):
                return tel_df

        class LapsFrame(pd.DataFrame):
            @property
            def _constructor(self):
                return LapsFrame

            def pick_drivers(self, driver):
                return self[self["Driver"] == driver]

            def pick_fastest(self):
                return LapRow()

            def __getitem__(self, key):
                res = super().__getitem__(key)
                if isinstance(res, pd.DataFrame) and len(res) > 0:
                    return res
                return res

        laps_df = LapsFrame([{"DriverNumber": "1", "Driver": "NOR", "LapNumber": 12}])

        # Ensure iloc[0] on filtered frame returns an object with get_telemetry
        class MockLaps:
            empty = False
            columns = ["DriverNumber", "Driver", "LapNumber"]

            def pick_drivers(self, d):
                return self if d in ("1", "NOR") else EmptyMock()

            def pick_fastest(self):
                return LapRow()

            def __getitem__(self, item):
                return EmptyMock()

        class EmptyMock:
            empty = True

        session_stub = type("Session", (), {"laps": MockLaps()})()
        _ = laps_df
        with patch.object(f, "_load_session", AsyncMock(return_value=session_stub)):
            pts = await f.get_telemetry(2026, 1, "Race", "NOR")
            missing_lap = await f.get_telemetry(2026, 1, "Race", "NOR", lap_number=99)
        self.assertEqual(len(pts), 1)
        self.assertEqual(pts[0].brake, 0.0)
        self.assertIsNone(pts[0].gear)
        self.assertIsNone(pts[0].drs)
        self.assertEqual(missing_lap, [])

    async def test_weather_preserves_none_rainfall(self):
        w_df = pd.DataFrame([{"AirTemp": 22.0, "TrackTemp": 34.0, "Humidity": 50.0, "Pressure": 1012.0, "WindSpeed": 3.0, "WindDirection": 180.0, "Rainfall": np.nan}])
        session_stub = type("Session", (), {"weather_data": w_df})()
        with patch.object(f, "_load_session", AsyncMock(return_value=session_stub)):
            w = await f.get_weather(2025, 1, "Race")
        self.assertIsNotNone(w)
        self.assertIsNone(w.rainfall)

    async def test_circuit_map_normalizes_rotated_coordinates(self):
        pts = pd.DataFrame([{"X": float(np.cos(a) * 500), "Y": float(np.sin(a) * 300)} for a in np.linspace(0, 6.2, 40)])

        class FastestLap:
            def get(self, k, d=None):
                return {"Driver": "VER", "DriverNumber": "1"}.get(k, d)

            def get_telemetry(self):
                return pts

        class Laps:
            empty = False

            def pick_fastest(self):
                return FastestLap()

        class CInfo:
            rotation = 90.0
            corners = pd.DataFrame([{"Number": 1, "Letter": "", "X": 500.0, "Y": 0.0}])

        class Session:
            laps = Laps()
            event = type("Ev", (), {"Location": "Melbourne", "EventName": "Australian Grand Prix"})()

            def get_circuit_info(self):
                return CInfo()

        with patch.object(f, "_load_session", AsyncMock(return_value=Session())):
            cmap = await f.get_circuit_map(2025, 1, "Race")
        self.assertTrue(cmap["available"])
        self.assertEqual(cmap["reference_driver"], "VER")
        self.assertEqual(len(cmap["points"]), 40)
        self.assertEqual(len(cmap["corners"]), 1)
        self.assertEqual(cmap["corners"][0]["number"], 1)

    def test_team_color_resolves_aliases(self):
        self.assertEqual(f._team_color("Red Bull", 2025), "#3671C6")
        self.assertEqual(f._team_color("Sauber", 2026), "#C0C0C0")
        self.assertEqual(f._team_color("Kick Sauber", 2025), "#52E252")

    async def test_openf1_history_fallback_skips_testing_and_merges_stints_and_location(self):
        sessions_payload = [
            {"session_key": 9001, "meeting_key": 1228, "meeting_name": "Pre-Season Testing", "circuit_short_name": "Sakhir", "location": "Sakhir", "country_name": "Bahrain", "session_name": "Race", "date_start": "2024-02-23T07:00:00+00:00"},
            {"session_key": 9472, "meeting_key": 1229, "meeting_name": "Bahrain Grand Prix", "circuit_short_name": "Sakhir", "location": "Sakhir", "country_name": "Bahrain", "session_name": "Race", "date_start": "2024-03-02T15:00:00+00:00"},
        ]
        drivers_payload = [
            {"driver_number": 1, "full_name": "Max VERSTAPPEN", "name_acronym": "VER", "team_name": "Red Bull Racing", "team_colour": "3671c6", "country_code": "NED"}
        ]
        laps_payload = [
            {"driver_number": 1, "lap_number": 1, "lap_duration": 97.5, "duration_sector_1": 32.5, "duration_sector_2": 41.0, "duration_sector_3": 24.0, "date_start": "2024-03-02T15:03:42.000+00:00", "is_pit_out_lap": False},
            {"driver_number": 1, "lap_number": 18, "lap_duration": 115.2, "duration_sector_1": 32.1, "duration_sector_2": 40.9, "duration_sector_3": 42.2, "date_start": "2024-03-02T15:31:00.000+00:00", "is_pit_out_lap": False},
            {"driver_number": 1, "lap_number": 19, "lap_duration": 95.1, "duration_sector_1": 31.1, "duration_sector_2": 40.0, "duration_sector_3": 24.0, "date_start": "2024-03-02T15:32:55.200+00:00", "is_pit_out_lap": True},
        ]
        stints_payload = [
            {"driver_number": 1, "stint_number": 1, "lap_start": 1, "lap_end": 18, "compound": "SOFT", "tyre_age_at_start": 0},
            {"driver_number": 1, "stint_number": 2, "lap_start": 19, "lap_end": 57, "compound": "HARD", "tyre_age_at_start": 2},
        ]
        car_payload = [
            {"date": "2024-03-02T15:32:55.200+00:00", "speed": 252, "rpm": 10800, "throttle": 100, "brake": 0, "n_gear": 6, "drs": 1},
            {"date": "2024-03-02T15:32:56.200+00:00", "speed": 288, "rpm": 11400, "throttle": 100, "brake": 0, "n_gear": 7, "drs": 12},
        ]
        loc_payload = [
            {"date": f"2024-03-02T15:32:{i:02d}.000+00:00", "x": float(i * 10), "y": float((i % 5) * 20), "z": 5.0}
            for i in range(1, 26)
        ]

        async def fake_get_json(url_or_path, params=None):
            if url_or_path == "/sessions":
                return sessions_payload
            if url_or_path == "/drivers":
                return drivers_payload
            if url_or_path == "/stints":
                return stints_payload
            if url_or_path == "/laps":
                return laps_payload
            if "/car_data" in url_or_path:
                return car_payload
            if "/location" in url_or_path:
                return loc_payload
            return []

        bahrain_ev = ScheduleEvent(round_number=1, country="Bahrain", location="Sakhir", event_name="Bahrain Grand Prix", session5_date="2024-03-02T15:00:00Z")
        with (
            patch.object(f, "_load_session", AsyncMock(return_value=None)),
            patch.object(f, "get_schedule", AsyncMock(return_value=[bahrain_ev])),
            patch.object(openf1_history, "_get_json", side_effect=fake_get_json),
        ):
            laps = await f.get_laps(2024, 1, "Race", driver="VER")
            pts = await f.get_telemetry(2024, 1, "Race", driver="VER", lap_number=19)
            cmap = await f.get_circuit_map(2024, 1, "Race")

        self.assertEqual(len(laps), 3)
        self.assertEqual(laps[0].compound, "SOFT")
        self.assertEqual(laps[1].pit_in, True)
        self.assertEqual(laps[2].compound, "HARD")
        self.assertEqual(laps[2].tyre_life, 3)
        self.assertEqual(laps[2].is_overall_best, True)
        self.assertEqual(len(pts), 2)
        self.assertGreater(pts[1].distance, 70.0)
        self.assertTrue(cmap["available"])
        self.assertEqual(cmap["source"], "OpenF1")
        self.assertEqual(cmap["reference_driver"], "VER")


class TestVisualTrackReplayEngine(unittest.IsolatedAsyncioTestCase):
    async def test_bin_positions_interpolates_short_gaps_and_omits_missing_retired_cars(self):
        from app.services.openf1_history import compute_track_bounds, _bin_positions_by_second

        bounds = compute_track_bounds([(0.0, 0.0), (1000.0, 1000.0)])
        rows_by_driver = {
            "1": [(0.0, 0.0, 0.0), (2.0, 200.0, 200.0), (10.0, 1000.0, 1000.0)],
            "24": [(0.0, 500.0, 500.0)],
        }
        frames = _bin_positions_by_second(rows_by_driver, bounds, 0, 10)
        self.assertEqual(len(frames), 11)
        # t=1 is halfway between (0,0) and (200,200) -> raw (100,100)
        self.assertEqual(frames[1]["t"], 1)
        self.assertIn("1", frames[1]["cars"])
        # Gap from t=2 to t=10 is 8s (> 2.5s), so t=5 must NOT invent an interpolated coordinate
        self.assertNotIn("1", frames[5]["cars"])
        # Retired car #24 at t=0 only must NOT appear past t=1
        self.assertIn("24", frames[0]["cars"])
        self.assertIn("24", frames[1]["cars"])
        self.assertNotIn("24", frames[3]["cars"])

    async def test_replay_metadata_pre_2023_unavailable(self):
        from app.services import openf1_history

        meta = await openf1_history.get_replay_metadata(2022, 1, "Race")
        self.assertFalse(meta["replay_available"])
        self.assertIn("2023", meta["reason"])

    async def test_replay_routes_and_metadata_positions_end_to_end(self):
        from fastapi.testclient import TestClient
        from app.main import app
        from app.models.schemas import ScheduleEvent
        from app.services import f1_service, openf1_history

        openf1_history._sessions_cache.clear()
        openf1_history._drivers_cache.clear()
        openf1_history._laps_raw_cache.clear()
        openf1_history._circuit_cache.clear()
        openf1_history._replay_meta_cache.clear()
        openf1_history._replay_chunk_cache.clear()

        sessions_payload = [{
            "session_key": 9991,
            "meeting_key": 1291,
            "session_name": "Race",
            "location": "Melbourne",
            "country_name": "Australia",
            "circuit_short_name": "Melbourne",
            "date_start": "2024-03-24T04:00:00+00:00",
            "date_end": "2024-03-24T05:30:00+00:00",
        }]
        drivers_payload = [
            {"driver_number": 55, "name_acronym": "SAI", "full_name": "Carlos Sainz", "team_name": "Ferrari", "team_colour": "E80020"},
            {"driver_number": 1, "name_acronym": "VER", "full_name": "Max Verstappen", "team_name": "Red Bull Racing", "team_colour": "3671C6"},
        ]
        laps_payload = [{
            "driver_number": 55,
            "lap_number": 1,
            "date_start": "2024-03-24T04:03:00+00:00",
            "lap_duration": 80.0,
            "duration_sector_1": 28.0,
            "duration_sector_2": 24.0,
        }]
        loc_payload = [
            {"driver_number": 55, "date": f"2024-03-24T04:03:{i:02d}.000+00:00", "x": float(i * 50), "y": float((i % 7) * 40)}
            for i in range(0, 60)
        ] + [
            {"driver_number": 1, "date": f"2024-03-24T04:03:{i:02d}.000+00:00", "x": float(i * 48), "y": float((i % 7) * 38)}
            for i in range(0, 60)
        ] + [
            {"driver_number": 55, "date": f"2024-03-24T04:04:{i:02d}.000+00:00", "x": float((60 - i) * 50), "y": float((i % 5) * 35)}
            for i in range(0, 21)
        ]
        pos_payload = [
            {"driver_number": 1, "position": 1, "date": "2024-03-24T04:03:00+00:00"},
            {"driver_number": 55, "position": 2, "date": "2024-03-24T04:03:00+00:00"},
            {"driver_number": 55, "position": 1, "date": "2024-03-24T04:04:00+00:00"},
        ]

        async def fake_get_json(url_or_path, params=None):
            if url_or_path == "/sessions":
                return sessions_payload
            if url_or_path == "/drivers":
                return drivers_payload
            if url_or_path == "/laps":
                return laps_payload
            if url_or_path == "/position":
                return pos_payload
            if "/location" in url_or_path:
                return loc_payload
            return []

        aus_ev = ScheduleEvent(round_number=3, country="Australia", location="Melbourne", event_name="Australian Grand Prix", session5_date="2024-03-24T04:00:00Z")
        with (
            patch.object(f1_service, "get_schedule", AsyncMock(return_value=[aus_ev])),
            patch.object(openf1_history, "_get_json", side_effect=fake_get_json),
        ):
            client = TestClient(app)
            meta_res = client.get("/api/replay/session-meta?year=2024&round=3&session=Race")
            self.assertEqual(meta_res.status_code, 200)
            meta_data = meta_res.json()["data"]
            self.assertTrue(meta_data["replay_available"])
            self.assertEqual(len(meta_data["drivers"]), 2)
            self.assertGreaterEqual(len(meta_data["circuit"]["sectors"]), 2)
            self.assertEqual(meta_data["race_start_offset"], 175)

            pos_res = client.get("/api/replay/positions?year=2024&round=3&session=Race&start_s=180&end_s=240")
            self.assertEqual(pos_res.status_code, 200)
            pos_data = pos_res.json()["data"]
            self.assertEqual(pos_data["start_s"], 180)
            self.assertEqual(len(pos_data["frames"]), 61)
            self.assertIn("55", pos_data["frames"][10]["cars"])
            self.assertIn("1", pos_data["frames"][10]["cars"])

            bad_res = client.get("/api/replay/positions?year=2024&round=3&session=Race&start_s=0&end_s=900")
            self.assertEqual(bad_res.status_code, 422)


if __name__ == "__main__":
    unittest.main()

