# Season-aware platform data architecture

## Domain boundary

`backend/app/models/history.py` validates Jolpica identities and classification rows. `services/jolpica.py` is the sole transport for the new history surfaces: 100-row pages, 300 ms minimum spacing (below the documented anonymous burst limit), bounded concurrency, 15-minute process cache, bounded page count, in-process single-flight and explicit `ProviderError` outcomes. Existing legacy routes remain in place during migration. Jolpica records are keyed by season, round, session and provider driver/constructor identity; cache keys include the complete query path and response collection.

`services/history_service.py` combines calendar, race, sprint, qualifying and standings data. Official championship points/positions are passed through from the selected-round standings endpoint. Event points use provider classification values and are labelled separately; they are not used to reconstruct historic standings. Grand Prix wins/podiums use race finishing rank, excluding disqualifications, DNS and excluded rows. Grid poles count official race grid position 1. Sprint events are separate. Fastest-lap counts are marked incomplete in eras where the provider field is missing. Constructor contributions are attributed to the constructor in each classification, which preserves transfers.

The `/api/history/season?year=&round=` response includes the provider standings round, requested coordinates, successful/partial status, per-domain errors, source and fetch time. If all domains fail the endpoint returns 503; a missing round returns 404. `?round=N` returns official championship totals after that round. The omitted round returns the provider's latest snapshot, including a current in-progress season when Jolpica has published one.

## Frontend ownership

TanStack Query owns season, round, career, portrait, news and supplier requests. Keys include all identity coordinates. Zod validates payloads at the browser boundary, followed by year/round/driver identity checks. Zustand carries the selected season between existing routes; URL search state remains authoritative on season pages. Query data is not copied into the canonical Zustand standings arrays. Retries are limited, error and partial states remain visible, and selectors preserve browser history.

## Refresh and provenance

| Data | Provider / route | Cache and refresh | Coverage |
|---|---|---|---|
| Historical seasons, race/sprint/qualifying results, standings, schedule | Jolpica via `/api/history/season` | 900 seconds in process; 900 seconds TanStack stale time | Jolpica/Ergast supported F1 dataset; provider-specific gaps remain visible |
| Driver championship career snapshots | Jolpica `/drivers/{id}/driverStandings` | 900 seconds shared transport; load on demand | Driver championship seasons and points; final snapshot per season used for career sums |
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

- A browser-integrated end-to-end multi-route fixture suite has not yet been added; real HTTP-provider smoke checks are blocked by this environment's approval-service usage limit.
- Historical constructor rename/merger lineage and historical power-unit relationships are not synthesized. Provider identities remain separate.
- Driver profile portrait display is off by default pending rights review. No team logos or arbitrary image proxy are introduced.
- Jolpica provides official final standings but not consistent per-round standings for every historical era. Requested round responses surface the provider's round and fail when mismatched.
- Points progression shows summed event classification points, not historic re-scoring, dropped scores, penalties or adjusted official standings.
- Session lifecycle uses fresh provider events/timing with a conservative 180-second evidence window. Real authenticated lifecycle, cancellation and reconnect checks remain unverified here.
