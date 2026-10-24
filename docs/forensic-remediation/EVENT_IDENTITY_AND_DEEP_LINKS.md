# Event Identity Reconciliation and Deep Links (M-03 & M-04)
**Affected Findings:** F-02 (M-04), F-05 (M-03)  
**Date:** 2026-10-21  
**Status:** **INDEPENDENTLY VERIFIED & ENFORCED**  

---

## 1. Canonical Event Identity (M-03 / F-05)

### Problem Definition
FastF1 and Jolpica providers frequently present divergent event naming, country spelling, or even venue assignments. Most notably, FastF1 and Jolpica disagreed regarding the 2026 Round 16 calendar entry:
- FastF1 reported: `"Bahrain Grand Prix"`, Country: `"Bahrain"`, Location: `"Sakhir"`.
- Jolpica reported: `"Malaysian Grand Prix"`, Country: `"Malaysia"`, Location: `"Kuala Lumpur"`, Circuit: `"Sepang International Circuit"`.

Historically, systems either overwrote one provider's data arbitrarily or generated nonsensical hybrid strings (e.g. "Bahrain Grand Prix in Malaysia").

### Architecture & Canonical Key
1. **Canonical Key:** Every Formula 1 World Championship event is indexed uniquely by `(season: int, round_number: int)`.
2. **Reconciliation Modules:**
   - Backend: `backend/app/services/event_identity.py`
   - Frontend: `frontend/src/lib/event-identity.ts`
3. **Conflict Detection & Attribution:**
   - Normalizes known locality and country diacritics and aliases (e.g. "Monte Carlo" $\leftrightarrow$ "Monaco", "Montreal" $\leftrightarrow$ "Montréal").
   - Flags genuine material contradictions where country or circuit IDs conflict.
   - Sets `has_conflict: true` and attaches a structured `conflict` payload containing both raw provider responses and a human-readable description.
   - **Never Fabricates:** The system never creates hybrid venues. In the UI, a prominent `Event Identity Disagreement` banner is presented with full provider provenance.

---

## 2. Race Center Deep Links (M-04 / F-02)

### Problem Definition
1. **Mode Parameter Loss:** Race Center deep links dropped `mode=archive`, preserving only `replay`.
2. **Cross-Season Resolution:** When navigating to an archive link for a year different from the globally selected context season (e.g. visiting a 2024 Singapore GP link while global store was 2026), the event failed to resolve, falling back to a confusing "Live timing is offline" state.
3. **Silent Defaults:** Pre-2018 years and invalid rounds were silently dropped rather than rejected with explicit, honest feedback.

### Remediation & Verification
1. **Mode Preservation:** `mode` parameter cleanly accepts both `"archive"` and `"replay"`, correctly round-tripping through `parseRaceCenterSearch` and `formatRaceCenterSearch`.
2. **Cross-Season Schedule Fetching:** `race-center.tsx` includes an asynchronous schedule resolution effect that queries `/api/schedule?year={year}` whenever the URL's year diverges from the ambient session context.
3. **Explicit Boundary Validation:**
   - Years `< 2018` render an explicit `Unsupported Archive Season` banner explaining that digitized telemetry/timing starts with the 2018 season.
   - Non-existent rounds render a `Round Unavailable` card with a clear link to Round 1 of that season.
   - Loading states clearly indicate "Resolving Race Schedule" rather than flashing uninitialized live views.

---

## 3. Investigation of the 2026 Round 16 Discrepancy

- **Evidence Analysis:** The FastF1 and Jolpica 2026 preliminary schedule scrapers ingested draft FIA provisional calendars from different publication epochs. FastF1 retained a legacy provisional round in Bahrain, whereas Jolpica ingested a speculative return to Sepang, Malaysia.
- **System Handling:** The reconciler accurately detects this conflict, flags `has_conflict: true`, preserves the FastF1 date/session timetable, retains the Jolpica circuit metadata, and displays both source attributions in the banner without corrupting database integrity.
