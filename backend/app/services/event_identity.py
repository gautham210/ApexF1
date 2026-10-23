"""Canonical event identity and provider reconciliation.

Keys events by (season, round). Reconciles display fields across FastF1 and
Jolpica providers. Distinguishes harmless formatting differences and geographical
aliases from material provider conflicts. Never hardcodes or fabricates data.
"""
from typing import Optional, Dict, Any, List, Set
import unicodedata
import re
from pydantic import BaseModel, Field


# ── Known aliases and formatting normalization ─────────────────────────────

COUNTRY_ALIASES: Dict[str, str] = {
    "usa": "United States",
    "united states": "United States",
    "united states of america": "United States",
    "uk": "United Kingdom",
    "united kingdom": "United Kingdom",
    "great britain": "United Kingdom",
    "uae": "United Arab Emirates",
    "united arab emirates": "United Arab Emirates",
}

LOCALITY_ALIASES: Dict[str, str] = {
    "miami": "Miami Gardens",
    "miami gardens": "Miami Gardens",
    "spa": "Spa-Francorchamps",
    "spa-francorchamps": "Spa-Francorchamps",
    "abu dhabi": "Yas Marina",
    "yas marina": "Yas Marina",
}

# Historical name aliases that refer to the exact same Grand Prix at the same circuit
EVENT_NAME_ALIASES: Dict[str, str] = {
    "brazilian grand prix": "São Paulo Grand Prix",
    "são paulo grand prix": "São Paulo Grand Prix",
    "sao paulo grand prix": "São Paulo Grand Prix",
}


def strip_accents(text: str) -> str:
    """Normalize unicode text and remove combining diacritical marks."""
    if not text:
        return ""
    normalized = unicodedata.normalize("NFKD", text)
    return "".join(c for c in normalized if not unicodedata.combining(c))


def normalize_country(country: Optional[str]) -> str:
    """Normalize country string accounting for aliases and casing."""
    if not country:
        return ""
    cleaned = strip_accents(country.strip().lower())
    return COUNTRY_ALIASES.get(cleaned, country.strip())


def normalize_locality(locality: Optional[str]) -> str:
    """Normalize locality string accounting for aliases, casing, and accents."""
    if not locality:
        return ""
    cleaned = strip_accents(locality.strip().lower())
    alias = LOCALITY_ALIASES.get(cleaned)
    if alias:
        return alias
    return strip_accents(locality.strip())


def normalize_event_name(name: Optional[str]) -> str:
    """Normalize Grand Prix name accounting for known historical rebrandings."""
    if not name:
        return ""
    cleaned = strip_accents(name.strip().lower())
    alias = EVENT_NAME_ALIASES.get(cleaned)
    if alias:
        return alias
    return strip_accents(name.strip())


# ── Conflict and Reconciled Models ─────────────────────────────────────────

class EventConflict(BaseModel):
    has_conflict: bool = True
    conflicting_fields: List[str] = Field(default_factory=list)
    fastf1: Dict[str, Any] = Field(default_factory=dict)
    jolpica: Dict[str, Any] = Field(default_factory=dict)
    description: str


class CanonicalEventIdentity(BaseModel):
    season: int
    round_number: int
    event_name: str
    country: str
    location: str
    circuit_name: Optional[str] = None
    circuit_id: Optional[str] = None
    event_date: Optional[str] = None
    has_conflict: bool = False
    conflict: Optional[EventConflict] = None
    provenance: Dict[str, str] = Field(default_factory=dict)


def reconcile_event(
    season: int,
    round_number: int,
    fastf1_event: Optional[Dict[str, Any]] = None,
    jolpica_event: Optional[Dict[str, Any]] = None,
) -> CanonicalEventIdentity:
    """
    Reconcile event identity from FastF1 and Jolpica providers.

    1. If only one provider is available, attributes fields honestly to that provider.
    2. If both are available:
       - Normalizes harmless differences (e.g. 'United States' vs 'USA', 'Miami Gardens' vs 'Miami').
       - Detects material conflicts (e.g. 2026 Round 16 where FastF1 reports Bahrain / Bahrain GP
         and Jolpica reports Malaysia / Sepang).
       - Never combines contradictory fields into a fabricated event.
       - Exposes explicit conflict with provenance.
    """
    if not fastf1_event and not jolpica_event:
        return CanonicalEventIdentity(
            season=season,
            round_number=round_number,
            event_name=f"Round {round_number}",
            country="Unknown",
            location="Unknown",
            has_conflict=False,
            conflict=None,
            provenance={"identity": "none"},
        )

    # 1. FastF1 only
    if fastf1_event and not jolpica_event:
        return CanonicalEventIdentity(
            season=season,
            round_number=round_number,
            event_name=fastf1_event.get("event_name", f"Round {round_number}"),
            country=fastf1_event.get("country", "Unknown"),
            location=fastf1_event.get("location", "Unknown"),
            event_date=fastf1_event.get("event_date"),
            has_conflict=False,
            conflict=None,
            provenance={
                "event_name": "FastF1",
                "country": "FastF1",
                "location": "FastF1",
                "schedule": "FastF1",
            },
        )

    # 2. Jolpica only
    if jolpica_event and not fastf1_event:
        circuit = jolpica_event.get("Circuit", {})
        location_obj = circuit.get("Location", {})
        return CanonicalEventIdentity(
            season=season,
            round_number=round_number,
            event_name=jolpica_event.get("raceName", f"Round {round_number}"),
            country=location_obj.get("country", "Unknown"),
            location=location_obj.get("locality", "Unknown"),
            circuit_name=circuit.get("circuitName"),
            circuit_id=circuit.get("circuitId"),
            event_date=jolpica_event.get("date"),
            has_conflict=False,
            conflict=None,
            provenance={
                "event_name": "Jolpica",
                "country": "Jolpica",
                "location": "Jolpica",
                "circuit": "Jolpica",
            },
        )

    # 3. Both providers present -> Reconcile
    assert fastf1_event is not None
    assert jolpica_event is not None

    f1_country = fastf1_event.get("country", "").strip()
    f1_loc = fastf1_event.get("location", "").strip()
    f1_name = fastf1_event.get("event_name", "").strip()
    f1_date = fastf1_event.get("event_date")

    j_circuit = jolpica_event.get("Circuit", {})
    j_loc_obj = j_circuit.get("Location", {})
    j_country = j_loc_obj.get("country", "").strip()
    j_loc = j_loc_obj.get("locality", "").strip()
    j_name = jolpica_event.get("raceName", "").strip()
    j_circuit_name = j_circuit.get("circuitName")
    j_circuit_id = j_circuit.get("circuitId")
    j_date = jolpica_event.get("date")

    norm_f1_country = normalize_country(f1_country)
    norm_j_country = normalize_country(j_country)

    norm_f1_loc = normalize_locality(f1_loc)
    norm_j_loc = normalize_locality(j_loc)

    norm_f1_name = normalize_event_name(f1_name)
    norm_j_name = normalize_event_name(j_name)

    conflicting_fields: List[str] = []

    # Check country agreement
    if norm_f1_country.casefold() != norm_j_country.casefold():
        conflicting_fields.append("country")

    # Check locality agreement
    if norm_f1_loc.casefold() != norm_j_loc.casefold():
        conflicting_fields.append("location")

    # Check event name agreement
    if norm_f1_name.casefold() != norm_j_name.casefold():
        # Only flag if country also disagrees or if the names represent fundamentally different entities
        # e.g., 'Bahrain Grand Prix' vs 'Bahrain Grand Prix in Malaysia'
        conflicting_fields.append("event_name")

    if conflicting_fields:
        # Material conflict exists between providers
        conflict_desc = (
            f"Provider conflict for Round {round_number}: FastF1 reports "
            f"'{f1_name}' ({f1_country}, {f1_loc}), while Jolpica reports "
            f"'{j_name}' ({j_country}, {j_loc}, circuit '{j_circuit_name}')."
        )
        conflict = EventConflict(
            has_conflict=True,
            conflicting_fields=conflicting_fields,
            fastf1={
                "event_name": f1_name,
                "country": f1_country,
                "location": f1_loc,
                "date": str(f1_date) if f1_date else None,
            },
            jolpica={
                "event_name": j_name,
                "country": j_country,
                "location": j_loc,
                "circuit_name": j_circuit_name,
                "circuit_id": j_circuit_id,
                "date": j_date,
            },
            description=conflict_desc,
        )

        return CanonicalEventIdentity(
            season=season,
            round_number=round_number,
            # Explicitly mark conflict state in display name and country so UI does not fabricate
            event_name=f"{f1_name} [Provider Conflict]",
            country=f"Conflict: {f1_country} (FastF1) vs {j_country} (Jolpica)",
            location=f"Disputed ({f1_loc} vs {j_loc})" if (f1_loc and j_loc and f1_loc.casefold() != j_loc.casefold()) else (f1_loc or j_loc),
            circuit_name=None,
            circuit_id=None,
            event_date=str(f1_date) if f1_date else j_date,
            has_conflict=True,
            conflict=conflict,
            provenance={
                "status": "conflict",
                "fastf1_source": "FastF1",
                "jolpica_source": "Jolpica",
            },
        )

    # Clean agreement / formatting variations reconciled
    canonical_country = norm_f1_country or norm_j_country
    canonical_location = norm_f1_loc or norm_j_loc
    canonical_name = norm_f1_name or norm_j_name

    return CanonicalEventIdentity(
        season=season,
        round_number=round_number,
        event_name=canonical_name,
        country=canonical_country,
        location=canonical_location,
        circuit_name=j_circuit_name,
        circuit_id=j_circuit_id,
        event_date=str(f1_date) if f1_date else j_date,
        has_conflict=False,
        conflict=None,
        provenance={
            "event_name": "Reconciled (FastF1 / Jolpica)",
            "country": "Reconciled (FastF1 / Jolpica)",
            "location": "Reconciled (FastF1 / Jolpica)",
            "circuit": "Jolpica",
            "sessions": "FastF1",
        },
    )


def reconcile_jolpica_schedule_entry(
    year: int,
    race_dict: Dict[str, Any],
    fastf1_dict: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Reconcile a single Jolpica race dict against FastF1 data if available."""
    round_num = race_dict.get("round", 0)
    if not fastf1_dict:
        try:
            from app.services import f1_service
            cached = f1_service._data_cache.get(f"schedule_v3_{year}")
            if cached:
                for ev in cached:
                    if ev.round_number == round_num:
                        if ev.has_conflict and ev.conflict:
                            race_dict["has_conflict"] = True
                            race_dict["conflict"] = ev.conflict
                            race_dict["raceName"] = f"{race_dict.get('raceName', '')} [Provider Conflict]"
                            return race_dict
                        fastf1_dict = {
                            "round_number": ev.round_number,
                            "country": ev.country,
                            "location": ev.location,
                            "event_name": ev.event_name,
                            "event_date": ev.event_date,
                        }
                        break
        except Exception:
            pass

    if fastf1_dict:
        reconciled = reconcile_event(year, round_num, fastf1_dict, race_dict)
        race_dict["has_conflict"] = reconciled.has_conflict
        race_dict["conflict"] = reconciled.conflict.model_dump() if reconciled.conflict else None
        if reconciled.has_conflict:
            race_dict["raceName"] = f"{race_dict.get('raceName', '')} [Provider Conflict]"
    else:
        race_dict["has_conflict"] = False
        race_dict["conflict"] = None
    return race_dict
