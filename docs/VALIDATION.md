# Validation record

## 2026-10-23 — integrated companion delivery from 6ee6d53

Branch `codex/apexf1-overnight-remediation`; starting HEAD `6ee6d5387b5eed37a085113888fd19a70ae86033`. Windows, Python 3.13.5, Node 22.18.0, npm 10.9.3. The implementation continues across integrity, PWA, timezone/widgets, official timeline, simulator, museum, discovery and live improvements; earlier checkpoint deferral notes below are historical records.

| Check | Result and exact evidence |
|---|---|
| Backend | PASS: from backend, `python -X utf8 -m unittest discover -s tests -v`; 63 tests, 9.329 s, outside the previously diagnosed sandbox loop restriction. Includes five new companion tests, existing SSRF/origin/identity/partial-career regressions. Existing NumPy deprecation and asyncio slow-task warnings remain. |
| Frontend logic | PASS: from frontend, `npm test`; 29 tests, 1.454 s final recorded run. Tests cover IANA DST/date rollover, session/season identity, fractional historical event points, transfers, simulation immutability/ties/reset, exact calendar starts, stale live updates and safe model manifests/GLTF parsing. Synthetic geometry exists only inside tests. |
| TypeScript | PASS: `npm run typecheck` after the final PWA hook/schema corrections. Intermediate checks caught missing route search fields, nullable live-row types and a missing timestamp in the schedule schema; these were fixed rather than bypassed. |
| ESLint | PASS with warnings: `npm run lint`; zero errors, eight existing Fast Refresh export warnings. New hook-dependency warnings were fixed. |
| Production build | PASS: `npm run build` outside sandbox, 3,022 modules, 28.60 s. Main 492.85 kB / 153.78 gzip; Companion 31.26 / 10.31 gzip; Race Center 427.98 / 118.25 gzip. Three module 746.70 / 191.63 gzip is lazy and excluded from shell pre-cache; its >500 kB chunk warning remains disclosed. No chunk-warning threshold was increased. |
| PWA artifact checks | PASS: after the production build, `npm run test:pwa`; five tests, 0.830 s. Checks icon dimensions/metadata, offline navigation, API exclusions, activation consent/cache isolation, versioned shell asset references and static Origin/query variants. |
| Dependency audit | PASS: `npm audit --omit=dev` reports zero vulnerabilities. `npm install` initially exposed a high follow-redirects advisory; compatible `npm update follow-redirects` resolved it. That update's full dependency audit also reported zero. |
| Real history API | PASS, limited smoke: local `/api/history/season?year=2025&round=1` returned HTTP 200, success, requested identity, no domain errors, 40 classification rows (race + qualifying). Browser also used full 2025 official standings/results and round snapshots. No exhaustive era coverage claim. |
| Real RSS | PASS: configured feeds through `news_service.get_feed()` returned success, 100 normalized articles, no feed errors. This exercises pinned DNS, TLS and redirect retrieval; tests independently cover hostile destinations. |
| Live credentials | BLOCKED for authenticated live verification: local health HTTP 200, status `not_configured`, configured false, REST polling. Unavailable UI was browser-verified. Deterministic tests cover partial live channels, ordering/expiry and unknown fields. No real telemetry/live session is claimed. |
| CI | Static PASS: YAML parsed and contains backend/frontend jobs plus production PWA artifact tests after build. Remote GitHub Actions and clean Linux dependency installation NOT VERIFIED; no push. |
| Docker | BLOCKED: executable unavailable via Get-Command. Existing Nginx production config remains; container execution NOT VERIFIED. |

### Actual browser operations

ChatGPT in-app browser reached the local production preview with a same-origin local API proxy. This replaces the older browser-unavailable limitation for this run.

- Simulator: used real 2025 standings, selected Max Verstappen, applied +5 points, observed 421 → 426 and a hypothetical lead over 423, saved a named local scenario, selected it for comparison, reloaded, loaded it, undid and restored baseline. The QA scenario was deleted afterward. This is test evidence, not production fallback data.
- Official timeline: loaded provider round snapshots, scrubbed to round 24, checked the standings deep link, stepped back to 23 and started playback; real Qatar race/sprint classifications were visible. Full constructor-playback/era matrix is not claimed.
- Timezone hub: real Australian 2025 weekend table showed UTC/IST/local/London/Monaco conversions; searched Tokyo, selected/favorited Asia/Tokyo, copied schedule, and observed success feedback.
- Museum: compared M23 and MP4/4, followed detail/source/season links, filtered Ferrari, opened F2004 and confirmed missing-model and unknown-specification labels. Authentic model rendering is BLOCKED by no supplied model; no real WebGL car/device performance is claimed.
- Responsive: timezone layout measured no page overflow at 390×844, 768×1024 and 1440×1000. Museum measured no page overflow at 320×800. Driver Norris, McLaren constructor, live unavailable route and Home were also rendered at 390 px without page overflow. The mobile More menu listed Companion and Escape restored trigger focus. Viewport override was reset. This is representative coverage, not every route/device/assistive technology combination.
- Discovery: searching Norris produced the year-aware driver link. Home rendered the race widget and provider-dispute event label. Live Race Center showed `not configured` instead of fake rows.
- Updates/offline: explicit Update ready reload preserved the museum deep link. Two initial server-off reloads FAILED (blank interface). Investigation found mutable HTML/build pairing and static-request Origin variants; versioned shell and path/ignoreVary matching were added with regressions. Final real test stopped only the verified task-owned preview process, reloaded the same deep link, rendered History garage and the explicit offline/stale-data banner. Preview was restored afterward. API data is never cached. Physical Android/iOS installation, background delivery, OS widgets and notification permission/delivery are NOT VERIFIED.

No production deployment, remote push, PR or merge occurred. All 69 pre-existing CRLF-only entries are preserved and excluded from staging. Source changes and exact file inventory are recorded in the local commit and COMPANION.md; generated dist/test caches and local environment files are excluded.


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
