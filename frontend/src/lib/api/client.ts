import axios from "axios";

const getBaseUrl = () => {
  // 1. Resolve compiled environment variables
  const viteEnv = (import.meta as any).env?.VITE_API_URL || (import.meta as any).env?.NEXT_PUBLIC_API_URL;
  if (viteEnv) return viteEnv;

  // 2. Check global window variables
  const windowEnv = (window as any).VITE_API_URL || (window as any).NEXT_PUBLIC_API_URL;
  if (windowEnv) return windowEnv;

  // 3. Server-side environment checks
  if (typeof window === "undefined") {
    return (typeof process !== "undefined"
      ? process.env?.VITE_API_URL || process.env?.NEXT_PUBLIC_API_URL
      : null) || "http://localhost:8000";
  }

  // 4. Localhost fallback only during development
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return "http://localhost:8000";
  }

  // 5. Default production backend Render fallback
  return "https://apexf1-api.onrender.com";
};

const BASE_URL = getBaseUrl();

export const WS_URL = BASE_URL.replace(/^http/, "ws");

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 35000,
  headers: { "Content-Type": "application/json" },
});

// Intercept: unwrap .data, handle cold-boot, graceful fallback
api.interceptors.response.use(
  (res) => res.data,
  async (err) => {
    const config = err.config;
    if (!config) return Promise.reject(err);

    // Basic timeout retry
    if ((err.code === "ECONNABORTED" || err?.message?.includes("timeout")) && !config._retriedTimeout) {
      config._retriedTimeout = true;
      return api(config);
    }

    const url = config.url || "";
    // Graceful empty fallback for data endpoints that are non-critical
    if (url.includes("/telemetry") || url.includes("/leaderboard") || url.includes("/laps")) {
      return Promise.resolve({ success: true, data: [] });
    }

    return Promise.reject(err);
  }
);

export const f1Api = {
  // ── Session ──────────────────────────────────────────────────────
  /** Real session state from OpenF1: state, is_live, session_info */
  getSessionState: () => api.get("/api/session/state"),
  getCurrentSession: () => api.get("/api/session/current"),

  // ── Schedule ─────────────────────────────────────────────────────
  getSchedule: (year?: number) => api.get("/api/schedule", { params: { year } }),

  // ── Live (OpenF1 primary) ─────────────────────────────────────────
  /** Full live snapshot: timing + weather + race control */
  getLiveSnapshot: () => api.get("/api/live/snapshot"),
  getLiveRaceControl: () => api.get("/api/live/race-control"),
  getLiveStints: () => api.get("/api/live/stints"),

  // ── Archive (FastF1) ──────────────────────────────────────────────
  getLeaderboard: (year?: number, round?: number, session?: string) =>
    api.get("/api/leaderboard", { params: { year, round, session } }),
  getLaps: (year?: number, round?: number, session?: string, driver?: string) =>
    api.get("/api/laps", { params: { year, round, session, driver } }),
  getTelemetry: (year?: number, round?: number, session?: string, driver?: string, lap?: number) =>
    api.get("/api/telemetry", { params: { year, round, session, driver, lap } }),
  getWeather: (year?: number, round?: number, session?: string) =>
    api.get("/api/weather", { params: { year, round, session } }),
  getRaceControl: (year?: number, round?: number, session?: string) =>
    api.get("/api/race-control", { params: { year, round, session } }),
  getTrackStatus: (year?: number, round?: number, session?: string) =>
    api.get("/api/track-status", { params: { year, round, session } }),
  getTyres: (year?: number, round?: number, session?: string) =>
    api.get("/api/tyres", { params: { year, round, session } }),
  getDrivers: (year?: number, round?: number) =>
    api.get("/api/drivers", { params: { year, round } }),

  // ── Standings ─────────────────────────────────────────────────────
  getStandings: (year?: number) => api.get("/api/standings", { params: { year } }),
  getConstructors: (year?: number) => api.get("/api/constructors", { params: { year } }),
  getEngineStandings: (year?: number) => api.get("/api/engine-standings", { params: { year } }),

  // ── Intelligence ──────────────────────────────────────────────────
  getInsights: (year?: number) => api.get("/api/insights", { params: { year } }),
  getNews: () => api.get("/api/news"),

  // ── Dashboard ────────────────────────────────────────────────────
  getDashboardContext: (year?: number) => api.get("/api/dashboard-context", { params: { year } }),
};
