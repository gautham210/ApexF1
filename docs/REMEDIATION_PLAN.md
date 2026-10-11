# Remediation plan

## Implemented in this pass

1. P0 data integrity: preserve requested archive coordinates; remove fabricated Home weather, circuit defaults and notification inbox; retain classification status/rank/laps.
2. P1 identity/schedule: season-aware driver lookup; source 2026 constructor labels; normalize schedule UTC; promote next race between weekends; version cache keys and validate standings season.
3. P1 archive recovery: paginated classifications independent of FastF1 telemetry; year-scoped result keys; connect bootstrap/Replay; validated archive links; ignore obsolete telemetry loads.
4. P1 reliability/security: clear old live snapshots; release heartbeat interval; preserve failed HTTP errors; enable limiter middleware; mask server errors; constrain WebSocket origins and RSS links; remediate known direct backend and resolved frontend dependency advisories.
5. P2 product: real calendar download; season selector; accessible toggles/row expansion/playback; reduced-motion CSS; all routes available in mobile dock; honest archive/notification copy.
6. P2 performance: query deduplication for Home/bootstrap, nonblocking schedule fetch, canonical standings reuse, route splitting (main bundle reduced from 1058 KB to roughly 422 KB).
7. Regression tests, source/validation reports, dedicated Git branch, commit and push verification.
8. Continuation: canonical season/round API; official standings snapshots; race, sprint and qualifying classifications; event-point progression; transferred-driver constructor contributions; driver/constructor profiles; exact-session optional portrait lookup; normalized publisher RSS feed and Home/News integration; environment-driven OpenF1 OAuth health and stale-session guard.

## Outstanding — not represented as complete

- P1: Live OpenF1 authorization and real session/reconnect integration verification (external 401 blocker).
- P1: Replace schedule's four-hour completion estimate with actual provider session-state/cancellation data; verify the new UTC session identity matcher against real authenticated feeds.
- P1: Full runtime schemas and distinct unavailable/partial/stale states for every legacy API; source timestamps in all stores and screens.
- P1: Full historical roster/constructor rename lineage and power-unit relationships; authenticated real sector/lap/tyre age coverage.
- P2: Full browser route matrix at desktop/tablet/mobile and assistive technology; initial desktop route checks passed, but tablet/mobile viewport control was blocked. Measured rendering performance remains outstanding.
- P2: Current continuation frontend build and Python suite could not be rerun to completion: Vite sandbox `realpath` EPERM; Python async test process stalls in this sandbox. Previous branch build and 24 tests are not proof for these new changes.
- P2: Portraits remain opt-in pending rights review; RSS publisher real-feed smoke checks were blocked by the environment approval usage cap.
- P2: Backend session-load single-flight and cancellation/resource bounds; transitive backend dependency lock/audit in clean Python 3.11 environment.
- P2: Complete per-file manual audit of remaining shared UI primitives; no claim that this entire codebase is exhaustively reviewed.
- P3: Forecast notifications require a forecast provider and delivery infrastructure. Preferences currently do not send alerts.

No production deployment, database mutations, force push or PR creation is part of this delivery. Current working source snapshot remains preserved separately from the isolated Git checkout.
