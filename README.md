# ApexF1

A cinematic Formula 1 companion built with React 19, Vite 7, TanStack Router, TanStack Query and Zustand. The Python FastAPI backend integrates Jolpica classifications/standings, FastF1 schedules/recorded telemetry, OpenF1 timing, and motorsport RSS feeds.

## Local development

Backend: use Python 3.11 for the pinned scientific packages (the Docker image uses 3.11).

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Frontend: Node 22 and npm. `package-lock.json` is the supported reproducible install. The legacy Bun lock describes an older framework and is not used by npm/Docker.

```powershell
cd frontend
npm ci
npm run dev -- --port 3000
npm run typecheck
npm test
npm run build
npm run lint
```

Set `VITE_API_URL` **at build time** for a hosted backend. Local development defaults to `http://localhost:8000`; the existing hosted fallback is `https://apexf1-api.onrender.com`. Never put secrets in Vite variables. Docker frontend accepts the `VITE_API_URL` build argument; use a browser-reachable URL, not the Docker service hostname.

Backend settings: `CORS_ORIGINS` (comma-separated origins), `CACHE_DIR`, `LOG_LEVEL`, `RATE_LIMIT_PER_MINUTE`, `LIVE_DATA_REFRESH_SECONDS` (30 seconds by default), `APP_ENV`. See `backend/app/core/config.py`. No application login, database, push service, or cloud preference synchronization is implemented. Preferences remain in browser local storage.

## Data contracts and limitations

- `/api/schedule?year=`: FastF1 schedule with offset-aware UTC session dates. Completion is a four-hour post-race schedule estimate, not an official race-control confirmation.
- `/api/results?year=`: paginated Jolpica race classifications; includes year, source and fetch timestamp. Returns HTTP 503 when retrieval/validation fails.
- `/api/leaderboard?year=&round=&session=`: exact requested archive. Race classifications prefer Jolpica and fall back to FastF1. It never substitutes unrelated live timing.
- `/api/standings`, `/api/engine-standings`: canonical season standings and supplier aggregates. Supplier coverage is explicitly limited to 2024–2026 mappings; earlier seasons return unavailable data.
- `/api/live/snapshot`, `/api/ws/live`: OpenF1 current session feed. OpenF1 live access requires provider authorization; the credential-free configuration returned HTTP 401 during this audit. A schedule window is not proof of a working live stream.
- `/api/telemetry`, `/api/laps`, `/api/weather`, `/api/race-control`, `/api/drivers`: recorded session channels, subject to provider coverage.
- `/api/news`, `/api/insights`, `/api/dashboard-context`: real RSS stories and derived context. No invented news/weather/results fallback.
- Calendar export downloads an iCalendar snapshot. It is not a subscription; re-export after schedule changes. Notification toggles save preferences only.

Tests: `cd backend; python -m unittest discover -s tests -v`. Fixtures under `backend/tests` are test data, never runtime fallbacks.

See [forensic audit](docs/FORENSIC_AUDIT.md), [data flow](docs/DATA_FLOW_MAP.md), [remediation plan](docs/REMEDIATION_PLAN.md), and [validation](docs/VALIDATION.md). These distinguish verified improvements from remaining limitations; the project is not certified fully audited or production-ready.
