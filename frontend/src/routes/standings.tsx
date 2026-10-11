import type { StandingsEntry } from "@/lib/store";
import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { Trophy } from "lucide-react";
import { f1Api } from "@/lib/api/client";
import { useSessionContext } from "@/hooks/useSessionContext";
import { useCanonicalStore, getDriverNumberByAbbr, getDriverNumberByName } from "@/lib/store";
import { GlassPanel } from "@/components/GlassPanel";
import { cn } from "@/lib/utils";

import heroDriver from "@/assets/hero-driver.jpg";

export const Route = createFileRoute("/standings")({
  head: () => ({
    meta: [
      { title: "ApexF1 — Championship standings" },
      {
        name: "description",
        content: "Official driver and constructor standings for the Formula 1 season.",
      },
    ],
  }),
  component: StandingsPage,
});

function StandingsPage() {
  const { season, setSelectedYear } = useSessionContext();
  const {
    standings: canonicalDrivers,
    constructors: canonicalConstructors,
    engines: canonicalEngines,
    setStandings,
    setConstructors,
    setEngines,
  } = useCanonicalStore();

  const [tab, setTab] = useState<"drivers" | "constructors" | "engines">("drivers");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use canonical store data; only fetch if store is empty for this season
  useEffect(() => {
    let cancelled = false;
    setStandings([]);
    setConstructors([]);
    setEngines([]);
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [res, engRes] = await Promise.allSettled([
          f1Api.getStandings(season),
          f1Api.getEngineStandings(season),
        ]);

        if (cancelled) return;
        let driverList: StandingsEntry[] = [];
        let constructorList: StandingsEntry[] = [];
        let engineList: StandingsEntry[] = [];

        if (res.status === "fulfilled") {
          const d = res.value.data;
          driverList = d.drivers || [];
          constructorList = d.constructors || [];
        }
        if (engRes.status === "fulfilled") {
          engineList = engRes.value.data;
          if (!Array.isArray(engineList)) engineList = [];
        }

        if (driverList.length === 0 && constructorList.length === 0) {
          if (season > 2025) {
            setError(`Championship standings are unavailable from the configured provider.`);
          } else {
            setError("Championship standings are currently unavailable for this season.");
          }
        }

        // Push into canonical store so all routes share the same truth
        setStandings(driverList);
        setConstructors(constructorList);
        setEngines(engineList);
      } catch {
        setError("Championship standings are currently offline. Please try again later.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season]);

  // Resolve driver car number from available fields
  function resolveDriverNumber(entry: StandingsEntry): string {
    if (entry.number && entry.number !== "0") return entry.number;
    const byAbbr = entry.code ? getDriverNumberByAbbr(season, entry.code) : null;
    if (byAbbr) return byAbbr;
    const byName = entry.name ? getDriverNumberByName(season, entry.name) : null;
    if (byName) return byName;
    return "—";
  }

  // Compute per-driver contribution within a constructor entry
  const getDriverContributions = (teamName: string, teamTotalPoints: number) => {
    if (!canonicalDrivers || canonicalDrivers.length === 0 || teamTotalPoints <= 0) return [];
    const teamDrivers = canonicalDrivers.filter((d) => d.team === teamName);
    const contribs = teamDrivers.map((d) => {
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

  // Championship leader — derived from real API data only
  const leaderDriver = canonicalDrivers[0] || null;

  return (
    <div className="min-h-screen px-6 pb-32 pt-12 lg:px-12">
      <div className="mx-auto max-w-[1300px]">
        <header className="mb-10 flex flex-wrap items-end justify-between gap-6 pb-6 border-b border-border/40">
          <div>
            <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground uppercase">
              CHAMPIONSHIP STANDINGS
            </div>
            <label className="block text-xs text-muted-foreground mb-4">
              Season
              <select
                aria-label="Championship season"
                value={season}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="ml-3 rounded-lg border border-border bg-background px-3 py-2"
              >
                {Array.from(
                  { length: new Date().getFullYear() - 2017 },
                  (_, i) => new Date().getFullYear() - i,
                ).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <h1 className="mt-2 font-display text-5xl md:text-6xl">Standings</h1>
            <p className="mt-3 max-w-xl text-muted-foreground">
              Official championship results compiled from verified timing feeds.
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
                  tab === t
                    ? "bg-foreground/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t === "drivers" ? "Drivers" : t === "constructors" ? "Constructors" : "Power unit"}
              </button>
            ))}
          </div>
        </header>

        {loading ? (
          <div className="space-y-4">
            {Array(6)
              .fill(0)
              .map((_, i) => (
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
                    {canonicalDrivers.map((d, i) => {
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
                            <div className="grid grid-cols-[40px_1fr_auto] items-center gap-5">
                              <div className="font-display text-3xl text-muted-foreground/60 w-8 tabular-nums">
                                {String(d.position || i + 1).padStart(2, "0")}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-baseline gap-2">
                                  <span className="font-display text-2xl leading-none">
                                    {d.name}
                                  </span>
                                  {driverNum !== "—" && (
                                    <span className="text-[10px] font-mono text-muted-foreground font-bold">
                                      #{driverNum}
                                    </span>
                                  )}
                                </div>
                                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>{d.team || "Independent"}</span>
                                  <span>·</span>
                                  <span>{d.nationality}</span>
                                  {d.wins != null && d.wins > 0 && (
                                    <>
                                      <span>·</span>
                                      <span>
                                        {d.wins} {d.wins === 1 ? "win" : "wins"}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-display text-3xl tabular-nums leading-none">
                                  {d.points}
                                </div>
                                <div className="text-[9px] font-mono tracking-widest text-muted-foreground mt-1">
                                  PTS
                                </div>
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
                        <img
                          src={heroDriver}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover opacity-60"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
                        <div className="absolute inset-0 flex flex-col justify-end p-8">
                          <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground font-bold uppercase">
                            CHAMPIONSHIP LEADER
                          </div>
                          <div className="mt-2 font-display text-4xl">{leaderDriver.name}</div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {leaderDriver.points} pts
                            {leaderDriver.wins != null && leaderDriver.wins > 0
                              ? ` · ${leaderDriver.wins} ${
                                  leaderDriver.wins === 1 ? "victory" : "victories"
                                }`
                              : ""}
                          </div>
                        </div>
                      </div>
                    )}

                    <GlassPanel className="p-6 border border-border/40">
                      <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground font-bold">
                        LEADERBOARD GAPS
                      </div>
                      <div className="mt-4 space-y-4">
                        {canonicalDrivers.slice(0, 5).map((d) => (
                          <div key={d.name} className="space-y-1.5">
                            <div className="flex items-baseline justify-between text-xs">
                              <span>{d.name.split(" ").pop()}</span>
                              <span className="font-mono text-muted-foreground">
                                {d.points} pts
                              </span>
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
                  {canonicalConstructors.map((c, i) => {
                    const teamColor = c.color || "#888888";
                    const driverContrib = getDriverContributions(c.name, c.points);
                    return (
                      <motion.div
                        key={c.display_name || c.name}
                        initial={{ opacity: 0, y: 12 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.4, delay: i * 0.04 }}
                      >
                        <GlassPanel className="relative overflow-hidden p-6 border border-border/40 hover:bg-foreground/[0.01] transition duration-300">
                          <div
                            className="absolute left-0 top-0 h-full w-[3px]"
                            style={{ background: teamColor }}
                          />
                          <div className="grid gap-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-6">
                                <div className="font-display text-4xl text-muted-foreground/60 w-8 tabular-nums">
                                  {String(c.position || i + 1).padStart(2, "0")}
                                </div>
                                <div>
                                  <div className="font-display text-2xl uppercase tracking-wider">
                                    {c.display_name || c.name}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground mt-1 font-mono uppercase font-bold tracking-wider">
                                    {c.wins || 0} victories
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-display text-3xl tabular-nums leading-none">
                                  {c.points}
                                </div>
                                <div className="text-[9px] font-mono tracking-widest text-muted-foreground mt-1">
                                  PTS
                                </div>
                              </div>
                            </div>

                            {/* Split driver contributions */}
                            {driverContrib.length > 0 && (
                              <div className="space-y-2 mt-2 bg-white/[0.01] p-4 rounded-xl border border-border/40">
                                <div className="flex justify-between text-[8px] font-bold text-muted-foreground uppercase tracking-wider">
                                  <span>Contribution split</span>
                                  <div className="flex gap-4">
                                    {driverContrib.map((dc, idx) => (
                                      <span key={idx} className="font-mono">
                                        {dc.name}:{" "}
                                        <strong className="text-foreground">
                                          {dc.points} pts ({dc.pct}%)
                                        </strong>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <div className="w-full h-1 rounded-full bg-foreground/5 overflow-hidden flex">
                                  {driverContrib.map((dc, idx) => {
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
                  {canonicalEngines.map((e, i) => {
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
                          <div
                            className="absolute left-0 top-0 h-full w-[3px]"
                            style={{ background: engineColor }}
                          />
                          <div className="grid gap-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-6">
                                <div className="font-display text-4xl text-muted-foreground/60 w-8 tabular-nums">
                                  {String(e.position || i + 1).padStart(2, "0")}
                                </div>
                                <div>
                                  <div className="font-display text-2xl uppercase tracking-wider">
                                    {e.name} Power unit
                                  </div>
                                  <div className="text-[10px] text-muted-foreground mt-1 font-mono uppercase font-bold tracking-wider">
                                    {e.wins || 0} aggregated victories
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-display text-3xl tabular-nums leading-none">
                                  {e.points}
                                </div>
                                <div className="text-[9px] font-mono tracking-widest text-muted-foreground mt-1">
                                  PTS
                                </div>
                              </div>
                            </div>

                            {/* Customer distribution */}
                            {breakdown.length > 0 && (
                              <div className="space-y-2 mt-2 bg-white/[0.01] p-4 rounded-xl border border-border/40">
                                <div className="flex justify-between text-[8px] font-bold text-muted-foreground uppercase tracking-wider">
                                  <span>Customer distribution</span>
                                  <div className="flex gap-4">
                                    {breakdown.map((b, idx) => (
                                      <span key={idx} className="font-mono flex items-center gap-1">
                                        <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                                        {b.team}:{" "}
                                        <strong className="text-foreground">
                                          {b.points} pts ({b.pct}%)
                                        </strong>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <div className="w-full h-1 rounded-full bg-foreground/5 overflow-hidden flex">
                                  {breakdown.map((b, idx) => (
                                    <div
                                      key={idx}
                                      className="h-full transition-all first:rounded-l-full last:rounded-r-full"
                                      style={{
                                        width: `${b.pct}%`,
                                        backgroundColor: engineColor,
                                        opacity:
                                          idx === 0
                                            ? "100%"
                                            : idx === 1
                                              ? "70%"
                                              : idx === 2
                                                ? "45%"
                                                : "20%",
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
