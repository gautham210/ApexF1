# Career Endpoint Specification and Forensic Remediation (M-07 / F-04)
**Affected Findings:** F-04 (M-07)  
**Date:** 2026-10-21  
**Status:** **FIXED & VERIFIED**  

---

## 1. Problem Description & Root Cause Analysis

In the original forensic audit, calling `/api/history/drivers/{driver_id}/career` consistently failed with HTTP 503 (`invalid_or_unavailable`):
```json
{
  "detail": {
    "status": "unavailable",
    "reason": "invalid_or_unavailable"
  }
}
```

### Empirical Provider Investigation
1. Jolpica (the Ergast API successor maintained at `https://api.jolpi.ca/ergast/f1/`) follows strict URL schemas.
2. The Ergast/Jolpica contract requires a season segment for `driverStandings.json`:
   - `GET /ergast/f1/drivers/max_verstappen/driverStandings.json` $\to$ **HTTP 400 Bad Request**
   - `GET /ergast/f1/2024/drivers/max_verstappen/driverStandings.json` $\to$ **HTTP 200 OK**
3. `backend/app/services/history_service.py:303` called:
   `await jolpica.collect(f"drivers/{driver_id}/driverStandings", ...)`
   Because there was no season segment, Jolpica rejected the call with HTTP 400. `jolpica.py` wrapped this in `ProviderError("invalid_or_unavailable")`, which the route handler turned into HTTP 503.
4. Furthermore, the unit test suite in `test_platform.py` mocked `jolpica.collect` directly for the string `"drivers/fixture/driverStandings"`, masking the upstream contract mismatch in CI.

---

## 2. Supported Jolpica Contract & Architecture

To support both season-scoped and full career queries without unbounded upstream calls:
1. **Driver Seasons Endpoint:**
   `GET /ergast/f1/drivers/{driver_id}/seasons.json` $\to$ **HTTP 200 OK**
   Returns `SeasonTable.Seasons: [{"season": "2015"}, ..., {"season": "2026"}]`.
   If a driver has 0 seasons recorded (e.g. unknown driver ID), `total` is 0 and `Seasons` is empty.
2. **Season Standings Endpoint:**
   `GET /ergast/f1/{season}/drivers/{driver_id}/driverStandings.json` $\to$ **HTTP 200 OK**
   Returns `StandingsTable.StandingsLists: [{"season": "{season}", "round": "{final_round}", "DriverStandings": [...]}]`.

---

## 3. Remediation Implementation

### Backend Route (`backend/app/api/history.py`)
- Endpoint signature updated:
  ```python
  @router.get("/history/drivers/{driver_id}/career")
  async def career(driver_id: str, year: int | None = Query(None, ge=1950, le=datetime.now().year + 1)):
      import re
      if not re.fullmatch(r"[a-zA-Z0-9_-]{1,80}", driver_id):
          raise HTTPException(422, detail="Invalid driver identity")
      return await guarded(history_service.career(driver_id, year))
  ```
- Validates alphanumeric/hyphenated driver IDs (rejects malformed IDs with HTTP 422).
- Validates `year` query parameter if provided (`1950 <= year <= current_year + 1`).

### History Service (`backend/app/services/history_service.py`)
- `career(driver_id: str, year: int | None = None)`:
  - If `year` is explicitly provided: queries `{year}/drivers/{driver_id}/driverStandings`.
  - If `year` is omitted (season-less career overview):
    - Queries `drivers/{driver_id}/seasons` via Jolpica.
    - If empty, raises `ProviderError("round_not_found")` (mapped to HTTP 404).
    - Queries `{year}/drivers/{driver_id}/driverStandings` for each season in parallel using `asyncio.gather`.
    - Merges snapshots, extracts final-round standings, aggregates career wins and championship points, and verifies championship titles against confirmed final rounds.

---

## 4. Verification & Automated Test Coverage

1. **Season-less Aggregated Career:**
   `test_career_aggregated_across_seasons_when_season_less` simulates upstream Jolpica 400 on `drivers/fixture/driverStandings`, triggering automatic fallback to `drivers/fixture/seasons`, querying seasons 2023 and 2024, and aggregating 13 wins, 500 points, and 1 championship title.
2. **Season-Scoped Career:**
   `test_career_season_scoped_query` verifies direct single-season retrieval with correct title and points calculation.
3. **HTTP Route Contract Validation:**
   `test_http_validation_and_lifespan_cleanup` asserts:
   - Malformed ID `invalid!id` $\to$ HTTP 422
   - Out-of-bounds year `year=1949` $\to$ HTTP 422
   - Out-of-bounds year `year=2099` $\to$ HTTP 422
   - Unknown driver $\to$ HTTP 404
   - Upstream outage $\to$ HTTP 503
