# Backend / Frontend API Contract Audit
**Date:** 2026-10-21  
**Remediation Lead:** Antigravity Autonomous Forensic Remediation  
**Scope:** Full public API inventory, schemas, consumers, validation rules, and error envelopes.

---

## Public API Surface Inventory

| Route | HTTP Method | Parameters | Primary Provider | Error Envelopes | Frontend Consumer |
|---|---|---|---|---|---|
| `/api/dashboard-context` | `GET` | None | Jolpica + FastF1 | 503 (`unavailable`) | `useDashboard()` in `index.tsx` |
| `/api/schedule` | `GET` | `year: int` (1950..curr+1) | FastF1 / Jolpica | 422 (validation), 503 | `useSessionContext()` across all routes |
| `/api/leaderboard` | `GET` | `year: int`, `round: int`, `session: str` | FastF1 / Jolpica | 422, 404, 503 | `ArchiveLeaderboard` in `race-center.tsx` |
| `/api/telemetry` | `GET` | `year`, `round`, `session`, `driver1`, `driver2`, `lap: int` | FastF1 | 422, 404, 503 | `TelemetryCompare` in `race-center.tsx` |
| `/api/history/season` | `GET` | `year: int`, `round: int?` | Jolpica | 422, 404, 503 | `getSeason()` in `standings.tsx`, `teams.tsx` |
| `/api/history/drivers/{id}/career` | `GET` | `id: str`, `year: int?` | Jolpica | 422 (invalid id/year), 404, 503 | `getCareer()` in `drivers.$driverId.tsx` |
| `/api/history/drivers/{id}/portrait` | `GET` | `id: str`, `year: int` | OpenF1 Media | 422, 404, 503 | `ProviderImage` in driver profile |
| `/api/news/feed` | `GET` | None | RSS Feeds | 503 | `news.tsx`, `index.tsx` |
| `/api/engine-standings` | `GET` | `year: int` | Jolpica / Static DB | 422, 503 | `getTeamPowerUnit()` in constructor profile |
| `/ws/live` | `WebSocket` | Query `Origin` | OpenF1 WebSocket | Close 1008 (policy violation) | `useLiveSession()` hook |

---

## Contract Alignment & Type Safety Review

1. **Nullable Error Serialization (F-01):**
   Backend Pydantic models serialize `"error": null` on successful queries. Frontend Zod schemas (`dashboardResponseSchema`, `apiResponseSchema`) now define `error: z.string().nullable().optional()`, eliminating parser rejections.
2. **Career Endpoint Contract (F-04):**
   Backend supports both season-scoped and full career requests. Driver IDs must match `^[a-zA-Z0-9_-]{1,80}$`. Missing drivers return HTTP 404 (`round_not_found` / `driver_not_found`), while service outages return HTTP 503.
3. **Session Query Formatting:**
   Sessions strictly follow canonical Formula 1 titles: `"Practice 1"`, `"Practice 2"`, `"Practice 3"`, `"Qualifying"`, `"Sprint"`, `"Sprint Shootout"`, `"Race"`.
4. **Data Attribution & Freshness:**
   All API responses return explicit provenance (`"source": "Jolpica"`, `"FastF1"`, or `"OpenF1"`), `"fetched_at"` ISO-8601 timestamps, and caching metadata (`"cache_seconds": 900`).
