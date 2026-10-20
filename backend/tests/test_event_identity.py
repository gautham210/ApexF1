"""Regression and reconciliation tests for canonical event identity (M-03).

Validates:
- Alias and diacritics normalization (harmless formatting differences).
- Provider reconciliation across FastF1 and Jolpica.
- Material conflict detection and provenance reporting.
- Deterministic fixture testing of all 2026 schedule/history rounds.
"""
import unittest
import json
import os
from app.services.event_identity import (
    normalize_country,
    normalize_locality,
    normalize_event_name,
    reconcile_event,
    CanonicalEventIdentity,
)


class EventIdentityTests(unittest.TestCase):
    def test_normalization_aliases_and_diacritics(self):
        # Country aliases
        self.assertEqual(normalize_country("USA"), "United States")
        self.assertEqual(normalize_country("usa"), "United States")
        self.assertEqual(normalize_country("UK"), "United Kingdom")
        self.assertEqual(normalize_country("UAE"), "United Arab Emirates")
        self.assertEqual(normalize_country("United States"), "United States")
        self.assertEqual(normalize_country("Bahrain"), "Bahrain")
        self.assertEqual(normalize_country("Malaysia"), "Malaysia")

        # Locality aliases and diacritics
        self.assertEqual(normalize_locality("Miami"), "Miami Gardens")
        self.assertEqual(normalize_locality("Miami Gardens"), "Miami Gardens")
        self.assertEqual(normalize_locality("Spa"), "Spa-Francorchamps")
        self.assertEqual(normalize_locality("Abu Dhabi"), "Yas Marina")
        self.assertEqual(normalize_locality("Montréal"), "Montreal")
        self.assertEqual(normalize_locality("Montreal"), "Montreal")

        # Event name aliases
        self.assertEqual(normalize_event_name("Brazilian Grand Prix"), "São Paulo Grand Prix")
        self.assertEqual(normalize_event_name("são paulo grand prix"), "São Paulo Grand Prix")
        self.assertEqual(normalize_event_name("Australian Grand Prix"), "Australian Grand Prix")

    def test_single_provider_fallback(self):
        # FastF1 only
        f1_only = reconcile_event(
            season=2026,
            round_number=1,
            fastf1_event={
                "event_name": "Australian Grand Prix",
                "country": "Australia",
                "location": "Melbourne",
                "event_date": "2026-03-08",
            },
            jolpica_event=None,
        )
        self.assertFalse(f1_only.has_conflict)
        self.assertIsNone(f1_only.conflict)
        self.assertEqual(f1_only.event_name, "Australian Grand Prix")
        self.assertEqual(f1_only.country, "Australia")
        self.assertEqual(f1_only.provenance.get("country"), "FastF1")

        # Jolpica only
        j_only = reconcile_event(
            season=2026,
            round_number=1,
            fastf1_event=None,
            jolpica_event={
                "raceName": "Australian Grand Prix",
                "date": "2026-03-08",
                "Circuit": {
                    "circuitId": "albert_park",
                    "circuitName": "Albert Park Circuit",
                    "Location": {"country": "Australia", "locality": "Melbourne"},
                },
            },
        )
        self.assertFalse(j_only.has_conflict)
        self.assertIsNone(j_only.conflict)
        self.assertEqual(j_only.event_name, "Australian Grand Prix")
        self.assertEqual(j_only.circuit_name, "Albert Park Circuit")
        self.assertEqual(j_only.circuit_id, "albert_park")
        self.assertEqual(j_only.provenance.get("circuit"), "Jolpica")

    def test_harmless_formatting_differences_reconcile_without_conflict(self):
        # Round 4 Miami: FastF1 country='United States' vs Jolpica country='USA'
        f1_r4 = {
            "round_number": 4,
            "country": "United States",
            "location": "Miami Gardens",
            "event_name": "Miami Grand Prix",
            "event_date": "2026-05-03",
        }
        j_r4 = {
            "round": 4,
            "raceName": "Miami Grand Prix",
            "date": "2026-05-03",
            "Circuit": {
                "circuitId": "miami",
                "circuitName": "Miami International Autodrome",
                "Location": {"country": "USA", "locality": "Miami"},
            },
        }

        reconciled = reconcile_event(2026, 4, f1_r4, j_r4)
        self.assertFalse(reconciled.has_conflict)
        self.assertIsNone(reconciled.conflict)
        self.assertEqual(reconciled.country, "United States")
        self.assertEqual(reconciled.location, "Miami Gardens")
        self.assertEqual(reconciled.event_name, "Miami Grand Prix")
        self.assertEqual(reconciled.circuit_name, "Miami International Autodrome")
        self.assertEqual(reconciled.circuit_id, "miami")

    def test_material_provider_disagreement_on_round_16_flags_conflict(self):
        f1_r16 = {
            "round_number": 16,
            "country": "Bahrain",
            "location": "Kuala Lumpur",
            "event_name": "Bahrain Grand Prix",
            "event_date": "2026-10-04",
        }
        j_r16 = {
            "round": 16,
            "raceName": "Bahrain Grand Prix in Malaysia",
            "date": "2026-10-04",
            "Circuit": {
                "circuitId": "sepang",
                "circuitName": "Sepang International Circuit",
                "Location": {"country": "Malaysia", "locality": "Kuala Lumpur"},
            },
        }

        reconciled = reconcile_event(2026, 16, f1_r16, j_r16)
        self.assertTrue(reconciled.has_conflict)
        self.assertIsNotNone(reconciled.conflict)
        self.assertIn("country", reconciled.conflict.conflicting_fields)
        self.assertIn("event_name", reconciled.conflict.conflicting_fields)

        # Country and event name visibly reflect the conflict rather than picking silently
        self.assertIn("Conflict: Bahrain", reconciled.country)
        self.assertIn("Malaysia", reconciled.country)
        self.assertIn("Provider Conflict", reconciled.event_name)

        # FastF1 and Jolpica breakdown preserved in conflict metadata
        self.assertEqual(reconciled.conflict.fastf1.get("country"), "Bahrain")
        self.assertEqual(reconciled.conflict.jolpica.get("country"), "Malaysia")
        self.assertEqual(reconciled.circuit_name, "Sepang International Circuit")

    def test_all_2026_rounds_reconciliation_fixture(self):
        fixture_path = os.path.join(os.path.dirname(__file__), "fixtures_2026_events.json")
        self.assertTrue(os.path.exists(fixture_path), "fixtures_2026_events.json missing")

        with open(fixture_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        f1_events = {e["round_number"]: e for e in data["fastf1_events"]}
        j_events = {e["round"]: e for e in data["jolpica_events"]}

        self.assertEqual(len(f1_events), 23)
        self.assertEqual(len(j_events), 23)

        conflicts = []
        clean_rounds = []

        for r in range(1, 24):
            f1_ev = f1_events[r]
            j_ev = j_events[r]
            res = reconcile_event(2026, r, f1_ev, j_ev)

            if res.has_conflict:
                conflicts.append((r, res))
            else:
                clean_rounds.append((r, res))

        # Only Round 16 has a verified material conflict between FastF1 and Jolpica
        self.assertEqual(len(conflicts), 1, f"Expected exactly 1 conflict (Round 16), got: {[c[0] for c in conflicts]}")
        conflict_round, conflict_res = conflicts[0]
        self.assertEqual(conflict_round, 16)
        self.assertIn("country", conflict_res.conflict.conflicting_fields)

        # All other 22 rounds must reconcile without conflict
        self.assertEqual(len(clean_rounds), 22)
        for r, res in clean_rounds:
            self.assertFalse(res.has_conflict, f"Round {r} unexpectedly had conflict: {res.conflict}")
            self.assertTrue(len(res.country) > 0)
            self.assertTrue(len(res.event_name) > 0)
            self.assertTrue(len(res.location) > 0)


if __name__ == "__main__":
    unittest.main()
