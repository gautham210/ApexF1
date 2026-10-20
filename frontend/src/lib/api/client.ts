import type {
  ScheduleEvent,
  StandingsEntry,
  LeaderboardEntry,
  TelemetryPoint,
  WeatherData,
  Driver,
  SeasonContext,
} from "../store";
import type { LiveSessionData } from "@/hooks/useLiveSession";
import { z } from "zod";
export interface APIResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
  error?: string | null;
}
export interface NewsItem {
  title: string;
  source: string;
  tag: string;
  link: string;
  published: string | null;
  summary?: string;
  source_url?: string;
  ingested_at?: string;
  topics?: string[];
  image?: string | null;
}
export interface DashboardContext {
  season_context: SeasonContext;
  news: NewsItem[];
  insights: Record<
    string,
    { name: string; stat: string; status?: "available" | "partial" | "unavailable" }
  >;
  driver_standings: StandingsEntry[];
  constructor_standings: StandingsEntry[];
  history_status?: "success" | "partial" | "unavailable";
  history_round?: number | null;
  history_source?: string | null;
  history_fetched_at?: string | null;
  history_errors?: Record<string, string>;
  news_status?: "success" | "partial" | "stale" | "unavailable";
  news_errors?: Record<string, string>;
  upcoming_schedule?: ScheduleEvent[];
}

const scheduleEventSchema = z
  .object({
    round_number: z.number(),
    country: z.string(),
    location: z.string(),
    event_name: z.string(),
    is_completed: z.boolean(),
    is_upcoming: z.boolean(),
  })
  .passthrough();
export const dashboardResponseSchema = z.object({
  success: z.literal(true),
  timestamp: z.string(),
  error: z.string().nullable().optional(),
  data: z
    .object({
      season_context: z
        .object({
          year: z.number().optional(),
          current_round: z.number(),
          completed_rounds: z.number(),
          total_rounds: z.number(),
          is_active_weekend: z.boolean(),
          latest_completed_race: scheduleEventSchema.nullable(),
          next_race: scheduleEventSchema.nullable(),
        })
        .passthrough(),
      news: z.array(
        z
          .object({
            title: z.string(),
            source: z.string(),
            tag: z.string(),
            link: z.string(),
            published: z.string().nullable(),
            summary: z.string().optional(),
            source_url: z.string().optional(),
            ingested_at: z.string().optional(),
            topics: z.array(z.string()).optional(),
            image: z.string().nullable().optional(),
          })
          .passthrough(),
      ),
      insights: z.record(
        z.string(),
        z.object({
          name: z.string(),
          stat: z.string(),
          status: z.enum(["available", "partial", "unavailable"]).optional(),
        }),
      ),
      driver_standings: z.array(
        z
          .object({
            position: z.number(),
            name: z.string(),
            points: z.number(),
            wins: z.number().nullable().optional(),
            driver_id: z.string().nullable().optional(),
            constructor_id: z.string().nullable().optional(),
            number: z.string().nullable().optional(),
            code: z.string().nullable().optional(),
            display_name: z.string().nullable().optional(),
            team: z.string().nullable().optional(),
            nationality: z.string().nullable().optional(),
            color: z.string().nullable().optional(),
          })
          .passthrough(),
      ),
      constructor_standings: z.array(
        z
          .object({
            position: z.number(),
            name: z.string(),
            points: z.number(),
            wins: z.number().nullable().optional(),
            driver_id: z.string().nullable().optional(),
            constructor_id: z.string().nullable().optional(),
            number: z.string().nullable().optional(),
            code: z.string().nullable().optional(),
            display_name: z.string().nullable().optional(),
            team: z.string().nullable().optional(),
            nationality: z.string().nullable().optional(),
            color: z.string().nullable().optional(),
          })
          .passthrough(),
      ),
      history_status: z.enum(["success", "partial", "unavailable"]),
      history_round: z.number().nullable(),
      history_source: z.string().nullable(),
      history_fetched_at: z.string().nullable(),
      history_errors: z.record(z.string(), z.string()),
      news_status: z.enum(["success", "partial", "stale", "unavailable"]),
      news_errors: z.record(z.string(), z.string()),
      upcoming_schedule: z.array(scheduleEventSchema),
    })
    .passthrough(),
});
declare global {
  interface Window {
    VITE_API_URL?: string;
    NEXT_PUBLIC_API_URL?: string;
  }
}
import axios from "axios";

const getBaseUrl = () => {
  // 1. Resolve compiled environment variables
  const viteEnv = import.meta.env?.VITE_API_URL || import.meta.env?.NEXT_PUBLIC_API_URL;
  if (viteEnv) return viteEnv;

  // 2. Check global window variables
  const windowEnv =
    typeof window !== "undefined" ? window.VITE_API_URL || window.NEXT_PUBLIC_API_URL : null;
  if (windowEnv) return windowEnv;

  // 3. Server-side environment checks
  if (typeof window === "undefined") {
    return (
      (typeof process !== "undefined"
        ? process.env?.VITE_API_URL || process.env?.NEXT_PUBLIC_API_URL
        : null) || "http://localhost:8000"
    );
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
    if (
      (err.code === "ECONNABORTED" || err?.message?.includes("timeout")) &&
      !config._retriedTimeout
    ) {
      config._retriedTimeout = true;
      return api(config);
    }

    return Promise.reject(err);
  },
);

export const f1Api = {
  // ── Session ──────────────────────────────────────────────────────
  /** Real session state from OpenF1: state, is_live, session_info */
  getSessionState: () => api.get("/api/session/state"),
  getCurrentSession: () => api.get("/api/session/current"),

  // ── Schedule ─────────────────────────────────────────────────────
  getSeasonResults: (year: number, signal?: AbortSignal) =>
    api.get<
      never,
      APIResponse<{
        year: number;
        source: string;
        fetched_at: string;
        results: Record<string, LeaderboardEntry[]>;
      }>
    >("/api/results", { params: { year }, signal }),
  getSchedule: (year?: number, signal?: AbortSignal) =>
    api.get<never, APIResponse<ScheduleEvent[]>>("/api/schedule", { params: { year }, signal }),

  // ── Live (OpenF1 primary) ─────────────────────────────────────────
  /** Full live snapshot: timing + weather + race control */
  getLiveSnapshot: () => api.get<never, APIResponse<LiveSessionData>>("/api/live/snapshot"),
  getLiveRaceControl: () => api.get("/api/live/race-control"),
  getLiveStints: () => api.get("/api/live/stints"),

  // ── Archive (FastF1) ──────────────────────────────────────────────
  getLeaderboard: (year?: number, round?: number, session?: string) =>
    api.get<never, APIResponse<LeaderboardEntry[]>>("/api/leaderboard", {
      params: { year, round, session },
    }),
  getLaps: (year?: number, round?: number, session?: string, driver?: string) =>
    api.get("/api/laps", { params: { year, round, session, driver } }),
  getTelemetry: (year?: number, round?: number, session?: string, driver?: string, lap?: number) =>
    api.get<never, APIResponse<TelemetryPoint[]>>("/api/telemetry", {
      params: { year, round, session, driver, lap },
    }),
  getWeather: (year?: number, round?: number, session?: string) =>
    api.get<never, APIResponse<WeatherData | null>>("/api/weather", {
      params: { year, round, session },
    }),
  getRaceControl: (year?: number, round?: number, session?: string) =>
    api.get("/api/race-control", { params: { year, round, session } }),
  getTrackStatus: (year?: number, round?: number, session?: string) =>
    api.get("/api/track-status", { params: { year, round, session } }),
  getTyres: (year?: number, round?: number, session?: string) =>
    api.get("/api/tyres", { params: { year, round, session } }),
  getDrivers: (year?: number, round?: number) =>
    api.get<never, APIResponse<Driver[]>>("/api/drivers", { params: { year, round } }),

  // ── Standings ─────────────────────────────────────────────────────
  getStandings: (year?: number) =>
    api.get<never, APIResponse<{ drivers: StandingsEntry[]; constructors: StandingsEntry[] }>>(
      "/api/standings",
      { params: { year } },
    ),
  getConstructors: (year?: number) =>
    api.get<never, APIResponse<StandingsEntry[]>>("/api/constructors", { params: { year } }),
  getEngineStandings: (year?: number) =>
    api.get<never, APIResponse<StandingsEntry[]>>("/api/engine-standings", { params: { year } }),

  // ── Intelligence ──────────────────────────────────────────────────
  getInsights: (year?: number) => api.get("/api/insights", { params: { year } }),
  getNews: () => api.get<never, APIResponse<NewsItem[]>>("/api/news"),

  // ── Dashboard ────────────────────────────────────────────────────
  getDashboardContext: async (year?: number, signal?: AbortSignal) => {
    const response = await api.get<never, unknown>("/api/dashboard-context", {
      params: { year },
      signal,
    });
    return dashboardResponseSchema.parse(response) as APIResponse<DashboardContext>;
  },
};
