import { LiveProviderNotice } from "@/components/LiveProviderNotice";
import { matchesSession } from "@/lib/session";
import type { LeaderboardEntry, TelemetryPoint, ScheduleEvent } from "@/lib/store";
import {
  parseRaceCenterSearch,
  getVerifiedEventLabel,
  type RaceCenterSearch,
} from "@/lib/event-identity";
import type { WeatherReading, RaceControlMsg, LiveDriver } from "@/hooks/useLiveSession";
import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useMemo, useRef } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { f1Api } from "@/lib/api/client";
import { useLiveSession, type SessionState } from "@/hooks/useLiveSession";
import { useSessionContext } from "@/hooks/useSessionContext";
import {
  useTelemetryStore,
  useCanonicalStore,
  getDriversListByYear,
  getDriverByYear,
} from "@/lib/store";
import {
  Radio,
  Archive,
  Clock,
  Thermometer,
  Wind,
  Droplets,
  CloudRain,
  AlertTriangle,
  Flag,
  RefreshCw,
  Play,
  Pause,
  RotateCcw,
  Zap,
  ChevronDown,
  ChevronRight,
  Activity,
  CalendarDays,
  Compass,
} from "lucide-react";
import { GlassPanel } from "@/components/GlassPanel";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/race-center")({
  head: () => ({
    meta: [
      { title: "ApexF1 — Race Center" },
      {
        name: "description",
        content: "Immersive real-time timing tower, weather logs, and visual race replays.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): RaceCenterSearch =>
    parseRaceCenterSearch(search),
  component: RaceCenter,
});

// ── Compound colors ──────────────────────────────────────────────────────────
const COMPOUND: Record<string, { color: string; label: string }> = {
  SOFT: { color: "#ff3333", label: "S" },
  MEDIUM: { color: "#ffd700", label: "M" },
  HARD: { color: "#ffffff", label: "H" },
  INTERMEDIATE: { color: "#39b54a", label: "I" },
  WET: { color: "#0067ff", label: "W" },
  UNKNOWN: { color: "#555", label: "?" },
};

// ── Track status → banner config ──────────────────────────────────────────────
const TRACK_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; pulse: boolean }
> = {
  GREEN: { label: "TRACK CLEAR", color: "#4ade80", bg: "rgba(74,222,128,0.04)", pulse: false },
  YELLOW: { label: "YELLOW FLAG", color: "#facc15", bg: "rgba(250,204,21,0.06)", pulse: true },
  SC: { label: "SAFETY CAR", color: "#fb923c", bg: "rgba(251,146,60,0.06)", pulse: true },
  VSC: { label: "VIRTUAL SC", color: "#fb923c", bg: "rgba(251,146,60,0.04)", pulse: false },
  RED: { label: "RED FLAG", color: "#ef4444", bg: "rgba(239,68,68,0.08)", pulse: true },
};

// ── State display config ──────────────────────────────────────────────────────
const STATE_CONFIG: Record<SessionState, { label: string; color: string; live: boolean }> = {
  UPCOMING: { label: "UPCOMING", color: "#60a5fa", live: false },
  WEEKEND: { label: "WEEKEND", color: "#a78bfa", live: false },
  FP1: { label: "PRACTICE 1", color: "#4ade80", live: true },
  FP2: { label: "PRACTICE 2", color: "#4ade80", live: true },
  FP3: { label: "PRACTICE 3", color: "#4ade80", live: true },
  QUALIFYING: { label: "QUALIFYING", color: "#facc15", live: true },
  SPRINT_Q: { label: "SPRINT QUAL", color: "#facc15", live: true },
  SPRINT: { label: "SPRINT", color: "#fb923c", live: true },
  RACE: { label: "GRAND PRIX", color: "#e10600", live: true },
  RED_FLAG: { label: "RED FLAG", color: "#ef4444", live: true },
  SC: { label: "SAFETY CAR", color: "#fb923c", live: true },
  VSC: { label: "VIRTUAL SC", color: "#fb923c", live: true },
  CHECKERED: { label: "FINISHED", color: "#9ca3af", live: false },
  ARCHIVE: { label: "ARCHIVE", color: "#60a5fa", live: false },
  WAKING: { label: "CONNECTING", color: "#9ca3af", live: false },
  UNKNOWN: { label: "LOADING", color: "#9ca3af", live: false },
};

// ── Shared Tyre Chip Widget ──
function TyreChip({ compound }: { compound?: string | null }) {
  if (!compound || compound === "UNKNOWN")
    return <span className="text-[9px] text-muted-foreground">Unavailable</span>;
  const key = (compound || "UNKNOWN").toUpperCase();
  const cfg = COMPOUND[key] || COMPOUND.UNKNOWN;
  return (
    <div
      className="w-5 h-5 rounded-full border flex items-center justify-center font-sans text-[8px] font-black flex-shrink-0"
      style={{ borderColor: cfg.color, color: cfg.color, background: `${cfg.color}05` }}
    >
      {cfg.label}
    </div>
  );
}

// ── Weather Bar component ──
function WeatherBar({ weather }: { weather: WeatherReading }) {
  if (!weather) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-muted-foreground text-[10px] font-mono tracking-wider font-bold">
      <span className="flex items-center gap-1.5">
        <Thermometer className="w-3.5 h-3.5" />
        {weather.air_temp?.toFixed(0) ?? "—"}° air / {weather.track_temp?.toFixed(0) ?? "—"}° track
      </span>
      <span className="flex items-center gap-1.5">
        <Wind className="w-3.5 h-3.5" />
        {weather.wind_speed?.toFixed(0) ?? "—"} m/s
      </span>
      <span className="flex items-center gap-1.5">
        <Droplets className="w-3.5 h-3.5" />
        {weather.humidity?.toFixed(0) ?? "—"}% hum
      </span>
      {weather.observed_at && (
        <span className="text-xs">
          Observed {new Date(weather.observed_at).toLocaleTimeString()}
        </span>
      )}
      {weather.rainfall && (
        <span className="flex items-center gap-1.5 text-primary animate-pulse font-bold">
          <CloudRain className="w-3.5 h-3.5 animate-bounce" /> WET TRACK
        </span>
      )}
    </div>
  );
}

// ── Track Status Warning Banner ──
function TrackStatusBanner({ status }: { status: string }) {
  const cfg = TRACK_STATUS_CONFIG[status] || TRACK_STATUS_CONFIG.GREEN;
  if (status === "GREEN" || status === "UNKNOWN" || !status) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 px-5 py-2.5 rounded-xl border text-[10px] font-mono tracking-widest uppercase mb-4"
      style={{ borderColor: `${cfg.color}20`, background: cfg.bg, color: cfg.color }}
    >
      <AlertTriangle className="w-4 h-4" />
      {cfg.label}
      {cfg.pulse && (
        <span
          className="ml-auto w-2 h-2 rounded-full animate-pulse"
          style={{ background: cfg.color }}
        />
      )}
    </motion.div>
  );
}

// ── Race Control messages ticker ──
function RaceControlTicker({ messages }: { messages: RaceControlMsg[] }) {
  if (!messages || messages.length === 0) return null;
  const latest = messages[0];
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-white/[0.01] border border-border/40 rounded-xl text-[11px] font-sans text-muted-foreground leading-none">
      <span className="text-primary font-bold tracking-wider flex-shrink-0 uppercase text-[9px] border border-primary/20 px-1.5 py-0.5 rounded bg-primary/5">
        {latest.flag || latest.category || "CONTROL"}
      </span>
      <span className="truncate text-foreground/80">{latest.message}</span>
      {latest.lap && (
        <span className="text-muted-foreground ml-auto flex-shrink-0 font-mono text-[9px]">
          Lap {latest.lap}
        </span>
      )}
    </div>
  );
}

// ── Telemetry comparison AreaChart Section ──
function ChartSection({
  title,
  d1,
  d2,
  dataKey,
  color1,
  color2,
  domain,
  activeDist,
}: {
  title: string;
  d1: TelemetryPoint[];
  d2: TelemetryPoint[];
  dataKey: keyof TelemetryPoint;
  color1: string;
  color2: string;
  domain?: [number, number];
  activeDist: number;
}) {
  const merged = useMemo(() => {
    return d1.map((p, i) => ({
      dist: p.distance ? Math.round(p.distance) : p.time ? Math.round(p.time * 10) : i,
      driver1: p[dataKey],
      driver2: d2[i]?.[dataKey],
    }));
  }, [d1, d2, dataKey]);

  return (
    <div className="bg-white/[0.01] border border-border/40 rounded-2xl p-4 shadow-xl">
      <h3 className="font-mono font-bold text-muted-foreground text-[9px] tracking-widest mb-3 uppercase flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color1 }} />
        {title}
      </h3>
      <ResponsiveContainer width="100%" height={90}>
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
          <YAxis
            domain={domain}
            tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 8, fontFamily: "monospace" }}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip
            cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }}
            contentStyle={{
              background: "rgba(10,10,18,0.95)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12,
              fontSize: 9,
              fontFamily: "sans-serif",
              color: "#fff",
              padding: "4px 8px",
            }}
            labelStyle={{ display: "none" }}
          />
          <Area
            type="monotone"
            dataKey="driver1"
            stroke={color1}
            fill={`url(#g1-${dataKey})`}
            strokeWidth={1}
            dot={false}
            activeDot={false}
          />
          <Area
            type="monotone"
            dataKey="driver2"
            stroke={color2}
            fill={`url(#g2-${dataKey})`}
            strokeWidth={1}
            dot={false}
            activeDot={false}
          />
          {activeDist > 0 && (
            <ReferenceLine
              x={activeDist}
              stroke="rgba(255,255,255,0.3)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Shared Leaderboard Table ──
function LeaderboardTable({
  rows,
  loading,
  expanded,
  setExpanded,
}: {
  rows: (LeaderboardEntry | LiveDriver)[];
  loading: boolean;
  expanded: string | null;
  setExpanded: (v: string | null) => void;
}) {
  if (loading) {
    return (
      <div className="p-4 space-y-2">
        {Array(8)
          .fill(0)
          .map((_, i) => (
            <div
              key={i}
              className="h-12 skeleton rounded-xl bg-white/5"
              style={{ opacity: 1 - i * 0.08 }}
            />
          ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="py-20 flex flex-col items-center gap-4 text-center">
        <Radio className="w-10 h-10 text-muted-foreground/10" />
        <p className="text-[10px] font-mono font-bold text-muted-foreground tracking-widest uppercase">
          No timing data active
        </p>
      </div>
    );
  }

  const COLS = "28px minmax(64px, 1fr) minmax(60px, 90px) 30px 58px 62px 28px";

  return (
    <div
      className="overflow-x-auto focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded-b-2xl scrollbar-thin"
      tabIndex={0}
      role="region"
      aria-label="Timing Tower Leaderboard"
    >
      <div
        className="grid items-center px-4 py-3 border-b border-border/40 bg-white/[0.005] min-w-[340px] text-[8px] font-mono text-muted-foreground tracking-widest uppercase font-bold"
        style={{ gridTemplateColumns: COLS }}
      >
        <span>Pos</span>
        <span>Driver</span>
        <span>Constructor</span>
        <span className="text-center">Tyre</span>
        <span className="text-right">Gap</span>
        <span className="text-right">Last Lap</span>
        <span className="text-center">Pits</span>
      </div>

      <AnimatePresence initial={false}>
        {rows.map((entry, i) => {
          const isExp = expanded === entry.driver_number;
          const teamCol = entry.team_color || "#888";
          const isTop3 = entry.position !== null && entry.position >= 1 && entry.position <= 3;

          return (
            <motion.div
              key={entry.driver_number}
              layout="position"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: Math.min(i * 0.012, 0.3) }}
              className="border-b border-border/20 last:border-0 min-w-[340px]"
            >
              <div
                className="grid items-center px-4 py-3.5 cursor-pointer hover:bg-foreground/[0.015] transition-colors"
                style={{
                  gridTemplateColumns: COLS,
                  borderLeft: `3px solid ${isTop3 ? teamCol : "transparent"}`,
                }}
                role="button"
                tabIndex={0}
                aria-expanded={isExp}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setExpanded(isExp ? null : entry.driver_number);
                  }
                }}
                onClick={() => setExpanded(isExp ? null : entry.driver_number)}
              >
                {/* Pos */}
                <span
                  className="font-mono text-xs font-bold"
                  style={{ color: i === 0 ? "var(--primary)" : "var(--muted-foreground)" }}
                >
                  {entry.position || "—"}
                </span>

                {/* Driver */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="font-display text-base font-bold text-foreground">
                    {entry.abbreviation}
                  </span>
                  <span className="font-mono text-[9px] text-muted-foreground font-bold hidden md:block truncate">
                    {entry.driver_name}
                  </span>
                </div>

                {/* Team */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="h-3 w-1 shrink-0 rounded" style={{ backgroundColor: teamCol }} />
                  <span className="font-mono text-[10px] text-muted-foreground truncate">
                    {entry.team}
                  </span>
                </div>

                {/* Tyre */}
                <div className="flex justify-center">
                  <TyreChip compound={entry.current_tyre} />
                </div>

                {/* Gap */}
                <div className="text-right truncate">
                  <span className="font-mono text-[10px] font-semibold text-muted-foreground">
                    {entry.position === 1 ? "LEADER" : entry.gap_to_leader || "—"}
                  </span>
                </div>

                {/* Last lap */}
                <div className="text-right truncate">
                  <span className="font-mono text-[10px] font-semibold text-foreground/80">
                    {entry.last_lap || "—"}
                  </span>
                </div>

                {/* Pits */}
                <div className="text-center">
                  <span className="font-mono text-muted-foreground text-[10px]">
                    {entry.pits ?? "—"}
                  </span>
                </div>
              </div>

              {/* Expanded detail */}
              <AnimatePresence>
                {isExp && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden bg-white/[0.005] border-t border-border/20"
                  >
                    <div className="px-14 py-3 flex flex-wrap gap-6 text-[9px] font-mono text-muted-foreground font-semibold">
                      <div>
                        <span className="text-[8px] text-muted-foreground/50 mr-2 uppercase">
                          Best Lap
                        </span>
                        <span className="text-foreground">{entry.best_lap || "—"}</span>
                      </div>
                      <div>
                        <span className="text-[8px] text-muted-foreground/50 mr-2 uppercase">
                          Tyre Age
                        </span>
                        <span className="text-foreground">{entry.tyre_age ?? "—"} laps</span>
                      </div>
                      <div>
                        <span className="text-[8px] text-muted-foreground/50 mr-2 uppercase">
                          Interval
                        </span>
                        <span className="text-foreground">{entry.interval || "—"}</span>
                      </div>
                      {entry.speed && (
                        <div>
                          <span className="text-[8px] text-muted-foreground/50 mr-2 uppercase">
                            Speed
                          </span>
                          <span className="text-foreground">{entry.speed} km/h</span>
                        </div>
                      )}
                      <div>
                        <span className="text-[8px] text-muted-foreground/50 mr-2 uppercase">
                          Status
                        </span>
                        <span className="text-primary font-bold">
                          {entry.status || "Unavailable"}
                        </span>
                      </div>
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
function ArchiveLeaderboard({
  year,
  round,
  session,
  expanded,
  setExpanded,
}: {
  year: number;
  round: number;
  session: string;
  expanded: string | null;
  setExpanded: (v: string | null) => void;
}) {
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData([]);
    f1Api
      .getLeaderboard(year, round, session)
      .then((res) => {
        if (cancelled) return;
        const d = Array.isArray(res) ? res : (res?.data ?? []);
        setData(d);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Official archive classification is unavailable for this session.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [year, round, session]);

  return (
    <div className="bg-[#0b0b14]/10 rounded-3xl border border-border/40 overflow-hidden">
      <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
        <span className="text-[10px] font-mono font-bold text-muted-foreground tracking-widest uppercase">
          Leaderboard Results
        </span>
        {loading && <RefreshCw className="w-3.5 h-3.5 text-muted-foreground animate-spin" />}
      </div>
      {error ? (
        <div className="p-6 text-center space-y-2">
          <AlertTriangle className="w-5 h-5 text-amber-500 mx-auto" />
          <p className="text-xs font-mono text-muted-foreground">{error}</p>
        </div>
      ) : (
        <LeaderboardTable
          rows={data}
          loading={loading}
          expanded={expanded}
          setExpanded={setExpanded}
        />
      )}
    </div>
  );
}

function RaceCenter() {
  const live = useLiveSession();
  const search = Route.useSearch();
  const context = useSessionContext();
  const { selectedLap } = context;
  const season = search.year ?? context.season;
  const selectedRound = search.round ?? context.selectedRound;
  const selectedSession = search.session ?? context.selectedSession;

  // Cross-year event resolution: query schedule for the requested season if different from context
  const [resolvedSchedule, setResolvedSchedule] = useState<ScheduleEvent[] | null>(
    context.season === season && context.schedule.length > 0 ? context.schedule : null,
  );
  const [scheduleLoading, setScheduleLoading] = useState<boolean>(
    context.season !== season || context.schedule.length === 0,
  );

  useEffect(() => {
    if (context.season === season && context.schedule.length > 0) {
      setResolvedSchedule(context.schedule);
      setScheduleLoading(false);
      return;
    }

    let cancelled = false;
    setScheduleLoading(true);

    f1Api
      .getSchedule(season)
      .then((res) => {
        if (cancelled) return;
        setResolvedSchedule(res.data || []);
        setScheduleLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setResolvedSchedule([]);
        setScheduleLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [season, context.season, context.schedule]);

  const activeSchedule =
    context.season === season && context.schedule.length > 0
      ? context.schedule
      : resolvedSchedule || [];

  const event = activeSchedule.find((e) => e.round_number === selectedRound);
  const eventLabelInfo = getVerifiedEventLabel(event, scheduleLoading);
  const raceLabel = eventLabelInfo.label;

  const isArchiveSession =
    search.mode === "archive" ||
    search.mode === "replay" ||
    Boolean(event?.is_completed) ||
    season < new Date().getFullYear();

  const showLive =
    !isArchiveSession &&
    search.mode !== "archive" &&
    search.mode !== "replay" &&
    live.is_live &&
    live.session_info?.year === season &&
    live.session_info?.session_name === selectedSession &&
    matchesSession(event, selectedSession, live.session_info?.date_start);
  const {
    driver1,
    driver2,
    driver1Data,
    driver2Data,
    scrubberPosition,
    isPlaying,
    setDriver1,
    setDriver2,
    setDriver1Data,
    setDriver2Data,
    setScrubberPosition,
    setIsPlaying,
  } = useTelemetryStore();

  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [rightPanelTab, setRightPanelTab] = useState<"circuit" | "telemetry" | "logs">("circuit");

  const [telemetryLoading, setTelemetryLoading] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [showDetailedTelemetry, setShowDetailedTelemetry] = useState(false);

  const db = getDriversListByYear(season);
  const d1Meta = getDriverByYear(season, driver1);
  const d2Meta = getDriverByYear(season, driver2);

  const DRIVER_COLOR_1 = d1Meta.color || "#e10600";
  const DRIVER_COLOR_2 = d2Meta.color || "#27F4D2";

  const telemetryAnalysis = useMemo(() => {
    if (driver1Data.length === 0) return null;
    const d1Speeds = driver1Data.map((p) => p.speed || 0);
    const d2Speeds = driver2Data.map((p) => p.speed || 0);

    const d1MaxSpeed = Math.max(...d1Speeds);
    const d2MaxSpeed = driver2Data.length > 0 ? Math.max(...d2Speeds) : 0;

    const d1AvgThrottle =
      driver1Data.reduce((acc, p) => acc + (p.throttle || 0), 0) / driver1Data.length;
    const d2AvgThrottle =
      driver2Data.length > 0
        ? driver2Data.reduce((acc, p) => acc + (p.throttle || 0), 0) / driver2Data.length
        : 0;

    const d1Brakes =
      (driver1Data.filter((p) => (p.brake || 0) > 0.1).length / driver1Data.length) * 100;
    const d2Brakes =
      driver2Data.length > 0
        ? (driver2Data.filter((p) => (p.brake || 0) > 0.1).length / driver2Data.length) * 100
        : 0;

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

  const scaledTracks = useMemo(() => {
    const combined = [...driver1Data, ...driver2Data].filter(
      (p) => typeof p.x === "number" && typeof p.y === "number",
    );
    if (combined.length === 0) return { d1Scaled: [], d2Scaled: [] };

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    combined.forEach((p) => {
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

    const scaleList = (list: TelemetryPoint[]) => {
      return list
        .filter((p) => typeof p.x === "number" && typeof p.y === "number")
        .map((p) => ({
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

  const telemetryRequest = useRef(0);
  async function loadTelemetry() {
    const request = ++telemetryRequest.current;
    setDriver1Data([]);
    setDriver2Data([]);
    setTelemetryLoading(true);
    setIsPlaying(false);
    setScrubberPosition(0);
    try {
      const [r1, r2] = await Promise.allSettled([
        f1Api.getTelemetry(
          season,
          selectedRound,
          selectedSession,
          driver1,
          selectedLap === "all" ? undefined : (selectedLap as number),
        ),
        f1Api.getTelemetry(
          season,
          selectedRound,
          selectedSession,
          driver2,
          selectedLap === "all" ? undefined : (selectedLap as number),
        ),
      ]);
      if (request !== telemetryRequest.current) return;
      const d1 = r1.status === "fulfilled" ? r1.value.data || [] : [];
      const d2 = r2.status === "fulfilled" ? r2.value.data || [] : [];
      setDriver1Data(d1);
      setDriver2Data(d2);
      const sessionKey = `${season}-${selectedRound}-${selectedSession}`;
      const hasPoints = d1.length > 0 || d2.length > 0;
      useCanonicalStore.getState().setTelemetryAvailability(sessionKey, hasPoints);
    } catch (e) {
      console.error("[Telemetry] load failed:", e);
      const sessionKey = `${season}-${selectedRound}-${selectedSession}`;
      useCanonicalStore.getState().setTelemetryAvailability(sessionKey, false);
    } finally {
      if (request === telemetryRequest.current) setTelemetryLoading(false);
    }
  }

  useEffect(() => {
    setDriver1Data([]);
    setDriver2Data([]);
    setIsPlaying(false);
    setScrubberPosition(0);
    telemetryRequest.current += 1;
    setTelemetryLoading(false);
    return () => {
      telemetryRequest.current += 1;
    };
  }, [
    season,
    selectedRound,
    selectedSession,
    driver1,
    driver2,
    selectedLap,
    setDriver1Data,
    setDriver2Data,
    setIsPlaying,
    setScrubberPosition,
  ]);

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
  }, [activePt1, driver2Data, scrubberPosition, driver1Data.length]);

  const activeDist = activePt1?.distance ? Math.round(activePt1.distance) : scrubberPosition;

  const telemetryTrackPathD = useMemo(() => {
    const track = scaledTracks.d1Scaled;
    if (track.length === 0) return "";
    return (
      track.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") +
      " Z"
    );
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

  const trackStatus = showLive ? live.session_info?.track_status || "UNKNOWN" : "UNKNOWN";

  const DriverSelector = ({
    value,
    onChange,
    color,
  }: {
    value: string;
    onChange: (v: string) => void;
    color: string;
  }) => (
    <div className="relative flex items-center">
      <span
        className="w-1.5 h-1.5 rounded-full mr-[-20px] z-10"
        style={{ backgroundColor: color }}
      />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none pl-8 pr-7 py-1.5 rounded-lg text-[9px] font-mono font-bold cursor-pointer outline-none bg-white/5 border border-border/40 text-foreground uppercase tracking-wider"
      >
        {Object.entries(db).map(([num, d]) => (
          <option key={num} value={num} className="bg-background">
            {d.abbr} #{num}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none text-muted-foreground" />
    </div>
  );

  if (search.error) {
    return (
      <div className="min-h-screen px-6 pb-32 pt-12 lg:px-12 flex items-center justify-center">
        <GlassPanel className="p-8 max-w-lg text-center space-y-4 border border-rose-500/30">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-500">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="font-display text-2xl text-foreground">Invalid Race Center Link</h2>
          <p className="text-xs font-mono text-muted-foreground leading-relaxed">{search.error}</p>
          <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
            <a
              href="/race-center"
              className="px-4 py-2 rounded-full bg-foreground text-background text-xs font-bold transition hover:bg-foreground/90"
            >
              Current Session
            </a>
            <a
              href={`/race-center?year=${context.season}&round=${context.selectedRound}&session=Race`}
              className="px-4 py-2 rounded-full glass text-xs font-bold transition hover:bg-white/10"
            >
              {context.season} Round {context.selectedRound}
            </a>
          </div>
        </GlassPanel>
      </div>
    );
  }

  if (scheduleLoading && !event) {
    return (
      <div className="min-h-screen px-6 pb-32 pt-12 lg:px-12 flex items-center justify-center">
        <div className="text-center space-y-4">
          <RefreshCw className="w-10 h-10 text-muted-foreground/30 animate-spin mx-auto" />
          <div className="font-display text-2xl">Resolving Race Schedule</div>
          <p className="text-xs text-muted-foreground uppercase font-mono tracking-widest">
            Loading {season} Round {selectedRound}
          </p>
        </div>
      </div>
    );
  }

  if (!scheduleLoading && !event && activeSchedule.length > 0) {
    return (
      <div className="min-h-screen px-6 pb-32 pt-12 lg:px-12 flex items-center justify-center">
        <GlassPanel className="p-8 max-w-lg text-center space-y-4 border border-amber-500/30">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-500">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="font-display text-2xl text-foreground">Round Unavailable</h2>
          <p className="text-xs font-mono text-muted-foreground leading-relaxed">
            Round {selectedRound} was not found in the {season} Formula 1 calendar (
            {activeSchedule.length} rounds total).
          </p>
          <div className="pt-4 flex items-center justify-center gap-3">
            <a
              href={`/race-center?year=${season}&round=1&session=Race&mode=archive`}
              className="px-4 py-2 rounded-full bg-foreground text-background text-xs font-bold transition hover:bg-foreground/90"
            >
              View {season} Round 1
            </a>
          </div>
        </GlassPanel>
      </div>
    );
  }

  if (!isArchiveSession && !event && live.is_waking) {
    return (
      <div className="min-h-screen px-6 pb-32 pt-12 lg:px-12 flex items-center justify-center">
        <div className="text-center space-y-4">
          <RefreshCw className="w-10 h-10 text-muted-foreground/30 animate-spin mx-auto" />
          <div className="font-display text-2xl">Initializing Race Feed</div>
          <p className="text-xs text-muted-foreground uppercase font-mono tracking-widest">
            Loading session data
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 pb-32 pt-12 lg:px-12 space-y-6">
      <LiveProviderNotice />
      {showLive && live.status === "partial" && (
        <p role="status" className="glass p-4 text-sm">
          Partial live coverage: {Object.keys(live.errors ?? {}).join(", ")} unavailable. Available
          channels remain visible.
        </p>
      )}
      {showLive && live.leaderboard.length > 0 && (
        <details className="glass rounded-xl p-4">
          <summary className="cursor-pointer py-2">Latest recorded laps and sectors</summary>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {[
                    "Driver",
                    "Lap",
                    "Last lap",
                    "Best lap",
                    "Sector 1 (s)",
                    "Sector 2 (s)",
                    "Sector 3 (s)",
                  ].map((h) => (
                    <th className="p-3 text-left" key={h}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {live.leaderboard.map((d) => (
                  <tr key={d.driver_number} className="border-t border-border">
                    <th className="p-3 text-left">{d.driver_name}</th>
                    <td>{d.lap_number ?? "—"}</td>
                    <td>{d.last_lap ?? "—"}</td>
                    <td>{d.best_lap ?? "—"}</td>
                    <td>{d.sector1 ?? "—"}</td>
                    <td>{d.sector2 ?? "—"}</td>
                    <td>{d.sector3 ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground my-2">
            Completed provider lap records. Missing fields are unavailable; these are not
            interpolated sensor readings.
          </p>
        </details>
      )}
      {!isArchiveSession && !live.is_live && (
        <p role="status" className="glass rounded-xl p-4 text-sm">
          Live timing is unavailable, stale or disconnected. No cached rows are presented as current
          timing. Select an archive session for recorded data.
        </p>
      )}
      {event?.has_conflict && event.conflict && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3 text-xs font-mono text-amber-200/90">
          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <div className="font-bold uppercase tracking-wider text-amber-400 text-[10px]">
              Event Identity Disagreement
            </div>
            <div>{event.conflict.description}</div>
            <div className="text-[10px] text-muted-foreground">
              FastF1: {String(event.conflict.fastf1?.event_name || "")} (
              {String(event.conflict.fastf1?.country || "")},{" "}
              {String(event.conflict.fastf1?.location || "")}) · Jolpica:{" "}
              {String(event.conflict.jolpica?.event_name || "")} (
              {String(event.conflict.jolpica?.country || "")},{" "}
              {String(event.conflict.jolpica?.location || "")},{" "}
              {String(event.conflict.jolpica?.circuit_name || "")})
            </div>
          </div>
        </div>
      )}
      {/* 1. BROADCAST PANEL */}
      <div className="flex flex-wrap items-center justify-between gap-6 border-b border-border/40 pb-6 z-10 relative">
        <div>
          <div className="flex items-center gap-3">
            {showLive ? (
              <span className="flex items-center gap-2 bg-[#ff3333]/15 border border-[#ff3333]/30 px-3 py-1 rounded-full text-[9px] font-mono font-bold text-[#ff3333] tracking-widest uppercase">
                <Radio className="w-3.5 h-3.5 animate-pulse" /> LIVE STREAM
              </span>
            ) : (
              <span className="flex items-center gap-2 bg-white/5 border border-border/40 px-3 py-1 rounded-full text-[9px] font-mono font-bold text-muted-foreground tracking-widest uppercase">
                <Archive className="w-3.5 h-3.5" /> ARCHIVE ANALYSIS
              </span>
            )}
            <h1 className="font-display text-4xl leading-none">Race Center</h1>
          </div>
          <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-widest mt-3 flex items-center gap-3 font-bold">
            <span>{season} · Grand Prix Weekend</span>
            <span className="w-1 h-1 rounded-full bg-border" />
            <span>Round {selectedRound}</span>
            <span className="w-1 h-1 rounded-full bg-border" />
            <span className="text-foreground/80">{raceLabel}</span>
            <span className="w-1 h-1 rounded-full bg-border" />
            <span className="text-primary font-black">{selectedSession}</span>
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          {showLive && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.02] border border-border/40 rounded-xl text-[9px] text-muted-foreground font-bold uppercase tracking-wider">
              {live.ws_connected ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> timing
                  loops live
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> timing
                  loops polling
                </>
              )}
            </div>
          )}
          {showLive && live.last_update && (
            <span className="text-muted-foreground/60 text-[9px] uppercase tracking-widest font-semibold">
              Updated {new Date(live.last_update).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* 2. LIVE STATE ALERTS */}
      <TrackStatusBanner status={trackStatus} />
      {live.race_control.length > 0 && <RaceControlTicker messages={live.race_control} />}

      {/* 3. CORE TWO-COLUMN BROADCAST VIEW */}
      <div className="grid gap-6 xl:grid-cols-3">
        {/* LEFT COLUMN: Timing Tower */}
        <div className="xl:col-span-1 min-w-0 space-y-4">
          <div className="flex justify-between items-center px-1">
            <span className="text-[10px] font-mono font-bold text-muted-foreground tracking-widest uppercase flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-muted-foreground/45" /> Timing Tower
            </span>
          </div>

          {showLive ? (
            <div className="bg-[#0b0b14]/10 rounded-3xl border border-border/40 overflow-hidden">
              <LeaderboardTable
                rows={live.leaderboard}
                loading={false}
                expanded={expandedRow}
                setExpanded={setExpandedRow}
              />
            </div>
          ) : isArchiveSession ? (
            <ArchiveLeaderboard
              year={season}
              round={selectedRound}
              session={selectedSession}
              expanded={expandedRow}
              setExpanded={setExpandedRow}
            />
          ) : (
            <GlassPanel className="p-8 py-20 text-center flex flex-col items-center justify-center gap-4 border border-border/40">
              <Flag className="w-8 h-8 text-muted-foreground/30" />
              <div>
                <h3 className="font-display text-2xl">Live timing is offline</h3>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed max-w-xs mx-auto">
                  Live timing appears when the session begins. Enjoy telemetry replays and calendar
                  synchronization.
                </p>
              </div>
            </GlassPanel>
          )}
        </div>

        {/* RIGHT COLUMN: Interactive Telemetry Compare / Circuit Vector */}
        <div className="xl:col-span-2 min-w-0 space-y-4">
          {/* Segmented controls tabs */}
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-2xl border border-border/40 self-start backdrop-blur-md max-w-max">
            {[
              { id: "circuit", label: "Circuit Profile", icon: Compass },
              { id: "telemetry", label: "Telemetry compare", icon: Activity },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setRightPanelTab(tab.id as "circuit" | "telemetry" | "logs")}
                  className={cn(
                    "px-4 py-2 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider transition duration-300 flex items-center gap-1.5",
                    rightPanelTab === tab.id
                      ? "bg-foreground/10 text-foreground border border-transparent shadow-lg"
                      : "text-muted-foreground hover:text-foreground border border-transparent",
                  )}
                >
                  <Icon className="w-3.5 h-3.5 text-muted-foreground/50" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* TAB 1: Circuit Profile */}
          {rightPanelTab === "circuit" && (
            <GlassPanel className="p-6 space-y-6 border border-border/40">
              <div className="flex justify-between items-start border-b border-border/20 pb-4">
                <div>
                  <span className="text-[9px] font-mono text-muted-foreground/60 tracking-widest uppercase font-bold">
                    Track Profile
                  </span>
                  <h3 className="font-display text-2xl mt-1">{raceLabel}</h3>
                </div>
                {showLive && live.weather && <WeatherBar weather={live.weather} />}
              </div>

              {telemetryTrackPathD ? (
                <svg
                  aria-label="Circuit trace from archived telemetry"
                  className="w-full h-[220px]"
                  viewBox="0 0 100 100"
                >
                  <path
                    d={telemetryTrackPathD}
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth="1"
                  />
                </svg>
              ) : (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  Verified circuit geometry unavailable. Load an archived lap in Telemetry to view
                  its recorded trace.
                </p>
              )}
            </GlassPanel>
          )}

          {/* TAB 2: Telemetry compare */}
          {rightPanelTab === "telemetry" && (
            <div className="space-y-4">
              <GlassPanel className="p-6 border border-border/40 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/20 pb-4">
                  <div className="flex items-center gap-3">
                    <DriverSelector value={driver1} onChange={setDriver1} color={DRIVER_COLOR_1} />
                    <span className="text-muted-foreground/30 font-mono text-xs">VS</span>
                    <DriverSelector value={driver2} onChange={setDriver2} color={DRIVER_COLOR_2} />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={loadTelemetry}
                      disabled={telemetryLoading}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-bold text-background transition hover:bg-foreground/90 disabled:opacity-50"
                    >
                      {telemetryLoading ? "Loading traces..." : "Sync telemetry"}
                    </button>
                  </div>
                </div>

                {driver1Data.length > 0 ? (
                  <div
                    className={cn(
                      "grid gap-6",
                      showDetailedTelemetry ? "lg:grid-cols-[1.2fr_1fr]" : "grid-cols-1",
                    )}
                  >
                    {/* Visual Spline coordinate maps */}
                    <div>
                      <div className="text-[9px] font-mono tracking-widest text-muted-foreground uppercase font-bold mb-4">
                        Archived lap position
                      </div>
                      <div className="relative aspect-[16/10] w-full rounded-2xl bg-gradient-to-br from-surface to-background/50 border border-border/40 p-4 flex items-center justify-center">
                        <svg
                          className="w-full h-full max-h-[260px] max-w-[340px]"
                          viewBox="0 0 100 100"
                        >
                          <path
                            d={telemetryTrackPathD}
                            fill="none"
                            stroke="rgba(255,255,255,0.03)"
                            strokeWidth="4"
                            strokeLinecap="round"
                          />
                          <path
                            d={telemetryTrackPathD}
                            fill="none"
                            stroke="var(--primary) opacity-20"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />

                          {/* Active car coordinates indicator */}
                          {car1Coord && (
                            <circle
                              cx={car1Coord.x}
                              cy={car1Coord.y}
                              r="3.5"
                              fill={DRIVER_COLOR_1}
                            />
                          )}
                          {car2Coord && (
                            <circle
                              cx={car2Coord.x}
                              cy={car2Coord.y}
                              r="3.5"
                              fill={DRIVER_COLOR_2}
                            />
                          )}
                        </svg>
                      </div>

                      {/* Scrubber panel controls */}
                      <div className="mt-4 flex items-center justify-between gap-4 bg-white/[0.01] border border-border/40 p-4 rounded-2xl">
                        <div className="flex items-center gap-2.5">
                          <button
                            aria-label={isPlaying ? "Pause lap playback" : "Play lap playback"}
                            onClick={() => setIsPlaying(!isPlaying)}
                            className="h-8 w-8 rounded-full bg-foreground text-background flex items-center justify-center hover:scale-105 transition"
                          >
                            {isPlaying ? (
                              <Pause className="h-4.5 w-4.5 fill-current" />
                            ) : (
                              <Play className="h-4.5 w-4.5 fill-current ml-0.5" />
                            )}
                          </button>
                          <button
                            aria-label="Restart lap playback"
                            onClick={() => setScrubberPosition(0)}
                            className="h-8 w-8 rounded-full glass flex items-center justify-center hover:bg-white/10 transition"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="flex-1 px-4">
                          <input
                            aria-label="Lap position"
                            type="range"
                            min="0"
                            max={driver1Data.length - 1}
                            value={scrubberPosition}
                            onChange={(e) => setScrubberPosition(Number(e.target.value))}
                            className="w-full h-1 bg-foreground/10 rounded-full appearance-none outline-none accent-primary cursor-pointer"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          {[1, 2, 4].map((s) => (
                            <button
                              key={s}
                              onClick={() => setPlaybackSpeed(s)}
                              className={cn(
                                "text-[9px] font-mono font-bold px-2 py-1 rounded-md transition",
                                playbackSpeed === s
                                  ? "bg-foreground/10 text-foreground"
                                  : "text-muted-foreground hover:bg-white/5",
                              )}
                            >
                              {s}x
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Toggle button to expand telemetry traces */}
                      <button
                        onClick={() => setShowDetailedTelemetry(!showDetailedTelemetry)}
                        className={cn(
                          "mt-4 w-full rounded-xl py-3 text-xs font-mono font-bold uppercase tracking-wider transition border duration-300 flex items-center justify-center gap-2",
                          showDetailedTelemetry
                            ? "bg-primary/10 text-primary border-primary/20"
                            : "glass text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <Activity className="w-4 h-4 text-primary" />
                        {showDetailedTelemetry
                          ? "Hide Detailed Telemetry Traces"
                          : "Enable Enthusiast Telemetry Mode"}
                      </button>
                    </div>

                    {/* Speeds & Pedals trace compare dashboards (Visible in Enthusiast mode only) */}
                    {showDetailedTelemetry && (
                      <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-4"
                      >
                        {telemetryAnalysis && (
                          <div className="grid grid-cols-2 gap-3">
                            <GlassPanel className="p-4 border border-border/40 text-center">
                              <div className="text-[8px] font-mono text-muted-foreground uppercase tracking-widest font-bold">
                                Top Speed
                              </div>
                              <div className="font-display text-2xl mt-1.5">
                                {telemetryAnalysis.d1MaxSpeed || activePt1?.speed || 0}
                                <span className="text-xs text-muted-foreground"> km/h</span>
                              </div>
                              <div className="text-[8px] font-mono text-muted-foreground mt-0.5">
                                Cursor: {activePt1?.speed || 0} km/h
                              </div>
                              <div className="text-[8px] font-mono text-primary font-bold uppercase tracking-wider mt-1">
                                {d1Meta.abbr}
                              </div>
                            </GlassPanel>
                            <GlassPanel className="p-4 border border-border/40 text-center">
                              <div className="text-[8px] font-mono text-muted-foreground uppercase tracking-widest font-bold">
                                Top Speed
                              </div>
                              <div className="font-display text-2xl mt-1.5">
                                {telemetryAnalysis.d2MaxSpeed || activePt2?.speed || 0}
                                <span className="text-xs text-muted-foreground"> km/h</span>
                              </div>
                              <div className="text-[8px] font-mono text-muted-foreground mt-0.5">
                                Cursor: {activePt2?.speed || 0} km/h
                              </div>
                              <div
                                className="text-[8px] font-mono text-primary font-bold uppercase tracking-wider mt-1"
                                style={{ color: DRIVER_COLOR_2 }}
                              >
                                {d2Meta.abbr}
                              </div>
                            </GlassPanel>
                          </div>
                        )}

                        <ChartSection
                          title="Speed trace (km/h)"
                          d1={driver1Data}
                          d2={driver2Data}
                          dataKey="speed"
                          color1={DRIVER_COLOR_1}
                          color2={DRIVER_COLOR_2}
                          domain={[50, 350]}
                          activeDist={activeDist}
                        />
                        <ChartSection
                          title="Throttle logs (%)"
                          d1={driver1Data}
                          d2={driver2Data}
                          dataKey="throttle"
                          color1={DRIVER_COLOR_1}
                          color2={DRIVER_COLOR_2}
                          domain={[0, 100]}
                          activeDist={activeDist}
                        />
                        <ChartSection
                          title="Brake traces (0-1)"
                          d1={driver1Data}
                          d2={driver2Data}
                          dataKey="brake"
                          color1={DRIVER_COLOR_1}
                          color2={DRIVER_COLOR_2}
                          domain={[0, 1]}
                          activeDist={activeDist}
                        />
                      </motion.div>
                    )}
                  </div>
                ) : (
                  <GlassPanel className="p-8 py-20 text-center border border-border/40 flex flex-col items-center justify-center gap-4">
                    <Activity className="w-8 h-8 text-muted-foreground/30" />
                    <div>
                      <h3 className="font-display text-2xl">Race replay offline</h3>
                      <p className="text-xs text-muted-foreground mt-2 leading-relaxed max-w-xs mx-auto">
                        Select a driver pair above and sync telemetry to compare speed traces and
                        braking maps.
                      </p>
                    </div>
                  </GlassPanel>
                )}
              </GlassPanel>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
