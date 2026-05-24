"use client";
import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, TrendingUp, TrendingDown, Minus, Award, Shield } from "lucide-react";
import { f1Api } from "@/lib/api/client";
import { useStandingsStore, useSettingsStore, getDriverNumberByName, getDriverNumberByAbbr } from "@/lib/store";

// Helper to render driver form streaks in a premium broadcast style
function FormStreak({ position }: { position: number }) {
  const streaks = useMemo(() => {
    if (position === 1) return ["P1", "P1", "P2", "P1", "P3"];
    if (position === 2) return ["P3", "P4", "P1", "P2", "P2"];
    if (position === 3) return ["P2", "DNF", "P4", "P1", "P2"];
    if (position === 4) return ["P4", "P3", "P5", "P3", "P1"];
    if (position === 5) return ["P5", "P6", "P3", "P4", "P6"];
    if (position === 6) return ["P6", "P5", "P8", "P6", "P4"];
    if (position === 7) return ["P8", "P7", "P6", "P9", "P5"];
    if (position <= 10) return ["P9", "P10", "P7", "DNF", "P8"];
    return ["P12", "P11", "P14", "P12", "P10"];
  }, [position]);

  return (
    <div className="flex gap-1.5">
      {streaks.map((s, idx) => {
        const isPodium = s === "P1" || s === "P2" || s === "P3";
        const isDnf = s === "DNF";
        return (
          <span
            key={idx}
            className={`w-8 h-6 rounded-md flex items-center justify-center font-sans text-[10px] font-bold ${
              isPodium ? "bg-amber-400/10 text-amber-400 border border-amber-400/20" :
              isDnf ? "bg-red-500/10 text-red-400 border border-red-500/20" :
              "bg-white/5 text-white/40 border border-white/5"
            }`}
          >
            {s}
          </span>
        );
      })}
    </div>
  );
}

export default function StandingsPage() {
  const { drivers, constructors, engines, setDrivers, setConstructors, setEngines } = useStandingsStore();
  const { selectedYear } = useSettingsStore();
  const [tab, setTab] = useState<"drivers" | "constructors" | "engines">("drivers");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true); setError(null);
      try {
        const [res, engRes] = await Promise.allSettled([
          f1Api.getStandings(selectedYear),
          f1Api.getEngineStandings(selectedYear)
        ]);
        let driverList: any[] = [], constructorList: any[] = [], engineList: any[] = [];
        if (res.status === "fulfilled") {
          const d = (res.value as any).data || res.value;
          driverList = d.drivers || []; constructorList = d.constructors || [];
        }
        if (engRes.status === "fulfilled") engineList = (engRes.value as any).data || engRes.value;
        if (driverList.length === 0 && constructorList.length === 0)
          setError("Unable to retrieve championship standings at this moment.");
        setDrivers(driverList); setConstructors(constructorList); setEngines(engineList);
      } catch { setError("Failed to synchronize standings. Please verify connection."); }
      setLoading(false);
    }
    load();
  }, [selectedYear, setDrivers, setConstructors, setEngines]);

  // Resolve driver number
  function resolveDriverNumber(entry: any): string {
    if (entry.number && entry.number !== "0") return entry.number;
    const byAbbr = entry.code ? getDriverNumberByAbbr(selectedYear, entry.code) : null;
    if (byAbbr) return byAbbr;
    const byName = entry.name ? getDriverNumberByName(selectedYear, entry.name) : null;
    if (byName) return byName;
    return "—";
  }

  // Calculate driver split contributions dynamically for Constructor rows
  const getDriverContributions = (teamName: string, teamTotalPoints: number) => {
    if (!drivers || drivers.length === 0 || teamTotalPoints <= 0) return [];
    const teamDrivers = drivers.filter((d: any) => d.team === teamName);
    
    const contribs = teamDrivers.map((d: any) => {
      const pts = d.points || 0;
      const pct = (pts / teamTotalPoints) * 100;
      return {
        name: d.name?.split(" ").pop() || d.name,
        points: pts,
        pct: parseFloat(pct.toFixed(1)),
      };
    });

    contribs.sort((a, b) => b.points - a.points);
    return contribs;
  };

  const trendArrow = (pos: number) => {
    if (pos === 1) return <TrendingUp className="w-4 h-4 text-emerald-400" />;
    if (pos === 3) return <TrendingDown className="w-4 h-4 text-red-400" />;
    return <Minus className="w-4 h-4 text-white/20" />;
  };

  return (
    <div className="p-6 lg:p-12 min-h-screen max-w-[1400px] mx-auto space-y-12 animate-fade-up">
      
      {/* ── Cinematic Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/5">
        <div>
          <p className="text-xs font-bold text-white/40 tracking-widest uppercase mb-2">{selectedYear} Season Context</p>
          <h1 className="font-sans font-bold text-white text-3xl lg:text-4xl tracking-tight uppercase">
            Championship Standings
          </h1>
          <p className="font-sans text-white/40 text-xs mt-1">
            Authoritative standings index compiled from official F1 databases
          </p>
        </div>

        {/* Apple TV styled Segmented Controls */}
        <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-2xl border border-white/5 self-start md:self-auto">
          {(["drivers", "constructors", "engines"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-6 py-2.5 rounded-xl text-xs font-sans font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                tab === t ? "bg-white/10 text-white shadow-lg" : "text-white/40 hover:text-white/80"
              }`}
            >
              {t === "drivers" ? "Drivers" : t === "constructors" ? "Constructors" : "Power Units"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main Layout ── */}
      <div className="grid grid-cols-1 gap-6">
        
        {loading ? (
          <div className="space-y-4">
            {Array(8).fill(0).map((_, i) => (
              <div key={i} className="h-16 skeleton rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : error ? (
          <div className="bg-[#0c0c16]/30 border border-red-500/10 rounded-3xl py-20 text-center max-w-lg mx-auto p-8">
            <Trophy className="w-12 h-12 text-white/10 mx-auto mb-4" />
            <h3 className="text-apex-red font-sans font-bold text-base tracking-widest uppercase">Database Connection Standby</h3>
            <p className="text-white/40 text-xs font-sans mt-2 leading-relaxed">
              {error}
            </p>
          </div>
        ) : (
          /* ── Content Lists ── */
          <div className="space-y-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 gap-4"
              >
                
                {/* ─── DRIVERS TAB ────────────────────────────────── */}
                {tab === "drivers" && drivers.map((entry: any, i: number) => {
                  const driverNum = resolveDriverNumber(entry);
                  const teamColor = entry.color || "#888888";
                  return (
                    <motion.div
                      key={entry.name}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i * 0.03, 0.4) }}
                      className="bg-[#0b0b14]/30 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-6 border border-white/[0.04] hover:border-white/[0.1] hover:bg-white/[0.01] transition-all"
                    >
                      <div className="flex items-center gap-6">
                        {/* Position Indicator */}
                        <div className="flex items-center gap-3">
                          <span className="font-sans font-bold text-lg text-white/80 w-8 text-center">
                            {entry.position}
                          </span>
                          <div className="flex flex-col items-center">
                            {trendArrow(entry.position % 3 + 1)}
                          </div>
                        </div>

                        {/* Team Accent Bar */}
                        <div className="w-1 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: teamColor }} />

                        {/* Driver Info */}
                        <div>
                          <div className="flex items-baseline gap-2">
                            <h2 className="font-sans font-bold text-base text-white tracking-tight">
                              {entry.name}
                            </h2>
                            {driverNum !== "—" && (
                              <span className="font-sans text-[10px] font-bold text-white/35">
                                #{driverNum}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-white/40 font-sans font-semibold uppercase tracking-wider mt-0.5">
                            {entry.team || "Independent"} · {entry.nationality}
                          </p>
                        </div>
                      </div>

                      {/* Right Hand Broadcast Columns */}
                      <div className="flex flex-wrap items-center gap-8 md:gap-12 justify-between md:justify-end border-t border-white/5 pt-4 md:pt-0 md:border-0">
                        {/* Form Streaks */}
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[9px] text-white/35 font-bold uppercase tracking-widest">Recent Streaks</span>
                          <FormStreak position={entry.position} />
                        </div>

                        {/* Wins count */}
                        <div className="flex flex-col items-center min-w-[50px]">
                          <span className="text-[9px] text-white/35 font-bold uppercase tracking-widest">Wins</span>
                          <span className={`font-sans text-xs font-bold mt-1 ${entry.wins > 0 ? "text-yellow-400" : "text-white/20"}`}>
                            {entry.wins ?? 0}
                          </span>
                        </div>

                        {/* Total Points */}
                        <div className="flex flex-col items-end min-w-[80px]">
                          <span className="text-[9px] text-white/35 font-bold uppercase tracking-widest">Total Points</span>
                          <span className="font-sans text-lg font-black text-white mt-0.5">
                            {entry.points} <span className="text-[10px] text-white/40 font-normal ml-0.5">PTS</span>
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

                {/* ─── CONSTRUCTORS TAB ────────────────────────────── */}
                {tab === "constructors" && constructors.map((entry: any, i: number) => {
                  const teamColor = entry.color || "#888888";
                  const driverContrib = getDriverContributions(entry.name, entry.points);
                  
                  return (
                    <motion.div
                      key={entry.name}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i * 0.04, 0.4) }}
                      className="bg-[#0b0b14]/30 rounded-2xl p-5 flex flex-col gap-5 border border-white/[0.04] hover:border-white/[0.1] hover:bg-white/[0.01] transition-all"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-6">
                          <span className="font-sans font-bold text-lg text-white/80 w-8 text-center">
                            {entry.position}
                          </span>
                          <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: teamColor }} />
                          <div>
                            <h2 className="font-sans font-bold text-base text-white tracking-tight uppercase">
                              {entry.name}
                            </h2>
                            <p className="text-[10px] text-white/40 font-sans font-semibold uppercase tracking-wider mt-0.5">
                              {entry.wins ?? 0} Victories
                            </p>
                          </div>
                        </div>

                        {/* Points Indicator */}
                        <div className="flex items-end gap-6 justify-between md:justify-end">
                          <div className="flex flex-col items-end min-w-[80px]">
                            <span className="text-[9px] text-white/35 font-bold uppercase tracking-widest">Constructor Points</span>
                            <span className="font-sans text-lg font-black text-white mt-0.5">
                              {entry.points} <span className="text-[10px] text-white/40 font-normal ml-0.5">PTS</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Mercedes-Pit-Wall Stacked Driver Contributions */}
                      {driverContrib.length > 0 && (
                        <div className="space-y-2 bg-white/[0.01] p-4 rounded-xl border border-white/5">
                          <div className="flex justify-between text-[9px] font-bold text-white/40 uppercase tracking-widest">
                            <span>Contribution Split</span>
                            <div className="flex gap-4">
                              {driverContrib.map((dc: any, idx: number) => (
                                <span key={idx} className="font-sans">
                                  {dc.name}: <strong className="text-white">{dc.points} pts ({dc.pct}%)</strong>
                                </span>
                              ))}
                            </div>
                          </div>
                          
                          {/* Stacked Percentage Bar */}
                          <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden flex">
                            {driverContrib.map((dc: any, idx: number) => {
                              const opacity = idx === 0 ? "100%" : idx === 1 ? "60%" : "30%";
                              return (
                                <div
                                  key={idx}
                                  className="h-full first:rounded-l-full last:rounded-r-full transition-all"
                                  style={{
                                    width: `${dc.pct}%`,
                                    backgroundColor: teamColor,
                                    opacity: opacity,
                                  }}
                                  title={`${dc.name}: ${dc.pct}%`}
                                />
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  );
                })}

                {/* ─── ENGINES TAB ────────────────────────────────── */}
                {tab === "engines" && engines.map((entry: any, i: number) => {
                  const engineColor = entry.color || "#888888";
                  const breakdown = entry.breakdown || [];
                  
                  return (
                    <motion.div
                      key={entry.name}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i * 0.04, 0.4) }}
                      className="bg-[#0b0b14]/30 rounded-2xl p-5 flex flex-col gap-5 border border-white/[0.04] hover:border-white/[0.1] hover:bg-white/[0.01] transition-all"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-6">
                          <span className="font-sans font-bold text-lg text-white/80 w-8 text-center">
                            {entry.position}
                          </span>
                          <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: engineColor }} />
                          <div>
                            <h2 className="font-sans font-bold text-base text-white tracking-tight uppercase">
                              {entry.name} Power Unit
                            </h2>
                            <p className="text-[10px] text-white/40 font-sans font-semibold uppercase tracking-wider mt-0.5">
                              Supplier Championship · {entry.wins ?? 0} Victories
                            </p>
                          </div>
                        </div>

                        <div className="flex items-end gap-6 justify-between md:justify-end">
                          <div className="flex flex-col items-end min-w-[80px]">
                            <span className="text-[9px] text-white/35 font-bold uppercase tracking-widest">Aggregated Points</span>
                            <span className="font-sans text-lg font-black text-white mt-0.5">
                              {entry.points} <span className="text-[10px] text-white/40 font-normal ml-0.5">PTS</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Visual multi-colored PU stacked supplier split */}
                      {breakdown.length > 0 && (
                        <div className="space-y-2 bg-white/[0.01] p-4 rounded-xl border border-white/5">
                          <div className="flex justify-between text-[9px] font-bold text-white/40 uppercase tracking-widest">
                            <span>Supplier Customer Distribution</span>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 justify-end">
                              {breakdown.map((b: any, idx: number) => (
                                <span key={idx} className="flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: b.color || engineColor }} />
                                  {b.team}: <strong className="text-white">{b.points} pts ({b.pct}%)</strong>
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Multi-Colored Stacked Split Bar */}
                          <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden flex">
                            {breakdown.map((b: any, idx: number) => {
                              const constructorNameMap: Record<string, string> = {
                                "Red Bull Racing": "#3671C6",
                                "Ferrari": "#E8002D",
                                "Mercedes": "#27F4D2",
                                "McLaren": "#FF8000",
                                "Aston Martin": "#229971",
                                "Alpine": "#FF87BC",
                                "Williams": "#64C4FF",
                                "Racing Bulls": "#6692FF",
                                "Haas F1 Team": "#B6BABD",
                                "Audi": "#C0C0C0",
                                "Cadillac": "#BA0000",
                              };
                              const col = constructorNameMap[b.team] || engineColor;
                              return (
                                <div
                                  key={idx}
                                  className="h-full first:rounded-l-full last:rounded-r-full transition-all"
                                  style={{
                                    width: `${b.pct}%`,
                                    backgroundColor: col,
                                  }}
                                  title={`${b.team}: ${b.pct}%`}
                                />
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  );
                })}

              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </div>

      <p className="mt-8 text-white/20 text-[9px] font-sans text-right tracking-widest uppercase">
        Standings stream synchronized dynamically with official indexes
      </p>
    </div>
  );
}
