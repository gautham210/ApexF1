"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine
} from "recharts";
import { f1Api } from "@/lib/api/client";
import { useLiveSession, type SessionState } from "@/lib/hooks/useLiveSession";
import { useSessionContext } from "@/lib/hooks/useSessionContext";
import { useTelemetryStore, getDriversListByYear, getDriverByYear } from "@/lib/store";
import {
  Radio, Archive, Clock, Thermometer, Wind, Droplets,
  CloudRain, AlertTriangle, Flag, RefreshCw, Play, Pause,
  RotateCcw, Shield, Zap, TrendingUp, ChevronDown, ChevronRight,
  Info, Gauge, Compass, Activity, CalendarDays
} from "lucide-react";

// ── Compound colours ──────────────────────────────────────────────────────────
const COMPOUND: Record<string, { color: string; label: string }> = {
  SOFT:         { color: "#ff3333", label: "S" },
  MEDIUM:       { color: "#ffd700", label: "M" },
  HARD:         { color: "#ffffff", label: "H" },
  INTERMEDIATE: { color: "#39b54a", label: "I" },
  WET:          { color: "#0067ff", label: "W" },
  UNKNOWN:      { color: "#555",    label: "?" },
};

// ── Track status → banner config ──────────────────────────────────────────────
const TRACK_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; pulse: boolean }> = {
  GREEN:  { label: "TRACK CLEAR",     color: "#4ade80", bg: "rgba(74,222,128,0.04)",  pulse: false },
  YELLOW: { label: "YELLOW FLAG",     color: "#facc15", bg: "rgba(250,204,21,0.06)",  pulse: true  },
  SC:     { label: "SAFETY CAR",      color: "#fb923c", bg: "rgba(251,146,60,0.06)",  pulse: true  },
  VSC:    { label: "VIRTUAL SC",      color: "#fb923c", bg: "rgba(251,146,60,0.04)",  pulse: false },
  RED:    { label: "RED FLAG",        color: "#ef4444", bg: "rgba(239,68,68,0.08)",   pulse: true  },
};

// ── State display config ──────────────────────────────────────────────────────
const STATE_CONFIG: Record<SessionState, { label: string; color: string; live: boolean }> = {
  UPCOMING:   { label: "UPCOMING",        color: "#60a5fa", live: false },
  WEEKEND:    { label: "WEEKEND",         color: "#a78bfa", live: false },
  FP1:        { label: "PRACTICE 1",      color: "#4ade80", live: true  },
  FP2:        { label: "PRACTICE 2",      color: "#4ade80", live: true  },
  FP3:        { label: "PRACTICE 3",      color: "#4ade80", live: true  },
  QUALIFYING: { label: "QUALIFYING",      color: "#facc15", live: true  },
  SPRINT_Q:   { label: "SPRINT QUAL",     color: "#facc15", live: true  },
  SPRINT:     { label: "SPRINT",          color: "#fb923c", live: true  },
  RACE:       { label: "GRAND PRIX",      color: "#e10600", live: true  },
  RED_FLAG:   { label: "RED FLAG",        color: "#ef4444", live: true  },
  SC:         { label: "SAFETY CAR",      color: "#fb923c", live: true  },
  VSC:        { label: "VIRTUAL SC",      color: "#fb923c", live: true  },
  CHECKERED:  { label: "FINISHED",        color: "#9ca3af", live: false },
  ARCHIVE:    { label: "ARCHIVE",         color: "#60a5fa", live: false },
  WAKING:     { label: "CONNECTING",      color: "#9ca3af", live: false },
  UNKNOWN:    { label: "LOADING",         color: "#9ca3af", live: false },
};

// ── Official Track Splines Database ──────────────────────────────────────────
const TRACKS_DB: Record<string, { path: string; length: string; laps: number; drs: number; name: string }> = {
  canada: {
    path: "M 10 50 C 12 32, 28 20, 36 28 L 44 38 C 48 44, 52 44, 56 38 L 70 18 C 74 12, 82 12, 86 18 L 110 46 C 114 50, 114 58, 108 62 L 94 70 C 88 74, 80 70, 76 62 L 70 50 C 66 44, 58 44, 54 50 L 46 68 C 42 76, 32 78, 26 70 L 12 56 Z",
    length: "4.361 km",
    laps: 70,
    drs: 3,
    name: "Circuit Gilles Villeneuve"
  },
  monaco: {
    path: "M 10 35 C 12 30, 18 10, 26 12 C 32 14, 38 28, 48 30 C 58 32, 62 10, 72 8 C 82 6, 92 12, 94 22 C 96 32, 88 40, 84 46 C 80 52, 88 56, 86 64 C 84 72, 72 78, 62 76 C 52 74, 46 64, 42 66 C 38 68, 36 78, 30 80 C 24 82, 14 74, 12 64 C 10 54, 8 40, 10 35 Z",
    length: "3.337 km",
    laps: 78,
    drs: 1,
    name: "Circuit de Monaco"
  },
  miami: {
    path: "M 10 40 L 40 18 C 45 15, 55 15, 60 18 L 90 40 C 95 44, 95 56, 90 60 L 80 72 C 75 77, 65 77, 60 72 L 50 62 C 45 57, 35 57, 30 62 L 20 72 C 15 77, 5 72, 8 62 L 10 40 Z",
    length: "5.412 km",
    laps: 57,
    drs: 3,
    name: "Miami International Autodrome"
  },
  "abu dhabi": {
    path: "M 10 20 L 48 20 C 52 20, 56 24, 58 28 L 74 62 C 76 66, 80 70, 84 70 L 108 70 C 112 70, 115 75, 112 80 L 98 94 C 94 98, 86 98, 82 94 L 54 66 C 50 62, 40 62, 36 66 L 24 78 C 20 82, 12 80, 10 74 L 6 34 C 5 26, 7 20, 10 20 Z",
    length: "5.281 km",
    laps: 58,
    drs: 2,
    name: "Yas Marina Circuit"
  },
  bahrain: {
    path: "M 15 25 L 50 18 L 85 25 C 90 28, 90 38, 85 42 L 55 58 C 50 62, 45 68, 48 74 L 62 82 C 65 85, 60 90, 52 88 L 22 74 C 18 70, 16 64, 18 58 Z",
    length: "5.412 km",
    laps: 57,
    drs: 3,
    name: "Bahrain International Circuit"
  }
};

const DEFAULT_TRACK = {
  path: "M 25 50 C 35 30, 58 28, 70 45 C 82 62, 102 62, 110 45 C 115 34, 105 18, 88 18 C 70 18, 60 35, 48 40 Z",
  length: "5.891 km",
  laps: 52,
  drs: 2,
  name: "Grand Prix Circuit Layout"
};

// ── Shared Tyre Chip Widget ──
function TyreChip({ compound }: { compound?: string | null }) {
  const key = (compound || "UNKNOWN").toUpperCase();
  const cfg = COMPOUND[key] || COMPOUND.UNKNOWN;
  return (
    <div
      className="w-5 h-5 rounded-full border flex items-center justify-center font-sans text-[9px] font-black flex-shrink-0"
      style={{ borderColor: cfg.color, color: cfg.color, background: `${cfg.color}08` }}
    >
      {cfg.label}
    </div>
  );
}

// ── Weather Bar component ──
function WeatherBar({ weather }: { weather: any }) {
  if (!weather) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-white/50 text-[10px] font-sans font-bold tracking-wider">
      <span className="flex items-center gap-1.5">
        <Thermometer className="w-3.5 h-3.5 text-apex-red" />
        {weather.air_temp?.toFixed(1)}°C AIR / {weather.track_temp?.toFixed(1)}°C TRACK
      </span>
      <span className="flex items-center gap-1.5">
        <Wind className="w-3.5 h-3.5 text-white/30" />
        {weather.wind_speed?.toFixed(1)} M/S
      </span>
      <span className="flex items-center gap-1.5">
        <Droplets className="w-3.5 h-3.5 text-blue-400" />
        {weather.humidity?.toFixed(0)}% HUMIDITY
      </span>
      {weather.rainfall && (
        <span className="flex items-center gap-1.5 text-blue-400 font-bold animate-pulse">
          <CloudRain className="w-3.5 h-3.5" /> WET TRACK CONDITIONS
        </span>
      )}
    </div>
  );
}

// ── Track Status Warning Banner ──
function TrackStatusBanner({ status }: { status: string }) {
  const cfg = TRACK_STATUS_CONFIG[status] || TRACK_STATUS_CONFIG.GREEN;
  if (status === "GREEN" || !status) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 px-5 py-2.5 rounded-xl border text-[11px] font-sans font-bold tracking-widest uppercase mb-4"
      style={{ borderColor: `${cfg.color}20`, background: cfg.bg, color: cfg.color }}
    >
      <AlertTriangle className="w-4 h-4" />
      {cfg.label}
      {cfg.pulse && (
        <span className="ml-auto w-2 h-2 rounded-full animate-pulse" style={{ background: cfg.color }} />
      )}
    </motion.div>
  );
}

// ── Race Control messages ticker ──
function RaceControlTicker({ messages }: { messages: any[] }) {
  if (!messages || messages.length === 0) return null;
  const latest = messages[0];
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-white/[0.01] border border-white/5 rounded-xl text-[11px] font-sans text-white/60">
      <span className="text-apex-red font-bold tracking-wider flex-shrink-0 uppercase text-[9px] border border-apex-red/20 px-1.5 py-0.5 rounded bg-apex-red/5">
        {latest.flag || latest.category || "CONTROL"}
      </span>
      <span className="text-white/70 truncate">{latest.message}</span>
      {latest.lap && (
        <span className="text-white/30 ml-auto flex-shrink-0 font-sans text-[10px]">Lap {latest.lap}</span>
      )}
    </div>
  );
}

// ── Telemetry comparison AreaChart Section ──
function ChartSection({ title, d1, d2, dataKey, color1, color2, domain, activeDist }: {
  title: string; d1: any[]; d2: any[]; dataKey: string; color1: string; color2: string; domain?: [number, number]; activeDist: number;
}) {
  const merged = useMemo(() => {
    return d1.map((p, i) => ({
      dist: p.distance ? Math.round(p.distance) : p.time ? Math.round(p.time * 10) : i,
      driver1: p[dataKey],
      driver2: d2[i]?.[dataKey],
    }));
  }, [d1, d2, dataKey]);

  return (
    <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-4 shadow-xl">
      <h3 className="font-sans font-bold text-white/40 text-[9px] tracking-widest mb-3 uppercase flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color1 }} />
        {title}
      </h3>
      <ResponsiveContainer width="100%" height={100}>
        <AreaChart data={merged} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id={`g1-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color1} stopOpacity={0.2} />
              <stop offset="95%" stopColor={color1} stopOpacity={0} />
            </linearGradient>
            <linearGradient id={`g2-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color2} stopOpacity={0.2} />
              <stop offset="95%" stopColor={color2} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.01)" vertical={false} />
          <XAxis dataKey="dist" tick={false} tickLine={false} axisLine={false} />
          <YAxis domain={domain} tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 8, fontFamily: "sans-serif" }} tickLine={false} axisLine={false} width={36} />
          <Tooltip
            cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }}
            contentStyle={{ background: "rgba(10,10,18,0.95)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 9, fontFamily: "sans-serif", color: "#fff", padding: "4px 8px" }}
            labelStyle={{ display: "none" }}
          />
          <Area type="monotone" dataKey="driver1" stroke={color1} fill={`url(#g1-${dataKey})`} strokeWidth={1} dot={false} activeDot={false} />
          <Area type="monotone" dataKey="driver2" stroke={color2} fill={`url(#g2-${dataKey})`} strokeWidth={1} dot={false} activeDot={false} />
          {activeDist > 0 && (
            <ReferenceLine x={activeDist} stroke="rgba(255,255,255,0.3)" strokeWidth={1} strokeDasharray="3 3" />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Shared Leaderboard Table ──
function LeaderboardTable({
  rows, loading, expanded, setExpanded,
}: {
  rows: any[]; loading: boolean;
  expanded: string | null; setExpanded: (v: string | null) => void;
}) {
  if (loading) {
    return (
      <div className="p-4 space-y-2">
        {Array(10).fill(0).map((_, i) => (
          <div key={i} className="h-12 skeleton rounded-xl bg-white/5" style={{ opacity: 1 - i * 0.08 }} />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="py-20 flex flex-col items-center gap-4 text-center">
        <Radio className="w-10 h-10 text-white/5" />
        <p className="text-[10px] font-bold text-white/20 tracking-wider uppercase">No timing data active</p>
      </div>
    );
  }

  const COLS = "40px 1fr 120px 48px 80px 80px 40px";

  return (
    <div className="overflow-x-auto">
      {/* Header */}
      <div
        className="grid items-center px-6 py-3 border-b border-white/[0.04] bg-white/[0.005] min-w-[650px]"
        style={{ gridTemplateColumns: COLS }}
      >
        <span className="text-[8px] font-bold text-white/30 tracking-widest uppercase">Pos</span>
        <span className="text-[8px] font-bold text-white/30 tracking-widest uppercase">Driver</span>
        <span className="text-[8px] font-bold text-white/30 tracking-widest uppercase">Constructor</span>
        <span className="text-[8px] font-bold text-white/30 tracking-widest uppercase text-center">Tyre</span>
        <span className="text-[8px] font-bold text-white/30 tracking-widest uppercase text-right">Gap</span>
        <span className="text-[8px] font-bold text-white/30 tracking-widest uppercase text-right">Last Lap</span>
        <span className="text-[8px] font-bold text-white/30 tracking-widest uppercase text-center">Pits</span>
      </div>

      <AnimatePresence initial={false}>
        {rows.map((entry, i) => {
          const isExp = expanded === entry.driver_number;
          const teamCol = entry.team_color || "#888";
          const isTop3 = i < 3;
          
          return (
            <motion.div
              key={entry.driver_number}
              layout="position"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: Math.min(i * 0.012, 0.3) }}
              className="border-b border-white/[0.03] last:border-0 min-w-[650px]"
            >
              <div
                className="grid items-center px-6 py-3 cursor-pointer hover:bg-white/[0.015] transition-colors"
                style={{
                  gridTemplateColumns: COLS,
                  borderLeft: `3px solid ${isTop3 ? teamCol : "transparent"}`,
                }}
                onClick={() => setExpanded(isExp ? null : entry.driver_number)}
              >
                {/* Pos */}
                <span
                  className="font-sans font-bold text-sm"
                  style={{ color: i === 0 ? "#e10600" : "rgba(255,255,255,0.4)" }}
                >
                  {entry.position ?? i + 1}
                </span>

                {/* Driver */}
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-sans font-bold text-white text-sm tracking-wide">
                    {entry.abbreviation}
                  </span>
                  <span className="font-sans text-white/35 text-xs truncate hidden lg:block">
                    {entry.driver_name || entry.full_name}
                  </span>
                </div>

                {/* Team */}
                <div className="flex items-center gap-2 min-w-0">
                  <div className="team-bar h-4 w-1 rounded" style={{ backgroundColor: teamCol }} />
                  <span className="font-sans text-white/40 text-xs truncate">{entry.team || entry.team_name}</span>
                </div>

                {/* Tyre */}
                <div className="flex justify-center">
                  <TyreChip compound={entry.current_tyre} />
                </div>

                {/* Gap */}
                <div className="text-right">
                  <span className="font-sans text-xs font-semibold text-white/50">
                    {i === 0 ? "LEADER" : (entry.gap_to_leader || "—")}
                  </span>
                </div>

                {/* Last lap */}
                <div className="text-right">
                  <span className="font-sans text-xs font-semibold text-white/80">
                    {entry.last_lap || "—"}
                  </span>
                </div>

                {/* Pits */}
                <div className="text-center">
                  <span className="font-sans text-white/20 text-xs">{entry.pits ?? 0}</span>
                </div>
              </div>

              {/* Expanded detail */}
              <AnimatePresence>
                {isExp && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden bg-white/[0.005] border-t border-white/[0.03]"
                  >
                    <div className="px-16 py-4 flex flex-wrap gap-8 text-[10px] font-sans text-white/50">
                      <div><span className="text-[8px] font-bold uppercase tracking-widest text-white/30 mr-2">Best Lap</span><span className="text-white font-semibold">{entry.best_lap || "—"}</span></div>
                      <div><span className="text-[8px] font-bold uppercase tracking-widest text-white/30 mr-2">Tyre Age</span><span className="text-white font-semibold">{entry.tyre_age ?? "—"} laps</span></div>
                      <div><span className="text-[8px] font-bold uppercase tracking-widest text-white/30 mr-2">Interval</span><span className="text-white/60 font-semibold">{entry.interval || "—"}</span></div>
                      {entry.speed && <div><span className="text-[8px] font-bold uppercase tracking-widest text-white/30 mr-2">Speed</span><span className="text-white font-semibold">{entry.speed} km/h</span></div>}
                      <div><span className="text-[8px] font-bold uppercase tracking-widest text-white/30 mr-2">Status</span><span className="text-emerald-400 font-bold">{entry.status || "ON TRACK"}</span></div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// ── Archive Leaderboard Wrapper ──
function ArchiveLeaderboard({ year, round, session, expanded, setExpanded }: { year: number; round: number; session: string; expanded: string | null; setExpanded: (v: string | null) => void }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    f1Api.getLeaderboard(year, round, session)
      .then((res: any) => {
        if (cancelled) return;
        const d = Array.isArray(res) ? res : (res?.data ?? []);
        setData(d);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [year, round, session]);

  return (
    <div className="bg-[#0b0b14]/30 rounded-3xl border border-white/[0.04] overflow-hidden">
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <span className="text-[10px] font-bold text-white/40 tracking-widest uppercase">Leaderboard Results</span>
        {loading && <RefreshCw className="w-3.5 h-3.5 text-white/25 animate-spin" />}
      </div>
      <LeaderboardTable rows={data} loading={loading} expanded={expanded} setExpanded={setExpanded} />
    </div>
  );
}

// ── Main Page (Race Center) ──
export default function RaceCenterPage() {
  const live = useLiveSession();
  const { season, selectedRound, selectedSession, isArchive, raceLabel, setSelectedSession, setSelectedLap, selectedLap } = useSessionContext();
  const {
    driver1, driver2, driver1Data, driver2Data,
    scrubberPosition, isPlaying,
    setDriver1, setDriver2, setDriver1Data, setDriver2Data,
    setScrubberPosition, setIsPlaying
  } = useTelemetryStore();

  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [rightPanelTab, setRightPanelTab] = useState<"circuit" | "telemetry" | "logs">("circuit");
  
  // Telemetry UI states
  const [telemetryLoading, setTelemetryLoading] = useState(false);
  const [telemetryLoadedAt, setTelemetryLoadedAt] = useState<string | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  const db = getDriversListByYear(season);
  const d1Meta = getDriverByYear(season, driver1);
  const d2Meta = getDriverByYear(season, driver2);

  const DRIVER_COLOR_1 = d1Meta.color || "#e10600";
  const DRIVER_COLOR_2 = d2Meta.color || "#27F4D2";

  // Official track details or procedurally fallback
  const normalizedCountry = (raceLabel || "").toLowerCase();
  const trackKey = Object.keys(TRACKS_DB).find(k => normalizedCountry.includes(k)) || "";
  const activeTrack = TRACKS_DB[trackKey] || DEFAULT_TRACK;

  // Dynamic telemetry analysis calculations
  const telemetryAnalysis = useMemo(() => {
    if (driver1Data.length === 0) return null;
    const d1Speeds = driver1Data.map(p => p.speed || 0);
    const d2Speeds = driver2Data.map(p => p.speed || 0);

    const d1MaxSpeed = Math.max(...d1Speeds);
    const d2MaxSpeed = driver2Data.length > 0 ? Math.max(...d2Speeds) : 0;

    const d1AvgThrottle = driver1Data.reduce((acc, p) => acc + (p.throttle || 0), 0) / driver1Data.length;
    const d2AvgThrottle = driver2Data.length > 0 ? driver2Data.reduce((acc, p) => acc + (p.throttle || 0), 0) / driver2Data.length : 0;

    const d1Brakes = driver1Data.filter(p => (p.brake || 0) > 0.1).length / driver1Data.length * 100;
    const d2Brakes = driver2Data.length > 0 ? driver2Data.filter(p => (p.brake || 0) > 0.1).length / driver2Data.length * 100 : 0;

    return {
      d1MaxSpeed,
      d2MaxSpeed,
      d1AvgThrottle: Math.round(d1AvgThrottle),
      d2AvgThrottle: Math.round(d2AvgThrottle),
      d1Brakes: Math.round(d1Brakes),
      d2Brakes: Math.round(d2Brakes),
      speedDelta: d1MaxSpeed - d2MaxSpeed,
      throttleDelta: Math.round(d1AvgThrottle - d2AvgThrottle),
    };
  }, [driver1Data, driver2Data]);

  // SVG Coordinates translation and scaling
  const scaledTracks = useMemo(() => {
    const combined = [...driver1Data, ...driver2Data].filter(p => typeof p.x === "number" && typeof p.y === "number");
    if (combined.length === 0) return { d1Scaled: [], d2Scaled: [] };

    let minX = Infinity; let maxX = -Infinity;
    let minY = Infinity; let maxY = -Infinity;

    combined.forEach(p => {
      if (p.x! < minX) minX = p.x!;
      if (p.x! > maxX) maxX = p.x!;
      if (p.y! < minY) minY = p.y!;
      if (p.y! > maxY) maxY = p.y!;
    });

    const width = maxX - minX;
    const height = maxY - minY;
    const maxDim = Math.max(width, height) || 1;

    const margin = 10;
    const size = 100 - 2 * margin;
    const scale = size / maxDim;

    const offsetX = margin + (size - width * scale) / 2;
    const offsetY = margin + (size - height * scale) / 2;

    const scaleList = (list: any[]) => {
      return list.filter(p => typeof p.x === "number" && typeof p.y === "number").map(p => ({
        ...p,
        x: offsetX + (p.x! - minX) * scale,
        y: offsetY + (maxY - p.y!) * scale,
      }));
    };

    return {
      d1Scaled: scaleList(driver1Data),
      d2Scaled: scaleList(driver2Data),
    };
  }, [driver1Data, driver2Data]);

  // Load telemetry from FastF1
  async function loadTelemetry() {
    setTelemetryLoading(true);
    setIsPlaying(false);
    setScrubberPosition(0);
    try {
      const [r1, r2] = await Promise.allSettled([
        f1Api.getTelemetry(season, selectedRound, selectedSession, driver1, selectedLap === "all" ? undefined : selectedLap as number),
        f1Api.getTelemetry(season, selectedRound, selectedSession, driver2, selectedLap === "all" ? undefined : selectedLap as number),
      ]);
      if (r1.status === "fulfilled") setDriver1Data((r1.value as any).data || []);
      if (r2.status === "fulfilled") setDriver2Data((r2.value as any).data || []);
      setTelemetryLoadedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (e) {
      console.error("[Telemetry] load failed:", e);
    }
    setTelemetryLoading(false);
  }

  // Scrubber timer loop
  useEffect(() => {
    if (!isPlaying || driver1Data.length === 0) return;

    const interval = setInterval(() => {
      const currentPos = useTelemetryStore.getState().scrubberPosition;
      if (currentPos >= driver1Data.length - 1) {
        setScrubberPosition(0);
      } else {
        setScrubberPosition(currentPos + playbackSpeed);
      }
    }, 45);

    return () => clearInterval(interval);
  }, [isPlaying, driver1Data.length, playbackSpeed, setScrubberPosition]);

  // Scrubber variables mapping
  const activePt1 = driver1Data[scrubberPosition] || null;
  const activePt2 = useMemo(() => {
    if (!activePt1 || driver2Data.length === 0) return null;
    if (typeof activePt1.distance === "number") {
      let bestPt = driver2Data[0];
      let minDiff = Math.abs((bestPt.distance || 0) - activePt1.distance);
      for (let i = 1; i < driver2Data.length; i++) {
        const pt = driver2Data[i];
        const diff = Math.abs((pt.distance || 0) - activePt1.distance);
        if (diff < minDiff) {
          minDiff = diff;
          bestPt = pt;
        }
      }
      return bestPt;
    }
    const ratio = driver2Data.length / driver1Data.length;
    const idx = Math.min(Math.round(scrubberPosition * ratio), driver2Data.length - 1);
    return driver2Data[idx] || null;
  }, [activePt1, driver2Data, scrubberPosition]);

  const activeDist = activePt1?.distance ? Math.round(activePt1.distance) : scrubberPosition;

  // Real track trace computed spline path
  const telemetryTrackPathD = useMemo(() => {
    const track = scaledTracks.d1Scaled;
    if (track.length === 0) return "";
    return track.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") + " Z";
  }, [scaledTracks.d1Scaled]);

  const car1Coord = scaledTracks.d1Scaled[scrubberPosition] || null;
  const car2Coord = useMemo(() => {
    if (scaledTracks.d2Scaled.length === 0) return null;
    if (activePt2) {
      const originalIdx = driver2Data.indexOf(activePt2);
      if (originalIdx !== -1) {
        return scaledTracks.d2Scaled[originalIdx] || null;
      }
    }
    return scaledTracks.d2Scaled[scrubberPosition] || null;
  }, [scaledTracks.d2Scaled, activePt2, driver2Data, scrubberPosition]);

  const stateConfig = STATE_CONFIG[live.state] || STATE_CONFIG.UNKNOWN;
  const trackStatus = live.session_info?.track_status || "GREEN";

  const DriverSelector = ({ value, onChange, color }: { value: string; onChange: (v: string) => void; color: string }) => (
    <div className="relative flex items-center">
      <span className="w-1.5 h-1.5 rounded-full mr-[-20px] z-10" style={{ backgroundColor: color }} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none pl-8 pr-6 py-1.5 rounded-lg text-[10px] font-sans font-bold cursor-pointer outline-none bg-white/5 border border-white/10 text-white uppercase tracking-wider"
      >
        {Object.entries(db).map(([num, d]) => (
          <option key={num} value={num} className="bg-[#101018]">{d.abbr} #{num}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none text-white/40" />
    </div>
  );

  // ── WAKING CONNECTION STATE ──
  if (live.state === "UNKNOWN" || live.is_waking) {
    return (
      <div className="p-6 lg:p-12 min-h-screen max-w-[1600px] mx-auto flex items-center justify-center relative">
        <div className="absolute top-[30%] left-[30%] w-[40%] h-[30%] bg-gradient-to-br from-apex-red/5 to-transparent blur-[120px] pointer-events-none z-0" />
        <div className="text-center space-y-6 z-10">
          <div className="w-14 h-14 rounded-3xl bg-white/[0.02] border border-white/5 flex items-center justify-center mx-auto">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}>
              <RefreshCw className="w-5 h-5 text-white/30" />
            </motion.div>
          </div>
          <h1 className="font-sans font-bold text-white text-xs tracking-widest uppercase">Initializing Race Center</h1>
          <p className="font-sans text-white/40 text-[10px] uppercase tracking-wider">
            Accessing open-source F1 telemetry streams
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-12 min-h-screen max-w-[1600px] mx-auto space-y-8 animate-fade-up relative">
      
      {/* Soft atmospheric blurred race backdrop */}
      <div className="absolute top-[5%] left-[20%] w-[65%] h-[30%] bg-gradient-to-br from-apex-red/5 via-[#27F4D2]/2 to-transparent blur-[130px] pointer-events-none rounded-full z-0" />

      {/* ── 1. CINEMATIC BROADCAST HEADER ──────────────────── */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 z-10 relative border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-3">
            {live.is_live ? (
              <span className="flex items-center gap-2 bg-[#ff3333]/10 border border-[#ff3333]/20 px-3 py-1 rounded-full text-[9px] font-bold text-[#ff3333] tracking-widest uppercase">
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                Live Broadcast
              </span>
            ) : isArchive ? (
              <span className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1 rounded-full text-[9px] font-bold text-white/50 tracking-widest uppercase">
                <Archive className="w-3.5 h-3.5 text-white/30" />
                Session Archive
              </span>
            ) : (
              <span className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1 rounded-full text-[9px] font-bold text-white/30 tracking-widest uppercase">
                <Clock className="w-3.5 h-3.5 text-white/20" />
                Standby Mode
              </span>
            )}
            <h1 className="font-sans font-bold text-white text-2xl tracking-tight uppercase leading-none">
              Race Center
            </h1>
          </div>
          
          <p className="font-sans text-white/40 text-[11px] font-bold tracking-widest uppercase mt-3.5 flex items-center gap-3">
            <span>{season} Season</span>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span>Round {selectedRound}</span>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span className="text-white/60">{raceLabel}</span>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span className="text-apex-red font-extrabold">{selectedSession}</span>
          </p>
        </div>

        {/* Live connections / session snapshots */}
        <div className="flex items-center gap-3 self-start xl:self-auto">
          {live.is_live && (
            <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.02] border border-white/5 rounded-xl text-[10px] text-white/40 font-bold uppercase tracking-wider">
              {live.ws_connected ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Telemetry Streaming
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  REST Fallback Mode
                </>
              )}
            </div>
          )}

          {live.last_update && (
            <span className="text-[9px] text-white/30 uppercase tracking-widest font-semibold">
              Updated {new Date(live.last_update).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* ── 2. ADAPTIVE STATUS ALERTS ──────────────────────── */}
      <TrackStatusBanner status={trackStatus} />
      {live.race_control.length > 0 && <RaceControlTicker messages={live.race_control} />}

      {/* ── 3. MODULAR MULTI-MODE LAYOUT GRID ──────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 z-10 relative">
        
        {/* LEFT COLUMN: Timing Tower (Always authentic and context-aware!) */}
        <div className="xl:col-span-1 space-y-6">
          <div className="flex justify-between items-center px-1">
            <span className="text-[10px] font-bold text-white/30 tracking-widest uppercase flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-white/20" />
              Timing Tower
            </span>
            {live.is_live && (
              <span className="text-[8px] bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider animate-pulse">
                Live Feed
              </span>
            )}
          </div>

          {live.is_live ? (
            <div className="bg-[#0b0b14]/30 rounded-3xl border border-white/[0.04] overflow-hidden">
              <LeaderboardTable
                rows={live.leaderboard}
                loading={false}
                expanded={expandedRow}
                setExpanded={setExpandedRow}
              />
            </div>
          ) : isArchive ? (
            <ArchiveLeaderboard
              year={season}
              round={selectedRound}
              session={selectedSession}
              expanded={expandedRow}
              setExpanded={setExpandedRow}
            />
          ) : (
            <div className="glass rounded-[24px] p-8 text-center flex flex-col items-center justify-center py-20 gap-4 border border-white/5">
              <Flag className="w-8 h-8 text-white/10" />
              <div>
                <h3 className="font-sans font-bold text-white text-xs tracking-widest uppercase">Timing Standby</h3>
                <p className="font-sans text-[10px] text-white/30 leading-relaxed uppercase tracking-wider mt-1.5">
                  Timing loops active during session schedules
                </p>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Cinematic Map, Telemetry, and Logs */}
        <div className="xl:col-span-2 space-y-6">
          
          {/* Segmented controls tabs */}
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-2xl border border-white/10 self-start backdrop-blur-md">
            {[
              { id: "circuit", label: "Circuit Profile", icon: Compass },
              { id: "telemetry", label: "Telemetry comparison", icon: Activity },
              { id: "logs", label: "Event Logs", icon: Radio }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setRightPanelTab(tab.id as any)}
                  className={`px-5 py-2 rounded-xl text-[10px] font-sans font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer flex items-center gap-2 ${
                    rightPanelTab === tab.id
                      ? "bg-white/10 text-white border border-white/10 shadow-lg"
                      : "text-white/45 hover:text-white/90 border border-transparent"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 text-white/30" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab 1: Circuit Profile & Live Stats */}
          {rightPanelTab === "circuit" && (
            <div className="glass rounded-[28px] p-8 space-y-8 border border-white/5">
              <div className="flex justify-between items-start border-b border-white/5 pb-6">
                <div>
                  <span className="text-[9px] text-white/30 tracking-widest uppercase font-bold">Track Profile</span>
                  <h3 className="font-sans font-bold text-white text-lg tracking-tight mt-1">{activeTrack.name}</h3>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-white/30 tracking-widest uppercase font-bold">Circuit Length</span>
                  <p className="font-sans font-bold text-sm text-white/80 mt-1">{activeTrack.length}</p>
                </div>
              </div>

              {/* Dynamic Track outline */}
              <div className="relative w-full h-[220px] flex items-center justify-center my-6">
                
                {/* Weather overlay for visual aesthetics */}
                {live.weather && (
                  <div className="absolute top-2 left-2 z-10">
                    <WeatherBar weather={live.weather} />
                  </div>
                )}

                {/* SVG path rendering */}
                {driver1Data.length > 0 && telemetryTrackPathD ? (
                  // Real-coordinate derived trace path!
                  <svg className="w-full h-full max-w-[340px]" viewBox="0 0 100 100">
                    <path
                      d={telemetryTrackPathD}
                      fill="none"
                      stroke="rgba(255,255,255,0.03)"
                      strokeWidth="5"
                      strokeLinecap="round"
                    />
                    <path
                      d={telemetryTrackPathD}
                      fill="none"
                      stroke="rgba(255,255,255,0.15)"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    
                    {/* synchronized telemetry scrubber dots */}
                    {car1Coord && (
                      <circle
                        cx={car1Coord.x}
                        cy={car1Coord.y}
                        r="3"
                        fill={DRIVER_COLOR_1}
                        className="shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                      />
                    )}
                    {car2Coord && (
                      <circle
                        cx={car2Coord.x}
                        cy={car2Coord.y}
                        r="3"
                        fill={DRIVER_COLOR_2}
                        className="shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                      />
                    )}
                  </svg>
                ) : (
                  // Official spline path outline
                  <svg className="w-full h-full max-w-[340px]" viewBox="0 0 120 100">
                    <defs>
                      <linearGradient id="circuit-glow" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="rgba(255,255,255,0.12)" stopOpacity={0.8} />
                        <stop offset="100%" stopColor="rgba(255,255,255,0.04)" stopOpacity={0.4} />
                      </linearGradient>
                      <linearGradient id="active-glow" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#ff3333" stopOpacity={1} />
                        <stop offset="100%" stopColor="#ff8800" stopOpacity={0.8} />
                      </linearGradient>
                    </defs>
                    <path
                      d={activeTrack.path}
                      fill="none"
                      stroke="rgba(255,255,255,0.01)"
                      strokeWidth="6"
                      strokeLinecap="round"
                    />
                    <path
                      d={activeTrack.path}
                      fill="none"
                      stroke="url(#circuit-glow)"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                    {/* Animated trace marker pulse */}
                    <path
                      d={activeTrack.path}
                      fill="none"
                      stroke="url(#active-glow)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      className="circuit-animate"
                    />
                  </svg>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 border-t border-white/5 pt-6 text-[11px] font-sans">
                <div>
                  <span className="text-[9px] text-white/30 uppercase tracking-widest font-bold">Laps Schedule</span>
                  <p className="font-sans font-bold text-white mt-1">{activeTrack.laps} Laps</p>
                </div>
                <div>
                  <span className="text-[9px] text-white/30 uppercase tracking-widest font-bold">DRS Zones</span>
                  <p className="font-sans font-bold text-white mt-1">{activeTrack.drs} Zones</p>
                </div>
                <div className="col-span-2 md:col-span-1 flex items-center md:justify-end gap-1.5 text-[9px] text-white/35 font-bold uppercase tracking-widest">
                  <Compass className="w-4 h-4 text-white/10 animate-spin-slow" /> Real Traces Map
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Lap Telemetry Comparison Area Charts */}
          {rightPanelTab === "telemetry" && (
            <div className="space-y-6">
              
              {/* Configuration panel */}
              <div className="glass rounded-[24px] p-6 border border-white/5 flex flex-wrap gap-4 items-center justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <DriverSelector value={driver1} onChange={setDriver1} color={DRIVER_COLOR_1} />
                  <span className="text-white/35 text-[9px] font-bold uppercase">VS</span>
                  <DriverSelector value={driver2} onChange={setDriver2} color={DRIVER_COLOR_2} />

                  <div className="h-6 w-px bg-white/10" />

                  <select
                    value={selectedSession}
                    onChange={(e) => setSelectedSession(e.target.value)}
                    className="appearance-none bg-white/5 border border-white/10 pl-4 pr-8 py-1.5 rounded-lg text-[10px] font-sans font-bold text-white outline-none cursor-pointer uppercase tracking-wider"
                  >
                    {["FP1", "FP2", "FP3", "Qualifying", "Sprint", "Race"].map(s => (
                      <option key={s} value={s} className="bg-[#101018]">{s}</option>
                    ))}
                  </select>

                  <select
                    value={selectedLap.toString()}
                    onChange={(e) => setSelectedLap(e.target.value === "all" ? "all" : parseInt(e.target.value))}
                    className="appearance-none bg-white/5 border border-white/10 pl-4 pr-8 py-1.5 rounded-lg text-[10px] font-sans font-bold text-white outline-none cursor-pointer uppercase tracking-wider"
                  >
                    <option value="all" className="bg-[#101018]">Fastest Lap</option>
                    {Array.from({ length: 70 }, (_, i) => i + 1).map(l => (
                      <option key={l} value={l} className="bg-[#101018]">Lap {l}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={loadTelemetry}
                  disabled={telemetryLoading}
                  className="px-4 py-2 rounded-xl text-[10px] font-sans font-bold tracking-widest uppercase transition-all hover:scale-105 active:scale-95 flex items-center gap-2 text-white bg-white/10 hover:bg-white/15 border border-white/10 disabled:opacity-60 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${telemetryLoading ? "animate-spin" : ""}`} />
                  {driver1Data.length > 0 ? "RELOAD" : "LOAD DATA"}
                </button>
              </div>

              {/* Loader or Empty states */}
              {telemetryLoading ? (
                <div className="space-y-4">
                  <div className="skeleton rounded-2xl h-24 bg-white/5" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Array(4).fill(0).map((_, i) => (
                      <div key={i} className="skeleton rounded-2xl h-20 bg-white/5" />
                    ))}
                  </div>
                </div>
              ) : driver1Data.length === 0 ? (
                <div className="glass rounded-[28px] border border-white/5 py-16 text-center flex flex-col items-center justify-center p-8 gap-4">
                  <Activity className="w-10 h-10 text-white/5" />
                  <h4 className="text-white font-sans font-bold text-xs tracking-widest uppercase">Telemetry Comparison Standby</h4>
                  <p className="text-white/35 text-[10px] font-sans leading-relaxed max-w-xs mx-auto uppercase tracking-wider">
                    {isArchive
                      ? "Select completed drivers to render lap telemetry logs side-by-side"
                      : "Telemetry logs and overlay comparison charts will compile once session completes"}
                  </p>
                  
                  {isArchive && (
                    <button
                      onClick={loadTelemetry}
                      className="px-5 py-2.5 bg-white text-black hover:bg-white/90 transition-all rounded-xl font-sans font-bold text-[10px] tracking-widest uppercase mt-4 shadow-lg cursor-pointer"
                    >
                      Load Telemetry Now
                    </button>
                  )}
                </div>
              ) : (
                // Loaded Telemetry Dashboard charts
                <div className="space-y-6">
                  
                  {/* Real-time playback Scrubber Controls */}
                  <div className="glass rounded-[24px] p-5 border border-white/5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setIsPlaying(!isPlaying)}
                          className="w-8 h-8 rounded-full flex items-center justify-center bg-white text-black hover:bg-white/90 transition-all shadow cursor-pointer"
                        >
                          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 pl-0.5" />}
                        </button>
                        <button
                          onClick={() => setScrubberPosition(0)}
                          className="p-2.5 rounded-full hover:bg-white/5 text-white/60 hover:text-white transition-all cursor-pointer"
                          title="Reset Scrubber"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[10px] font-sans font-semibold text-white/50">
                          Cursor: <strong className="text-white font-black">{scrubberPosition}</strong> / {driver1Data.length - 1} pts
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-xl border border-white/10">
                        {([1, 2, 4] as const).map(speed => (
                          <button
                            key={speed}
                            onClick={() => setPlaybackSpeed(speed)}
                            className={`px-3 py-1 rounded-lg text-[9px] font-sans font-bold transition-all cursor-pointer ${
                              playbackSpeed === speed
                                ? "bg-white/10 text-white shadow"
                                : "text-white/40 hover:text-white/80"
                            }`}
                          >
                            {speed}x
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Scrubber slider bar */}
                    <div className="relative pt-2">
                      <input
                        type="range"
                        min="0"
                        max={driver1Data.length - 1}
                        value={scrubberPosition}
                        onChange={(e) => setScrubberPosition(parseInt(e.target.value))}
                        className="w-full h-1 bg-white/10 rounded-full appearance-none outline-none cursor-pointer accent-white"
                      />
                    </div>
                  </div>

                  {/* Synchronized dials columns */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: "Speed", unit: "km/h", val1: activePt1?.speed, val2: activePt2?.speed, icon: Gauge },
                      { label: "Throttle", unit: "%", val1: activePt1?.throttle, val2: activePt2?.throttle, icon: Zap },
                      { label: "Brake", unit: "", val1: activePt1?.brake ? Math.round(activePt1.brake * 100) : 0, val2: activePt2?.brake ? Math.round(activePt2.brake * 100) : 0, icon: AlertTriangle },
                      { label: "Gear", unit: "", val1: activePt1?.gear, val2: activePt2?.gear, icon: Gauge },
                    ].map((dial, idx) => {
                      const Icon = dial.icon;
                      return (
                        <div key={idx} className="bg-white/[0.01] border border-white/5 rounded-2xl p-4 flex flex-col justify-between h-[100px]">
                          <div className="flex justify-between items-start">
                            <span className="text-[8px] text-white/30 font-bold uppercase tracking-widest">{dial.label}</span>
                            <Icon className="w-3.5 h-3.5 text-white/20" />
                          </div>
                          <div className="flex items-baseline justify-between mt-2">
                            <span className="font-sans font-bold text-base" style={{ color: DRIVER_COLOR_1 }}>
                              {dial.val1 ?? "—"} <span className="text-[8px] font-normal text-white/30 ml-0.5">{dial.unit}</span>
                            </span>
                            <span className="font-sans font-bold text-sm" style={{ color: DRIVER_COLOR_2 }}>
                              {dial.val2 ?? "—"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Telemetry charts */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ChartSection title="Velocity (km/h)" d1={driver1Data} d2={driver2Data} dataKey="speed" color1={DRIVER_COLOR_1} color2={DRIVER_COLOR_2} domain={[0, 350]} activeDist={activeDist} />
                    <ChartSection title="Throttle Index (%)" d1={driver1Data} d2={driver2Data} dataKey="throttle" color1={DRIVER_COLOR_1} color2={DRIVER_COLOR_2} domain={[0, 100]} activeDist={activeDist} />
                    <ChartSection title="Brake Control" d1={driver1Data} d2={driver2Data} dataKey="brake" color1={DRIVER_COLOR_1} color2={DRIVER_COLOR_2} domain={[0, 1]} activeDist={activeDist} />
                    <ChartSection title="Engine RPM" d1={driver1Data} d2={driver2Data} dataKey="rpm" color1={DRIVER_COLOR_1} color2={DRIVER_COLOR_2} activeDist={activeDist} />
                  </div>

                  {/* Premium telemetry coach comparison statistics */}
                  {telemetryAnalysis && (
                    <div className="glass rounded-[24px] p-6 border border-white/5 space-y-4">
                      <h4 className="text-[10px] font-bold text-white/60 uppercase tracking-widest flex items-center gap-2">
                        <Shield className="w-4 h-4 text-white/40" />
                        Paddock Intelligence Analysis
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-[11px] font-sans">
                        <div className="space-y-1">
                          <p className="text-[8px] text-white/30 font-bold uppercase tracking-widest">Max Speed Diff</p>
                          <p className="font-sans font-bold text-white">
                            {d1Meta.abbr}: <strong style={{ color: DRIVER_COLOR_1 }}>{telemetryAnalysis.d1MaxSpeed} km/h</strong> vs{" "}
                            {d2Meta.abbr}: <strong style={{ color: DRIVER_COLOR_2 }}>{telemetryAnalysis.d2MaxSpeed} km/h</strong>
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[8px] text-white/30 font-bold uppercase tracking-widest">Avg Throttle Index</p>
                          <p className="font-sans font-bold text-white">
                            {d1Meta.abbr}: <strong style={{ color: DRIVER_COLOR_1 }}>{telemetryAnalysis.d1AvgThrottle}%</strong> vs{" "}
                            {d2Meta.abbr}: <strong style={{ color: DRIVER_COLOR_2 }}>{telemetryAnalysis.d2AvgThrottle}%</strong>
                          </p>
                        </div>
                        <div className="space-y-1 col-span-2 md:col-span-1">
                          <p className="text-[8px] text-white/30 font-bold uppercase tracking-widest">Brake Percentage Zone</p>
                          <p className="font-sans font-bold text-white">
                            {d1Meta.abbr}: <strong style={{ color: DRIVER_COLOR_1 }}>{telemetryAnalysis.d1Brakes}%</strong> vs{" "}
                            {d2Meta.abbr}: <strong style={{ color: DRIVER_COLOR_2 }}>{telemetryAnalysis.d2Brakes}%</strong>
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {telemetryLoadedAt && (
                    <p className="text-right text-[8px] text-white/20 uppercase tracking-widest">
                      Telemetry comparison cached at {telemetryLoadedAt}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Event logs / messages console */}
          {rightPanelTab === "logs" && (
            <div className="glass rounded-[28px] p-6 space-y-4 border border-white/5">
              <span className="text-[10px] font-bold text-white/30 tracking-widest uppercase px-1">
                Broadcaster Race Control Feed
              </span>
              
              {live.race_control.length > 0 ? (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 hide-scrollbar">
                  {live.race_control.map((msg, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-white/[0.01] border border-white/5 rounded-xl text-xs font-sans text-white/70 flex items-start justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <span className="text-apex-red font-bold tracking-widest uppercase text-[9px] border border-apex-red/20 px-1.5 py-0.5 rounded bg-apex-red/5 mr-2">
                          {msg.flag || msg.category || "CONTROL"}
                        </span>
                        <span>{msg.message}</span>
                      </div>
                      
                      {msg.lap && (
                        <span className="text-white/30 font-semibold text-[10px] flex-shrink-0">Lap {msg.lap}</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
                  <Radio className="w-8 h-8 text-white/5" />
                  <p className="text-[10px] font-bold text-white/20 tracking-wider uppercase">No messages recorded</p>
                </div>
              )}
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
