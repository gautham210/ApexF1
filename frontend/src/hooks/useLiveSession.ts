import { useEffect, useRef, useState, useCallback } from "react";
import { acceptLivePayload } from "@/lib/live-state";
import { f1Api, WS_URL } from "@/lib/api/client";

export interface LiveSessionInfo {
  date_start?: string;
  session_key?: number;
  session_name: string;
  display_name: string;
  circuit: string;
  country: string;
  year: number;
  track_status: "GREEN" | "YELLOW" | "SC" | "VSC" | "RED" | string;
}

export interface LiveDriver {
  position: number | null;
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
  pits: number | null;
  status: string | null;
  drs: boolean | null;
  lap_number?: number | null;
  laps?: number | null;
  sector1?: number | null;
  sector2?: number | null;
  sector3?: number | null;
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
  rainfall: boolean | null;
  observed_at?: string | null;
}

export type SessionState =
  | "UPCOMING"
  | "WEEKEND"
  | "FP1"
  | "FP2"
  | "FP3"
  | "QUALIFYING"
  | "SPRINT_Q"
  | "SPRINT"
  | "RACE"
  | "RED_FLAG"
  | "SC"
  | "VSC"
  | "CHECKERED"
  | "ARCHIVE"
  | "WAKING"
  | "UNKNOWN";

export interface LiveSessionData {
  status?: "success" | "partial";
  errors?: Record<string, string>;
  timestamp?: string;
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
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryCount = useRef(0);
  const mountedRef = useRef(true);
  const requestRef = useRef<AbortController | null>(null);

  const applyPayload = useCallback((payload: Partial<LiveSessionData> & { timestamp?: string }) => {
    if (!mountedRef.current) return;
    setData((prev) => ({ ...acceptLivePayload(prev, payload), ws_connected: true }));
  }, []);

  const fetchSnapshot = useCallback(async () => {
    if (!mountedRef.current) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setData((prev) => ({ ...prev, is_waking: true }));
    try {
      const res = await f1Api.getLiveSnapshot(controller.signal);
      if (!mountedRef.current || controller.signal.aborted) return;
      setData((prev) => acceptLivePayload(prev, res.data));
    } catch {
      if (!mountedRef.current || controller.signal.aborted) return;
      setData((prev) => ({ ...INITIAL, ws_connected: prev.ws_connected }));
    }
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) return;

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
      } catch {
        /* ignore */
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setData(() => ({ ...INITIAL }));
      const delay = Math.min(1000 * Math.pow(2, retryCount.current), 30_000);
      retryCount.current += 1;
      reconnectTimer.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };

    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send("ping");
      }
    }, 25_000);

    pingTimer.current = pingInterval;
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
    void fetchSnapshot();
    connect();
    const freshness = setInterval(
      () =>
        setData((prev) =>
          prev.is_live && (!prev.last_update || Date.now() - Date.parse(prev.last_update) > 45000)
            ? { ...INITIAL, ws_connected: prev.ws_connected }
            : prev,
        ),
      5000,
    );
    const fallback = setInterval(() => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) void fetchSnapshot();
    }, 30000);

    return () => {
      mountedRef.current = false;
      clearInterval(freshness);
      clearInterval(fallback);
      requestRef.current?.abort();
      if (pingTimer.current) clearInterval(pingTimer.current);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [fetchSnapshot, connect]);

  return data;
}
