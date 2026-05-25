import { useEffect, useRef, useState, useCallback } from "react";
import { f1Api, WS_URL } from "@/lib/api/client";

export interface LiveSessionInfo {
  session_name: string;
  display_name: string;
  circuit: string;
  country: string;
  year: number;
  track_status: "GREEN" | "YELLOW" | "SC" | "VSC" | "RED" | string;
}

export interface LiveDriver {
  position: number;
  driver_number: string;
  driver_name: string;
  abbreviation: string;
  team: string;
  team_color: string;
  gap_to_leader: string | null;
  interval: string | null;
  last_lap: string | null;
  best_lap: string | null;
  current_tyre: string | null;
  tyre_age: number | null;
  pits: number;
  status: string;
  drs: boolean;
  speed: number | null;
}

export interface RaceControlMsg {
  time: string | null;
  lap: number | null;
  category: string | null;
  message: string;
  flag: string | null;
  scope: string | null;
}

export interface WeatherReading {
  air_temp: number | null;
  track_temp: number | null;
  humidity: number | null;
  pressure: number | null;
  wind_speed: number | null;
  wind_direction: number | null;
  rainfall: boolean;
}

export type SessionState =
  | "UPCOMING" | "WEEKEND" | "FP1" | "FP2" | "FP3"
  | "QUALIFYING" | "SPRINT_Q" | "SPRINT" | "RACE"
  | "RED_FLAG" | "SC" | "VSC" | "CHECKERED" | "ARCHIVE"
  | "WAKING" | "UNKNOWN";

export interface LiveSessionData {
  is_live: boolean;
  state: SessionState;
  session_info: LiveSessionInfo | null;
  leaderboard: LiveDriver[];
  weather: WeatherReading | null;
  race_control: RaceControlMsg[];
  last_update: string | null;
  is_waking: boolean;
  ws_connected: boolean;
}

const INITIAL: LiveSessionData = {
  is_live: false,
  state: "UNKNOWN",
  session_info: null,
  leaderboard: [],
  weather: null,
  race_control: [],
  last_update: null,
  is_waking: false,
  ws_connected: false,
};

export function useLiveSession(): LiveSessionData {
  const [data, setData] = useState<LiveSessionData>(INITIAL);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCount = useRef(0);
  const mountedRef = useRef(true);

  const applyPayload = useCallback((payload: any) => {
    if (!mountedRef.current) return;
    setData((prev) => ({
      ...prev,
      is_live: payload.is_live ?? prev.is_live,
      state: payload.state ?? prev.state,
      session_info: payload.session_info ?? prev.session_info,
      leaderboard: payload.leaderboard?.length > 0 ? payload.leaderboard : prev.leaderboard,
      weather: payload.weather ?? prev.weather,
      race_control: payload.race_control?.length > 0 ? payload.race_control : prev.race_control,
      last_update: payload.timestamp ?? new Date().toISOString(),
      is_waking: false,
      ws_connected: true,
    }));
  }, []);

  const fetchSnapshot = useCallback(async () => {
    if (!mountedRef.current) return;
    const startMs = Date.now();
    setData((prev) => ({ ...prev, is_waking: true }));
    try {
      const res = await f1Api.getLiveSnapshot() as any;
      const d = res?.data ?? res;
      if (!mountedRef.current) return;
      const elapsed = Date.now() - startMs;
      setData((prev) => ({
        ...prev,
        is_live: d.is_live ?? false,
        state: d.state ?? "ARCHIVE",
        session_info: d.session_info ?? prev.session_info,
        leaderboard: d.leaderboard ?? [],
        weather: d.weather ?? null,
        race_control: d.race_control ?? [],
        last_update: d.timestamp ?? new Date().toISOString(),
        is_waking: elapsed > 20_000 ? false : prev.is_waking,
      }));
    } catch {
      if (!mountedRef.current) return;
      setData((prev) => ({ ...prev, is_waking: false, state: "ARCHIVE" }));
    }
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const wsEndpoint = `${WS_URL}/api/ws/live`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsEndpoint);
    } catch {
      return;
    }

    wsRef.current = ws;

    ws.onopen = () => {
      retryCount.current = 0;
      if (!mountedRef.current) return;
      setData((prev) => ({ ...prev, ws_connected: true }));
    };

    ws.onmessage = (ev) => {
      try {
        const payload = JSON.parse(ev.data);
        if (payload.type === "pong") return;
        applyPayload(payload);
      } catch { /* ignore */ }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setData((prev) => ({ ...prev, ws_connected: false }));
      const delay = Math.min(1000 * Math.pow(2, retryCount.current), 30_000);
      retryCount.current += 1;
      reconnectTimer.current = setTimeout(connect, delay);
    };

    ws.onerror = () => { ws.close(); };

    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send("ping");
      }
    }, 25_000);

    const origOnClose = ws.onclose;
    ws.onclose = (ev) => {
      clearInterval(pingInterval);
      if (origOnClose) {
        origOnClose.call(ws, ev);
      }
    };
  }, [applyPayload]);

  useEffect(() => {
    mountedRef.current = true;
    fetchSnapshot();
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [fetchSnapshot, connect]);

  return data;
}
