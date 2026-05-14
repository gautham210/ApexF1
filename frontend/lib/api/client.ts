import axios from "axios";

let BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 5000,
  headers: { "Content-Type": "application/json" },
});

// Automatic fallback and retry for port 8000/8001
api.interceptors.response.use(
  (res) => res.data,
  async (err) => {
    const config = err.config;
    if (!config) return Promise.reject(err);
    
    // If connection refused on 8000, fallback to 8001
    if (err.message === "Network Error" && BASE_URL === "http://localhost:8000" && !config._retried) {
      config._retried = true;
      BASE_URL = "http://localhost:8001";
      api.defaults.baseURL = BASE_URL;
      config.baseURL = BASE_URL;
      return api(config);
    }
    
    // Basic retry logic for timeouts
    if ((err.code === "ECONNABORTED" || err.message.includes("timeout")) && !config._retriedTimeout) {
      config._retriedTimeout = true;
      return api(config);
    }
    
    console.error("[API Error]", err?.response?.data || err.message);
    if (config.url.includes("/telemetry") || config.url.includes("/leaderboard") || config.url.includes("/laps")) {
        return Promise.resolve([]);
    }
    return Promise.reject(err);
  }
);

export const f1Api = {
  getCurrentSession: () => api.get("/api/session/current"),
  getSchedule: (year?: number) => api.get("/api/schedule", { params: { year } }),
  getDrivers: (year?: number, round?: number) => api.get("/api/drivers", { params: { year, round } }),
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
  getStandings: (year?: number) => api.get("/api/standings", { params: { year } }),
  getConstructors: (year?: number) => api.get("/api/constructors", { params: { year } }),
  getTrackStatus: (year?: number, round?: number, session?: string) =>
    api.get("/api/track-status", { params: { year, round, session } }),
  getTyres: (year?: number, round?: number, session?: string) =>
    api.get("/api/tyres", { params: { year, round, session } }),
  getInsights: (year?: number) => api.get("/api/insights", { params: { year } }),
  getNews: () => api.get("/api/news"),
  getEngineStandings: (year?: number) => api.get("/api/engine-standings", { params: { year } }),
};
