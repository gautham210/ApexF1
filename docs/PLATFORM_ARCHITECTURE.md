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

## RSS outbound connection boundary (2026-10-23)

Each feed fetch and redirect resolves its hostname under a five-second deadline. All answers must be globally routable; empty, private/mixed and IPv4-mapped IPv6 answers fail closed. Only standard HTTP/HTTPS ports are accepted. The HTTP socket destination is the validated numeric IP, eliminating a second hostname resolution during connection. Original publisher Host and TLS SNI are preserved with certificate verification enabled via httpcore's `sni_hostname` request extension (confirmed in the installed transport source). Automatic redirects and environment proxies are disabled. Each of at most four hops undergoes the same checks. Existing eight-source/two-megabyte limits, safe links, XML protections, attribution, partial errors and stale-cache reporting remain intact. First-address connection failure is reported unavailable; address failover is not implemented. Public article links are validated as links, not fetched by this server.

## Integrity continuation (2026-10-23)

Home schedule countdowns now expose upcoming, scheduled-start-passed/status-unverified, or missing schedule. No guessed duration establishes a live or terminal state; only existing authenticated provider evidence may do that. The next future session is focused, otherwise the latest scheduled start is shown as unverified. Career schema preserves season_coverage and failed_seasons; profile aggregates from incomplete history are explicitly qualified.

Container hosting builds static dist assets and serves them with Nginx on port 3000. The /api/ location proxies backend:8000 including WebSocket upgrade; SPA deep links fall back to index.html, hashed assets use immutable caching and the shell revalidates. Production API defaults to window.location.origin; split-host deployments must provide VITE_API_URL at build time. Local Vite development retains localhost:8000. Docker runtime and remote deployment remain unverified. No service worker or offline data caching has been added yet.

## Integrated companion (2026-10-23)

See [COMPANION.md](COMPANION.md) for the implemented route/data/model/PWA boundaries. New history schedule and official progression endpoints reuse the canonical transport rather than introducing another provider client. Official snapshots preserve dropped-score and penalty-era totals; event-point and hypothetical views are separate. API caches remain bounded; schedule threads are deduplicated by year (four pending jobs maximum), and frontend queries carry year/kind/identity and AbortSignal. General backend cache TTL remains 300 seconds; Jolpica and history query stale times remain 900 seconds. Heavy global results/dashboard queries are enabled only on Home; other tools request their own shared domains.

The app shell uses a build-versioned HTML snapshot and an enumerated static asset cache, matching static paths while ignoring Vary/query differences. Live/history/news API responses and model assets are excluded. Model renderer chunks are lazy and not pre-cached. Explicit update consent, network/offline status, safe-area navigation and shared race-widget contracts are connected. Foreground reminders are intentionally limited to an open page; native widgets and background push require separate implementations.

The live adapter now exposes partial-channel errors and completed lap/sector records. Missing positions, DRS and current tyre age remain null; the client clears expired/disconnected data and rejects older timestamps. Real authenticated verification is blocked by missing credentials. Source terms, constructor identities, portrait opt-in and geometry availability restrictions remain unchanged.


## Hosted deployment contract
Vercel serves frontend only; existing Render service apexf1-api serves FastAPI. VITE_API_URL is the canonical public backend origin for preview and production. Missing production configuration rejects requests before contacting the static SPA. An optional trailing /api is normalized because callers already include /api. HTTPS maps to WSS. Only Docker explicitly sets VITE_SAME_ORIGIN_API=true because its Nginx configuration proxies API and WebSocket traffic. No browser process.env or legacy NEXT_PUBLIC variable fallback is used.
render.yaml documents the existing service, Python 3.11 Docker runtime, backend root, main release branch, health route, exact production CORS origin and disabled automatic deployment. It must be applied to the existing authorized service; it does not prove deployment. Preview CORS requires the exact preview origin. Optional OpenF1 credentials remain server secrets.
