"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useLiveSession, type SessionState } from "@/lib/hooks/useLiveSession";
import { useSessionContext } from "@/lib/hooks/useSessionContext";
import { f1Api } from "@/lib/api/client";
import { useState, useEffect, useCallback } from "react";
import {
  Radio, Archive, Clock, Thermometer, Wind, Droplets,
  CloudRain, AlertTriangle, Flag, ChevronDown, RefreshCw,
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
  GREEN:  { label: "TRACK CLEAR",     color: "#4ade80", bg: "rgba(74,222,128,0.06)",  pulse: false },
  YELLOW: { label: "YELLOW FLAG",     color: "#facc15", bg: "rgba(250,204,21,0.08)",  pulse: true  },
  SC:     { label: "SAFETY CAR",      color: "#fb923c", bg: "rgba(251,146,60,0.08)",  pulse: true  },
  VSC:    { label: "VIRTUAL SC",      color: "#fb923c", bg: "rgba(251,146,60,0.06)",  pulse: false },
  RED:    { label: "RED FLAG",        color: "#ef4444", bg: "rgba(239,68,68,0.10)",   pulse: true  },
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

// ── Sub-components ────────────────────────────────────────────────────────────

function TyreChip({ compound }: { compound?: string | null }) {
  const key = (compound || "UNKNOWN").toUpperCase();
  const cfg = COMPOUND[key] || COMPOUND.UNKNOWN;
  return (
    <div
      className="w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center font-orbitron text-[8px] font-black flex-shrink-0"
      style={{ borderColor: cfg.color, color: cfg.color, background: `${cfg.color}12` }}
    >
      {cfg.label}
    </div>
  );
}

function WeatherBar({ weather }: { weather: any }) {
  if (!weather) return null;
  return (
    <div className="flex items-center gap-4 text-white/40 text-[10px] font-rajdhani font-bold tracking-wide">
      <span className="flex items-center gap-1">
        <Thermometer className="w-3 h-3 text-apex-red" />
        {weather.air_temp?.toFixed(1)}°C air / {weather.track_temp?.toFixed(1)}°C track
      </span>
      <span className="flex items-center gap-1">
        <Wind className="w-3 h-3" />
        {weather.wind_speed?.toFixed(1)} m/s
      </span>
      <span className="flex items-center gap-1">
        <Droplets className="w-3 h-3 text-blue-400" />
        {weather.humidity?.toFixed(0)}%
      </span>
      {weather.rainfall && (
        <span className="flex items-center gap-1 text-blue-400">
          <CloudRain className="w-3 h-3" /> RAIN
        </span>
      )}
    </div>
  );
}

function TrackStatusBanner({ status }: { status: string }) {
  const cfg = TRACK_STATUS_CONFIG[status] || TRACK_STATUS_CONFIG.GREEN;
  if (status === "GREEN") return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 px-4 py-2 rounded-lg border text-[11px] font-rajdhani font-black tracking-[0.15em] uppercase mb-4"
      style={{ borderColor: `${cfg.color}40`, background: cfg.bg, color: cfg.color }}
    >
      <AlertTriangle className="w-3.5 h-3.5" />
      {cfg.label}
      {cfg.pulse && (
        <span className="ml-auto w-2 h-2 rounded-full animate-pulse" style={{ background: cfg.color }} />
      )}
    </motion.div>
  );
}

function RaceControlTicker({ messages }: { messages: any[] }) {
  if (!messages || messages.length === 0) return null;
  const latest = messages[0];
  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-white/[0.03] border border-white/[0.05] rounded-lg text-[10px] font-rajdhani truncate">
      <span className="text-apex-red font-black tracking-widest flex-shrink-0 uppercase">
        {latest.flag || latest.category || "RC"}
      </span>
      <span className="text-white/50 truncate">{latest.message}</span>
      {latest.lap && (
        <span className="text-white/25 flex-shrink-0">Lap {latest.lap}</span>
      )}
    </div>
  );
}

// ── Archive leaderboard (FastF1) ──────────────────────────────────────────────
function ArchiveLeaderboard({ year, round, session }: { year: number; round: number; session: string }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

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
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.05] flex items-center justify-between">
        <span className="label-xs">RACE RESULT — {session.toUpperCase()}</span>
        {loading && <RefreshCw className="w-3 h-3 text-white/20 animate-spin" />}
      </div>
      <LeaderboardTable rows={data} loading={loading} expanded={expanded} setExpanded={setExpanded} />
    </div>
  );
}

// ── Shared leaderboard table ──────────────────────────────────────────────────
function LeaderboardTable({
  rows, loading, expanded, setExpanded,
}: {
  rows: any[]; loading: boolean;
  expanded: string | null; setExpanded: (v: string | null) => void;
}) {
  if (loading) {
    return (
      <div className="p-3 space-y-px">
        {Array(20).fill(0).map((_, i) => (
          <div key={i} className="h-10 skeleton rounded-md" style={{ opacity: 1 - i * 0.04 }} />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="py-24 flex flex-col items-center gap-4 text-center">
        <Radio className="w-8 h-8 text-white/10" />
        <p className="label-xs">No timing data available</p>
        <p className="font-rajdhani text-white/20 text-xs max-w-xs">
          Select an active session or wait for the next event.
        </p>
      </div>
    );
  }

  const COLS = "36px 1fr 110px 52px 100px 90px 32px";

  return (
    <>
      {/* Header */}
      <div
        className="grid items-center px-4 py-2 border-b border-white/[0.04] bg-white/[0.01]"
        style={{ gridTemplateColumns: COLS }}
      >
        <span className="label-xs">POS</span>
        <span className="label-xs">DRIVER</span>
        <span className="label-xs">TEAM</span>
        <span className="label-xs text-center">TYR</span>
        <span className="label-xs text-right">GAP</span>
        <span className="label-xs text-right">LAST LAP</span>
        <span className="label-xs text-center">PIT</span>
      </div>

      <AnimatePresence initial={false}>
        {rows.map((entry, i) => {
          const isExp = expanded === entry.driver_number;
          const teamCol = entry.team_color || "#888";
          const isTop3 = i < 3;
          return (
            <motion.div
              key={entry.driver_number}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.015 }}
              className="border-b border-white/[0.03] last:border-0"
            >
              <div
                className="grid items-center px-4 py-2.5 cursor-pointer hover:bg-white/[0.025] transition-colors"
                style={{
                  gridTemplateColumns: COLS,
                  borderLeft: `3px solid ${isTop3 ? teamCol : "transparent"}`,
                }}
                onClick={() => setExpanded(isExp ? null : entry.driver_number)}
              >
                {/* Pos */}
                <span
                  className="font-orbitron font-black text-sm"
                  style={{ color: i === 0 ? "#e10600" : "rgba(255,255,255,0.4)" }}
                >
                  {entry.position ?? i + 1}
                </span>

                {/* Driver */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-orbitron font-bold text-white text-sm tracking-wider">
                    {entry.abbreviation}
                  </span>
                  <span className="font-rajdhani text-white/30 text-[11px] truncate hidden lg:block">
                    {entry.driver_name}
                  </span>
                </div>

                {/* Team */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="team-bar h-3.5" style={{ backgroundColor: teamCol }} />
                  <span className="font-rajdhani text-white/35 text-[11px] truncate">{entry.team}</span>
                </div>

                {/* Tyre */}
                <div className="flex justify-center">
                  <TyreChip compound={entry.current_tyre} />
                </div>

                {/* Gap */}
                <div className="text-right">
                  <span className="font-orbitron text-[11px] text-white/55">
                    {i === 0 ? "LEADER" : (entry.gap_to_leader || "—")}
                  </span>
                </div>

                {/* Last lap */}
                <div className="text-right">
                  <span className="font-orbitron text-[11px] text-white/80">
                    {entry.last_lap || "—"}
                  </span>
                </div>

                {/* Pits */}
                <div className="text-center">
                  <span className="font-rajdhani text-white/25 text-xs">{entry.pits ?? 0}</span>
                </div>
              </div>

              {/* Expanded detail */}
              <AnimatePresence>
                {isExp && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden bg-white/[0.015] border-t border-white/[0.04]"
                  >
                    <div className="px-12 py-3 flex flex-wrap gap-6 text-[11px]">
                      <div><span className="label-xs mr-2">Best Lap</span><span className="font-orbitron text-white">{entry.best_lap || "—"}</span></div>
                      <div><span className="label-xs mr-2">Tyre Age</span><span className="font-rajdhani text-white">{entry.tyre_age ?? "—"} laps</span></div>
                      <div><span className="label-xs mr-2">Interval</span><span className="font-orbitron text-white/60">{entry.interval || "—"}</span></div>
                      {entry.speed && <div><span className="label-xs mr-2">Speed</span><span className="font-rajdhani text-white">{entry.speed} km/h</span></div>}
                      <div><span className="label-xs mr-2">Status</span><span className="text-[#4ade80] font-rajdhani font-bold">{entry.status || "ON TRACK"}</span></div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LiveTimingPage() {
  const live = useLiveSession();
  const { selectedYear, selectedRound, selectedSession, currentRace, isArchive, raceLabel } = useSessionContext();
  const [expanded, setExpanded] = useState<string | null>(null);

  const stateConfig = STATE_CONFIG[live.state] || STATE_CONFIG.UNKNOWN;
  const trackStatus = live.session_info?.track_status || "GREEN";
  const trackCfg = TRACK_STATUS_CONFIG[trackStatus] || TRACK_STATUS_CONFIG.GREEN;

  // ── WAKING STATE ───────────────────────────────────────────────────────────
  if (live.state === "UNKNOWN" || live.is_waking) {
    return (
      <div className="p-4 lg:p-6 min-h-screen max-w-[1600px] mx-auto flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-apex-red/10 border border-apex-red/20 flex items-center justify-center mx-auto mb-6">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
            >
              <RefreshCw className="w-7 h-7 text-apex-red" />
            </motion.div>
          </div>
          <h1 className="font-orbitron font-bold text-white text-xl tracking-widest mb-2">WAKING DATA ENGINE</h1>
          <p className="font-rajdhani text-white/40 text-sm tracking-wide">
            Connecting to live timing infrastructure...
          </p>
        </div>
      </div>
    );
  }

  // ── ARCHIVE / NO LIVE SESSION ──────────────────────────────────────────────
  if (!live.is_live && isArchive) {
    return (
      <div className="p-4 lg:p-6 min-h-screen max-w-[1600px] mx-auto animate-fade-up">
        <div className="mb-6">
          <p className="label-xs mb-2">{selectedYear} · Round {selectedRound}</p>
          <h1 className="font-orbitron font-bold text-white text-3xl tracking-tight flex items-center gap-3">
            <Archive className="w-6 h-6 text-blue-400" />
            SESSION REPLAY
          </h1>
          <p className="font-rajdhani text-white/40 text-sm tracking-widest uppercase mt-1">
            {raceLabel} · {selectedSession}
          </p>
        </div>

        <div className="card p-5 border-blue-500/20 bg-blue-500/[0.03] mb-6">
          <p className="label-xs text-blue-400 mb-1">ARCHIVE MODE</p>
          <p className="font-rajdhani text-white/50 text-sm leading-relaxed">
            This session is complete — live timing unavailable. View historical results below or use{" "}
            <a href="/telemetry" className="text-blue-400 underline underline-offset-2">Telemetry</a>{" "}
            for detailed analysis.
          </p>
        </div>

        <ArchiveLeaderboard year={selectedYear} round={selectedRound} session={selectedSession} />
      </div>
    );
  }

  // ── UPCOMING / WEEKEND (NO ACTIVE SESSION) ─────────────────────────────────
  if (!live.is_live) {
    const si = live.session_info;
    return (
      <div className="p-4 lg:p-6 min-h-screen max-w-[1600px] mx-auto animate-fade-up">
        <div className="mb-6">
          <p className="label-xs mb-2">{si?.year ?? selectedYear} · {si?.country}</p>
          <h1 className="font-orbitron font-bold text-white text-3xl tracking-tight flex items-center gap-3">
            <Clock className="w-6 h-6" style={{ color: stateConfig.color }} />
            {stateConfig.label}
          </h1>
          {si && (
            <p className="font-rajdhani text-white/40 text-sm tracking-widest uppercase mt-1">
              {si.circuit} · {si.country}
            </p>
          )}
        </div>

        <div className="card p-6 flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center border"
            style={{ background: `${stateConfig.color}10`, borderColor: `${stateConfig.color}30` }}
          >
            <Flag className="w-7 h-7" style={{ color: stateConfig.color }} />
          </div>
          <div>
            <p className="font-orbitron font-bold text-white text-lg tracking-widest mb-1">
              {live.state === "CHECKERED" ? "SESSION COMPLETE" : "NO ACTIVE SESSION"}
            </p>
            <p className="font-rajdhani text-white/35 text-sm">
              {live.state === "UPCOMING"
                ? "This event has not started yet."
                : live.state === "WEEKEND"
                ? "Race weekend active — session not currently running."
                : live.state === "CHECKERED"
                ? "Session finished. Full results processing."
                : "No timing data broadcasting right now."}
            </p>
            <p className="font-rajdhani text-white/20 text-xs mt-4">
              Live timing activates automatically when a session begins.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── LIVE TIMING VIEW ───────────────────────────────────────────────────────
  const si = live.session_info;
  return (
    <div className="p-4 lg:p-6 min-h-screen max-w-[1600px] mx-auto animate-fade-up">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div>
          <p className="label-xs mb-2">{si?.year} · {si?.country}</p>
          <h1 className="font-orbitron font-bold text-white text-3xl tracking-tight flex items-center gap-3">
            <Radio className="w-6 h-6 text-apex-red" />
            {stateConfig.label}
          </h1>
          <p className="font-rajdhani text-white/40 text-sm tracking-widest uppercase mt-1">
            {si?.circuit} · {si?.display_name}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          {/* Live indicator */}
          <div className="flex items-center gap-2.5 px-4 py-2 card">
            {live.ws_connected ? (
              <>
                <span className="status-live">Live</span>
                <span className="label-xs text-white/20">· WS Connected</span>
              </>
            ) : (
              <span className="font-rajdhani text-amber-500 text-[10px] font-bold tracking-widest uppercase">
                ⚠️ Live Data Not Available
              </span>
            )}
          </div>
          {live.last_update && (
            <p className="label-xs text-right">
              Updated {new Date(live.last_update).toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>

      {/* ── Track status banner ─────────────────────────────────────── */}
      <TrackStatusBanner status={trackStatus} />

      {/* ── Race control ticker ─────────────────────────────────────── */}
      {live.race_control.length > 0 && (
        <div className="mb-4">
          <RaceControlTicker messages={live.race_control} />
        </div>
      )}

      {/* ── Weather strip ──────────────────────────────────────────── */}
      {live.weather && (
        <div className="mb-4 px-4 py-2 card">
          <WeatherBar weather={live.weather} />
        </div>
      )}

      {/* ── Leaderboard ────────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="px-4 py-2.5 border-b border-white/[0.05] flex items-center justify-between bg-white/[0.015]">
          <span className="label-xs">{si?.display_name} TIMING</span>
          <span className="label-xs">{live.leaderboard.length} DRIVERS</span>
        </div>

        <LeaderboardTable
          rows={live.leaderboard}
          loading={false}
          expanded={expanded}
          setExpanded={setExpanded}
        />
      </div>

      {live.leaderboard.length > 0 && (
        <p className="mt-3 label-xs text-right">
          Polling every 5s via OpenF1 · {stateConfig.label}
        </p>
      )}
    </div>
  );
}
