"use client";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { f1Api } from "@/lib/api/client";
import { useStandingsStore, useSettingsStore } from "@/lib/store";
import { Trophy, TrendingUp, Users } from "lucide-react";
import { useEffect } from "react";

export default function StandingsPage() {
  const { drivers, constructors, engines, setDrivers, setConstructors, setEngines } = useStandingsStore();
  const { selectedYear } = useSettingsStore();
  const [tab, setTab] = useState<"drivers" | "constructors" | "engines">("drivers");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredEngine, setHoveredEngine] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [res, engRes] = await Promise.allSettled([
          f1Api.getStandings(selectedYear),
          f1Api.getEngineStandings(selectedYear)
        ]);
        let driverList: any[] = [], constructorList: any[] = [], engineList: any[] = [];
        if (res.status === "fulfilled") {
          const d = (res.value as any).data || res.value;
          driverList = d.drivers || [];
          constructorList = d.constructors || [];
        }
        if (engRes.status === "fulfilled") {
          engineList = (engRes.value as any).data || engRes.value;
        }
        if (driverList.length === 0 && constructorList.length === 0) {
          setError("Unable to load standings data. The Jolpica/Ergast API may be temporarily unavailable.");
        }
        setDrivers(driverList);
        setConstructors(constructorList);
        setEngines(engineList);
      } catch (e) {
        setError("Failed to fetch standings. Please check your connection and try again.");
      }
      setLoading(false);
    }
    load();
  }, [selectedYear]);

  const chartData = useMemo(() => {
    if (tab === "drivers") return drivers.slice(0, 10).map(d => ({ name: d.name?.split(" ").pop() || d.name, pts: d.points, color: d.color }));
    if (tab === "constructors") return constructors.slice(0, 10).map(c => ({ name: c.name, pts: c.points, color: c.color }));
    return engines.slice(0, 8).map((e: any) => ({ name: e.name, pts: e.points, color: e.color }));
  }, [tab, drivers, constructors, engines]);

  const activeList = tab === "drivers" ? drivers : tab === "constructors" ? constructors : engines;

  return (
    <div className="p-4 lg:p-8 min-h-screen max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-apex-red/20 to-transparent flex items-center justify-center border border-apex-red/20">
              <Trophy className="w-5 h-5 text-apex-red" />
            </div>
            <h1 className="font-orbitron font-bold text-white text-3xl tracking-tight">STANDINGS</h1>
          </div>
          <div className="text-white/60 text-sm font-rajdhani tracking-widest uppercase mt-2">{selectedYear} Season Overview</div>
        </div>
        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-xl border border-white/10 p-1.5 rounded-2xl shadow-lg">
          {(["drivers", "constructors", "engines"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-6 py-2.5 rounded-xl text-xs font-rajdhani font-bold uppercase tracking-widest transition-all duration-300"
              style={{
                background: tab === t ? "rgba(255,255,255,0.1)" : "transparent",
                color: tab === t ? "#fff" : "rgba(255,255,255,0.4)",
                boxShadow: tab === t ? "0 4px 15px rgba(0,0,0,0.2)" : "none",
              }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Table */}
        <div className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.3)] max-h-[75vh] overflow-y-auto lg:col-span-7">
          <div className="sticky top-0 bg-black/60 backdrop-blur-2xl z-10 grid grid-cols-12 gap-2 px-6 py-4 border-b border-white/10 text-[10px] font-rajdhani font-bold tracking-widest text-white/50 uppercase">
            <span className="col-span-1">POS</span>
            <span className={tab === "drivers" ? "col-span-5" : "col-span-7"}>{tab === "drivers" ? "DRIVER" : tab === "constructors" ? "TEAM" : "ENGINE SUPPLIER"}</span>
            {tab === "drivers" && <span className="col-span-2 text-center">NUMBER</span>}
            <span className="col-span-2 text-center">WINS</span>
            <span className="col-span-2 text-right">POINTS</span>
          </div>

          {loading ? (
            <div className="p-6 space-y-3">{Array(10).fill(0).map((_, i) => <div key={i} className="skeleton h-12 rounded-xl bg-white/5" />)}</div>
          ) : error ? (
            <div className="p-16 text-center">
              <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-6">
                <TrendingUp className="w-8 h-8 text-white/20" />
              </div>
              <div className="text-apex-red text-xs font-rajdhani font-bold uppercase tracking-widest mb-2">⚠ Data Unavailable</div>
              <p className="text-white/40 text-sm max-w-sm mx-auto">{error}</p>
            </div>
          ) : activeList.length === 0 ? (
            <div className="p-16 text-center text-white/30 text-sm font-rajdhani">No standings data available.</div>
          ) : activeList.map((entry: any, i: number) => (
            <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
              className="grid grid-cols-12 gap-2 px-6 py-4 items-center border-b border-white/[0.04] last:border-0 hover:bg-white/[0.04] transition-colors group relative"
              style={{ borderLeft: i < 3 ? `4px solid ${entry.color || "#888"}` : "4px solid transparent" }}
              onMouseEnter={() => tab === "engines" && setHoveredEngine(entry.name)}
              onMouseLeave={() => setHoveredEngine(null)}
            >
              <span className="col-span-1 font-orbitron font-bold text-base" style={{ color: i === 0 ? "#e10600" : "rgba(255,255,255,0.4)" }}>{entry.position}</span>
              <div className={`${tab === "drivers" ? "col-span-5" : "col-span-7"} flex items-center gap-3`}>
                <div className="w-1 h-6 rounded-full" style={{ backgroundColor: entry.color || "#888", boxShadow: `0 0 8px ${entry.color || "#888"}66` }} />
                <span className="text-base text-white font-rajdhani font-bold tracking-wide">{entry.name}</span>
                {tab === "engines" && entry.teams && (
                  <span className="text-[9px] text-white/30 font-rajdhani hidden lg:block">{entry.teams.slice(0, 2).join(" · ")}</span>
                )}
              </div>
              {tab === "drivers" && (
                <div className="col-span-2 flex justify-center">
                  <span className="text-xs font-orbitron text-white/40">#{entry.number || "—"}</span>
                </div>
              )}
              <span className="col-span-2 text-center text-white/40 text-sm font-bold">{entry.wins ?? 0}</span>
              <span className="col-span-2 text-right font-orbitron font-bold text-base" style={{ color: entry.color || "#fff" }}>{entry.points}</span>

              {/* Engine breakdown tooltip */}
              {tab === "engines" && hoveredEngine === entry.name && entry.breakdown?.length > 0 && (
                <div className="absolute right-6 top-full z-50 mt-1 bg-black/90 backdrop-blur-xl border border-white/20 rounded-2xl p-4 min-w-[200px] shadow-2xl">
                  <p className="text-[10px] text-white/50 font-rajdhani uppercase tracking-widest mb-3 font-bold">Team Contribution</p>
                  {entry.breakdown.map((b: any, bi: number) => (
                    <div key={bi} className="flex items-center justify-between mb-2 last:mb-0">
                      <span className="text-sm font-rajdhani font-bold text-white/80">{b.team}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${b.pct}%`, backgroundColor: entry.color || "#888" }} />
                        </div>
                        <span className="text-xs font-orbitron text-white/60">{b.pct}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Bar chart */}
        <div className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-3xl p-6 lg:col-span-5 flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-4 h-4 text-white/50" />
            <h3 className="font-rajdhani font-bold text-white/50 text-sm tracking-widest uppercase">Points Distribution</h3>
          </div>
          {loading ? <div className="skeleton rounded-2xl h-[400px] bg-white/5" /> : (
            <div className="flex-1 w-full min-h-[400px]">
              <ResponsiveContainer width="100%" height={420}>
                <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10, fontFamily: "Rajdhani" }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11, fontFamily: "Rajdhani", fontWeight: 600 }} tickLine={false} axisLine={false} width={110} />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    contentStyle={{ background: "rgba(0,0,0,0.9)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12, fontFamily: "Rajdhani", fontWeight: 600 }}
                  />
                  <Bar dataKey="pts" radius={[0, 6, 6, 0]} barSize={20}>
                    {chartData.map((entry, i) => <Cell key={i} fill={entry.color || "#e10600"} opacity={0.9} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
      <p className="mt-6 text-white/20 text-[10px] font-rajdhani text-right tracking-widest uppercase">
        Data via Jolpica / Ergast API · Cached 1h · Hover engine rows for team breakdown
      </p>
    </div>
  );
}
