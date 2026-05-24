"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, AreaChart, Area, ReferenceLine
} from "recharts";
import { f1Api } from "@/lib/api/client";
import { useTelemetryStore, getDriversListByYear, getDriverByYear } from "@/lib/store";
import { useSessionContext } from "@/lib/hooks/useSessionContext";
import {
  Activity, ChevronDown, RefreshCw, Play, Pause,
  RotateCcw, ShieldAlert, Cpu, Gauge, Zap, TrendingUp
} from "lucide-react";

const SESSIONS = ["FP1", "FP2", "FP3", "Qualifying", "Sprint", "Race"];

// ChartSection renders the comparison graphs with synchronized vertical reference line
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
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-black/30 backdrop-blur-xl border border-white/5 rounded-2xl p-4 shadow-xl"
    >
      <h3 className="font-rajdhani font-bold text-white/70 text-[10px] tracking-widest mb-3 uppercase flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color1 }} />
        {title}
      </h3>
      <ResponsiveContainer width="100%" height={110}>
        <AreaChart data={merged} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id={`g1-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color1} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color1} stopOpacity={0} />
            </linearGradient>
            <linearGradient id={`g2-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color2} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color2} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
          <XAxis dataKey="dist" tick={false} tickLine={false} axisLine={false} />
          <YAxis domain={domain} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 8, fontFamily: "Rajdhani" }} tickLine={false} axisLine={false} width={40} />
          <Tooltip
            cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
            contentStyle={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 10, fontFamily: "Rajdhani", color: "#fff", padding: "4px 8px" }}
            labelStyle={{ display: "none" }}
          />
          <Area type="monotone" dataKey="driver1" stroke={color1} fill={`url(#g1-${dataKey})`} strokeWidth={1.5} dot={false} activeDot={false} />
          <Area type="monotone" dataKey="driver2" stroke={color2} fill={`url(#g2-${dataKey})`} strokeWidth={1.5} dot={false} activeDot={false} />
          {activeDist > 0 && (
            <ReferenceLine x={activeDist} stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} strokeDasharray="3 3" />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

export default function TelemetryPage() {
  const {
    driver1, driver2, driver1Data, driver2Data,
    scrubberPosition, isPlaying,
    setDriver1, setDriver2, setDriver1Data, setDriver2Data,
    setScrubberPosition, setIsPlaying
  } = useTelemetryStore();

  const {
    selectedYear, selectedRound, selectedSession, selectedLap,
    setSelectedSession, setSelectedLap, raceLabel,
  } = useSessionContext();

  const [loading, setLoading] = useState(false);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1); // 1x, 2x, 4x

  const db = getDriversListByYear(selectedYear);
  const d1Meta = getDriverByYear(selectedYear, driver1);
  const d2Meta = getDriverByYear(selectedYear, driver2);

  const DRIVER_COLOR_1 = d1Meta.color || "#e10600";
  const DRIVER_COLOR_2 = d2Meta.color || "#27F4D2";

  // Dynamic telemetry calculations for AI Coach
  const analysis = useMemo(() => {
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

  // Combined physical coordinates scaling for SVG Track Map
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

    const margin = 8;
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

  // Load telemetry from FastF1 backend
  async function loadTelemetry() {
    setLoading(true);
    setIsPlaying(false);
    setScrubberPosition(0);
    try {
      const [r1, r2] = await Promise.allSettled([
        f1Api.getTelemetry(selectedYear, selectedRound, selectedSession, driver1, selectedLap === "all" ? undefined : selectedLap as number),
        f1Api.getTelemetry(selectedYear, selectedRound, selectedSession, driver2, selectedLap === "all" ? undefined : selectedLap as number),
      ]);
      if (r1.status === "fulfilled") setDriver1Data((r1.value as any).data || []);
      if (r2.status === "fulfilled") setDriver2Data((r2.value as any).data || []);
      setLoadedAt(new Date().toLocaleTimeString());
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  // Synchronized Scrubber playback timer loop
  useEffect(() => {
    if (!isPlaying || driver1Data.length === 0) return;

    const interval = setInterval(() => {
      const currentPos = useTelemetryStore.getState().scrubberPosition;
      if (currentPos >= driver1Data.length - 1) {
        setScrubberPosition(0);
      } else {
        setScrubberPosition(currentPos + playbackSpeed);
      }
    }, 40);

    return () => clearInterval(interval);
  }, [isPlaying, driver1Data.length, playbackSpeed, setScrubberPosition]);

  // Current values at scrubber cursor position
  const activePt1 = driver1Data[scrubberPosition] || null;
  
  // Align driver 2 coordinate point based on closest cumulative distance
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

  // Render SVG Path strings for scaled track coords
  const trackPathD = useMemo(() => {
    const track = scaledTracks.d1Scaled;
    if (track.length === 0) return "";
    return track.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") + " Z";
  }, [scaledTracks.d1Scaled]);

  const car1Coord = scaledTracks.d1Scaled[scrubberPosition] || null;
  
  const car2Coord = useMemo(() => {
    if (scaledTracks.d2Scaled.length === 0) return null;
    if (activePt2) {
      // Find item in scaled list matching activePt2's index
      const originalIdx = driver2Data.indexOf(activePt2);
      if (originalIdx !== -1) {
        return scaledTracks.d2Scaled[originalIdx] || null;
      }
    }
    return scaledTracks.d2Scaled[scrubberPosition] || null;
  }, [scaledTracks.d2Scaled, activePt2, driver2Data, scrubberPosition]);

  const DriverSelect = ({ value, onChange, color }: { value: string; onChange: (v: string) => void; color: string }) => {
    return (
      <div className="relative flex items-center">
        <div className="w-2.5 h-2.5 rounded-full mr-[-24px] z-10 shadow" style={{ backgroundColor: color }} />
        <select
          value={value} onChange={(e) => onChange(e.target.value)}
          className="appearance-none pl-10 pr-8 py-2 rounded-xl text-xs font-rajdhani font-bold cursor-pointer outline-none bg-white/5 border border-white/10 text-white"
        >
          {Object.entries(db).map(([num, d]) => (
            <option key={num} value={num} className="bg-[#111]">{d.abbr} #{num}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none text-white/50" />
      </div>
    );
  };

  return (
    <div className="p-4 lg:p-6 min-h-screen max-w-[1600px] mx-auto space-y-6">
      
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-apex-red/10 border border-apex-red/20 flex items-center justify-center">
              <Activity className="w-5 h-5 text-apex-red animate-pulse" />
            </div>
            <h1 className="font-orbitron font-bold text-white text-2xl lg:text-3xl tracking-tight">TELEMETRY ANALYSIS</h1>
          </div>
          <div className="text-white/60 text-xs font-rajdhani tracking-widest uppercase mt-2.5 flex flex-wrap items-center gap-2">
            <span>{selectedYear} Season</span>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span>Round {selectedRound}</span>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span className="text-white">{raceLabel}</span>
            {loadedAt && (
              <>
                <span className="w-1 h-1 rounded-full bg-white/20" />
                <span className="text-[#00ff66]/80 font-bold uppercase">Sync Time: {loadedAt}</span>
              </>
            )}
          </div>
        </div>

        {/* Configuration Bar */}
        <div className="flex flex-wrap items-center gap-3 bg-white/[0.02] border border-white/5 p-3 rounded-2xl">
          <DriverSelect value={driver1} onChange={setDriver1} color={DRIVER_COLOR_1} />
          <span className="text-white/30 text-[10px] font-rajdhani font-bold uppercase">VS</span>
          <DriverSelect value={driver2} onChange={setDriver2} color={DRIVER_COLOR_2} />
          
          <div className="h-6 w-px bg-white/10" />
          
          <select 
            value={selectedSession} 
            onChange={(e) => setSelectedSession(e.target.value)}
            className="appearance-none bg-white/5 hover:bg-white/10 transition-colors border border-white/10 px-4 py-2 rounded-xl text-xs font-rajdhani font-bold text-white outline-none cursor-pointer"
          >
            {SESSIONS.map(s => (
              <option key={s} value={s} className="bg-[#111]">{s}</option>
            ))}
          </select>

          <select 
            value={selectedLap.toString()} 
            onChange={(e) => setSelectedLap(e.target.value === "all" ? "all" : parseInt(e.target.value))}
            className="appearance-none bg-white/5 hover:bg-white/10 transition-colors border border-white/10 px-4 py-2 rounded-xl text-xs font-rajdhani font-bold text-white outline-none cursor-pointer"
          >
            <option value="all" className="bg-[#111]">Fastest Lap</option>
            {Array.from({length: 80}, (_, i) => i + 1).map(l => (
              <option key={l} value={l} className="bg-[#111]">Lap {l}</option>
            ))}
          </select>

          <button onClick={loadTelemetry} disabled={loading}
            className="px-5 py-2 rounded-xl text-xs font-rajdhani font-bold tracking-widest uppercase transition-all hover:scale-105 active:scale-95 flex items-center gap-2 text-white bg-gradient-to-r from-apex-red to-orange-600 disabled:opacity-60"
            style={{ boxShadow: "0 4px 15px rgba(225, 6, 0, 0.3)" }}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            {driver1Data.length > 0 ? "RELOAD" : "LOAD DATA"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="skeleton rounded-2xl h-36 bg-white/5" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array(4).fill(0).map((_, i) => <div key={i} className="skeleton rounded-2xl h-28 bg-white/5" />)}
            </div>
          </div>
          <div className="skeleton rounded-2xl h-[450px] bg-white/5" />
        </div>
      ) : driver1Data.length === 0 ? (
        // Empty State
        <div className="glass border border-white/5 rounded-3xl py-20 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
            <Activity className="w-8 h-8 text-white/20" />
          </div>
          <h2 className="text-white font-orbitron font-bold text-lg mb-2 tracking-wide">TELEMETRY STANDBY</h2>
          <p className="text-white/40 text-xs max-w-sm font-rajdhani leading-relaxed mb-6 uppercase tracking-wider">
            FastF1 is ready to extract core lap telemetry for selected parameters.
          </p>
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl px-6 py-4 text-left max-w-xs space-y-2">
            <p className="text-[9px] text-white/50 uppercase font-rajdhani tracking-widest font-bold mb-2">Instructions</p>
            <p className="text-xs text-white/40 font-rajdhani">1. Choose Drivers 1 and 2 to compare.</p>
            <p className="text-xs text-white/40 font-rajdhani">2. Select Session type and Lap number.</p>
            <p className="text-xs text-white/40 font-rajdhani">3. Click <span className="text-apex-red font-bold">LOAD DATA</span> to compile.</p>
          </div>
        </div>
      ) : (
        /* ── Telemetry Working Dashboard ────────────────────────── */
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* Charts Column */}
          <div className="xl:col-span-2 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ChartSection title="Speed (km/h)" d1={driver1Data} d2={driver2Data} dataKey="speed" color1={DRIVER_COLOR_1} color2={DRIVER_COLOR_2} domain={[0, 350]} activeDist={activeDist} />
              <ChartSection title="Throttle (%)" d1={driver1Data} d2={driver2Data} dataKey="throttle" color1={DRIVER_COLOR_1} color2={DRIVER_COLOR_2} domain={[0, 100]} activeDist={activeDist} />
              <ChartSection title="Brake Intensity" d1={driver1Data} d2={driver2Data} dataKey="brake" color1={DRIVER_COLOR_1} color2={DRIVER_COLOR_2} domain={[0, 1]} activeDist={activeDist} />
              <ChartSection title="RPM Dials" d1={driver1Data} d2={driver2Data} dataKey="rpm" color1={DRIVER_COLOR_1} color2={DRIVER_COLOR_2} activeDist={activeDist} />
            </div>

            {/* Gear Chart */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-black/30 backdrop-blur-xl border border-white/5 rounded-2xl p-4 shadow-xl"
            >
              <h3 className="font-rajdhani font-bold text-white/70 text-[10px] tracking-widest mb-3 uppercase flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                Gear Selection Shift Profiler
              </h3>
              <ResponsiveContainer width="100%" height={80}>
                <LineChart data={driver1Data.map((p, i) => ({ dist: p.distance ? Math.round(p.distance) : p.time ? Math.round(p.time * 10) : i, gear: p.gear, gear2: driver2Data[i]?.gear }))} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
                  <XAxis dataKey="dist" tick={false} tickLine={false} axisLine={false} />
                  <YAxis domain={[1, 8]} ticks={[1,2,3,4,5,6,7,8]} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 8, fontFamily: "Rajdhani" }} tickLine={false} axisLine={false} width={40} />
                  <Tooltip
                    cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
                    contentStyle={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 10, fontFamily: "Rajdhani", color: "#fff", padding: "4px 8px" }}
                    labelStyle={{ display: "none" }}
                  />
                  <Line type="stepAfter" dataKey="gear" stroke={DRIVER_COLOR_1} strokeWidth={1.5} dot={false} activeDot={false} />
                  <Line type="stepAfter" dataKey="gear2" stroke={DRIVER_COLOR_2} strokeWidth={1.5} dot={false} activeDot={false} />
                  {activeDist > 0 && (
                    <ReferenceLine x={activeDist} stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} strokeDasharray="3 3" />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </motion.div>
          </div>

          {/* Interactive Map & Realtime Dashboard Column */}
          <div className="space-y-6">
            
            {/* SVG Interactive Circuit Card */}
            <div className="glass rounded-3xl p-5 border border-white/5 flex flex-col items-center relative overflow-hidden">
              <div className="scan-line" />
              <div className="w-full flex items-center justify-between mb-4">
                <span className="label-xs flex items-center gap-1.5 text-apex-red">
                  <Gauge className="w-3.5 h-3.5" />
                  Synchronized Map
                </span>
                {activePt1 && (
                  <span className="font-orbitron text-[10px] text-white/50">
                    DIST: {Math.round(activePt1.distance || 0)}m
                  </span>
                )}
              </div>

              {/* Dynamic Coordinate SVG Path */}
              {trackPathD ? (
                <div className="relative w-full h-[220px] bg-black/40 border border-white/5 rounded-2xl flex items-center justify-center p-4">
                  <svg className="w-full h-full max-w-[200px]" viewBox="0 0 100 100">
                    {/* Underlying Track Contour */}
                    <path
                      d={trackPathD}
                      fill="none"
                      stroke="rgba(255,255,255,0.06)"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {/* Inner Track Guideline */}
                    <path
                      d={trackPathD}
                      fill="none"
                      stroke="rgba(255,255,255,0.12)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* Driver 1 Car Marker Dot */}
                    {car1Coord && (
                      <circle
                        cx={car1Coord.x}
                        cy={car1Coord.y}
                        r="3.5"
                        fill={DRIVER_COLOR_1}
                        className="animate-pulse"
                        style={{ filter: `drop-shadow(0 0 4px ${DRIVER_COLOR_1})` }}
                      />
                    )}

                    {/* Driver 2 Car Marker Dot */}
                    {car2Coord && (
                      <circle
                        cx={car2Coord.x}
                        cy={car2Coord.y}
                        r="3"
                        fill={DRIVER_COLOR_2}
                        className="animate-pulse"
                        style={{ filter: `drop-shadow(0 0 4px ${DRIVER_COLOR_2})` }}
                      />
                    )}
                  </svg>
                </div>
              ) : (
                <div className="w-full h-[220px] bg-black/20 border border-white/5 rounded-2xl flex items-center justify-center text-[10px] font-rajdhani text-white/30 uppercase tracking-widest">
                  Map trace offline
                </div>
              )}

              {/* Interactive Scrubber Controls */}
              <div className="w-full mt-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 hover:bg-white/10 active:scale-95 text-white transition-all border border-white/10 cursor-pointer"
                    >
                      {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-white ml-0.5" />}
                    </button>
                    <button
                      onClick={() => { setIsPlaying(false); setScrubberPosition(0); }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 hover:bg-white/10 active:scale-95 text-white/70 transition-all border border-white/10 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Playback speed multiplier toggle */}
                  <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/10">
                    {[1, 2, 4].map(s => (
                      <button
                        key={s}
                        onClick={() => setPlaybackSpeed(s)}
                        className={`text-[9px] font-orbitron font-bold px-2 py-1 rounded transition-colors cursor-pointer ${playbackSpeed === s ? "bg-apex-red text-white" : "text-white/40 hover:text-white"}`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <input
                    type="range"
                    min="0"
                    max={driver1Data.length - 1}
                    value={scrubberPosition}
                    onChange={(e) => { setIsPlaying(false); setScrubberPosition(parseInt(e.target.value)); }}
                    className="w-full accent-apex-red cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] font-rajdhani text-white/30 uppercase">
                    <span>Start</span>
                    <span>Lap Scrubber</span>
                    <span>Checkered</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Metrics Dials */}
            {activePt1 && (
              <div className="glass rounded-3xl p-5 border border-white/5 space-y-4">
                <span className="label-xs flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-blue-400" />
                  Interactive Telemetry Values
                </span>

                <div className="grid grid-cols-2 gap-4">
                  {/* Driver 1 Metrics Column */}
                  <div className="space-y-3 bg-white/[0.01] border border-white/5 rounded-2xl p-3.5 relative">
                    <div className="absolute top-3 right-3 w-2 h-2 rounded-full" style={{ backgroundColor: DRIVER_COLOR_1 }} />
                    <p className="font-orbitron font-bold text-xs text-white tracking-widest">{d1Meta.abbr}</p>

                    <div>
                      <p className="text-[8px] text-white/30 uppercase font-rajdhani">Velocity</p>
                      <p className="font-orbitron font-bold text-xl text-white leading-none mt-1">
                        {activePt1.speed || 0} <span className="text-[10px] text-white/40 font-normal">KM/H</span>
                      </p>
                    </div>

                    <div>
                      <p className="text-[8px] text-white/30 uppercase font-rajdhani">Gear shift</p>
                      <p className="font-orbitron font-bold text-lg text-white mt-0.5">GEAR {activePt1.gear || "—"}</p>
                    </div>

                    {/* Throttle Gauge bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[8px] font-rajdhani uppercase text-white/40">
                        <span>Throttle</span>
                        <span>{activePt1.throttle || 0}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${activePt1.throttle || 0}%` }} />
                      </div>
                    </div>

                    {/* Brake Gauge bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[8px] font-rajdhani uppercase text-white/40">
                        <span>Brake</span>
                        <span>{Math.round((activePt1.brake || 0) * 100)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-red-500 rounded-full" style={{ width: `${Math.round((activePt1.brake || 0) * 100)}%` }} />
                      </div>
                    </div>
                  </div>

                  {/* Driver 2 Metrics Column */}
                  <div className="space-y-3 bg-white/[0.01] border border-white/5 rounded-2xl p-3.5 relative">
                    <div className="absolute top-3 right-3 w-2 h-2 rounded-full" style={{ backgroundColor: DRIVER_COLOR_2 }} />
                    <p className="font-orbitron font-bold text-xs text-white tracking-widest">{d2Meta.abbr}</p>

                    <div>
                      <p className="text-[8px] text-white/30 uppercase font-rajdhani">Velocity</p>
                      <p className="font-orbitron font-bold text-xl text-white leading-none mt-1">
                        {activePt2?.speed || 0} <span className="text-[10px] text-white/40 font-normal">KM/H</span>
                      </p>
                    </div>

                    <div>
                      <p className="text-[8px] text-white/30 uppercase font-rajdhani">Gear shift</p>
                      <p className="font-orbitron font-bold text-lg text-white mt-0.5">GEAR {activePt2?.gear || "—"}</p>
                    </div>

                    {/* Throttle Gauge bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[8px] font-rajdhani uppercase text-white/40">
                        <span>Throttle</span>
                        <span>{activePt2?.throttle || 0}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${activePt2?.throttle || 0}%` }} />
                      </div>
                    </div>

                    {/* Brake Gauge bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[8px] font-rajdhani uppercase text-white/40">
                        <span>Brake</span>
                        <span>{activePt2 ? Math.round((activePt2.brake || 0) * 100) : 0}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-red-500 rounded-full" style={{ width: `${activePt2 ? Math.round((activePt2.brake || 0) * 100) : 0}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AI Reactive Intelligence Panel */}
            {analysis && (
              <div className="glass rounded-3xl p-5 border border-white/5 space-y-4">
                <span className="label-xs flex items-center gap-1.5 text-yellow-400">
                  <Cpu className="w-3.5 h-3.5" />
                  Tactical Coach Analytics
                </span>

                <div className="space-y-3 font-rajdhani text-xs text-white/70 leading-relaxed">
                  <div className="flex items-start gap-2.5">
                    <TrendingUp className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <p>
                      <strong className="text-white font-bold">{d1Meta.name} ({d1Meta.abbr})</strong> hit a top speed of <span className="text-white font-bold font-orbitron">{analysis.d1MaxSpeed} km/h</span> compared to <span className="text-white font-bold font-orbitron">{analysis.d2MaxSpeed} km/h</span> for <strong className="text-white/90">{d2Meta.abbr}</strong> (Delta: <span className="text-emerald-400 font-bold">+{analysis.speedDelta.toFixed(1)} km/h</span>).
                    </p>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <Zap className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                    <p>
                      Average throttle percentage was <span className="text-white font-bold">{analysis.d1AvgThrottle}%</span> vs <span className="text-white font-bold">{analysis.d2AvgThrottle}%</span>. A higher throttle percentage indicates earlier corner exit application or longer straight sections.
                    </p>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <ShieldAlert className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                    <p>
                      Braking footprint ratio: <span className="text-white font-bold">{analysis.d1Brakes}%</span> of the lap spent braking vs <span className="text-white font-bold">{analysis.d2Brakes}%</span>. A lower braking ratio implies higher corner velocity carry or later deceleration zones.
                    </p>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}

