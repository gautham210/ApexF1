import { LiveProviderNotice } from "@/components/LiveProviderNotice";
import { matchesSession } from "@/lib/session";
import type { LeaderboardEntry, TelemetryPoint, ScheduleEvent } from "@/lib/store";
import {
  parseRaceCenterSearch,
  getVerifiedEventLabel,
  type RaceCenterSearch,
} from "@/lib/event-identity";
import type { WeatherReading, RaceControlMsg, LiveDriver } from "@/hooks/useLiveSession";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useMemo, useRef, Suspense, lazy } from "react";
import { f1Api } from "@/lib/api/client";
import {
  getCircuitMap,
  getSessionDrivers,
  getSessionLaps,
  getSessionTyres,
} from "@/lib/api/telemetry";
import { CircuitTrackMap } from "@/components/CircuitTrackMap";
import {
  buildReplayFrames,
  formatLapDuration,
  formatSectorDuration,
  normalizeBrakePercent,
} from "@/lib/replay-helpers";
import { VALID_SESSIONS, MIN_SUPPORTED_YEAR } from "@/lib/event-identity";
import { useLiveSession, type SessionState } from "@/hooks/useLiveSession";
import { useSessionContext } from "@/hooks/useSessionContext";
import {
  useTelemetryStore,
  useCanonicalStore,
  getDriversListByYear,
  getDriverByYear,
} from "@/lib/store";

const TelemetryCharts = lazy(() => import("@/components/TelemetryCharts"));
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
    return (
      <span
        className="text-[10px] font-mono text-muted-foreground/50 whitespace-nowrap"
        title="Tyre compound unavailable"
      >
        —
      </span>
    );
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

// ── Telemetry charts are lazy-loaded in @/components/TelemetryCharts ───────────

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

  const COLS = "24px minmax(88px, 1.1fr) minmax(70px, 0.85fr) 30px 58px 60px 26px";

  return (
    <div
      className="overflow-x-auto focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded-b-2xl scrollbar-thin"
      tabIndex={0}
      role="region"
      aria-label="Timing Tower Leaderboard"
    >
      <div
        className="grid items-center gap-x-2 px-4 py-3 border-b border-border/40 bg-white/[0.005] min-w-[388px] text-[8px] font-mono text-muted-foreground tracking-widest uppercase font-bold whitespace-nowrap"
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
              className="border-b border-border/20 last:border-0 min-w-[388px]"
            >
              <div
                className="grid items-center gap-x-2 px-4 py-3.5 cursor-pointer hover:bg-foreground/[0.015] transition-colors"
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
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-display text-base font-bold text-foreground whitespace-nowrap shrink-0">
                    {entry.abbreviation}
                  </span>
                  <span className="font-mono text-[9px] text-muted-foreground font-bold hidden xl:block truncate">
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

  const navigate = useNavigate();
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [rightPanelTab, setRightPanelTab] = useState<"circuit" | "telemetry" | "logs">(
    search.mode === "replay" ? "telemetry" : "circuit",
  );

  const [telemetryLoading, setTelemetryLoading] = useState(false);
  const [telemetryError, setTelemetryError] = useState<string | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [showDetailedTelemetry, setShowDetailedTelemetry] = useState<boolean>(true);
  const [lapChoice, setLapChoice] = useState<string>(
    typeof selectedLap === "number" ? String(selectedLap) : "fastest",
  );

  const canQueryHistoricalSession = season >= MIN_SUPPORTED_YEAR && selectedRound > 0;

  const circuitMapQuery = useQuery({
    queryKey: ["circuit-map", season, selectedRound, selectedSession],
    queryFn: () => getCircuitMap(season, selectedRound, selectedSession),
    enabled: canQueryHistoricalSession,
    staleTime: 1000 * 60 * 60,
  });

  const sessionDriversQuery = useQuery({
    queryKey: ["session-drivers", season, selectedRound, selectedSession],
    queryFn: () => getSessionDrivers(season, selectedRound, selectedSession),
    enabled: canQueryHistoricalSession,
    staleTime: 1000 * 60 * 60,
  });

  const sessionLapsQuery = useQuery({
    queryKey: ["session-laps", season, selectedRound, selectedSession, driver1],
    queryFn: () => getSessionLaps(season, selectedRound, selectedSession, driver1),
    enabled: canQueryHistoricalSession && Boolean(driver1),
    staleTime: 1000 * 60 * 30,
  });

  const sessionTyresQuery = useQuery({
    queryKey: ["session-tyres", season, selectedRound, selectedSession],
    queryFn: () => getSessionTyres(season, selectedRound, selectedSession),
    enabled: canQueryHistoricalSession,
    staleTime: 1000 * 60 * 30,
  });

  const driverOptions = useMemo(() => {
    const apiDrivers = sessionDriversQuery.data ?? [];
    if (apiDrivers.length > 0) {
      return apiDrivers.map((d) => {
        const abbr = d.abbreviation || d.name_acronym || d.driver_number;
        return {
          number: d.driver_number,
          abbr,
          name: d.full_name || d.broadcast_name || abbr || `#${d.driver_number}`,
          color: d.team_color?.startsWith("#") ? d.team_color : `#${d.team_color || "9CA3AF"}`,
        };
      });
    }
    const db = getDriversListByYear(season);
    return Object.entries(db).map(([num, d]) => ({
      number: num,
      abbr: d.abbr,
      name: d.name,
      color: d.color,
    }));
  }, [sessionDriversQuery.data, season]);

  useEffect(() => {
    if (driverOptions.length === 0) return;
    if (!driverOptions.some((d) => d.number === driver1)) {
      setDriver1(driverOptions[0].number);
    }
    if (!driverOptions.some((d) => d.number === driver2) || driver2 === driver1) {
      const alt = driverOptions.find((d) => d.number !== driver1) ?? driverOptions[0];
      if (alt && alt.number !== driver2) setDriver2(alt.number);
    }
  }, [driverOptions, driver1, driver2, setDriver1, setDriver2]);

  const d1Option = driverOptions.find((d) => d.number === driver1);
  const d2Option = driverOptions.find((d) => d.number === driver2);
  const d1Fallback = getDriverByYear(season, driver1);
  const d2Fallback = getDriverByYear(season, driver2);
  const d1Meta = {
    abbr: d1Option?.abbr || d1Fallback.abbr || `#${driver1}`,
    name: d1Option?.name || d1Fallback.name || `Driver #${driver1}`,
    color: d1Option?.color || d1Fallback.color || "#e10600",
  };
  const d2Meta = {
    abbr: d2Option?.abbr || d2Fallback.abbr || `#${driver2}`,
    name: d2Option?.name || d2Fallback.name || `Driver #${driver2}`,
    color: d2Option?.color || d2Fallback.color || "#27F4D2",
  };

  const DRIVER_COLOR_1 = d1Meta.color || "#e10600";
  const DRIVER_COLOR_2 =
    d2Meta.color && d2Meta.color.toLowerCase() !== DRIVER_COLOR_1.toLowerCase()
      ? d2Meta.color
      : "#06b6d4";

  const selectedLapObj = useMemo(() => {
    if (lapChoice === "fastest") return null;
    const lapNum = Number(lapChoice);
    return (sessionLapsQuery.data ?? []).find((l) => l.lap_number === lapNum) ?? null;
  }, [lapChoice, sessionLapsQuery.data]);

  const replayFrames = useMemo(
    () => buildReplayFrames(driver1Data, driver2Data, 260),
    [driver1Data, driver2Data],
  );

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
      (driver1Data.filter((p) => (normalizeBrakePercent(p.brake) ?? 0) > 5).length /
        driver1Data.length) *
      100;
    const d2Brakes =
      driver2Data.length > 0
        ? (driver2Data.filter((p) => (normalizeBrakePercent(p.brake) ?? 0) > 5).length /
            driver2Data.length) *
          100
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

  const telemetryRequest = useRef(0);
  const autoReplayKeyRef = useRef<string>("");

  async function loadTelemetry() {
    const request = ++telemetryRequest.current;
    const parsedLap = lapChoice === "fastest" ? undefined : Number(lapChoice);
    setDriver1Data([]);
    setDriver2Data([]);
    setTelemetryError(null);
    setTelemetryLoading(true);
    setIsPlaying(false);
    setScrubberPosition(0);
    try {
      const [r1, r2] = await Promise.allSettled([
        f1Api.getTelemetry(season, selectedRound, selectedSession, driver1, parsedLap),
        f1Api.getTelemetry(season, selectedRound, selectedSession, driver2, parsedLap),
      ]);
      if (request !== telemetryRequest.current) return;
      const d1 = r1.status === "fulfilled" ? r1.value.data || [] : [];
      const d2 = r2.status === "fulfilled" ? r2.value.data || [] : [];
      setDriver1Data(d1);
      setDriver2Data(d2);
      const sessionKey = `${season}-${selectedRound}-${selectedSession}`;
      const hasPoints = d1.length > 0 || d2.length > 0;
      useCanonicalStore.getState().setTelemetryAvailability(sessionKey, hasPoints);
      if (!hasPoints) {
        setTelemetryError(
          `FastF1 car telemetry is not published for ${season} R${selectedRound} ${selectedSession}.`,
        );
      }
    } catch (e) {
      console.error("[Telemetry] load failed:", e);
      const sessionKey = `${season}-${selectedRound}-${selectedSession}`;
      useCanonicalStore.getState().setTelemetryAvailability(sessionKey, false);
      setTelemetryError("Failed to fetch telemetry from the archive backend.");
    } finally {
      if (request === telemetryRequest.current) setTelemetryLoading(false);
    }
  }

  useEffect(() => {
    setDriver1Data([]);
    setDriver2Data([]);
    setTelemetryError(null);
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
    lapChoice,
    setDriver1Data,
    setDriver2Data,
    setIsPlaying,
    setScrubberPosition,
  ]);

  // Switch straight to telemetry and auto-sync when entering via Replay links
  useEffect(() => {
    if (search.mode !== "replay") return;
    setRightPanelTab("telemetry");
    if (!canQueryHistoricalSession || !driver1) return;
    const key = `${season}-${selectedRound}-${selectedSession}-${driver1}-${driver2}-${lapChoice}`;
    if (autoReplayKeyRef.current === key) return;
    autoReplayKeyRef.current = key;
    void loadTelemetry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.mode, season, selectedRound, selectedSession, driver1, driver2, lapChoice]);

  useEffect(() => {
    if (!isPlaying || replayFrames.length === 0) return;

    const intervalMs = Math.max(12, Math.round(45 / playbackSpeed));
    const interval = setInterval(() => {
      const currentPos = useTelemetryStore.getState().scrubberPosition;
      if (currentPos >= replayFrames.length - 1) {
        setScrubberPosition(0);
      } else {
        setScrubberPosition(currentPos + 1);
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isPlaying, replayFrames.length, playbackSpeed, setScrubberPosition]);

  const cursorIndex =
    replayFrames.length > 0 ? Math.min(replayFrames.length - 1, Math.max(0, scrubberPosition)) : 0;
  const activeFrame = replayFrames[cursorIndex] ?? null;

  const trackDrivers = useMemo(() => {
    if (!activeFrame) return [];
    const list = [
      {
        code: d1Meta.abbr,
        color: DRIVER_COLOR_1,
        progress: activeFrame.progress,
        speed: activeFrame.speedA,
      },
    ];
    if (driver2Data.length > 0) {
      const d2Dist = driver2Data[driver2Data.length - 1]?.distance || 1;
      const matchedBProgress =
        activeFrame.timeB !== null && driver1Data[driver1Data.length - 1]?.distance
          ? Math.min(1, Math.max(0, activeFrame.distance / (d2Dist || activeFrame.distance || 1)))
          : activeFrame.progress;
      list.push({
        code: d2Meta.abbr,
        color: DRIVER_COLOR_2,
        progress: matchedBProgress,
        speed: activeFrame.speedB,
      });
    }
    return list;
  }, [
    activeFrame,
    d1Meta.abbr,
    d2Meta.abbr,
    DRIVER_COLOR_1,
    DRIVER_COLOR_2,
    driver2Data,
    driver1Data,
  ]);

  const trackStatus = showLive ? live.session_info?.track_status || "UNKNOWN" : "UNKNOWN";

  const updateRouteSearch = (patch: Partial<RaceCenterSearch>) => {
    void navigate({
      to: "/race-center",
      search: {
        mode: patch.mode ?? (search.mode || "archive"),
        year: patch.year ?? season,
        round: patch.round ?? selectedRound,
        session: patch.session ?? selectedSession,
      },
    });
  };

  const DriverSelector = ({
    value,
    onChange,
    color,
    label,
  }: {
    value: string;
    onChange: (v: string) => void;
    color: string;
    label: string;
  }) => (
    <div className="relative flex items-center shrink-0">
      <span
        className="w-2 h-2 rounded-full absolute left-3 z-10 pointer-events-none"
        style={{ backgroundColor: color }}
      />
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none min-w-[118px] pl-7 pr-7 py-2 rounded-xl glass text-xs font-mono font-bold cursor-pointer outline-none border border-white/12 bg-background/80 text-foreground uppercase tracking-wider"
      >
        {driverOptions.map((d) => (
          <option key={d.number} value={d.number} className="bg-background">
            {d.abbr} #{d.number}
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
    <div className="min-h-screen overflow-x-clip px-4 sm:px-6 pb-32 pt-8 sm:pt-12 lg:px-12 space-y-6">
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
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5 border-b border-border/40 pb-6 z-10 relative">
        <div>
          <div className="flex items-center gap-3">
            {showLive ? (
              <span className="flex items-center gap-2 bg-[#ff3333]/15 border border-[#ff3333]/30 px-3 py-1 rounded-full text-[9px] font-mono font-bold text-[#ff3333] tracking-widest uppercase">
                <Radio className="w-3.5 h-3.5 animate-pulse" /> LIVE STREAM
              </span>
            ) : (
              <span className="flex items-center gap-2 glass-pill px-3 py-1 rounded-full text-[9px] font-mono font-bold text-muted-foreground tracking-widest uppercase">
                <Archive className="w-3.5 h-3.5" />{" "}
                {search.mode === "replay" ? "REPLAY STUDIO" : "ARCHIVE ANALYSIS"}
              </span>
            )}
            <h1 className="font-display text-4xl leading-none">Race Center</h1>
          </div>
          <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-widest mt-3 flex flex-wrap items-center gap-2.5 font-bold">
            <span>{season} · Grand Prix Weekend</span>
            <span className="w-1 h-1 rounded-full bg-border" />
            <span>Round {selectedRound}</span>
            <span className="w-1 h-1 rounded-full bg-border" />
            <span className="text-foreground/80">{raceLabel}</span>
            <span className="w-1 h-1 rounded-full bg-border" />
            <span className="text-primary font-black">{selectedSession}</span>
          </p>
        </div>

        {/* In-page session explorer (2018..currentYear) */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono">
          <select
            aria-label="Season year"
            value={season}
            onChange={(e) => updateRouteSearch({ year: Number(e.target.value), round: 1 })}
            className="rounded-xl glass border border-white/12 bg-background/80 px-3 py-2 text-xs font-mono text-foreground"
          >
            {Array.from(
              { length: Math.max(1, new Date().getFullYear() - MIN_SUPPORTED_YEAR + 1) },
              (_, i) => new Date().getFullYear() - i,
            ).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <select
            aria-label="Grand Prix round"
            value={selectedRound}
            onChange={(e) => updateRouteSearch({ round: Number(e.target.value) })}
            className="rounded-xl glass border border-white/12 bg-background/80 px-3 py-2 text-xs font-mono text-foreground max-w-[210px] truncate"
          >
            {(activeSchedule.length > 0
              ? activeSchedule
              : Array.from({ length: 24 }, (_, idx) => ({
                  round_number: idx + 1,
                  event_name: `Round ${idx + 1}`,
                }))
            ).map((ev) => (
              <option key={ev.round_number} value={ev.round_number}>
                R{ev.round_number} · {ev.event_name}
              </option>
            ))}
          </select>

          <select
            aria-label="Session type"
            value={selectedSession}
            onChange={(e) => updateRouteSearch({ session: e.target.value })}
            className="rounded-xl glass border border-white/12 bg-background/80 px-3 py-2 text-xs font-mono text-foreground"
          >
            {VALID_SESSIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {showLive && (
            <div className="flex items-center gap-2 px-3 py-1.5 glass rounded-xl text-[9px] text-muted-foreground font-bold uppercase tracking-wider">
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
      <div className="grid gap-6 lg:grid-cols-[minmax(410px,445px)_minmax(0,1fr)]">
        {/* LEFT COLUMN: Timing Tower */}
        <div className="min-w-0 space-y-4">
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
        <div className="min-w-0 space-y-4">
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
            <GlassPanel className="p-6 space-y-6 border border-white/12">
              <div className="flex flex-wrap justify-between items-start gap-4 border-b border-border/20 pb-4">
                <div>
                  <span className="text-[9px] font-mono text-muted-foreground/60 tracking-widest uppercase font-bold">
                    {circuitMapQuery.data?.source
                      ? `${circuitMapQuery.data.source} Track Geometry`
                      : "Track Telemetry Geometry"}
                  </span>
                  <h3 className="font-display text-2xl mt-1">
                    {circuitMapQuery.data?.circuit_name || raceLabel}
                  </h3>
                  {circuitMapQuery.data?.reference_driver && (
                    <p className="mt-1 text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                      Reference lap: {circuitMapQuery.data.reference_driver} ·{" "}
                      {circuitMapQuery.data.corners.length} corners
                    </p>
                  )}
                </div>
                {showLive && live.weather && <WeatherBar weather={live.weather} />}
              </div>

              <div className="aspect-[16/10] w-full max-h-[340px] rounded-2xl glass-subtle p-4 flex items-center justify-center">
                <CircuitTrackMap
                  circuitMap={circuitMapQuery.data}
                  loading={circuitMapQuery.isLoading}
                  trackName={raceLabel}
                  drivers={trackDrivers}
                  className="w-full h-full max-h-[300px]"
                />
              </div>

              {sessionTyresQuery.data && Object.keys(sessionTyresQuery.data).length > 0 && (
                <div className="pt-2 border-t border-border/20 space-y-2.5">
                  <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
                    Stint strategy snapshot ({Object.keys(sessionTyresQuery.data).length} cars)
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-40 overflow-y-auto pr-1">
                    {Object.entries(sessionTyresQuery.data)
                      .slice(0, 12)
                      .map(([drvNum, stints]) => {
                        const drvMeta = driverOptions.find((d) => d.number === drvNum);
                        return (
                          <div
                            key={drvNum}
                            className="rounded-xl glass-subtle px-2.5 py-2 flex items-center justify-between gap-2 text-[10px] font-mono"
                          >
                            <span className="font-bold text-foreground">
                              {drvMeta?.abbr || `#${drvNum}`}
                            </span>
                            <span className="flex items-center gap-1">
                              {stints.map((st, idx) => {
                                const c = COMPOUND[st.compound?.toUpperCase()] ?? {
                                  color: "#9CA3AF",
                                  label: st.compound?.slice(0, 1) || "?",
                                };
                                return (
                                  <span
                                    key={idx}
                                    title={`${st.compound} (L${st.start_lap ?? st.lap ?? "?"}–${st.end_lap ?? "?"})`}
                                    className="inline-flex h-4 w-4 items-center justify-center rounded-full border text-[8px] font-black"
                                    style={{ borderColor: c.color, color: c.color }}
                                  >
                                    {c.label}
                                  </span>
                                );
                              })}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </GlassPanel>
          )}

          {/* TAB 2: Telemetry Replay & Compare */}
          {rightPanelTab === "telemetry" && (
            <div className="space-y-4">
              <GlassPanel className="p-5 sm:p-6 border border-white/12 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/20 pb-4">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <DriverSelector
                      label="Primary driver"
                      value={driver1}
                      onChange={setDriver1}
                      color={DRIVER_COLOR_1}
                    />
                    <span className="text-muted-foreground/40 font-mono text-[10px]">VS</span>
                    <DriverSelector
                      label="Comparison driver"
                      value={driver2}
                      onChange={setDriver2}
                      color={DRIVER_COLOR_2}
                    />
                    <select
                      aria-label="Lap selector"
                      value={lapChoice}
                      onChange={(e) => setLapChoice(e.target.value)}
                      className="rounded-xl glass border border-white/12 bg-background/80 px-3 py-2 text-xs font-mono text-foreground max-w-[180px]"
                    >
                      <option value="fastest">Fastest lap</option>
                      {(sessionLapsQuery.data ?? []).map((lap) => (
                        <option key={lap.lap_number} value={String(lap.lap_number)}>
                          L{lap.lap_number} · {formatLapDuration(lap.lap_time)}{" "}
                          {lap.compound ? `(${lap.compound.slice(0, 1)})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={loadTelemetry}
                      disabled={telemetryLoading}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-bold text-background transition hover:bg-foreground/90 disabled:opacity-50"
                    >
                      {telemetryLoading ? "Syncing..." : "Sync telemetry"}
                    </button>
                  </div>
                </div>

                {selectedLapObj && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                    <div className="rounded-xl glass-subtle px-3 py-2">
                      <span className="text-muted-foreground block text-[9px]">LAP TIME</span>
                      <span className="text-foreground font-bold tabular-nums">
                        {formatLapDuration(selectedLapObj.lap_time)}
                      </span>
                    </div>
                    <div className="rounded-xl glass-subtle px-3 py-2">
                      <span className="text-muted-foreground block text-[9px]">SECTOR 1</span>
                      <span className="text-foreground tabular-nums">
                        {formatSectorDuration(selectedLapObj.sector1)}
                      </span>
                    </div>
                    <div className="rounded-xl glass-subtle px-3 py-2">
                      <span className="text-muted-foreground block text-[9px]">SECTOR 2</span>
                      <span className="text-foreground tabular-nums">
                        {formatSectorDuration(selectedLapObj.sector2)}
                      </span>
                    </div>
                    <div className="rounded-xl glass-subtle px-3 py-2">
                      <span className="text-muted-foreground block text-[9px]">
                        SECTOR 3 / TYRE
                      </span>
                      <span className="text-foreground tabular-nums">
                        {formatSectorDuration(selectedLapObj.sector3)}{" "}
                        {selectedLapObj.compound ? `· ${selectedLapObj.compound}` : ""}
                      </span>
                    </div>
                  </div>
                )}

                {telemetryError && driver1Data.length === 0 && (
                  <p
                    role="status"
                    className="rounded-2xl glass-subtle p-4 text-xs font-mono text-amber-300"
                  >
                    {telemetryError}
                  </p>
                )}

                {replayFrames.length > 0 ? (
                  <div className="space-y-4">
                    {/* Track + Live Telemetry HUD */}
                    <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr] items-start">
                      <div className="relative h-[260px] sm:h-[290px] w-full rounded-2xl glass-subtle p-3 flex items-center justify-center overflow-hidden">
                        <CircuitTrackMap
                          circuitMap={circuitMapQuery.data}
                          loading={circuitMapQuery.isLoading}
                          trackName={raceLabel}
                          drivers={trackDrivers}
                          showCorners={false}
                          className="w-full h-full max-h-[260px]"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 content-start min-w-0">
                        <div className="rounded-2xl glass-subtle p-3 min-w-0">
                          <div className="text-[9px] font-mono uppercase tracking-[0.16em] text-muted-foreground truncate">
                            {d1Meta.abbr} Cursor
                          </div>
                          <div className="font-display text-2xl sm:text-3xl mt-1 tabular-nums whitespace-nowrap">
                            {activeFrame?.speedA ?? "—"}{" "}
                            <span className="text-xs font-mono text-muted-foreground">km/h</span>
                          </div>
                          <div className="text-[10px] font-mono text-muted-foreground mt-1 tabular-nums">
                            G{activeFrame?.gearA ?? "—"} · THR {activeFrame?.throttleA ?? 0}% ·{" "}
                            {activeFrame?.drsA ? "DRS ON" : `BRK ${activeFrame?.brakeA ?? 0}%`}
                          </div>
                        </div>

                        <div className="rounded-2xl glass-subtle p-3 min-w-0">
                          <div
                            className="text-[9px] font-mono uppercase tracking-[0.16em] truncate"
                            style={{ color: DRIVER_COLOR_2 }}
                          >
                            {d2Meta.abbr} Cursor
                          </div>
                          <div className="font-display text-2xl sm:text-3xl mt-1 tabular-nums whitespace-nowrap">
                            {activeFrame?.speedB ?? "—"}{" "}
                            <span className="text-xs font-mono text-muted-foreground">km/h</span>
                          </div>
                          <div className="text-[10px] font-mono text-muted-foreground mt-1 tabular-nums">
                            G{activeFrame?.gearB ?? "—"} · THR {activeFrame?.throttleB ?? 0}% · DRS{" "}
                            {activeFrame?.drsB ? "ON" : "OFF"}
                          </div>
                        </div>

                        {telemetryAnalysis && (
                          <>
                            <div className="rounded-2xl glass-subtle p-3 min-w-0">
                              <div className="text-[9px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
                                Peak Speed
                              </div>
                              <div className="text-xs sm:text-sm font-mono font-bold mt-1 tabular-nums">
                                {d1Meta.abbr} {telemetryAnalysis.d1MaxSpeed} vs {d2Meta.abbr}{" "}
                                {telemetryAnalysis.d2MaxSpeed}
                              </div>
                            </div>
                            <div className="rounded-2xl glass-subtle p-3 min-w-0">
                              <div className="text-[9px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
                                Live Delta / Dist
                              </div>
                              <div className="text-xs sm:text-sm font-mono font-bold mt-1 tabular-nums">
                                {activeFrame?.deltaSec !== null &&
                                activeFrame?.deltaSec !== undefined
                                  ? `${activeFrame.deltaSec >= 0 ? "+" : ""}${activeFrame.deltaSec.toFixed(3)}s`
                                  : "—"}{" "}
                                · {Math.round(activeFrame?.distance ?? 0)}m
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Synchronized Scrubber & Speed Controls */}
                    <div className="flex flex-wrap items-center justify-between gap-3 glass-subtle p-3.5 rounded-2xl">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label={isPlaying ? "Pause lap playback" : "Play lap playback"}
                          onClick={() => setIsPlaying(!isPlaying)}
                          className="h-9 w-9 rounded-full bg-foreground text-background flex items-center justify-center hover:scale-105 transition"
                        >
                          {isPlaying ? (
                            <Pause className="h-4 w-4 fill-current" />
                          ) : (
                            <Play className="h-4 w-4 fill-current ml-0.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          aria-label="Restart lap playback"
                          onClick={() => setScrubberPosition(0)}
                          className="h-9 w-9 rounded-full glass flex items-center justify-center hover:bg-white/10 transition"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex-1 min-w-[140px] px-2">
                        <input
                          aria-label="Lap position"
                          type="range"
                          min="0"
                          max={Math.max(0, replayFrames.length - 1)}
                          value={cursorIndex}
                          onChange={(e) => setScrubberPosition(Number(e.target.value))}
                          className="w-full h-1.5 bg-foreground/15 rounded-full appearance-none outline-none accent-primary cursor-pointer"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        {[0.5, 1, 2, 4].map((s) => (
                          <button
                            type="button"
                            key={s}
                            onClick={() => setPlaybackSpeed(s)}
                            className={cn(
                              "text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg transition",
                              playbackSpeed === s
                                ? "bg-foreground text-background"
                                : "text-muted-foreground hover:bg-white/10",
                            )}
                          >
                            {s}x
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowDetailedTelemetry(!showDetailedTelemetry)}
                      className={cn(
                        "w-full rounded-xl py-2.5 text-xs font-mono font-bold uppercase tracking-wider transition border flex items-center justify-center gap-2",
                        showDetailedTelemetry
                          ? "bg-primary/10 text-primary border-primary/25"
                          : "glass text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Activity className="w-4 h-4 text-primary" />
                      {showDetailedTelemetry
                        ? "Hide Multi-Channel Traces"
                        : "Show Multi-Channel Traces"}
                    </button>

                    {showDetailedTelemetry && (
                      <Suspense
                        fallback={
                          <div className="rounded-2xl glass-subtle p-8 text-center text-xs font-mono text-muted-foreground">
                            Loading multi-channel telemetry charts…
                          </div>
                        }
                      >
                        <TelemetryCharts
                          frames={replayFrames}
                          cursorIndex={cursorIndex}
                          onSelectIndex={(idx) => setScrubberPosition(idx)}
                          driver1Label={d1Meta.abbr}
                          driver1Color={DRIVER_COLOR_1}
                          driver2Label={driver2Data.length > 0 ? d2Meta.abbr : undefined}
                          driver2Color={DRIVER_COLOR_2}
                        />
                      </Suspense>
                    )}
                  </div>
                ) : (
                  <GlassPanel className="p-8 py-16 text-center border border-border/40 flex flex-col items-center justify-center gap-4">
                    <Activity className="w-8 h-8 text-muted-foreground/30" />
                    <div>
                      <h3 className="font-display text-2xl">
                        {telemetryLoading ? "Loading FastF1 Telemetry..." : "Ready for Lap Replay"}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-2 leading-relaxed max-w-sm mx-auto">
                        Select any two drivers and a lap above, then click Sync telemetry to compare
                        speed, throttle, braking, gearshifts, RPM, DRS, and live track positions.
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
