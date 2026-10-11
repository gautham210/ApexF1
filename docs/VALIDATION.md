# Validation record

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
