# Remediation plan

## Implemented in this pass

1. P0 data integrity: preserve requested archive coordinates; remove fabricated Home weather, circuit defaults and notification inbox; retain classification status/rank/laps.
2. P1 identity/schedule: season-aware driver lookup; source 2026 constructor labels; normalize schedule UTC; promote next race between weekends; version cache keys and validate standings season.
3. P1 archive recovery: paginated classifications independent of FastF1 telemetry; year-scoped result keys; connect bootstrap/Replay; validated archive links; ignore obsolete telemetry loads.
4. P1 reliability/security: clear old live snapshots; release heartbeat interval; preserve failed HTTP errors; enable limiter middleware; mask server errors; constrain WebSocket origins and RSS links; remediate known direct backend and resolved frontend dependency advisories.
5. P2 product: real calendar download; season selector; accessible toggles/row expansion/playback; reduced-motion CSS; all routes available in mobile dock; honest archive/notification copy.
6. P2 performance: query deduplication for Home/bootstrap, nonblocking schedule fetch, canonical standings reuse, route splitting (main bundle reduced from 1058 KB to roughly 422 KB).
7. Regression tests, source/validation reports, dedicated Git branch, commit and push verification.

## Outstanding — not represented as complete

- P1: Live OpenF1 authorization and real session/reconnect integration verification (external 401 blocker).
- P1: Replace schedule's four-hour completion estimate with actual provider session-state/cancellation data; verify the new UTC session identity matcher against real authenticated feeds.
- P1: Full runtime schemas and distinct unavailable/partial/stale states for every legacy API; source timestamps in all stores and screens.
- P1: Full historical roster metadata and team-transfer contribution accounting; authenticated real sector/lap/tyre age coverage.
- P2: Browser route matrix at desktop/tablet/mobile, screen-reader/contrast and measured rendering performance; browser disconnected during this pass.
- P2: Backend session-load single-flight and cancellation/resource bounds; transitive backend dependency lock/audit in clean Python 3.11 environment.
- P2: Complete per-file manual audit of remaining shared UI primitives; no claim that this entire codebase is exhaustively reviewed.
- P3: Forecast notifications require a forecast provider and delivery infrastructure. Preferences currently do not send alerts.

No production deployment, database mutations, force push or PR creation is part of this delivery. Current working source snapshot remains preserved separately from the isolated Git checkout.
