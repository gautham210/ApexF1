# ApexF1 forensic audit and remediation

2026-10-11. This is a substantial remediation pass, **not a claim of exhaustive whole-codebase certification**. Status definitions: PASS = executed and verified; FAIL = executed and failed; BLOCKED = identified external/environment obstacle; NOT VERIFIED = insufficient evidence.

## Repository baseline

The supplied workspace had no `.git`. An isolated clone at `.audit-upstream` recovered `https://github.com/gautham210/ApexF1`, base `a666f90f9d6ef5de81fbc85f57ca3374c833879d`. All 119 tracked files matched the supplied snapshot after newline normalization before edits. No pre-existing source changes were discarded. Delivery branch: `codex/apexf1-forensic-remediation`. The original working tree is retained, with edited files copied to the verified clone for Git delivery.

Actual stack: React 19, Vite 7, TanStack Router/Query, Zustand, Tailwind 4, FastAPI, FastF1/Jolpica/OpenF1, RSS. README incorrectly claimed Next.js. Both npm and Bun lockfiles existed; Bun described abandoned TanStack Start/Cloudflare dependencies. Supported npm lock is updated; legacy Bun lock is retained as historical configuration, not used for validated installation. Node 22.18.0 and Python 3.13.5 were available; Python installed libraries differ from declared pins. Docker now targets Python 3.11 to accommodate pinned scientific wheels. No CI workflows, database migrations, backend auth, push delivery, or existing tests were found in the supplied source.

Reviewed feature paths: all eight route implementations, frontend API/store/context/preferences/live hook, custom layout/visual components, backend routes/models/config/cache/services/WebSocket manager, startup, deployment and package configuration. Automated TypeScript/ESLint and pattern scanning covered frontend source. Shared UI primitives have static-analysis coverage, not complete manual/per-interaction verification. Full UI audit remains incomplete.

## Confirmed bugs and fixes

| Priority | Files | Previous behavior / root cause | Implemented correction | Evidence / limitation |
|---|---|---|---|---|
| P0 | `backend/app/api/routes.py` | Explicit archive timing/weather requests switched to any live session | Keep coordinates authoritative; live has dedicated endpoints | PASS mocked isolation test; real Round 1 classification returned 22 rows |
| P0 | `frontend/src/routes/index.tsx` | Missing weather became 21°C/3.4m/s/dry; unknown tracks inherited Spa stats | Removed fabricated weather, record/distance/geometry defaults; factual unavailable/programme state | PASS browser DOM before/after; final responsive layout NOT VERIFIED |
| P1 | `frontend/src/lib/store/index.ts` | Global first-match aliases overrode season, assigning VER #1 and NOR #4 in 2026; HAD/LIN placeholders 98/99 | Removed contradictory global map; season-specific lookup; corrected 2026 roster fields, #6/#41; unknown unsupported year returns unknown | PASS number regression tests; historical substitutions remain partial |
| P1 | `backend/app/services/metadata.py`, schemas, standings | No provider identity fields; short names conflated with presentation | Preserve driver/constructor ID; sourced 2026 display names and number overrides; separate short aggregation labels | PASS typecheck/tests; metadata source linked below |
| P1 | `f1_service.py` | Dropped timezone offsets before comparing calendar dates; off-week default selected last completed round | UTC columns/offset-aware conversion; same normalized schedule drives context; promote next GP | PASS UTC/off-week tests; four-hour completion estimate remains |
| P1 | `f1_service.py`, routes, `GlobalContextInit.tsx`, Replay/Home | `syncCanonicalData` was never called and referenced unimported client; archive store stayed empty and omitted season in keys | Removed dead broken sync; paginated Jolpica season classifications; Query bootstrap; `year-round-Race` keys | PASS pagination/cache/wrong-season tests, real results endpoint returned 16 rounds |
| P1 | `f1_service.py`, schemas | FastF1 row index replaced official finishing position; status/laps discarded, defaults claimed ON_TRACK/zero pits | Preserve provider rank, status, laps; unknown pits/status null; race results independent of telemetry | PASS DSQ/classification test |
| P1 | Race Center, Sessions, Replay | Archive link omitted year/session; delayed telemetry callback captured old selection; failed load kept old data | Validate URL selection; exact session links; invalidate/clear obsolete loads; no timed auto-fetch closure | PASS typecheck and identity unit test; full click-through NOT VERIFIED |
| P1 | `openf1_service.py` | Selected earliest interval, discarded gaps >10, formatted lapped strings as floats, used meeting key as round; nonexistent `/track_status` request | Latest interval, retain lapped strings, no interval cutoff, unknown round, documented race-control feed | PASS deterministic interval test; real authenticated live state BLOCKED (401) |
| P1 | `useLiveSession.ts` | Empty/null updates retained old leaderboard/weather; heartbeat leaked on unmount; quick snapshot stayed waking | Clear explicit empty data; release heartbeat; clear waking; disconnect stops live claim | PASS static/type checks; reconnect scenario NOT VERIFIED |
| P1 | API client | Failed classifications/telemetry returned `success:true,data:[]`; window accessed before SSR guard | Preserve rejection, guard window, typed response contracts | PASS typecheck; per-endpoint backend semantics still incomplete |
| P1 | standings/insights/engines | Engines/insights bypassed canonical standings; pre-2026 Sauber renamed Audi; pole count truncated by 50 qualifying rows | Reuse standings; retain historical identity; fetch position-1 qualifying records; limit unverified supplier years | PASS owner totals tests; season-wide transfers remain limitation |
| P1 | main/routes/RSS | Limiter constructed without middleware; exception text sent to client; WS origin unrestricted; RSS URL schemes unchecked | Enable SlowAPI middleware; generic client error; origin allowlist; HTTP(S) news links | PASS imports/HTTP tests/static checks; no penetration-test claim |
| P1 | dependency manifests | Direct backend and resolved frontend advisories | Updated dotenv/Arrow, removed unused multipart, compatible npm security updates | PASS scans with scope limits in VALIDATION; Python transitive resolution NOT VERIFIED |
| P2 | Calendar and `lib/calendar.ts` | Subscription pointed to nonexistent route; session-name keys didn't match schema | Actual UTC .ics snapshot, escaping/folding, correct session keys | PASS calendar unit test; calendar-app import NOT VERIFIED |
| P2 | Alerts/Profile/preferences | Fictional inbox, fake push claims, initial profile ignored persisted state | Honest empty inbox/local-only copy; no pointless permission request; lazy persisted read; switch semantics | PASS source/type checks; browser persistence workflow NOT VERIFIED |
| P2 | Race Center/Home | Hand-drawn/default geometry claimed actual circuit; missing metrics looked real | Geometry from recorded telemetry only in Race Center; remove invented Home geometry/statistics; label archived playback | PASS source review; Sessions decorative schematics still need provenance review |
| P2 | router config and route exports | All routes/charts bundled on initial load | Automatic route splitting; remove unnecessary component exports | PASS measured build; main bundle ~1058 → ~422 KB (see final build log) |
| P2 | styles/sidebar/controls | No global keyboard focus/reduced-motion fallback; mobile omitted routes | Focus ring, reduced-motion CSS, all mobile routes, named controls and keyboard row expansion | PASS static checks; mobile usability/contrast NOT VERIFIED |
| P2 | Docker/README | Python 3.13 incompatible with old scientific wheels; curl health check without curl; browser used service-hostname env | Python 3.11 base, stdlib health check, build-time public API URL, npm ci | NOT VERIFIED Docker image build; no Docker daemon exercised |

## Regression snapshot

`backend/tests/owner_snapshot.json` contains all 22 owner-confirmed driver points, explicitly test-only with unspecified historical date. Normalization preserves these values; constructor totals match all 11 owner totals; supplier totals match 414/186/111/2/1. No snapshot values were inserted into production. Real provider standings now return 23 drivers and 11 constructors; this is provider-season data, not silently coerced to the older fixture.

## Security findings

The direct-pin backend audit initially reported 18 advisory entries (including duplicate IDs) across dotenv, multipart and Arrow. Scan after remediation reports no known advisories for direct pins. Npm lock audit initially reported 13 vulnerable packages, including one critical; compatible updates yield zero. Neither result certifies absence of vulnerabilities. Backend transitive pins, deployed image, CORS environment and production access controls are NOT VERIFIED. Source regex scan found no private-key/GitHub-token/AWS-key patterns in app source; it is a limited secret scan, not a repository-history scan. Chart CSS injection helper uses code-owned config; no externally controlled input path was demonstrated. No confirmed authentication bypass exists because there is no private account API.

## Performance findings

Build comparison on this machine: main JS 1058.43 KB / 318.94 KB gzip before splitting, about 421.81 KB / 136.47 KB gzip after splitting and compatible security updates. Race Center's ~420 KB chunk is lazy. This is bundle measurement, not a claimed LCP/FPS improvement. One paginated results domain replaces all-race telemetry fan-out. Query keys deduplicate bootstrap/Home and refresh schedule every minute. Remaining risks: FastF1 worker timeout does not cancel work; caches are bounded but concurrent loads aren't single-flight; OpenF1 full-session history reads grow over time.

## UI/UX verification and blockers

Browser DOM confirmed removal of fake Home weather/statistics, navigation reached Standings, and a desktop screenshot was inspected at a requested 1440×900 override. Browser then disconnected; complete desktop/tablet/mobile matrix and a final screenshot are BLOCKED. Home unavailable text, Replay labels, Calendar export, local preference semantics, focus states and controls are implemented but not all end-to-end verified. Live OpenF1 returned 401 on the real latest-session request. No forecast service/push queue exists. No production deployment was attempted.

## Sources

- FIA Monaco entry list: https://www.fia.com/system/files/decision-document/2026_monaco_grand_prix_-_entry_list.pdf (2026 names, numbers, customer relationships; dated 5 June).
- F1 confirmed 2026 driver numbers: https://www.formula1.com/en/latest/article/all-the-2026-f1-driver-numbers-confirmed-in-full.5rh7o9mPntG7NerzVk9onc
- OpenF1 supported endpoints/access: https://openf1.org/docs/ and https://openf1.org/ (live authorization required; no track_status endpoint documented).

Exact commands/results and changed paths are in VALIDATION.md and CHANGED_FILES.md. Remaining work is in REMEDIATION_PLAN.md. No claim of complete forensic coverage, authenticated live recovery, production security verification or complete UX validation is made.


## Continued platform implementation

After the verified remediation commit, the working continuation adds the season-aware Jolpica service, official round standings, race/sprint/qualifying rows, event-point progression, season-specific constructor contributions, driver career snapshots, driver and constructor profiles, exact-session optional portraits, reusable image fallback, configurable RSS news, and server-side OpenF1 OAuth/health handling. See [platform architecture](PLATFORM_ARCHITECTURE.md) for identities, cache rules, provenance, scoring definitions and known limits.

Frontend checks in this continuation: TypeScript PASS, ESLint PASS with eight Fast Refresh warnings, four frontend tests PASS. Browser checks covered Standings unavailable state, News, and Driver profile at the default viewport. Build and current backend suite are NOT VERIFIED due sandbox restrictions. Real provider smoke tests are BLOCKED by the approval usage limit. The active work is on `codex/apexf1-forensic-remediation`; delivery SHA and push verification are reported separately.
