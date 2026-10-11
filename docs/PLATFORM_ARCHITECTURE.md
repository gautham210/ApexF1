# Season-aware platform data architecture

## Domain boundary

`backend/app/models/history.py` validates Jolpica identities and classification rows. `services/jolpica.py` is the shared transport: 100-row pages, 300 ms minimum spacing, bounded concurrency, 15-minute process cache, bounded page count, in-process single-flight and explicit `ProviderError` outcomes. Nested classifications can split one event across pages; the transport merges only matching season/round/event/date/circuit envelopes with identical metadata. It rejects duplicate driver/constructor identities and conflicting envelopes. Cache keys include the complete path, table, collection and nested field.

`services/history_service.py` combines calendar, race, sprint, qualifying and standings data. Official championship points/positions are passed through from the provider's selected-round snapshot; historical points, deductions and scoring rules are not re-created. Event-point progression is a sum of race and sprint classification points, not official historical championship progression. Grand Prix wins/podiums use classified race position, excluding disqualifications, non-classified rows and DNS. Sprint classifications remain separate.

Dashboard insights and legacy standings consumers now project from this canonical service. `/api/dashboard-context` and `/api/insights` derive official driver/team leaders, recent winner, grid-to-finish places gained and Qualifying P1 counts from one shared season payload. Legacy `/api/standings` and `/api/constructors` use the canonical official standings snapshots; `/api/engine-standings` derives points from those constructor rows. The dashboard preserves its existing `StandingsEntry` arrays and news fields, adds history/news status metadata, and validates the response through a frontend Zod schema. Insight objects include per-metric `status`; dashboard context includes history status/errors, provider source, fetch timestamp and official snapshot round. A partial domain remains visible while unrelated valid domains are retained. Home shows “Official standings through round N” and marks partial/unavailable history instead of inferring completed races from schedule dates.

The legacy `/api/results` response is a compatibility projection over canonical race classifications. Its existing integer-rank timing-store schema cannot express unranked rows, so that projection omits them; `/api/history/season` retains the full positions and statuses. Unknown power-unit mappings use the explicit `Unmapped supplier` bucket rather than a guessed manufacturer.

Qualifying P1 is counted only from `QualifyingResults` where the official classified `position` is 1. It is not represented as an all-era official pole tally because qualifying formats, sprint formats and grid penalties vary. Race `grid == 1` is separately counted as a race start from grid P1, excluding DNS and non-starters; raw grid position remains on each result. Neither metric includes sprint starting positions. Driver and constructor qualifying P1 is attributed to the identity recorded on that event's qualifying classification, which preserves transfers. The response reports qualifying coverage as complete, partial or unavailable; when unavailable, driver and constructor counts are `null`, never zero. Fastest-lap counts require a recorded `FastestLap.rank`, are nullable where no rank is supplied, and include season-level coverage metadata.

Paginated rows are checked for provider offset/total consistency, duplicate event rounds and duplicate driver classifications. Official standings identities are checked for duplicate IDs and the requested season/round. A failed domain remains distinct in `errors`; complete failure returns 503. Constructor totals derive from recorded event entries and are never synthesized across historical renames or mergers.

The `/api/history/season?year=&round=` response includes the provider standings round, requested coordinates, successful/partial status, per-domain errors, source and fetch time. For the latest snapshot, driver and constructor standings must identify the same provider round; a mismatch is surfaced as partial and the conflicting constructor snapshot is withheld. If all domains fail the endpoint returns 503; a missing round returns 404. `?round=N` returns official championship totals after that round. The omitted round returns the provider's latest snapshot, including a current in-progress season when Jolpica has published one.

## Frontend ownership

TanStack Query owns season, round, career, portrait, news and supplier requests. Keys include all identity coordinates. Zod validates payloads at the browser boundary, followed by year/round/driver identity checks. Season, career, portrait, supplier, schedule, result and dashboard requests receive TanStack's abort signal. The backend single-flight task is shielded so one disconnected client does not cancel a fetch shared by other requests. Zustand carries the selected season between existing routes; URL search state remains authoritative on season pages. Query data is not copied into canonical standings arrays. Retries are limited, error and partial states remain visible, and selectors preserve browser history.

## Refresh and provenance

| Data | Provider / route | Cache and refresh | Coverage |
|---|---|---|---|
| Historical seasons, race/sprint/qualifying results, standings, schedule | Jolpica via `/api/history/season`; legacy standings/results reuse the history service and transport | 900 seconds in process; 900 seconds TanStack stale time; dashboard query 60 seconds | Jolpica/Ergast supported F1 dataset; provider-specific gaps remain visible |
| Driver championship career snapshots | Jolpica `/drivers/{id}/driverStandings` plus matching season calendars | 900 seconds shared transport; load on demand | Final snapshot per season used for career points/wins; a title counts only when position 1 is at the final scheduled round. In-progress seasons are excluded; title count is unavailable if finality cannot be verified |
| Driver portraits | OpenF1 exact matched historical Race session, opt-in | 3600 seconds after a match | OpenF1 historical endpoints from 2023; disabled by default until image reuse rights are reviewed |
| News | Environment-configured RSS publishers | 600 seconds; stale result allowed for up to 24 hours if all current feeds fail | Public RSS only; dates reflect publisher publication time; ingestion timestamp is separate; images omitted |
| Live session | OpenF1 server adapter | session 30 seconds; intervals 4 seconds; medium channels 15 seconds | Live REST access requires configured paid/authenticated account; no browser credentials, WebSocket push, MQTT integration or live guarantee without fresh feed evidence |
| Power-unit aggregate | Existing year-specific service mapping over constructor standings | existing backend process cache | Configured mappings for 2024–2026 only; aggregate is not a championship |

Anonymous Jolpica limits and paging guidance: [rate limits](https://github.com/jolpica/jolpica-f1/blob/main/docs/rate_limits.md), [endpoint index](https://github.com/jolpica/jolpica-f1/blob/main/docs/README.md). OpenF1 authentication, streaming guidance and driver headshot fields: [authentication](https://openf1.org/auth.html), [API documentation](https://openf1.org/docs/). OpenF1 describes F1 marks and the service as unofficial; headshot URL availability does not grant reuse rights. Logo and portrait presentation stays conservative.

## Live session state

Set `OPENF1_USERNAME` and `OPENF1_PASSWORD` for backend-only OAuth renewal or provide a server-only `OPENF1_TOKEN`. Never set these as `VITE_*` values. Token acquisition is serialized and in-memory; a 60-second expiry margin triggers renewal. Unauthorized, rate limited, stale, not configured and failed requests are reported without logging credentials or provider response content. Session identity is `session_key`; the display uses the session name/start date, not country, meeting key or race number. A current session is reported live only with recent authenticated race-control or timing evidence and no later terminal status. The integration currently uses bounded REST polling, not the provider-recommended MQTT/WebSocket stream.

## Media and news boundaries

Portrait lookup matches season, race start UTC, exact provider session and normalized full driver name/number. There is no cross-driver image fallback. Media URLs pass HTTP(S)/credential/host checks; a broken URL becomes the accessible availability treatment. Keep `OPENF1_IMAGES_ENABLED=false` unless your deployment has reviewed the referenced publisher rights and policies.

News source entries use `NEWS_FEEDS=URL|Publisher,...`. Feed retrieval is bounded to eight sources and two megabytes per source, with XML entities rejected, HTTP(S) URLs only, redirects disabled, host credentials/local addresses rejected, link deduplication and UTC publication parsing. Article summaries are text-only; source image metadata is not assumed. Topic filters only use actual RSS categories. Text search is clearly labelled and does not imply semantic classification.

## Known gaps

- A browser-integrated end-to-end multi-route fixture suite has not yet been added. The 2025 Round 1 canonical smoke passed after fixing split-page event merging; RSS and authenticated OpenF1 smoke checks remain unverified. Browser route/viewport review was blocked by the Computer Use approval timeout.
- Historical constructor rename/merger lineage and historical power-unit relationships are not synthesized. Provider identities remain separate.
- Driver profile portrait display is off by default pending rights review. No team logos or arbitrary image proxy are introduced.
- Jolpica provides official final standings but not consistent per-round standings for every historical era. Requested round responses surface the provider's round and fail when mismatched.
- Points progression shows summed event classification points, not historic re-scoring, dropped scores, penalties or adjusted official standings.
- Legacy `/api/results` omits classifications without a numeric position because its old consumer requires an integer; full unranked statuses remain in canonical history.
- Supplier mappings are only configured for supported seasons. Unknown constructor mappings remain “Unmapped supplier”; historical lineage is not inferred.
- Qualifying P1 is not equivalent to an all-era official pole statistic; partial qualifying and fastest-lap coverage is disclosed in the response and UI.
- Session lifecycle uses fresh provider events/timing with a conservative 180-second evidence window. Real authenticated lifecycle, cancellation and reconnect checks remain unverified here.
