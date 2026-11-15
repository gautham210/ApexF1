import { LiveProviderNotice } from "@/components/LiveProviderNotice";
import { matchesSession } from "@/lib/session";
import type { LeaderboardEntry, ScheduleEvent } from "@/lib/store";
import { presentEvent } from "@/lib/event-presentation";
import { parseRaceCenterSearch, type RaceCenterSearch } from "@/lib/event-identity";
import type { WeatherReading, RaceControlMsg, LiveDriver } from "@/hooks/useLiveSession";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useMemo } from "react";
import { f1Api } from "@/lib/api/client";
import { getCircuitMap, getSessionTyres } from "@/lib/api/telemetry";
import { CircuitTrackMap } from "@/components/CircuitTrackMap";
import { TrackReplayEngine } from "@/components/TrackReplayEngine";
import { PageHeader } from "@/components/PageHeader";
import { VALID_SESSIONS, MIN_SUPPORTED_YEAR } from "@/lib/event-identity";
import { useLiveSession, type SessionState } from "@/hooks/useLiveSession";
import { useSessionContext } from "@/hooks/useSessionContext";
import {
  Radio,
  Archive,
  Thermometer,
  Wind,
  Droplets,
  CloudRain,
  AlertTriangle,
  Flag,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  CalendarDays,
  Compass,
  Play,
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
  const pres = presentEvent(event);
  const raceLabel = pres.displayName;

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

  const navigate = useNavigate();
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [rightPanelTab, setRightPanelTab] = useState<"replay" | "circuit">(
    search.mode === "replay" || isArchiveSession ? "replay" : "circuit",
  );

  useEffect(() => {
    if (search.mode === "replay") {
      setRightPanelTab("replay");
    }
  }, [search.mode]);

  const canQueryHistoricalSession = season >= MIN_SUPPORTED_YEAR && selectedRound > 0;

  const circuitMapQuery = useQuery({
    queryKey: ["circuit-map", season, selectedRound, selectedSession],
    queryFn: () => getCircuitMap(season, selectedRound, selectedSession),
    enabled: canQueryHistoricalSession,
    staleTime: 1000 * 60 * 60,
  });

  const sessionTyresQuery = useQuery({
    queryKey: ["session-tyres", season, selectedRound, selectedSession],
    queryFn: () => getSessionTyres(season, selectedRound, selectedSession),
    enabled: canQueryHistoricalSession,
    staleTime: 1000 * 60 * 30,
  });

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
    <div className="apex-page pb-24 space-y-6">
      {!search.mode && <LiveProviderNotice />}
      {showLive && live.status === "partial" && (
        <p role="status" className="apex-card p-4 text-sm text-amber-200">
          Partial live coverage: {Object.keys(live.errors ?? {}).join(", ")} unavailable. Available
          channels remain visible.
        </p>
      )}
      {showLive && live.leaderboard.length > 0 && (
        <details className="apex-card p-4">
          <summary className="cursor-pointer py-1.5 text-sm font-medium">
            Latest recorded laps and sectors
          </summary>
          <div className="overflow-x-auto mt-2">
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

      {pres.hasConflict && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3 text-xs font-mono text-amber-200/90">
          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <div className="font-bold uppercase tracking-wider text-amber-400 text-[10px]">
              Provider Schedule Disagreement ({pres.cleanVenue || "Venue Agreed"})
            </div>
            <div>{pres.conflictDetail}</div>
          </div>
        </div>
      )}

      <PageHeader
        eyebrow={`${season} · Round ${selectedRound} · ${selectedSession}`}
        title="Race Center"
        subtitle={
          <span>
            {raceLabel}
            {pres.cleanVenue ? ` · ${pres.cleanVenue}` : ""}
            {showLive && live.last_update
              ? ` · Updated ${new Date(live.last_update).toLocaleTimeString()}`
              : ""}
          </span>
        }
        badges={
          showLive ? (
            <span className="inline-flex items-center gap-1.5 bg-[#ff3333]/15 border border-[#ff3333]/35 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold text-[#ff3333] uppercase tracking-wider">
              <Radio className="w-3 h-3 animate-pulse" />
              {live.ws_connected ? "Live WS" : "Live Polling"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 glass-pill px-2.5 py-0.5 rounded-full text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              <Archive className="w-3 h-3" />
              {search.mode === "replay"
                ? "Track Replay"
                : isArchiveSession
                  ? "Archive"
                  : "Upcoming"}
            </span>
          )
        }
        actions={
          <>
            <select
              aria-label="Season year"
              value={season}
              onChange={(e) => updateRouteSearch({ year: Number(e.target.value), round: 1 })}
              className="apex-control font-mono"
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
              className="apex-control font-mono max-w-[230px] truncate"
            >
              {(activeSchedule.length > 0
                ? activeSchedule
                : Array.from({ length: 24 }, (_, idx) => ({
                    round_number: idx + 1,
                    event_name: `Round ${idx + 1}`,
                    country: "",
                    location: "",
                    circuit_name: null,
                    has_conflict: false,
                    conflict: null,
                  }))
              ).map((ev) => {
                const evPres = presentEvent(ev as ScheduleEvent);
                return (
                  <option key={ev.round_number} value={ev.round_number}>
                    R{ev.round_number} · {evPres.displayName}
                  </option>
                );
              })}
            </select>

            <select
              aria-label="Session type"
              value={selectedSession}
              onChange={(e) => updateRouteSearch({ session: e.target.value })}
              className="apex-control font-mono"
            >
              {VALID_SESSIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </>
        }
      />

      {/* Live state alerts */}
      <TrackStatusBanner status={trackStatus} />
      {live.race_control.length > 0 && <RaceControlTicker messages={live.race_control} />}

      {/* Right panel mode toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="apex-tab-bar" role="tablist" aria-label="Race Center views">
          {[
            { id: "replay" as const, label: "Track Replay", icon: Play },
            { id: "circuit" as const, label: "Circuit & Stints", icon: Compass },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = rightPanelTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setRightPanelTab(tab.id)}
                className={cn("apex-tab", active && "apex-tab-active")}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
        {showLive && live.weather && <WeatherBar weather={live.weather} />}
      </div>

      {/* Primary Interactive Track Workspace (full width on replay for 20-car clarity) */}
      {rightPanelTab === "replay" && (
        <TrackReplayEngine
          year={season}
          round={selectedRound}
          session={selectedSession}
          trackLabel={circuitMapQuery.data?.circuit_name || pres.cleanVenue}
          eventName={raceLabel}
        />
      )}

      {rightPanelTab === "circuit" && (
        <GlassPanel className="p-6 space-y-6 border border-white/10">
          <div className="flex flex-wrap justify-between items-start gap-4 border-b border-border/20 pb-4">
            <div>
              <span className="apex-eyebrow">
                {circuitMapQuery.data?.source
                  ? `${circuitMapQuery.data.source} Track Geometry`
                  : "Circuit Layout"}
              </span>
              <h3 className="font-display text-2xl mt-1">
                {circuitMapQuery.data?.circuit_name || pres.cleanCircuit || raceLabel}
              </h3>
              {circuitMapQuery.data?.reference_driver && (
                <p className="mt-1 text-[11px] font-mono text-muted-foreground">
                  Reference lap: {circuitMapQuery.data.reference_driver} ·{" "}
                  {circuitMapQuery.data.corners.length} verified corners
                </p>
              )}
            </div>
          </div>

          <div className="aspect-[16/10] w-full max-h-[380px] rounded-2xl glass-subtle p-4 flex items-center justify-center">
            <CircuitTrackMap
              circuitMap={circuitMapQuery.data}
              loading={circuitMapQuery.isLoading}
              trackName={raceLabel}
              className="w-full h-full max-h-[340px]"
            />
          </div>

          {sessionTyresQuery.data && Object.keys(sessionTyresQuery.data).length > 0 && (
            <div className="pt-2 border-t border-border/20 space-y-2.5">
              <div className="apex-eyebrow">
                Tyre stint summary ({Object.keys(sessionTyresQuery.data).length} cars)
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-48 overflow-y-auto pr-1">
                {Object.entries(sessionTyresQuery.data).map(([drvNum, stints]) => (
                  <div
                    key={drvNum}
                    className="rounded-xl glass-subtle px-2.5 py-2 flex items-center justify-between gap-2 text-[10px] font-mono"
                  >
                    <span className="font-bold text-foreground">#{drvNum}</span>
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
                ))}
              </div>
            </div>
          )}
        </GlassPanel>
      )}

      {/* Official Classification / Live Timing Tower */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="apex-eyebrow flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-muted-foreground/60" />
            {showLive
              ? "Live Timing Tower"
              : isArchiveSession
                ? "Session Classification"
                : "Timing Status"}
          </span>
        </div>

        {showLive ? (
          <div className="apex-card overflow-hidden">
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
          <GlassPanel className="p-8 text-center flex flex-col items-center justify-center gap-3 border border-white/10">
            <Flag className="w-7 h-7 text-muted-foreground/40" />
            <h3 className="font-display text-2xl">Session Not Live</h3>
            <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
              Live timing opens automatically during active sessions. Switch season, round, or
              session above to inspect completed classifications or launch any 2023+ track replay.
            </p>
          </GlassPanel>
        )}
      </div>
    </div>
  );
}
