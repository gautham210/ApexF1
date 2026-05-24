"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useLiveSession, type SessionState } from "@/lib/hooks/useLiveSession";
import { useSessionContext } from "@/lib/hooks/useSessionContext";
import { f1Api } from "@/lib/api/client";
import { useState, useEffect } from "react";
import {
  Radio, Archive, Clock, Thermometer, Wind, Droplets,
  CloudRain, AlertTriangle, Flag, RefreshCw
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

function WeatherBar({ weather }: { weather: any }) {
  if (!weather) return null;
  return (
    <div className="flex items-center gap-6 text-white/40 text-[11px] font-sans font-semibold tracking-wider">
      <span className="flex items-center gap-1.5">
        <Thermometer className="w-3.5 h-3.5 text-apex-red" />
        {weather.air_temp?.toFixed(1)}°C Air / {weather.track_temp?.toFixed(1)}°C Track
      </span>
      <span className="flex items-center gap-1.5">
        <Wind className="w-3.5 h-3.5 text-white/30" />
        {weather.wind_speed?.toFixed(1)} m/s
      </span>
      <span className="flex items-center gap-1.5">
        <Droplets className="w-3.5 h-3.5 text-blue-400" />
        {weather.humidity?.toFixed(0)}% Humidity
      </span>
      {weather.rainfall && (
        <span className="flex items-center gap-1.5 text-blue-400 font-bold">
          <CloudRain className="w-3.5 h-3.5" /> Wet Track Conditions
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

function RaceControlTicker({ messages }: { messages: any[] }) {
  if (!messages || messages.length === 0) return null;
  const latest = messages[0];
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-white/[0.02] border border-white/5 rounded-xl text-[11px] font-sans text-white/60">
      <span className="text-apex-red font-bold tracking-wider flex-shrink-0 uppercase">
        {latest.flag || latest.category || "Race Control"}
      </span>
      <span className="text-white/50 truncate">{latest.message}</span>
      {latest.lap && (
        <span className="text-white/20 ml-auto flex-shrink-0">Lap {latest.lap}</span>
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
    <div className="bg-[#0b0b14]/30 rounded-3xl border border-white/[0.04] overflow-hidden">
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <span className="text-[10px] font-bold text-white/40 tracking-widest uppercase">Leaderboard Results</span>
        {loading && <RefreshCw className="w-3.5 h-3.5 text-white/20 animate-spin" />}
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
        <Radio className="w-10 h-10 text-white/10" />
        <p className="text-xs font-semibold text-white/30 tracking-wider uppercase">No timing logs compiled</p>
      </div>
    );
  }

  const COLS = "48px 1fr 140px 60px 100px 100px 48px";

  return (
    <div className="overflow-x-auto">
      {/* Header */}
      <div
        className="grid items-center px-6 py-3 border-b border-white/[0.04] bg-white/[0.005] min-w-[700px]"
        style={{ gridTemplateColumns: COLS }}
      >
        <span className="text-[9px] font-bold text-white/30 tracking-widest uppercase">Pos</span>
        <span className="text-[9px] font-bold text-white/30 tracking-widest uppercase">Driver</span>
        <span className="text-[9px] font-bold text-white/30 tracking-widest uppercase">Constructor</span>
        <span className="text-[9px] font-bold text-white/30 tracking-widest uppercase text-center">Tyre</span>
        <span className="text-[9px] font-bold text-white/30 tracking-widest uppercase text-right">Gap</span>
        <span className="text-[9px] font-bold text-white/30 tracking-widest uppercase text-right">Last Lap</span>
        <span className="text-[9px] font-bold text-white/30 tracking-widest uppercase text-center">Pits</span>
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
              transition={{ delay: i * 0.012 }}
              className="border-b border-white/[0.03] last:border-0 min-w-[700px]"
            >
              <div
                className="grid items-center px-6 py-3 cursor-pointer hover:bg-white/[0.015] transition-colors"
                style={{
                  gridTemplateColumns: COLS,
                  borderLeft: `4px solid ${isTop3 ? teamCol : "transparent"}`,
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
                    {entry.driver_name}
                  </span>
                </div>

                {/* Team */}
                <div className="flex items-center gap-2 min-w-0">
                  <div className="team-bar h-4 w-1 rounded" style={{ backgroundColor: teamCol }} />
                  <span className="font-sans text-white/40 text-xs truncate">{entry.team}</span>
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
                    className="overflow-hidden bg-white/[0.005] border-t border-white/[0.04]"
                  >
                    <div className="px-16 py-4 flex flex-wrap gap-8 text-[11px] font-sans text-white/50">
                      <div><span className="text-[9px] font-bold uppercase tracking-widest text-white/30 mr-2">Best Lap</span><span className="text-white font-semibold">{entry.best_lap || "—"}</span></div>
                      <div><span className="text-[9px] font-bold uppercase tracking-widest text-white/30 mr-2">Tyre Age</span><span className="text-white font-semibold">{entry.tyre_age ?? "—"} laps</span></div>
                      <div><span className="text-[9px] font-bold uppercase tracking-widest text-white/30 mr-2">Interval</span><span className="text-white/60 font-semibold">{entry.interval || "—"}</span></div>
                      {entry.speed && <div><span className="text-[9px] font-bold uppercase tracking-widest text-white/30 mr-2">Speed</span><span className="text-white font-semibold">{entry.speed} km/h</span></div>}
                      <div><span className="text-[9px] font-bold uppercase tracking-widest text-white/30 mr-2">Status</span><span className="text-emerald-400 font-bold">{entry.status || "ON TRACK"}</span></div>
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

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LiveTimingPage() {
  const live = useLiveSession();
  const { season, selectedRound, selectedSession, isArchive, raceLabel } = useSessionContext();
  const [expanded, setExpanded] = useState<string | null>(null);

  const stateConfig = STATE_CONFIG[live.state] || STATE_CONFIG.UNKNOWN;
  const trackStatus = live.session_info?.track_status || "GREEN";

  // ── WAKING STATE ───────────────────────────────────────────────────────────
  if (live.state === "UNKNOWN" || live.is_waking) {
    return (
      <div className="p-6 lg:p-12 min-h-screen max-w-[1600px] mx-auto flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="w-16 h-16 rounded-3xl bg-white/[0.02] border border-white/5 flex items-center justify-center mx-auto">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            >
              <RefreshCw className="w-6 h-6 text-white/30" />
            </motion.div>
          </div>
          <h1 className="font-sans font-bold text-white text-base tracking-widest uppercase">Establishing Connection</h1>
          <p className="font-sans text-white/40 text-xs">
            Connecting to timing database...
          </p>
        </div>
      </div>
    );
  }

  // ── ARCHIVE / NO LIVE SESSION ──────────────────────────────────────────────
  if (!live.is_live && isArchive) {
    return (
      <div className="p-6 lg:p-12 min-h-screen max-w-[1600px] mx-auto space-y-8 animate-fade-up">
        <div>
          <p className="text-xs font-bold text-white/40 tracking-widest uppercase mb-1.5">{season} Season · Round {selectedRound}</p>
          <h1 className="font-sans font-bold text-white text-3xl tracking-tight flex items-center gap-3">
            <Archive className="w-6 h-6 text-blue-400" />
            Session Replay
          </h1>
          <p className="font-sans text-white/40 text-xs mt-1.5 uppercase tracking-wide">
            {raceLabel} · {selectedSession}
          </p>
        </div>

        <div className="bg-[#0b0b14]/20 border border-white/[0.04] p-6 rounded-2xl">
          <p className="text-[10px] font-bold text-blue-400 tracking-widest uppercase mb-2">Historical Replay</p>
          <p className="font-sans text-white/50 text-xs leading-relaxed">
            This session has concluded. Real-time telemetry is unavailable. Review the historical session leaderboard below, or open{" "}
            <a href="/telemetry" className="text-blue-400 underline underline-offset-2 hover:text-blue-300">Telemetry</a>{" "}
            for full lap-by-lap analytics.
          </p>
        </div>

        <ArchiveLeaderboard year={season} round={selectedRound} session={selectedSession} />
      </div>
    );
  }

  // ── UPCOMING / WEEKEND (NO ACTIVE SESSION) ─────────────────────────────────
  if (!live.is_live) {
    const si = live.session_info;
    return (
      <div className="p-6 lg:p-12 min-h-screen max-w-[1600px] mx-auto space-y-8 animate-fade-up">
        <div>
          <p className="text-xs font-bold text-white/40 tracking-widest uppercase mb-1.5">{si?.year ?? season} · {si?.country}</p>
          <h1 className="font-sans font-bold text-white text-3xl tracking-tight flex items-center gap-3">
            <Clock className="w-6 h-6" style={{ color: stateConfig.color }} />
            {stateConfig.label}
          </h1>
          {si && (
            <p className="font-sans text-white/40 text-xs mt-1.5 uppercase tracking-wide">
              {si.circuit} · {si.country}
            </p>
          )}
        </div>

        <div className="bg-[#0c0c16]/30 border border-white/[0.04] rounded-3xl p-10 flex flex-col items-center justify-center py-24 gap-6 text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center border"
            style={{ background: "rgba(255,255,255,0.01)", borderColor: "rgba(255,255,255,0.05)" }}
          >
            <Flag className="w-6 h-6 text-white/20" />
          </div>
          <div className="space-y-2">
            <p className="font-sans font-bold text-white text-base tracking-widest uppercase">
              {live.state === "CHECKERED" ? "Session Finished" : "Live Stream Standby"}
            </p>
            <p className="font-sans text-white/40 text-xs max-w-sm leading-relaxed">
              {live.state === "UPCOMING"
                ? "This session has not commenced yet."
                : live.state === "WEEKEND"
                ? "Race weekend is active. Real-time data streams will commence as soon as the session begins."
                : live.state === "CHECKERED"
                ? "The checkered flag has flown. Final results are currently processing."
                : "Live telemetry streams are currently offline."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── LIVE TIMING VIEW ───────────────────────────────────────────────────────
  const si = live.session_info;
  return (
    <div className="p-6 lg:p-12 min-h-screen max-w-[1600px] mx-auto space-y-6 animate-fade-up">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div>
          <p className="text-xs font-bold text-white/40 tracking-widest uppercase mb-1.5">{si?.year} · {si?.country}</p>
          <h1 className="font-sans font-bold text-white text-3xl tracking-tight flex items-center gap-3">
            <Radio className="w-6 h-6 text-apex-red animate-pulse" />
            {stateConfig.label}
          </h1>
          <p className="font-sans text-white/40 text-xs mt-1.5 uppercase tracking-wide">
            {si?.circuit} · {si?.display_name}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          {/* Live indicator */}
          <div className="flex items-center gap-2.5 px-4 py-2 bg-white/[0.02] border border-white/5 rounded-xl">
            {live.ws_connected ? (
              <>
                <span className="status-live font-sans font-bold text-[9px] tracking-widest uppercase">Live Feed</span>
                <span className="text-[10px] text-white/20">· Connected</span>
              </>
            ) : (
              <span className="font-sans text-amber-500 text-[10px] font-bold tracking-widest uppercase">
                ⚠️ Live Data Not Available
              </span>
            )}
          </div>
          {live.last_update && (
            <p className="text-[10px] text-white/30 uppercase tracking-wider">
              Updated {new Date(live.last_update).toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>

      {/* ── Track status banner ── */}
      <TrackStatusBanner status={trackStatus} />

      {/* ── Race control ticker ── */}
      {live.race_control.length > 0 && (
        <div className="mb-4">
          <RaceControlTicker messages={live.race_control} />
        </div>
      )}

      {/* ── Weather strip ── */}
      {live.weather && (
        <div className="mb-4 px-5 py-3 bg-[#0b0b14]/20 border border-white/[0.04] rounded-2xl">
          <WeatherBar weather={live.weather} />
        </div>
      )}

      {/* ── Leaderboard ── */}
      <div className="bg-[#0b0b14]/30 rounded-3xl border border-white/[0.04] overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.04] flex items-center justify-between bg-white/[0.005]">
          <span className="text-[10px] font-bold text-white/40 tracking-widest uppercase">{si?.display_name} Leaderboard</span>
          <span className="text-[10px] font-bold text-white/40 tracking-widest uppercase">{live.leaderboard.length} Active Competitors</span>
        </div>

        <LeaderboardTable
          rows={live.leaderboard}
          loading={false}
          expanded={expanded}
          setExpanded={setExpanded}
        />
      </div>

      {live.leaderboard.length > 0 && (
        <p className="mt-3 text-[9px] text-white/25 text-right tracking-widest uppercase">
          Timing logs refreshed dynamically via OpenF1
        </p>
      )}
    </div>
  );
}
