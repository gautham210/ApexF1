# Validation record

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
