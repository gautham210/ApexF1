import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useMemo } from "react";
import { Trophy, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { f1Api } from "@/lib/api/client";
import { useSessionContext } from "@/hooks/useSessionContext";
import { useStandingsStore, getDriverNumberByAbbr, getDriverNumberByName } from "@/lib/store";
import { GlassPanel } from "@/components/GlassPanel";
import { cn } from "@/lib/utils";

import heroDriver from "@/assets/hero-driver.jpg";

export const Route = createFileRoute("/standings")({
  head: () => ({
    meta: [
      { title: "ApexF1 — Championship standings" },
      { name: "description", content: "Official driver and constructor standings for the Formula 1 season." },
    ],
  }),
  component: StandingsPage,
});

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
    <div className="flex gap-1">
      {streaks.map((s, idx) => {
        const isPodium = s === "P1" || s === "P2" || s === "P3";
        return (
          <span
            key={idx}
            className={cn(
              "w-7 h-5 rounded-md flex items-center justify-center font-sans text-[8px] font-black border",
              isPodium
                ? "bg-foreground/10 text-foreground border-foreground/10"
                : "bg-foreground/[0.02] text-muted-foreground border-border/20",
            )}
          >
            {s}
          </span>
        );
      })}
    </div>
  );
}

function StandingsPage() {
  const { season } = useSessionContext();
  const { drivers, constructors, engines, setDrivers, setConstructors, setEngines } = useStandingsStore();

  const [tab, setTab] = useState<"drivers" | "constructors" | "engines">("drivers");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [res, engRes] = await Promise.allSettled([
          f1Api.getStandings(season),
          f1Api.getEngineStandings(season),
        ]);
        
        let driverList: any[] = [];
        let constructorList: any[] = [];
        let engineList: any[] = [];

        if (res.status === "fulfilled") {
          const d = (res.value as any).data || res.value;
          driverList = d.drivers || [];
          constructorList = d.constructors || [];
        }
        if (engRes.status === "fulfilled") {
          engineList = (engRes.value as any).data || engRes.value;
        }

        if (driverList.length === 0 && constructorList.length === 0) {
          if (season > 2025) {
            setError(`Championship standings for the ${season} season will appear once the opening race concludes.`);
          } else {
            setError("Championship standings are currently offline for this historical season.");
          }
        }

        setDrivers(driverList);
        setConstructors(constructorList);
        setEngines(engineList);
      } catch {
        setError("Championship standings are currently offline. Please try again later.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [season, setDrivers, setConstructors, setEngines]);

  function resolveDriverNumber(entry: any): string {
    if (entry.number && entry.number !== "0") return entry.number;
    const byAbbr = entry.code ? getDriverNumberByAbbr(season, entry.code) : null;
    if (byAbbr) return byAbbr;
    const byName = entry.name ? getDriverNumberByName(season, entry.name) : null;
    if (byName) return byName;
    return "—";
  }

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

  const trendIcon = (pos: number) => {
    if (pos === 1 || pos === 4) return <TrendingUp className="h-4 w-4 text-primary/80" strokeWidth={1.5} />;
    if (pos === 3 || pos === 5) return <TrendingDown className="h-4 w-4 text-muted-foreground/50" strokeWidth={1.5} />;
    return <Minus className="h-4 w-4 text-muted-foreground/30" strokeWidth={1.5} />;
  };

  // Find dynamic leader details
  const leaderDriver = drivers[0] || null;

  return (
    <div className="min-h-screen px-6 pb-32 pt-12 lg:px-12">
      <div className="mx-auto max-w-[1300px]">
        <header className="mb-10 flex flex-wrap items-end justify-between gap-6 pb-6 border-b border-border/40">
          <div>
            <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground uppercase">CHAMPIONSHIP STANDINGS</div>
            <h1 className="mt-2 font-display text-5xl md:text-6xl">Standings</h1>
            <p className="mt-3 max-w-xl text-muted-foreground">
              Official championship standing results compiled from direct timing feeds.
            </p>
          </div>

          {/* Segmented control tabs */}
          <div className="inline-flex rounded-full glass-strong p-1 text-sm">
            {(["drivers", "constructors", "engines"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "rounded-full px-5 py-2.5 transition text-xs font-mono uppercase tracking-wider font-bold",
                  tab === t ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t === "drivers" ? "Drivers" : t === "constructors" ? "Constructors" : "Power unit"}
              </button>
            ))}
          </div>
        </header>

        {loading ? (
          <div className="space-y-4">
            {Array(6).fill(0).map((_, i) => (
              <div key={i} className="h-16 skeleton rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : error ? (
          <GlassPanel className="glass border border-white/5 rounded-3xl py-20 text-center max-w-lg mx-auto p-8 border-border/40">
            <Trophy className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
            <h3 className="font-display text-2xl">Standings will populate after Round 1</h3>
            <p className="text-muted-foreground text-sm mt-3 leading-relaxed max-w-xs mx-auto">
              {error}
            </p>
          </GlassPanel>
        ) : (
          <div className="grid gap-6">
            <AnimatePresence mode="wait">
              {tab === "drivers" && (
                <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]" key="drivers">
                  {/* Drivers catalog */}
                  <div className="flex flex-col gap-3">
                    {drivers.map((d: any, i: number) => {
                      const driverNum = resolveDriverNumber(d);
                      const teamColor = d.color || "#888888";
                      return (
                        <motion.div
                          key={d.name}
                          initial={{ opacity: 0, y: 12 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.4, delay: i * 0.03 }}
                        >
                          <GlassPanel className="group relative overflow-hidden p-5 border border-border/40 hover:bg-foreground/[0.02] transition duration-300">
                            <div
                              className="absolute left-0 top-0 h-full w-[3px]"
                              style={{ background: teamColor }}
                            />
                            <div className="grid grid-cols-[40px_1fr_auto_auto] items-center gap-5">
                              <div className="font-display text-3xl text-muted-foreground/60 w-8 tabular-nums">
                                {String(d.position || i + 1).padStart(2, "0")}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-baseline gap-2">
                                  <span className="font-display text-2xl leading-none">{d.name}</span>
                                  {driverNum !== "—" && (
                                    <span className="text-[10px] font-mono text-muted-foreground font-bold">#{driverNum}</span>
                                  )}
                                </div>
                                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>{d.team || "Independent"}</span>
                                  <span>·</span>
                                  <span>{d.nationality}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-6 max-sm:hidden">
                                <div className="flex flex-col items-start gap-1">
                                  <span className="text-[8px] font-mono text-muted-foreground/60 tracking-wider uppercase font-bold">Form</span>
                                  <FormStreak position={d.position || i + 1} />
                                </div>
                                <div className="flex flex-col items-center">
                                  <span className="text-[8px] font-mono text-muted-foreground/60 tracking-wider uppercase font-bold">Trend</span>
                                  <div className="mt-1">{trendIcon(d.position || i + 1)}</div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-display text-3xl tabular-nums leading-none">{d.points}</div>
                                <div className="text-[9px] font-mono tracking-widest text-muted-foreground mt-1">PTS</div>
                              </div>
                            </div>
                          </GlassPanel>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Spotlight sidebar column */}
                  <aside className="space-y-6">
                    {leaderDriver && (
                      <div className="relative h-[420px] overflow-hidden rounded-3xl border border-border/40 shadow-2xl">
                        <img src={heroDriver} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
                        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
                        <div className="absolute inset-0 flex flex-col justify-end p-8">
                          <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground font-bold uppercase">
                            CHAMPIONSHIP LEADER
                          </div>
                          <div className="mt-2 font-display text-4xl">{leaderDriver.name}</div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {leaderDriver.points} pts · {leaderDriver.wins || 0} victories
                          </div>
                        </div>
                      </div>
                    )}

                    <GlassPanel className="p-6 border border-border/40">
                      <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground font-bold">
                        LEADERBOARD GAPS
                      </div>
                      <div className="mt-4 space-y-4">
                        {drivers.slice(0, 5).map((d: any) => (
                          <div key={d.name} className="space-y-1.5">
                            <div className="flex items-baseline justify-between text-xs">
                              <span>{d.name.split(" ").pop()}</span>
                              <span className="font-mono text-muted-foreground">{d.points} pts</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-foreground/5">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${(d.points / (leaderDriver?.points || 1)) * 100}%`,
                                  background: d.color || "#888888",
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </GlassPanel>
                  </aside>
                </div>
              )}

              {tab === "constructors" && (
                <div className="grid gap-3" key="constructors">
                  {constructors.map((c: any, i: number) => {
                    const teamColor = c.color || "#888888";
                    const driverContrib = getDriverContributions(c.name, c.points);
                    return (
                      <motion.div
                        key={c.name}
                        initial={{ opacity: 0, y: 12 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.4, delay: i * 0.04 }}
                      >
                        <GlassPanel className="relative overflow-hidden p-6 border border-border/40 hover:bg-foreground/[0.01] transition duration-300">
                          <div className="absolute left-0 top-0 h-full w-[3px]" style={{ background: teamColor }} />
                          <div className="grid gap-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-6">
                                <div className="font-display text-4xl text-muted-foreground/60 w-8 tabular-nums">
                                  {String(c.position || i + 1).padStart(2, "0")}
                                </div>
                                <div>
                                  <div className="font-display text-2xl uppercase tracking-wider">{c.name}</div>
                                  <div className="text-[10px] text-muted-foreground mt-1 font-mono uppercase font-bold tracking-wider">
                                    {c.wins || 0} victories
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-display text-3xl tabular-nums leading-none">{c.points}</div>
                                <div className="text-[9px] font-mono tracking-widest text-muted-foreground mt-1">PTS</div>
                              </div>
                            </div>

                            {/* Split driver contributions */}
                            {driverContrib.length > 0 && (
                              <div className="space-y-2 mt-2 bg-white/[0.01] p-4 rounded-xl border border-border/40">
                                <div className="flex justify-between text-[8px] font-bold text-muted-foreground uppercase tracking-wider">
                                  <span>Contribution split</span>
                                  <div className="flex gap-4">
                                    {driverContrib.map((dc: any, idx: number) => (
                                      <span key={idx} className="font-mono">
                                        {dc.name}: <strong className="text-foreground">{dc.points} pts ({dc.pct}%)</strong>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <div className="w-full h-1 rounded-full bg-foreground/5 overflow-hidden flex">
                                  {driverContrib.map((dc: any, idx: number) => {
                                    const opacity = idx === 0 ? "100%" : idx === 1 ? "60%" : "30%";
                                    return (
                                      <div
                                        key={idx}
                                        className="h-full transition-all first:rounded-l-full last:rounded-r-full"
                                        style={{
                                          width: `${dc.pct}%`,
                                          backgroundColor: teamColor,
                                          opacity: opacity,
                                        }}
                                      />
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </GlassPanel>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {tab === "engines" && (
                <div className="grid gap-3" key="engines">
                  {engines.map((e: any, i: number) => {
                    const engineColor = e.color || "#888888";
                    const breakdown = e.breakdown || [];
                    return (
                      <motion.div
                        key={e.name}
                        initial={{ opacity: 0, y: 12 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.4, delay: i * 0.04 }}
                      >
                        <GlassPanel className="relative overflow-hidden p-6 border border-border/40">
                          <div className="absolute left-0 top-0 h-full w-[3px]" style={{ background: engineColor }} />
                          <div className="grid gap-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-6">
                                <div className="font-display text-4xl text-muted-foreground/60 w-8 tabular-nums">
                                  {String(e.position || i + 1).padStart(2, "0")}
                                </div>
                                <div>
                                  <div className="font-display text-2xl uppercase tracking-wider">{e.name} Power unit</div>
                                  <div className="text-[10px] text-muted-foreground mt-1 font-mono uppercase font-bold tracking-wider">
                                    {e.wins || 0} aggregated victories
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-display text-3xl tabular-nums leading-none">{e.points}</div>
                                <div className="text-[9px] font-mono tracking-widest text-muted-foreground mt-1">PTS</div>
                              </div>
                            </div>

                            {/* Customer distribution */}
                            {breakdown.length > 0 && (
                              <div className="space-y-2 mt-2 bg-white/[0.01] p-4 rounded-xl border border-border/40">
                                <div className="flex justify-between text-[8px] font-bold text-muted-foreground uppercase tracking-wider">
                                  <span>Customer distribution</span>
                                  <div className="flex gap-4">
                                    {breakdown.map((b: any, idx: number) => (
                                      <span key={idx} className="font-mono flex items-center gap-1">
                                        <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                                        {b.team}: <strong className="text-foreground">{b.points} pts ({b.pct}%)</strong>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <div className="w-full h-1 rounded-full bg-foreground/5 overflow-hidden flex">
                                  {breakdown.map((b: any, idx: number) => (
                                    <div
                                      key={idx}
                                      className="h-full transition-all first:rounded-l-full last:rounded-r-full"
                                      style={{
                                        width: `${b.pct}%`,
                                        backgroundColor: engineColor,
                                        opacity: idx === 0 ? "100%" : idx === 1 ? "70%" : idx === 2 ? "45%" : "20%",
                                      }}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </GlassPanel>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
