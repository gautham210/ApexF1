# ApexF1 data flow map

Audit date: 2026-10-11. Paths refer to this repository. No database or application authentication exists in this snapshot.

| Domain | Provider → service → route | Frontend path | Cache/failure semantics |
|---|---|---|---|
| Calendar, upcoming GP, most recent GP | FastF1 → `f1_service.get_schedule/get_season_context` → `/schedule`, `/dashboard-context` | `GlobalContextInit` → Query cache → settings store → `useSessionContext` → Home/Sessions/Calendar | Backend 300s TTL; frontend 60s refresh. UTC columns normalized, ambiguous naive local dates unavailable. Four-hour completion heuristic remains. |
| Driver/constructor standings | Jolpica → `_fetch_jolpica_*` → `get_standings` → `/standings` | `client.ts` → Standings → canonical store | Versioned disk 1h + memory 300s. Season response checked. Numeric parse failures currently make that standings domain empty. |
| Power units | Canonical constructor standings → `get_engine_standings` → `/engine-standings` | Standings Power Unit tab | 2024–2026 explicit customer map; sums points/wins from constructors. Unknown earlier seasons unavailable. |
| Official race archives | Paginated Jolpica results → `get_season_results` → `/results` | Query `[results,year]` → keys `year-round-Race` → Home/Replay | Memory 300s; timestamp/source/year included. Incomplete/wrong-season/error response gives 503. No telemetry download needed. |
| Requested classification | Jolpica season results, FastF1 fallback → `get_leaderboard` → `/leaderboard` | validated Race Center URL → ArchiveLeaderboard | Exact year/round/session preserved. Provider rank/status/laps retained. Missing FastF1 data still returns empty list. |
| Recorded laps/telemetry | FastF1 → `_load_session` → `/laps`, `/telemetry` | Race Center → telemetry store → charts/trace | Session memory 600s; data 300s; 30s worker wait. Obsolete frontend requests invalidated; worker itself cannot be cancelled. |
| Live timing | OpenF1 → `openf1_service` → broadcaster/`live_service` → `/live/snapshot`, `/ws/live` | `useLiveSession` → Race Center/Home | Provider auth required during live window (401 observed). Latest intervals used; no unrelated archive substitution. Reconnect backoff; empty snapshots clear prior data. |
| Weather | OpenF1 session observations / FastF1 recorded weather | live hook / `/weather` | No forecast service. No hardcoded temperature/wind. OpenF1 observation date included; complete UI freshness presentation remains outstanding. |
| News | Motorsport/Autosport/RaceFans RSS → `get_news` → `/news` and dashboard | Home editorial cards | 600s TTL; only HTTP(S) source links accepted. Empty feed stays empty; historical season selection does not imply historical news. |
| Preferences | Browser localStorage → `preferences.ts` | Profile, Alerts, ambient palette, Home favourite | Local only. No login, cloud sync, delivery queue or push service. |
| Calendar export | Canonical schedule → `lib/calendar.ts` | Calendar download/Google event links | iCalendar UTC snapshot, escaping and UTF-8 folding; no subscription. Google event duration remains a two-hour estimate. |

## Identity and metadata

`backend/app/services/metadata.py` contains sourced 2026 constructor display names and the four season-specific number overrides. Provider constructor identifiers remain separate from aggregation labels. Frontend season databases supply remaining presentation fallbacks; session results retain the provider's actual driver number. The old cross-season global alias table was removed. Historical roster substitutions are not fully modeled and require provider metadata in a future pass.

## Security boundaries

Browser public configuration: `VITE_API_URL`; no secret belongs here. Backend upstream hosts are fixed. API inputs constrain year/round/lap. CORS and WebSocket Origin checks use configured origins. SlowAPI middleware applies configured request limits. Responses do not expose exception text. No database migrations/policies, OAuth callback, upload route, user account or private user data service was found.

## Remaining contract gaps

Several legacy endpoints still conflate unavailable and empty data. Disk standings timestamps are not propagated as source freshness. Drivers with mid-season team changes can make whole-season driver contributions differ from team totals. Schedule windows do not encode cancellations, postponements or actual race-control completion. Live provider meeting IDs are deliberately not treated as championship round numbers. Live matching uses session name and UTC start instant; rescheduled sessions with divergent provider timestamps remain unmatched instead of guessing.
