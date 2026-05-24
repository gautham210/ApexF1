"use client";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { f1Api } from "@/lib/api/client";
import { useLiveStore } from "@/lib/store";
import { useSessionContext } from "@/lib/hooks/useSessionContext";
import {
  Radio, WifiOff, Thermometer, Wind, Droplets, CloudRain,
  Archive, Clock, ChevronDown,
} from "lucide-react";

// ── Tyre compound ─────────────────────────────────────────────────
const COMPOUND_COLOR: Record<string, string> = {
  SOFT: "#ff3333", MEDIUM: "#ffd700", HARD: "#ffffff",
  INTERMEDIATE: "#39b54a", WET: "#0067ff", UNKNOWN: "#666",
};
const COMPOUND_ABBR: Record<string, string> = {
  SOFT: "S", MEDIUM: "M", HARD: "H", INTERMEDIATE: "I", WET: "W", UNKNOWN: "?",
};

function TyreChip({ compound }: { compound?: string }) {
  const c = compound?.toUpperCase() || "UNKNOWN";
  const col = COMPOUND_COLOR[c] || "#666";
  return (
    <div
      className="w-6 h-6 rounded-full border-2 flex items-center justify-center font-orbitron text-[9px] font-bold"
      style={{ borderColor: col, color: col, background: `${col}10` }}
    >
      {COMPOUND_ABBR[c] || "?"}
    </div>
  );
}

function WeatherStrip({ weather }: { weather: any }) {
  if (!weather) return null;
  return (
    <div className="flex flex-wrap items-center gap-4 px-4 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05] text-white/50">
      <span className="flex items-center gap-1.5 text-[11px] font-rajdhani">
        <Thermometer className="w-3 h-3 text-apex-red" />
        Air {weather.air_temp?.toFixed(1)}°C
      </span>
      <span className="flex items-center gap-1.5 text-[11px] font-rajdhani">
        <Thermometer className="w-3 h-3 text-orange-400" />
        Track {weather.track_temp?.toFixed(1)}°C
      </span>
      <span className="flex items-center gap-1.5 text-[11px] font-rajdhani">
        <Wind className="w-3 h-3" />
        {weather.wind_speed?.toFixed(1)} m/s
      </span>
      <span className="flex items-center gap-1.5 text-[11px] font-rajdhani">
        <Droplets className="w-3 h-3 text-blue-400" />
        {weather.humidity?.toFixed(0)}%
      </span>
      {weather.rainfall && (
        <span className="flex items-center gap-1 text-[11px] text-blue-400 font-rajdhani">
          <CloudRain className="w-3 h-3" /> Rain
        </span>
      )}
    </div>
  );
}

export default function LiveTimingPage() {
  const { leaderboard, weather, isConnected, applyLiveUpdate, setConnected } = useLiveStore();

  // ── THE FIX: use canonical context — no independent schedule fetch ──
  // isArchive = currentRace.is_completed (derived by useSessionContext from store)
  // This is the single reason live timing was always showing archive mode:
  // the old code fetched schedule independently and checked is_completed on
  // whatever selectedRound pointed to — which defaulted to the last completed race.
  const {
    selectedYear, selectedRound, selectedSession,
    currentRace, isArchive, raceLabel,
  } = useSessionContext();

  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchLiveData = useCallback(async () => {
    try {
      const [lbRes, wRes] = await Promise.allSettled([
        f1Api.getLeaderboard(selectedYear, selectedRound, selectedSession),
        f1Api.getWeather(selectedYear, selectedRound, selectedSession),
      ]);
      if (lbRes.status === "fulfilled") {
        const d = (lbRes.value as any)?.data ?? [];
        applyLiveUpdate({ leaderboard: Array.isArray(d) ? d : [] });
      }
      if (wRes.status === "fulfilled") {
        const d = (wRes.value as any)?.data;
        applyLiveUpdate({ weather: d });
      }
      setConnected(true);
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedRound, selectedSession, applyLiveUpdate, setConnected]);

  // Poll ONLY when not archive — archive sessions have no live data
  useEffect(() => {
    if (isArchive) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchLiveData();
    const iv = setInterval(fetchLiveData, 10_000);
    return () => clearInterval(iv);
  }, [isArchive, fetchLiveData]);

  // ── Archive state (completed sessions) ───────────────────────────
  if (isArchive) {
    return (
      <div className="p-4 lg:p-6 min-h-screen max-w-[1600px] mx-auto animate-fade-up">
        {/* Header */}
        <div className="mb-8">
          <p className="label-xs mb-2">{selectedYear} · Round {selectedRound}</p>
          <h1 className="font-orbitron font-bold text-white text-3xl tracking-tight flex items-center gap-3">
            <Archive className="w-7 h-7 text-blue-400" />
            SESSION REPLAY
          </h1>
          <p className="font-rajdhani text-white/40 text-sm tracking-widest uppercase mt-1">
            {raceLabel} · {selectedSession}
          </p>
        </div>

        {/* Archive notice */}
        <div className="card p-6 border-blue-500/20 bg-blue-500/[0.03] mb-6 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
            <Archive className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <p className="font-orbitron font-bold text-blue-400 text-sm tracking-widest uppercase mb-1">
              Archive Mode
            </p>
            <p className="font-rajdhani text-white/50 text-sm leading-relaxed">
              This session is complete — live timing is not available.
              Browse driver telemetry, lap analysis, and sector data from the{" "}
              <a href="/telemetry" className="text-blue-400 underline underline-offset-2 hover:text-blue-300">
                Telemetry
              </a>{" "}
              page.
            </p>
          </div>
        </div>

        {/* Call to action */}
        <div className="flex gap-3">
          <a
            href="/telemetry"
            className="px-6 py-3 rounded-xl font-rajdhani font-bold text-sm uppercase tracking-widest transition-all hover:scale-105 active:scale-95 border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
          >
            Open Telemetry →
          </a>
          <a
            href="/sessions"
            className="px-6 py-3 rounded-xl font-rajdhani font-bold text-sm uppercase tracking-widest transition-all hover:scale-105 active:scale-95 border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08]"
          >
            Browse Sessions
          </a>
        </div>
      </div>
    );
  }

  // ── Live timing view ─────────────────────────────────────────────
  return (
    <div className="p-4 lg:p-6 min-h-screen max-w-[1600px] mx-auto animate-fade-up">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <p className="label-xs mb-2">{selectedYear} · Round {selectedRound}</p>
          <h1 className="font-orbitron font-bold text-white text-3xl tracking-tight flex items-center gap-3">
            <Radio className="w-6 h-6 text-apex-red" />
            LIVE TIMING
          </h1>
          <p className="font-rajdhani text-white/40 text-sm tracking-widest uppercase mt-1">
            {raceLabel} · {selectedSession}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <WeatherStrip weather={weather} />

          <div className="flex items-center gap-2 px-4 py-2 card">
            {isConnected ? (
              <span className="status-live">Live</span>
            ) : (
              <span className="flex items-center gap-1.5 label-xs text-white/30">
                <WifiOff className="w-3.5 h-3.5" /> Offline
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Leaderboard table */}
      <div className="card overflow-hidden">

        {/* Column headers */}
        <div
          className="grid items-center px-4 py-3 border-b border-white/[0.05] bg-white/[0.02]"
          style={{ gridTemplateColumns: "40px 1fr 120px 80px 110px 90px 40px" }}
        >
          <span className="label-xs">POS</span>
          <span className="label-xs">DRIVER</span>
          <span className="label-xs">TEAM</span>
          <span className="label-xs text-center">TYRE</span>
          <span className="label-xs text-right">GAP</span>
          <span className="label-xs text-right">LAST LAP</span>
          <span className="label-xs text-center">PIT</span>
        </div>

        {loading ? (
          <div className="space-y-px p-2">
            {Array(20).fill(0).map((_, i) => (
              <div key={i} className="h-11 skeleton rounded-lg" />
            ))}
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="py-28 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-full bg-white/[0.04] border border-white/[0.07] flex items-center justify-center mb-5">
              <Radio className="w-7 h-7 text-white/15" />
            </div>
            <p className="font-rajdhani font-bold text-white/40 text-sm uppercase tracking-widest mb-1">
              Session Offline
            </p>
            <p className="font-rajdhani text-white/25 text-xs max-w-xs">
              No live data broadcasting. Select an active session from the{" "}
              <a href="/sessions" className="text-white/50 underline underline-offset-2">
                Session Browser
              </a>.
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {leaderboard.map((entry, i) => {
              const isExp = expanded === entry.driver_number;
              return (
                <motion.div
                  key={entry.driver_number}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="border-b border-white/[0.03] last:border-0 cursor-pointer"
                  onClick={() => setExpanded(isExp ? null : entry.driver_number)}
                >
                  {/* Main row */}
                  <div
                    className="grid items-center px-4 py-2.5 hover:bg-white/[0.03] transition-colors"
                    style={{
                      gridTemplateColumns: "40px 1fr 120px 80px 110px 90px 40px",
                      borderLeft: `3px solid ${i < 3 ? (entry.team_color || "#e10600") : "transparent"}`,
                    }}
                  >
                    {/* Pos */}
                    <span
                      className="font-orbitron font-bold text-sm"
                      style={{ color: i === 0 ? "#e10600" : "rgba(255,255,255,0.5)" }}
                    >
                      {entry.position}
                    </span>

                    {/* Driver */}
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-orbitron font-bold text-white text-sm tracking-wider">
                        {entry.abbreviation}
                      </span>
                      <span className="font-rajdhani text-white/30 text-xs truncate hidden lg:block">
                        {entry.driver_name}
                      </span>
                    </div>

                    {/* Team */}
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="team-bar h-4" style={{ backgroundColor: entry.team_color || "#888" }} />
                      <span className="font-rajdhani text-white/40 text-xs truncate">{entry.team}</span>
                    </div>

                    {/* Tyre */}
                    <div className="flex justify-center">
                      <TyreChip compound={entry.current_tyre} />
                    </div>

                    {/* Gap */}
                    <div className="text-right">
                      <span className="font-orbitron text-xs text-white/60">
                        {i === 0 ? "LEADER" : (entry.gap_to_leader || "—")}
                      </span>
                    </div>

                    {/* Last lap */}
                    <div className="text-right">
                      <span className="font-orbitron text-xs text-white/80">{entry.last_lap || "—"}</span>
                    </div>

                    {/* Pits */}
                    <div className="text-center">
                      <span className="font-rajdhani text-white/30 text-xs">{entry.pits ?? 0}</span>
                    </div>
                  </div>

                  {/* Expanded row */}
                  <AnimatePresence>
                    {isExp && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden bg-white/[0.02] border-t border-white/[0.04]"
                      >
                        <div className="px-14 py-3 flex flex-wrap gap-6 text-xs">
                          <div><span className="label-xs mr-2">Best Lap</span><span className="font-orbitron text-white">{entry.best_lap || "—"}</span></div>
                          <div><span className="label-xs mr-2">Tyre Age</span><span className="font-rajdhani text-white">{entry.tyre_age ?? "—"} laps</span></div>
                          <div><span className="label-xs mr-2">Speed</span><span className="font-rajdhani text-white">{entry.speed ? `${entry.speed} km/h` : "—"}</span></div>
                          <div><span className="label-xs mr-2">Status</span><span className="text-[#4ade80] font-rajdhani font-bold">{entry.status || "ON TRACK"}</span></div>
                          <div><span className="label-xs mr-2">Interval</span><span className="font-orbitron text-white/60">{entry.interval || "—"}</span></div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {leaderboard.length > 0 && (
        <p className="mt-3 label-xs text-right">
          {isConnected ? "Polling every 10s" : "Reconnecting..."} · {selectedYear} R{selectedRound} {selectedSession}
        </p>
      )}
    </div>
  );
}
