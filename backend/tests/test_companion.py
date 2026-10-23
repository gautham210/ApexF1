import asyncio
import unittest
from unittest.mock import AsyncMock, patch
import pandas as pd
from app.services import history_service as h, f1_service as f, jolpica as j
from app.models.history import Race

class CompanionTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        f._data_cache.clear()

    async def test_official_progression_preserves_dropped_score_totals_and_partial_rounds(self):
        async def standings(year, round_number, kind):
            self.assertEqual((year,kind),(1988,'drivers'))
            if round_number == 2: raise j.ProviderError('timeout')
            return {'round':round_number or 3,'rows':[{'id':'a','points':87 if round_number == 1 else 80,'position':1}]}
        calendar=[type('RaceStub',(),{'round':r}) for r in [1,2,3,4]]
        with patch.object(h,'standings',AsyncMock(side_effect=standings)),patch.object(h,'races',AsyncMock(return_value=calendar)):
            data=await h.championship_progression(1988,'drivers')
        self.assertEqual(data['status'],'partial')
        self.assertEqual([r['round'] for r in data['rounds']],[1,2,3])
        self.assertEqual(data['rounds'][0]['points']['a'],87)
        self.assertIsNone(data['rounds'][1]['points'])
        self.assertEqual(data['rounds'][2]['points']['a'],80)

    async def test_schedule_completion_requires_classification_not_elapsed_clock(self):
        schedule=pd.DataFrame([{'RoundNumber':1,'Country':'Test','Location':'Test','EventName':'Test','EventDate':'2020-01-01','Session5':'Race','Session5DateUtc':'2020-01-01T12:00:00Z'}])
        with patch.object(f.fastf1,'get_event_schedule',return_value=schedule),patch.object(h,'races',AsyncMock(return_value=[])):
            events=await f.get_schedule(2020)
        self.assertFalse(events[0].is_completed)
        self.assertEqual(events[0].completion_status,'unverified')
        f._data_cache.clear()
        result=Race.model_validate({'season':2020,'round':1,'raceName':'Test','date':'2020-01-01','Circuit':{'circuitId':'test','circuitName':'Test','Location':{'locality':'Test','country':'Test'}},'Results':[{'Driver':{'driverId':'a','givenName':'A','familyName':'A'},'Constructor':{'constructorId':'b','name':'B'},'points':'25','position':'1','status':'Finished'}]})
        async def races(year,kind): return [result] if kind=='results' else []
        with patch.object(f.fastf1,'get_event_schedule',return_value=schedule),patch.object(h,'races',AsyncMock(side_effect=races)):
            events=await f.get_schedule(2020)
        self.assertTrue(events[0].is_completed)
        self.assertEqual(events[0].completion_status,'verified_classification')

    async def test_schedule_provider_failure_is_not_successful_empty_list(self):
        with patch.object(f.fastf1,'get_event_schedule',side_effect=RuntimeError('private provider detail')):
            with self.assertRaises(j.ProviderError) as raised: await f.get_schedule(2020)
        self.assertEqual(raised.exception.reason,'schedule_unavailable')

    async def test_live_channels_keep_missing_positions_and_sensor_values_unavailable(self):
        from app.services import openf1_service as o
        o._live_cache.clear()
        o._medium_cache.clear()
        values={"/intervals":[{"driver_number":1,"date":"2026-01-01T00:00:00Z","gap_to_leader":0}],"/drivers":[{"driver_number":1,"full_name":"Fixture"}],"/position":None,"/stints":[{"driver_number":1,"tyre_age_at_start":3}],"/pit":None,"/laps":[{"driver_number":1,"lap_number":4,"lap_duration":84.5,"duration_sector_1":25.1}]}
        with patch.object(o,'_get',AsyncMock(side_effect=lambda path,params:values.get(path))):
            rows=await o.get_live_timing(777)
        self.assertIsNone(rows[0]['position'])
        self.assertIsNone(rows[0]['drs'])
        self.assertIsNone(rows[0]['tyre_age'])
        self.assertIsNone(rows[0]['pits'])
        self.assertEqual(rows[0]['last_lap'],'1:24.500')
        self.assertEqual(rows[0]['lap_number'],4)
        self.assertEqual(rows[0]['sector1'],25.1)
        self.assertIsNone(rows[0]['sector2'])
        with patch.object(o,'get_live_timing',AsyncMock(return_value=rows)),patch.object(o,'get_live_weather',AsyncMock(return_value=None)),patch.object(o,'get_race_control_messages',AsyncMock(return_value=[])):
            snapshot=await o.get_live_snapshot(777)
        self.assertEqual(snapshot['status'],'partial')
        self.assertEqual(snapshot['errors']['positions'],'unavailable')
        self.assertEqual(snapshot['leaderboard'],rows)

    async def test_concurrent_schedule_requests_share_one_provider_load(self):
        schedule=pd.DataFrame([{'RoundNumber':1,'Country':'Test','Location':'Test','EventName':'Test','EventDate':'2020-01-01'}])
        with patch.object(f.fastf1,'get_event_schedule',return_value=schedule) as provider,patch.object(h,'races',AsyncMock(return_value=[])):
            first,second=await asyncio.gather(f.get_schedule(2020),f.get_schedule(2020))
        self.assertEqual(provider.call_count,1)
        self.assertEqual(first,second)
        await asyncio.sleep(0)
        self.assertFalse(f._schedule_pending)
