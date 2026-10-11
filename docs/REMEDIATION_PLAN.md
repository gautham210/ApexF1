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
9. P1 statistics integrity: calculate Qualifying P1 from classified qualifying position, report race grid-P1 starts separately, surface qualifying/fastest-lap coverage, validate duplicate/oversized pagination and verify career titles against each season's final scheduled round. Add regressions for sprint separation, constructor transfers, missing metrics and current-season title exclusion.
10. P1 canonical pipeline continuation: route Home insights, legacy standings and engine-point projections through shared provider-backed history services; expose per-domain partial/unavailable metadata and the official standings round; make the legacy race-results projection use canonical classifications; preserve explicit unmapped power-unit identity; propagate TanStack cancellation; merge valid split-event pagination pages while rejecting duplicate classifications. Validate against live public 2025 Round 1 data.

## Outstanding — not represented as complete

- P1: Live OpenF1 authorization and real session/reconnect integration verification (external 401 blocker).
- P1: Replace schedule's four-hour completion estimate with actual provider session-state/cancellation data; verify the new UTC session identity matcher against real authenticated feeds.
- P1: Full runtime schemas and distinct unavailable/partial/stale states for every legacy API; source timestamps in all stores and screens.
- P1: Full historical roster/constructor rename lineage and power-unit relationships; authenticated real sector/lap/tyre age coverage.
- P2: Full browser route matrix at desktop/tablet/mobile and assistive technology; initial desktop route checks passed, but tablet/mobile viewport control was blocked. Measured rendering performance remains outstanding.
- P2: Browser viewport review for this follow-up was blocked because the in-app browser could not connect to the locally running Vite server. No desktop/tablet/mobile pass is claimed.
- P2: This continuation's browser route review was not completed: the Computer Use browser inspection timed out before state capture. No Home, standings, driver, constructor or partial/unavailable UI state is visually verified in this pass.
- P2: Jolpica passed a single completed-season qualifying smoke; broader historical coverage, real RSS feeds and authenticated OpenF1 smoke remain unverified. Portraits remain opt-in pending rights review.
- P2: Sandboxed Windows Proactor loop creation stalls in socket-pair setup; the full Python suite passes when run outside the sandbox. The default sandboxed Vite build also hits Node `realpath` EPERM; the production build passes without source/config workarounds outside the sandbox.
- P2: Backend session-load single-flight and cancellation/resource bounds; transitive backend dependency lock/audit in clean Python 3.11 environment.
- P2: Complete per-file manual audit of remaining shared UI primitives; no claim that this entire codebase is exhaustively reviewed.
- P3: Forecast notifications require a forecast provider and delivery infrastructure. Preferences currently do not send alerts.

No production deployment, database mutations, force push or PR creation is part of this delivery. Current working source snapshot remains preserved separately from the isolated Git checkout.
