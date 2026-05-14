"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, AreaChart, Area, ReferenceArea
} from "recharts";
import { f1Api } from "@/lib/api/client";
import { useTelemetryStore, useSettingsStore, DRIVER_DATABASE, getDriverByYear } from "@/lib/store";
import { Activity, ChevronDown, RefreshCw } from "lucide-react";

const DRIVER_COLOR_1 = "#e10600";
const DRIVER_COLOR_2 = "#27F4D2";

const SESSIONS = ["FP1", "FP2", "FP3", "Qualifying", "Sprint", "Race"];

// TrackMapOverlay removed — generic SVG was not circuit-specific and was misleading.

function ChartSection({ title, d1, d2, dataKey, color1 = DRIVER_COLOR_1, color2 = DRIVER_COLOR_2, domain }: {
  title: string; d1: any[]; d2: any[]; dataKey: string; color1?: string; color2?: string; domain?: [number, number];
}) {
  const merged = d1.map((p, i) => ({
    dist: p.distance ? Math.round(p.distance) : p.time ? Math.round(p.time * 10) : i,
    driver1: p[dataKey],
    driver2: d2[i]?.[dataKey],
  }));

  const maxDist = merged.length > 0 ? merged[merged.length - 1].dist : 5000;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-all duration-300">
      <h3 className="font-rajdhani font-bold text-white/80 text-[11px] tracking-wider mb-2 uppercase">{title}</h3>
      <ResponsiveContainer width="100%" height={120}>
        <AreaChart data={merged} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id={`g1-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color1} stopOpacity={0.4} />
              <stop offset="95%" stopColor={color1} stopOpacity={0} />
            </linearGradient>
            <linearGradient id={`g2-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color2} stopOpacity={0.4} />
              <stop offset="95%" stopColor={color2} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
          
          <XAxis dataKey="dist" tick={false} tickLine={false} axisLine={false} />
          <YAxis domain={domain} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9, fontFamily: "Rajdhani" }} tickLine={false} axisLine={false} width={45} />
          <Tooltip
            cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
            contentStyle={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11, fontFamily: "Rajdhani", fontWeight: 600, padding: "4px 8px" }}
            labelStyle={{ display: "none" }}
          />
          <Area type="monotone" dataKey="driver1" stroke={color1} fill={`url(#g1-${dataKey})`} strokeWidth={1.5} dot={false} activeDot={{ r: 3, fill: color1, stroke: "#000" }} />
          <Area type="monotone" dataKey="driver2" stroke={color2} fill={`url(#g2-${dataKey})`} strokeWidth={1.5} dot={false} activeDot={{ r: 3, fill: color2, stroke: "#000" }} />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

export default function TelemetryPage() {
  const { driver1, driver2, driver1Data, driver2Data, setDriver1, setDriver2, setDriver1Data, setDriver2Data } = useTelemetryStore();
  const { selectedYear, selectedRound, selectedSession, selectedLap, setSelectedSession, setSelectedLap, currentRace } = useSettingsStore();
  const [loading, setLoading] = useState(false);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);

  async function loadTelemetry() {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.allSettled([
        f1Api.getTelemetry(selectedYear, selectedRound, selectedSession, driver1, selectedLap === "all" ? undefined : selectedLap as number),
        f1Api.getTelemetry(selectedYear, selectedRound, selectedSession, driver2, selectedLap === "all" ? undefined : selectedLap as number),
      ]);
      if (r1.status === "fulfilled") setDriver1Data((r1.value as any).data || []);
      if (r2.status === "fulfilled") setDriver2Data((r2.value as any).data || []);
      setLoadedAt(new Date().toLocaleTimeString());
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  // NO auto-fetch on mount — telemetry is expensive (FastF1 cold-load can take 30s+).
  // User must explicitly press LOAD to trigger a fetch.

  const DriverSelect = ({ value, onChange, color }: { value: string; onChange: (v: string) => void; color: string }) => {
    const db = Object.entries(
      selectedYear >= 2026 ? DRIVER_DATABASE
        : Object.fromEntries(
            // filter to year-relevant numbers
            Object.entries(DRIVER_DATABASE).filter(([n]) => n !== "33")
          )
    ).filter(([num]) => num !== "33");
    return (
      <div className="relative flex items-center">
        <div className="w-2.5 h-2.5 rounded-full mr-[-24px] z-10" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}88` }} />
        <select
          value={value} onChange={(e) => onChange(e.target.value)}
          className="appearance-none pl-10 pr-8 py-2 rounded-xl text-xs font-rajdhani font-bold cursor-pointer outline-none transition-colors"
          style={{ background: "rgba(255,255,255,0.05)", border: `1px solid rgba(255,255,255,0.1)`, color: "#fff" }}
        >
          {Object.entries(DRIVER_DATABASE).map(([num, d]) => (
            <option key={num} value={num} style={{ background: "#111" }}>{d.abbr} #{num}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none text-white/50" />
      </div>
    );
  };

  return (
    <div className="p-4 lg:p-8 min-h-screen max-w-[1600px] mx-auto">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between mb-8 gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-apex-red/20 to-transparent flex items-center justify-center border border-apex-red/20">
              <Activity className="w-5 h-5 text-apex-red" />
            </div>
            <h1 className="font-orbitron font-bold text-white text-3xl tracking-tight">TELEMETRY</h1>
          </div>
          <div className="text-white/60 text-sm font-rajdhani tracking-widest uppercase mt-2 flex items-center gap-2">
            <span>{selectedYear}</span>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span>Round {selectedRound}</span>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span className="text-white/80">{currentRace?.event_name || currentRace?.location || "—"}</span>
            {loadedAt && (
              <><span className="w-1 h-1 rounded-full bg-white/20" />
              <span className="text-green-400/70">Loaded {loadedAt}</span></>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 bg-black/40 backdrop-blur-xl p-2 rounded-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          <DriverSelect value={driver1} onChange={setDriver1} color={DRIVER_COLOR_1} />
          <span className="text-white/20 text-[10px] font-rajdhani font-bold uppercase px-0.5">vs</span>
          <DriverSelect value={driver2} onChange={setDriver2} color={DRIVER_COLOR_2} />
          
          <div className="h-6 w-px bg-white/10 mx-1" />
          
          <select 
            value={selectedSession} 
            onChange={(e) => setSelectedSession(e.target.value)}
            className="appearance-none bg-white/5 hover:bg-white/10 transition-colors border border-white/10 px-4 py-2 rounded-xl text-xs font-rajdhani font-bold tracking-wide text-white outline-none cursor-pointer"
          >
            {SESSIONS.map(s => (
              <option key={s} value={s} className="bg-[#111]">{s}</option>
            ))}
          </select>

          <select 
            value={selectedLap.toString()} 
            onChange={(e) => setSelectedLap(e.target.value === "all" ? "all" : parseInt(e.target.value))}
            className="appearance-none bg-white/5 hover:bg-white/10 transition-colors border border-white/10 px-4 py-2 rounded-xl text-xs font-rajdhani font-bold tracking-wide text-white outline-none cursor-pointer"
          >
            <option value="all" className="bg-[#111]">Full Session</option>
            {Array.from({length: 80}, (_, i) => i + 1).map(l => (
              <option key={l} value={l} className="bg-[#111]">Lap {l}</option>
            ))}
          </select>

          <button onClick={loadTelemetry} disabled={loading}
            className="px-5 py-2 rounded-xl text-xs font-rajdhani font-bold tracking-widest uppercase transition-all hover:scale-105 active:scale-95 ml-1 flex items-center gap-2 disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#e10600,#ff4d00)", color: "#fff", boxShadow: "0 4px 15px 0 rgba(225, 6, 0, 0.4)" }}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            {driver1Data.length > 0 ? "RELOAD" : "LOAD"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="skeleton rounded-2xl h-40 bg-white/5" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Array(4).fill(0).map((_, i) => <div key={i} className="skeleton rounded-2xl h-32 bg-white/5" />)}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {/* Track map removed — was a generic SVG unrelated to actual circuit */}
          
          {driver1Data.length === 0 ? (
            <div className="bg-black/20 backdrop-blur-xl border border-white/5 rounded-3xl py-32 text-center flex flex-col items-center justify-center shadow-[0_8px_32px_rgba(0,0,0,0.3)] mt-4">
              <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-8 shadow-[0_0_40px_rgba(255,255,255,0.02)]">
                <Activity className="w-10 h-10 text-white/20" />
              </div>
              <h2 className="text-white font-orbitron font-bold text-xl mb-3 tracking-wide">TELEMETRY UNAVAILABLE</h2>
              <p className="text-white/40 text-sm max-w-md font-rajdhani tracking-widest uppercase">No telemetry data is currently available for this session and driver combination.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartSection title="Speed (km/h)" d1={driver1Data} d2={driver2Data} dataKey="speed" domain={[0, 360]} />
            <ChartSection title="Throttle (%)" d1={driver1Data} d2={driver2Data} dataKey="throttle" domain={[0, 100]} />
            <ChartSection title="Brake" d1={driver1Data} d2={driver2Data} dataKey="brake" domain={[0, 1]} />
            <ChartSection title="RPM" d1={driver1Data} d2={driver2Data} dataKey="rpm" />
          </div>

          {/* Gear visualization */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-all duration-300">
            <h3 className="font-rajdhani font-bold text-white/80 text-[11px] tracking-wider mb-2 uppercase">Gear Selection</h3>
            <ResponsiveContainer width="100%" height={80}>
              <LineChart data={driver1Data.map((p, i) => ({ dist: p.distance ? Math.round(p.distance) : p.time ? Math.round(p.time * 10) : i, gear: p.gear, gear2: driver2Data[i]?.gear }))} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
                <XAxis dataKey="dist" tick={false} tickLine={false} axisLine={false} />
                <YAxis domain={[1, 8]} ticks={[1,2,3,4,5,6,7,8]} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9, fontFamily: "Rajdhani" }} tickLine={false} axisLine={false} width={45} />
                <Tooltip 
                  cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
                  contentStyle={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11, fontFamily: "Rajdhani", fontWeight: 600, padding: "4px 8px" }} 
                  labelStyle={{ display: "none" }}
                />
                <Line type="stepAfter" dataKey="gear" stroke={DRIVER_COLOR_1} strokeWidth={1.5} dot={false} />
                <Line type="stepAfter" dataKey="gear2" stroke={DRIVER_COLOR_2} strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
