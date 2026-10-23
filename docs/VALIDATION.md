# Validation record

## 2026-10-23 — continuation from d8a03d8 (Phase A checkpoint)

Branch: codex/apexf1-overnight-remediation. Starting HEAD: d8a03d8996794da67c14b016444a59957bcd64f8. Python 3.13.5, Node 22.18.0, npm 10.9.3.

| Check | Actual outcome |
|---|---|
| Backend | PASS: `cd backend; python -X utf8 -m unittest discover -s tests -v`, 58 tests, 2.050s outside sandbox. Existing deprecation/slow-task diagnostics remain. Includes security, origin, identity and partial-career tests. |
| Frontend | PASS: `cd frontend; npm test`, 19 tests. Updated schedule boundaries assert unverified status rather than guessed live/completed states; new career contract test retains failed seasons and incomplete coverage. |
| Typecheck | PASS: `npm run typecheck` after correcting an intermediate duplicate export/schema declaration. |
| Lint | PASS: `npm run lint`, 0 errors, 8 existing warnings. Intermediate CRLF/format errors were corrected only in intended edited files with targeted Prettier. |
| Build | PASS: `npm run build` outside sandbox, 3,005 modules, 9.23s; main 488.19 kB / 152.20 gzip; Race Center 426.25 kB / 117.77 gzip. First build caught duplicate export syntax; corrected build passed. Subsequent edits were formatting/comments only. |
| Docker | BLOCKED: `docker --version` executable unavailable. Nginx routing, runtime config, container build and WebSocket proxy behavior NOT VERIFIED in container. |
| Browser/devices | NOT VERIFIED: no visual/device automation run in this integrity checkpoint. Unit tests do not establish rendered accessibility or responsive behavior. |
| Remote CI / deployment | NOT VERIFIED; no push or deployment performed. |
| PWA / offline / installation | NOT IMPLEMENTED in this checkpoint. No claim of installation, cached data freshness or native widgets. |

Source review corrected F-04 disclosure, F-08 schedule-only semantics, and F-21 static container configuration. See findings-ledger overrides for remaining partial/open findings. Phase A is not wholly closed; Phases B–G remain deferred. No broad audit/production-ready claim. All 69 original unstaged entries remain untouched and excluded from staging; no mirror synchronization, push, merge, PR or deployment.


## 2026-10-23 — Milestone 1 security increment

Starting HEAD: `ee9eb603dfc3e6f898d03005c6edf6e093cb15dd`; branch `codex/apexf1-overnight-remediation`. Python 3.13.5, Node 22.18.0. Scope: RSS outbound DNS/redirect security; no frontend behavior changes.

| Check | Outcome | Evidence |
|---|---|---|
| Backend | PASS | From backend: `python -X utf8 -m unittest discover -s tests -v`; 58 tests, 2.833s, including five new DNS/security tests and existing WebSocket origin tests. Run outside sandbox due previously established loop restriction. Existing NumPy deprecation and asyncio slow-task diagnostics remain. |
| Frontend | PASS | From frontend: `npm test`; 18 tests. |
| TypeScript | PASS | `npm run typecheck` |
| Lint | PASS with warnings | `npm run lint`; 0 errors, 8 existing Fast Refresh warnings. |
| Production build | PASS | `npm run build` outside sandbox; 3,005 modules, 15.64s; main 488.23 kB / 152.23 gzip; Race Center 426.25 kB / 117.77 gzip. |
| Public RSS connection | PASS, limited | BBC configured RSS URL resolved and connected to pinned IP with original Host/SNI and default certificate verification; HTTP 302. Full redirect chain/feed availability not verified. First attempted smoke command had a quoting SyntaxError; corrected stdin command exited 0. |
| Browser | NOT VERIFIED | No visual or device checks performed for this backend-only increment. |
| Docker | BLOCKED | `docker --version`: executable unavailable. |
| Remote CI | NOT VERIFIED | No push or remote run performed. |

New tests cover private, empty, mixed public/private and IPv4-mapped IPv6 DNS answers; public IPv4/IPv6 pinning; DNS failure/timeout; unsafe schemes/ports; and redirect DNS rejection before a second connection. MockTransport checks the actual outbound IP, Host header and SNI extension. Real TLS smoke verifies only one configured publisher connection.

This is a coherent security increment within Milestone 1, not completion of the full product assignment or all forensic findings. Milestones 2–7 (PWA, timezone hub/widgets, timeline, simulator, museum and live polish) remain deferred. Existing tests were retained. No remote push, merge, PR or deployment. The 69 pre-existing CRLF-only entries remain untouched and excluded from staging.


## 2026-10-11 canonical pipeline migration (based on `8886239f9d2fdddcf58d9932a1bd2ca2dab641c0`)

Windows, Python 3.13.5, Node 22.18.0, npm 10.9.3. Changes were validated in the Git checkout on `codex/apexf1-forensic-remediation`. The workspace-root source mirror and the pre-existing unstaged mirror/config/UI edits in the checkout were preserved.

| Check | Result | Evidence / limits |
|---|---|---|
| Backend full suite | PASS, 43 tests | `cd backend; python -X utf8 -m unittest discover -s tests -v`; all 43 passed after the final changes. Python 3.13 async loop startup still stalls in the sandbox before test setup; the same command completed outside the sandbox. |
| Frontend tests | PASS, 5 tests | `cd frontend; npm test`; all five Node tests passed, including the dashboard Zod contract with partial provider metadata. |
| TypeScript | PASS | `cd frontend; npm run typecheck` (`tsc --noEmit`). |
| ESLint | PASS, 0 errors, 8 warnings | `cd frontend; npm run lint`. The warnings are existing Fast Refresh export warnings in `CircuitOutline`, `SeasonData` and shared UI components. |
| Vite production build | PASS | `cd frontend; npm run build`, outside the sandbox because sandboxed Node `realpathSync.native('index.html')` returns `EPERM`. Vite 7.3.7 transformed 3,003 modules in 22.94 s. Main entry: 481.82 kB / 150.22 kB gzip; Race Center: 421.28 kB / 116.72 kB gzip. |
| Jolpica public-provider smoke | PASS, 2025 Round 1 and latest standings | Read-only `history_service.season(2025, 1)` returned status `success`, official standings round 1, 20 race rows, complete qualifying coverage, no domain errors and race winner `norris`. `f1_service.get_standings(2025)` returned status `success`, round 24, 21 drivers, 10 constructors and Lando Norris as leader. The first smoke exposed a valid page split (one result row then 19 rows under the same event envelope); the shared transport now merges matching event envelopes and still rejects duplicate/conflicting classifications. |
| Browser route / viewport review | BLOCKED | The `@oai/sky` browser inspection call returned `Computer Use app approval timed out`. No Home, standings, driver, constructor or unavailable-state route, and no desktop/tablet/mobile viewport, is claimed as visually verified. |
| OpenF1 and RSS real-provider smoke | NOT VERIFIED | Existing deterministic tests cover stale/unauthenticated OpenF1 and RSS URL/XML protections. This pass did not verify authenticated OpenF1 or live RSS availability. |
| Sandboxed Python/Vite execution | BLOCKED | Python 3.13’s Windows Proactor socket-pair startup and Node `realpathSync.native` restrictions prevented in-sandbox execution. Tests and build were successfully run outside the sandbox; no application workaround was added. |

Regression coverage added for single-event classifications split across pages, duplicate classifications, canonical dashboard insight provenance, partial qualifying coverage, unavailable dashboard domains, legacy standings partial status, legacy result projections using the canonical provider adapter, and unknown power-unit mappings. Existing qualifying, official-points, transfers, standings-round, career-title and sprint-separation tests remain in the suite.

This is not a full production-readiness certification. Visual route/viewport testing, authenticated OpenF1 smoke, RSS smoke and broader season/event provider coverage remain outstanding.

2026-10-11 follow-up to commit `1709ecdb4e49e2c9a79eca6f869e758a8b66e9f0`, branch `codex/apexf1-forensic-remediation`. Windows; Python 3.13.5, Node 22.18.0, npm 10.9.3. The isolated clone is the Git checkout; the supplied workspace root has no `.git` directory. Existing unstaged mirror/config/UI changes in the clone were preserved and excluded from this commit.

| Check | Result | Evidence / limits |
|---|---|---|
| Backend full suite | PASS, 37 tests, twice | From `backend`: `python -X utf8 -m unittest discover -s tests -v`; both final full-suite runs passed all 37 tests. |
| Async test hang diagnosis | PASS, environmental root cause isolated | The first reported case was `test_career_uses_final_snapshot_per_season`; faulthandler showed `IsolatedAsyncioTestCase` blocked before `setUp` or the test body in Python 3.13 `ProactorEventLoop._make_self_pipe` → `socket._fallback_socketpair` → `socket.accept`. The same full suite passed outside the sandbox. Tests reset loop-bound module locks per isolated loop, assert no pending Jolpica tasks survive, use HTTP responses with `request` metadata, and exercise FastAPI lifespan start/stop under `TestClient`. No application workaround was needed. |
| Backend async/test warnings | PASS with warning | Python emitted slow-task diagnostics for a few synchronous `TestClient`/mock operations; no test failures or leaked Jolpica tasks. One existing NumPy `Timedelta` deprecation warning remains in `test_integrity.py`. |
| Frontend tests | PASS, 4 tests | `npm test`; four Node tests passed. |
| TypeScript | PASS | `npm run typecheck` (`tsc --noEmit`). |
| ESLint | PASS, 0 errors, 8 warnings | `npm run lint`; the eight existing Fast Refresh export warnings remain in shared component files. The new route edits add no lint errors. |
| Vite build in sandbox | BLOCKED | `npm run build` fails before module transformation because Node's own `fs.realpathSync.native('index.html')` returns Windows `EPERM` in the sandbox. `Get-Item` and `Resolve-Path` resolve the file, separating this from a missing/stale path. |
| Vite production build | PASS outside sandbox | `npm run build` completed after running outside the filesystem restriction: 3,003 modules transformed, 15.98 s. Main entry chunk: 479.85 kB / 149.94 kB gzip; lazy Race Center chunk: 421.28 kB / 116.73 kB gzip. No Vite config or application workaround was added. |
| Browser route/responsive review | BLOCKED | Vite server started at `127.0.0.1:3001`, but the in-app browser could not connect (`ERR_CONNECTION_TIMED_OUT`). No desktop/tablet/mobile dimensions or UI pass are claimed in this follow-up. |
| Jolpica qualifying provider smoke | PASS, one completed season endpoint | `history_service.races(2025, "qualifying")` read public provider data through the existing adapter: Australian GP, 20 qualifying rows, classified P1 identity `norris` / `mclaren`. This verifies the response shape and one event only, not full historical coverage or every statistic. |
| RSS/OpenF1 provider smoke | NOT VERIFIED | This validation used deterministic mocks for these providers. OpenF1 still requires deployment credentials; portrait lookup remains disabled pending rights review. |
| Dependency/security scans | NOT RUN in this follow-up | See the earlier forensic audit for the limited direct-pin and resolved npm audit results; they are not renewed by this pass. |

The qualifying regressions cover grid P1 without qualifying P1, classified qualifying P1, event-specific constructor attribution across a transfer, sprint isolation, missing qualifying/fastest-lap coverage, and unchanged wins/podiums/points/transfer totals. Pagination tests cover duplicate events/rows, unchanged totals, exact offsets, and offsets exceeding provider totals. Career tests verify final-round titles, in-progress exclusion and unavailable finality.

This is not a full production-readiness certification. Viewport review and RSS/authenticated OpenF1 smoke tests remain outstanding. See [architecture limits](PLATFORM_ARCHITECTURE.md), [remaining work](REMEDIATION_PLAN.md) and [audit](FORENSIC_AUDIT.md).
