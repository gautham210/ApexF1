# ⚡ ApexF1 — Formula 1 Analytics Platform

A production-ready, full-stack Formula 1 data platform featuring real-time telemetry, live timing, race replay, driver analytics, and AI-powered insights.

## 🏎️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 + React 19 + TypeScript |
| Backend | Python FastAPI + FastF1 |
| Styling | TailwindCSS + Custom CSS |
| Animations | Framer Motion |
| Charts | Recharts |
| 3D | Three.js + React Three Fiber |
| State | Zustand |
| HTTP | Axios |
| Real-time | WebSockets |

## 📁 Project Structure

```
ApexF1/
├── backend/
│   ├── app/
│   │   ├── api/          # REST & WebSocket routes
│   │   ├── core/         # Config, logging, cache
│   │   ├── models/       # Pydantic schemas
│   │   ├── services/     # F1 data + live service
│   │   └── websockets/   # WS connection manager
│   │   └── main.py       # FastAPI app
│   ├── cache/            # FastF1 local cache
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── app/              # Next.js App Router pages
│   │   ├── live-timing/
│   │   ├── telemetry/
│   │   ├── race-replay/
│   │   ├── driver-analytics/
│   │   ├── standings/
│   │   ├── session-browser/
│   │   ├── ai-insights/
│   │   └── settings/
│   ├── components/
│   │   ├── 3d/           # Three.js scenes
│   │   ├── charts/       # Recharts wrappers
│   │   ├── layout/       # Sidebar, TopBar
│   │   └── ui/           # Shared UI components
│   ├── lib/
│   │   ├── api/          # Axios client
│   │   └── store/        # Zustand stores
│   └── Dockerfile
└── docker-compose.yml
```

## 🚀 Quick Start (Local Development)

### 1. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy env file
copy .env.example .env

# Start the server
python run.py
```

Backend runs at **http://localhost:8000**  
API docs at **http://localhost:8000/docs**

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Copy env file
copy .env.local.example .env.local   # or just use .env.local already created

# Start dev server
npm run dev
```

Frontend runs at **http://localhost:3000**

## 🐳 Docker Deployment

```bash
# From project root
docker compose up --build
```

Both services start automatically with health checks.

## 🌐 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/session/current` | Current/latest session info |
| GET | `/api/schedule?year=` | Full race calendar |
| GET | `/api/drivers?year=&round=` | Driver list |
| GET | `/api/leaderboard?year=&round=&session=` | Race leaderboard |
| GET | `/api/laps?year=&round=&session=&driver=` | Lap times |
| GET | `/api/telemetry?year=&round=&session=&driver=&lap=` | Car telemetry |
| GET | `/api/weather?year=&round=&session=` | Weather data |
| GET | `/api/race-control?year=&round=&session=` | Race control messages |
| GET | `/api/standings?year=` | Championship standings |
| GET | `/api/constructors?year=` | Constructor standings |
| GET | `/api/track-status?year=&round=&session=` | Track status/flags |
| GET | `/api/tyres?year=&round=&session=` | Tyre strategy data |
| WS | `/ws/live` | Live timing WebSocket |
| WS | `/ws/telemetry` | Telemetry WebSocket |

## 📱 Pages

| Page | Route | Description |
|------|-------|-------------|
| Home | `/` | 3D hero, standings, calendar |
| Live Timing | `/live-timing` | Real-time leaderboard |
| Telemetry | `/telemetry` | Driver telemetry comparison |
| Race Replay | `/race-replay` | Animated track map replay |
| Driver Analytics | `/driver-analytics` | Per-driver stats & radar |
| Standings | `/standings` | Championship tables & charts |
| Session Browser | `/session-browser` | Browse all sessions by year |
| AI Insights | `/ai-insights` | Strategy & performance insights |
| Settings | `/settings` | App configuration |

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘/Ctrl + K` | Open command palette |
| `Esc` | Close command palette |
| `Space` | Play/pause race replay |

## 📝 Notes

- **FastF1 data** is cached locally to avoid re-downloading. First load of a session may take 30-60 seconds.
- **Live sessions**: When a live F1 session is detected, the backend auto-refreshes data every 5 seconds and pushes updates via WebSocket.
- **Historical data**: All past 2018-2025 sessions are accessible via the session browser.
- Backend API rate-limited to **60 requests/minute** per IP.
