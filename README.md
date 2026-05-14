# ⚡ ApexF1

**A real Formula 1 motorsport intelligence platform.**

Authentic F1 data, zero fabrication. ApexF1 derives every insight, standing, and metric from live public F1 APIs — no hardcoded values, no mock telemetry, no fake analytics.

---

## 🏎️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 · React 19 · TypeScript |
| Styling | TailwindCSS · Custom CSS (Glassmorphism) |
| Animations | Framer Motion |
| Charts | Recharts |
| State | Zustand (centralized session context) |
| Backend | Python FastAPI |
| F1 Session Data | FastF1 (telemetry, laps, weather) |
| Championships | Jolpica / Ergast REST API |
| News | Motorsport.com RSS · Autosport RSS · RaceFans RSS |
| Caching | In-memory TTL + disk cache (standings persist across restarts) |

---

## ✅ What Works (Authentic Data)

| Feature | Data Source | Notes |
|---------|-------------|-------|
| Driver Standings | Jolpica/Ergast | Real-time, disk-cached 1h |
| Constructor Standings | Jolpica/Ergast | Real-time, disk-cached 1h |
| Engine Supplier Standings | Derived from constructor data | 2026 PU mappings |
| Race Schedule / Calendar | FastF1 | Live + historical |
| Telemetry (Speed, RPM, etc.) | FastF1 | Per-driver, per-lap |
| Live Timing Leaderboard | FastF1 | Polls every 10s |
| Session Weather | FastF1 | Air/track temp, rain, wind |
| Dashboard Insights | Jolpica/Ergast | Derived from real standings + results |
| Paddock News | RSS feeds | Auto-cached 10 min |
| Live vs Archive detection | Schedule API | Completed sessions show archive state |

---

## 🗂️ Project Structure

```
ApexF1/
├── backend/
│   ├── app/
│   │   ├── api/routes.py        # All REST endpoints
│   │   ├── core/                # Config, logging, cache
│   │   ├── models/schemas.py    # Pydantic models
│   │   └── services/f1_service.py  # All data logic
│   ├── cache/                   # FastF1 + standings disk cache
│   ├── requirements.txt
│   └── run.py
├── frontend/
│   ├── app/
│   │   ├── page.tsx             # Dashboard
│   │   ├── live-timing/         # Live + Archive timing
│   │   ├── telemetry/           # Driver telemetry comparison
│   │   ├── standings/           # Drivers / Constructors / Engines
│   │   └── sessions/            # Session browser + smart routing
│   ├── components/
│   │   ├── layout/              # Sidebar, TopBar, AppLayout
│   │   └── ui/                  # CommandPalette
│   └── lib/
│       ├── api/client.ts        # Axios API client
│       └── store/index.ts       # Zustand global state
└── docker-compose.yml
```

---

## 🚀 Local Setup

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
copy .env.example .env
python run.py
```

- API: `http://localhost:8000`
- Swagger docs: `http://localhost:8000/docs`

> **Note:** First load of a FastF1 session may take 30–90 seconds while telemetry is downloaded and cached. Subsequent loads are instant.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

- App: `http://localhost:3000`

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/schedule?year=` | Race calendar |
| GET | `/api/standings?year=` | Driver + constructor standings |
| GET | `/api/engine-standings?year=` | Engine supplier standings |
| GET | `/api/insights?year=` | Derived analytics (winner, qualifier, etc.) |
| GET | `/api/news` | Live F1 news from RSS |
| GET | `/api/leaderboard?year=&round=&session=` | Session leaderboard |
| GET | `/api/telemetry?year=&round=&session=&driver=&lap=` | Car telemetry data |
| GET | `/api/weather?year=&round=&session=` | Session weather |
| GET | `/api/laps?year=&round=&session=&driver=` | Lap times |
| GET | `/api/drivers?year=&round=` | Driver list for session |
| GET | `/api/session/current` | Current/latest session info |

---

## 📐 Architecture Principles

- **Zero fabrication:** if data is unavailable, an elegant empty state is shown. No mock data is ever generated.
- **Unified context:** all pages (Dashboard, Live Timing, Telemetry, Standings) derive `year / round / session` from one centralized Zustand store.
- **Live vs Archive split:** the Session Browser routes completed sessions to Telemetry (archive), and upcoming/live sessions to Live Timing. The Live Timing page itself detects archive mode and shows appropriate context.
- **Layered caching:** standings use disk cache (1h TTL, survives restart) → memory cache (5 min) → live API. FastF1 sessions are cached in memory for 10 minutes.

---

## 🗺️ Roadmap

- [ ] Live session WebSocket streaming (OpenF1 API)
- [ ] Sector comparison charts
- [ ] Lap-by-lap telemetry timeline scrubber
- [ ] Circuit metadata (corners, DRS zones, lap record)
- [ ] Driver head-to-head analytics
- [ ] Race strategy visualizer (tyre stints)
- [ ] Mobile-optimized layout

---

## 🐳 Docker

```bash
docker compose up --build
```

Both services start with health checks on ports `3000` (frontend) and `8000` (backend).

---

## ⌨️ Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + K` | Open command palette |
| `Esc` | Close command palette |

---

*Data sourced from [FastF1](https://github.com/theOehrly/Fast-F1), [Jolpica/Ergast](https://api.jolpi.ca), and public F1 RSS feeds. Not affiliated with Formula 1 or the FIA.*
