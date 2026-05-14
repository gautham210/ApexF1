"use client";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { f1Api } from "@/lib/api/client";
import { useLiveStore, useSettingsStore } from "@/lib/store";
import { Radio, Wifi, WifiOff, Thermometer, Wind, Droplets, CloudRain, Play, Pause, SkipForward, SkipBack, Clock } from "lucide-react";

const COMPOUND_COLORS: Record<string, string> = {
  SOFT: "#ff3333", MEDIUM: "#ffd700", HARD: "#ffffff",
  INTERMEDIATE: "#39b54a", WET: "#0067ff", UNKNOWN: "#888",
};

const COMPOUND_SHORT: Record<string, string> = {
  SOFT: "S", MEDIUM: "M", HARD: "H", INTERMEDIATE: "I", WET: "W", UNKNOWN: "?",
};

function TyreIcon({ compound }: { compound?: string }) {
  const c = compound?.toUpperCase() || "UNKNOWN";
  return (
    <div className="w-5 h-5 rounded-full border-[2.5px] flex items-center justify-center text-[10px] font-bold bg-[#1a1a1a]"
      style={{ borderColor: COMPOUND_COLORS[c] || "#888", color: COMPOUND_COLORS[c] || "#888" }}>
      {COMPOUND_SHORT[c] || "?"}
    </div>
  );
}

function WeatherBar({ weather }: { weather: any }) {
  if (!weather) return null;
  return (
    <div className="flex flex-wrap items-center gap-4 px-4 py-2 glass rounded-xl text-xs text-[#888]">
      <div className="flex items-center gap-1.5">
        <Thermometer className="w-3 h-3 text-[#e10600]" />
        <span>Air {weather.air_temp?.toFixed(1)}°C</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Thermometer className="w-3 h-3 text-[#ff8000]" />
        <span>Track {weather.track_temp?.toFixed(1)}°C</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Wind className="w-3 h-3" />
        <span>{weather.wind_speed?.toFixed(1)} m/s</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Droplets className="w-3 h-3 text-blue-400" />
        <span>{weather.humidity?.toFixed(0)}%</span>
      </div>
      {weather.rainfall && (
        <div className="flex items-center gap-1 text-blue-400">
          <CloudRain className="w-3 h-3" /> <span>Rain</span>
        </div>
      )}
    </div>
  );
}

export default function LiveTimingPage() {
  const { leaderboard, weather, isConnected, applyLiveUpdate, setConnected, replayMode, setReplayMode } = useLiveStore();
  const { selectedYear, selectedRound, selectedSession } = useSettingsStore();
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [replayPlaying, setReplayPlaying] = useState(false);

  // Polling data load
  useEffect(() => {
    async function load() {
      try {
        const [lbRes, wRes] = await Promise.allSettled([
          f1Api.getLeaderboard(selectedYear, selectedRound, selectedSession),
          f1Api.getWeather(selectedYear, selectedRound, selectedSession),
        ]);
        if (lbRes.status === "fulfilled") {
          const d = (lbRes.value as any).data || [];
          applyLiveUpdate({ leaderboard: d });
        }
        if (wRes.status === "fulfilled") {
          const d = (wRes.value as any).data;
          applyLiveUpdate({ weather: d });
        }
        setConnected(true);
      } catch (e) {
        console.error(e);
        setConnected(false);
      }
      finally { setLoading(false); }
    }
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [selectedYear, selectedRound, selectedSession]);

  return (
    <div className="p-4 lg:p-8 min-h-screen max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-apex-red/20 to-transparent flex items-center justify-center border border-apex-red/20">
              <Radio className="w-5 h-5 text-apex-red" />
            </div>
            <h1 className="font-orbitron font-bold text-white text-3xl tracking-tight">LIVE TIMING</h1>
          </div>
          <div className="text-white/60 text-sm font-rajdhani tracking-widest uppercase mt-2 flex items-center gap-2">
            <span>{selectedYear}</span>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span>Round {selectedRound}</span>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span className="text-white/80">{selectedSession}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <WeatherBar weather={weather} />
          
          <div className="flex items-center gap-3 px-4 py-2 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-lg">
            {!replayMode && isConnected ? (
              <>
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.6)]" />
                <span className="text-xs font-bold text-white/90 uppercase tracking-widest">LIVE</span>
              </>
            ) : replayMode ? (
              <>
                <Clock className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold text-white/90 uppercase tracking-widest">ARCHIVE REPLAY</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-white/40" />
                <span className="text-xs font-bold text-white/40 uppercase tracking-widest">OFFLINE</span>
              </>
            )}
          </div>
        </div>
      </div>

      {replayMode && (
        <div className="mb-6 bg-black/40 backdrop-blur-xl rounded-2xl p-4 flex items-center justify-between border border-blue-500/20 shadow-[0_8px_32px_rgba(59,130,246,0.1)]">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button className="p-2 text-white/60 hover:text-white transition-colors rounded-lg hover:bg-white/10"><SkipBack className="w-4 h-4" /></button>
              <button onClick={() => setReplayPlaying(!replayPlaying)} className="p-3 bg-white text-black rounded-full hover:scale-105 transition-all shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                {replayPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>
              <button className="p-2 text-white/60 hover:text-white transition-colors rounded-lg hover:bg-white/10"><SkipForward className="w-4 h-4" /></button>
            </div>
            <div className="h-10 w-px bg-white/10" />
            <div className="flex flex-col">
              <span className="text-[10px] text-blue-400 font-rajdhani uppercase tracking-widest font-bold">Session Progression</span>
              <span className="text-sm font-orbitron text-white">Lap 12 / 57</span>
            </div>
          </div>
          <div className="flex-1 max-w-2xl mx-8 relative group">
            <div className="h-1.5 bg-white/10 rounded-full w-full overflow-hidden transition-all group-hover:h-2">
              <div className="h-full bg-blue-500 w-1/4 rounded-full relative shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
            </div>
            <div className="absolute top-1/2 -translate-y-1/2 left-1/4 w-4 h-4 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)] cursor-pointer hover:scale-125 transition-transform" />
          </div>
          <div className="text-xs text-white/60 font-orbitron bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
            1x Speed
          </div>
        </div>
      )}

      {/* Leaderboard table */}
      <div className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
        {/* Column headers */}
        <div className="sticky top-0 z-10 bg-black/60 backdrop-blur-2xl grid grid-cols-12 gap-2 px-6 py-4 border-b border-white/10 text-[10px] font-rajdhani font-bold tracking-widest text-white/50 uppercase">
          <span className="col-span-1">POS</span>
          <span className="col-span-3">DRIVER</span>
          <span className="col-span-2">TEAM</span>
          <span className="col-span-1 text-center">TYRE</span>
          <span className="col-span-2 text-right">GAP / INTERVAL</span>
          <span className="col-span-2 text-right">LAST LAP</span>
          <span className="col-span-1 text-center">PITS</span>
        </div>

        {loading ? (
          <div className="space-y-px">
            {Array(20).fill(0).map((_, i) => (
              <div key={i} className="skeleton mx-6 my-2 h-12 rounded-xl bg-white/5" />
            ))}
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="py-32 flex flex-col items-center justify-center min-h-[400px] text-center">
            <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(255,255,255,0.02)]">
              <Radio className="w-8 h-8 text-white/20" />
            </div>
            <p className="text-white/40 text-sm font-rajdhani uppercase tracking-widest mb-2 font-bold">Session Offline</p>
            <p className="text-white/30 text-xs max-w-sm">No live timing data is currently broadcasting for this session. Please select an active session or view historical data.</p>
          </div>
        ) : (
          <AnimatePresence>
            {leaderboard.map((entry, i) => {
              const isExp = expanded === entry.driver_number;
              return (
                <motion.div key={entry.driver_number}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b border-white/[0.04] last:border-0 cursor-pointer"
                  onClick={() => setExpanded(isExp ? null : entry.driver_number)}
                >
                  <div className="grid grid-cols-12 gap-2 px-3 py-1 items-center hover:bg-white/[0.04] transition-colors"
                    style={{
                      borderLeft: i < 3 ? `3px solid ${entry.team_color || "#e10600"}` : "3px solid transparent",
                    }}>
                    {/* Position */}
                    <div className="col-span-1">
                      <span className="font-orbitron font-bold text-sm"
                        style={{ color: i === 0 ? "#e10600" : "#fff" }}>{entry.position}</span>
                    </div>
                    {/* Driver */}
                    <div className="col-span-3 flex items-center gap-2">
                      <span className="font-rajdhani font-bold text-sm text-white tracking-wider">
                        {entry.abbreviation}
                      </span>
                      <span className="text-[#555] text-xs hidden lg:block truncate">{entry.driver_name}</span>
                    </div>
                    {/* Team */}
                    <div className="col-span-2 flex items-center gap-1.5">
                      <div className="w-1.5 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: entry.team_color || "#888" }} />
                      <span className="text-[#888] text-xs truncate hidden md:block">{entry.team}</span>
                    </div>
                    {/* Tyre */}
                    <div className="col-span-1 flex justify-center">
                      <TyreIcon compound={entry.current_tyre} />
                    </div>
                    {/* Gap */}
                    <div className="col-span-2 text-right">
                      <span className="font-orbitron text-xs text-[#aaa]">
                        {i === 0 ? "LEADER" : entry.gap_to_leader || "—"}
                      </span>
                    </div>
                    {/* Last lap */}
                    <div className="col-span-2 text-right">
                      <span className="font-orbitron text-xs text-[#ccc]">{entry.last_lap || "—"}</span>
                    </div>
                    {/* Pits */}
                    <div className="col-span-1 text-center">
                      <span className="text-xs text-[#666]">{entry.pits ?? 0}</span>
                    </div>
                  </div>
                  {/* Expanded row */}
                  <AnimatePresence>
                    {isExp && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden bg-white/[0.015] px-4 py-3"
                      >
                        <div className="flex flex-wrap gap-4 text-xs">
                          <div><span className="text-[#555]">Best Lap: </span><span className="font-orbitron text-white">{entry.best_lap || "—"}</span></div>
                          <div><span className="text-[#555]">Tyre Age: </span><span className="text-white">{entry.tyre_age ?? "—"} laps</span></div>
                          <div><span className="text-[#555]">Speed: </span><span className="text-white">{entry.speed ? `${entry.speed} km/h` : "—"}</span></div>
                          <div><span className="text-[#555]">Status: </span><span className="text-green-400">{entry.status || "ON TRACK"}</span></div>
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
    </div>
  );
}
