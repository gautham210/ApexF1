# Verification and Test Results
**Date:** 2026-10-21  
**Remediation Branch:** `codex/apexf1-overnight-remediation`  
**Execution Environment:** Windows (PowerShell / Python 3.13.7 / Node.js v22.18.0)  

---

## 1. Backend Automated Test Suite
**Command:** `python -X utf8 -m unittest discover -s tests`  
**Result:** **PASS — 50/50 Tests OK**  
**Execution Time:** 6.050s  

### Test Suites Covered:
1. `tests/test_integrity.py` (11 tests):
   - FastF1 session schedule resolution & UTC conversion
   - Schedule event schema serialization & validation
   - Next session selection & countdown boundaries
   - HTTP contract and status envelopes
   - Origin check enforcement on WebSockets
2. `tests/test_platform.py` (30 tests):
   - Jolpica bounded pagination and single-flight request gating
   - Career final snapshot per season calculation
   - Career verified final round title calculation
   - Career in-progress season exclusion
   - Career title unavailable when finality unverified
   - **NEW:** Career aggregated across seasons when season-less (`test_career_aggregated_across_seasons_when_season_less`)
   - **NEW:** Career season-scoped query (`test_career_season_scoped_query`)
   - **NEW:** Career HTTP validation & error status mapping (`test_http_validation_and_lifespan_cleanup`)
   - Media service URL sanitization
   - Rate limiting and retry backoff behavior
   - OpenF1 token renewal credential confidentiality
3. `tests/test_event_identity.py` (9 tests):
   - Canonical `(season, round_number)` reconciliation
   - 2026 Round 16 FastF1 Bahrain vs Jolpica Sepang conflict detection
   - Diacritic and alias normalization without data fabrication
   - FastF1 / Jolpica timetable preservation

---

## 2. Frontend Test Suite
**Command:** `npm test`  
**Result:** **PASS — 14/14 Tests OK**  
**Execution Time:** 1.450s  

### Test Cases Covered:
1. Season-aware driver numbers never prefer global aliases
2. Calendar emits UTC instants, escaped text and no invented end times
3. Live identity uses session date, never country or meeting ID
4. Provider portraits reject unsafe URLs and preserve missing-image fallback
5. Dashboard contract preserves official snapshot and partial-domain metadata
6. F-01 regression: dashboard schema accepts `error: null` from real API response
7. M-04 regression: Race Center preserves `mode=archive` and `mode=replay`
8. M-04 regression: Race Center rejects pre-2018 years with explicit error rather than silently defaulting
9. M-04 regression: Race Center deep links validate round and session explicitly
10. M-04 regression: Race Center search params round-trip through serialize and parse
11. M-03 regression: Truthful event labeling distinguishes verified, resolving, and provider conflict states
12. **NEW (M-05):** Timing tower responsive columns fit mobile viewports (`<= 340px`)
13. **NEW (M-06):** Mobile navigation reaches all 9 destinations without horizontal clipping (`dock width = 256px <= 320px`)
14. **NEW (M-08):** Unknown circuits do not silently render a Spa track outline

---

## 3. Frontend Typecheck
**Command:** `npm run typecheck`  
**Result:** **PASS — 0 Errors** (`tsc --noEmit` exited with code 0)  

---

## 4. Frontend Lint
**Command:** `npm run lint`  
**Result:** **PASS — 0 Errors, 8 Pre-existing React Refresh Warnings**  
`eslint .` exited with code 0.

---

## 5. Production Bundle Build
**Command:** `npm run build`  
**Result:** **PASS — Built in 33.69s**  
- 3004 modules transformed
- Client production bundle output to `dist/` with zero bundle errors
