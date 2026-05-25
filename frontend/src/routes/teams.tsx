import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useMemo } from "react";
import { f1Api } from "@/lib/api/client";
import { useSessionContext } from "@/hooks/useSessionContext";
import { TEAMS, type TeamKey } from "@/lib/preferences";
import { getDriversListByYear } from "@/lib/store";
import { GlassPanel } from "@/components/GlassPanel";
import { cn } from "@/lib/utils";

import heroGarage from "@/assets/hero-garage.jpg";
import heroPit from "@/assets/hero-pit.jpg";

export const Route = createFileRoute("/teams")({
  head: () => ({
    meta: [
      { title: "ApexF1 — Constructors garages" },
      { name: "description", content: "Inside the garages of every Formula 1 team." },
    ],
  }),
  component: TeamsPage,
});

interface ConstructorProfile {
  key: TeamKey;
  name: string;
  founded: number;
  chassis: string;
  engine: string;
  drivers: string[];
  points: number;
  position: number;
  color: string;
  wins: number;
}

// Year-aware chassis & engine lookup database
const TEAM_SPECS_DB: Record<string, { founded: number; chassis: string; engine: string; key: TeamKey }> = {
  "mclaren":      { founded: 1966, chassis: "MCL38",   engine: "Mercedes",  key: "mclaren" },
  "red bull":     { founded: 2005, chassis: "RB20",    engine: "Honda RBPT",key: "red-bull" },
  "ferrari":      { founded: 1929, chassis: "SF-24",   engine: "Ferrari",   key: "ferrari" },
  "mercedes":     { founded: 2010, chassis: "W15",     engine: "Mercedes",  key: "mercedes" },
  "aston martin": { founded: 2021, chassis: "AMR24",   engine: "Mercedes",  key: "aston-martin" },
  "alpine":       { founded: 2021, chassis: "A524",    engine: "Renault",   key: "alpine" },
  "williams":     { founded: 1977, chassis: "FW46",    engine: "Mercedes",  key: "williams" },
  "racing bulls": { founded: 2024, chassis: "VCARB 01",engine: "Honda RBPT",key: "rb" },
  "haas":         { founded: 2016, chassis: "VF-24",   engine: "Ferrari",   key: "haas" },
  "audi":         { founded: 1993, chassis: "C44",     engine: "Ferrari",   key: "sauber" },
  "kick sauber":  { founded: 1993, chassis: "C44",     engine: "Ferrari",   key: "sauber" },
  "sauber":       { founded: 1993, chassis: "C44",     engine: "Ferrari",   key: "sauber" }
};

export function TeamsPage() {
  const { season } = useSessionContext();
  const [constructors, setConstructors] = useState<ConstructorProfile[]>([]);
  const [active, setActive] = useState<ConstructorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [standingsRes, driversRes] = await Promise.allSettled([
          f1Api.getStandings(season),
          f1Api.getDrivers(season, 1)
        ]);

        let rawStandings: any[] = [];
        let rawDrivers: any[] = [];

        if (standingsRes.status === "fulfilled") {
          const s = (standingsRes.value as any).data || standingsRes.value || {};
          rawStandings = s.constructors || [];
        }
        if (driversRes.status === "fulfilled") {
          rawDrivers = (driversRes.value as any).data || driversRes.value || [];
        }

        const formatted: ConstructorProfile[] = rawStandings.map((c: any) => {
          const normName = c.name?.toLowerCase().trim();
          const spec = Object.entries(TEAM_SPECS_DB).find(([k]) => normName.includes(k))?.[1] || {
            founded: 2000,
            chassis: "Spec-01",
            engine: "PU Supplier",
            key: "haas" as TeamKey
          };

          // Find driving pairs from driver list
          const teamDrivers = rawDrivers
            .filter((d: any) => d.team_name?.toLowerCase().includes(c.name?.toLowerCase()) || c.name?.toLowerCase().includes(d.team_name?.toLowerCase()))
            .map((d: any) => d.full_name);

          return {
            key: spec.key,
            name: c.name,
            founded: spec.founded,
            chassis: spec.chassis,
            engine: spec.engine,
            drivers: teamDrivers.length > 0 ? teamDrivers : ["Driver 1", "Driver 2"],
            points: c.points,
            position: c.position,
            color: c.color || "#888888",
            wins: c.wins || 0
          };
        });

        setConstructors(formatted);
        if (formatted.length > 0) setActive(formatted[0]);
      } catch (e) {
        console.error("[Teams] hydration failed:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [season]);

  return (
    <div className="min-h-screen px-6 pb-32 pt-12 lg:px-12">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-10">
          <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground">{season} SEASON</div>
          <h1 className="mt-2 font-display text-5xl md:text-6xl">Teams</h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Explore constructor garages, points distribution, and technical specifications.
          </p>
        </header>

        {loading ? (
          <div className="space-y-4">
            <div className="h-16 skeleton rounded-xl" />
            <div className="h-32 skeleton rounded-xl" />
          </div>
        ) : constructors.length === 0 ? (
          <GlassPanel className="p-8 py-16 text-center max-w-md mx-auto">
            <div className="font-display text-2xl">Constructors standings standby</div>
            <p className="mt-2 text-sm text-muted-foreground">Constructor details will populate once timings go live.</p>
          </GlassPanel>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
            {/* Roster rail */}
            <aside className="flex flex-col gap-2 max-h-[70vh] overflow-y-auto scrollbar-none pr-1">
              {constructors.map((r) => {
                const selected = r.key === active?.key;
                return (
                  <button
                    key={r.name}
                    onClick={() => setActive(r)}
                    className={cn(
                      "group relative flex items-center gap-4 rounded-xl p-4 text-left transition duration-300",
                      selected ? "glass-strong" : "hover:bg-foreground/[0.03]",
                    )}
                  >
                    <span className="h-10 w-[3px] rounded-full" style={{ background: r.color }} />
                    <div className="flex-1">
                      <div className="font-display text-xl leading-none">{r.name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono mt-1.5">{r.points} pts</div>
                    </div>
                  </button>
                );
              })}
            </aside>

            {/* Constructor details */}
            <AnimatePresence mode="wait">
              {active && (
                <motion.div
                  key={active.key}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-6"
                >
                  <div className="relative h-[460px] overflow-hidden rounded-3xl border border-border/40">
                    <img src={heroGarage} alt={active.name} className="absolute inset-0 h-full w-full object-cover opacity-60" />
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
                    <div className="absolute inset-0 flex flex-col justify-end p-8">
                      <div className="flex items-center gap-3 text-[10px] font-mono tracking-[0.2em] text-muted-foreground font-bold">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: active.color }} />
                        EST. {active.founded} · {active.chassis} · {active.engine.toUpperCase()}
                      </div>
                      <h2 className="mt-3 font-display text-5xl md:text-6xl">{active.name}</h2>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <GlassPanel className="p-6 border border-border/40">
                      <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground font-bold">DRIVER PAIR</div>
                      <div className="mt-4 space-y-3">
                        {active.drivers.map((d) => (
                          <div key={d} className="flex items-center gap-3">
                            <span className="h-6 w-[2px] rounded-full" style={{ background: active.color }} />
                            <span className="font-display text-xl">{d}</span>
                          </div>
                        ))}
                      </div>
                    </GlassPanel>

                    <GlassPanel className="p-6 border border-border/40 flex flex-col justify-between">
                      <div>
                        <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground font-bold">CHAMPIONSHIP STANDING</div>
                        <div className="mt-3 font-display text-5xl">P{active.position}</div>
                      </div>
                      <span className="text-[9px] text-muted-foreground font-mono uppercase tracking-wider font-bold">
                        {active.wins} wins this season
                      </span>
                    </GlassPanel>

                    <GlassPanel className="p-6 border border-border/40 flex flex-col justify-between">
                      <div>
                        <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground font-bold">TOTAL POINTS</div>
                        <div className="mt-3 font-display text-5xl tabular-nums">{active.points}</div>
                      </div>
                      <span className="text-[9px] text-muted-foreground font-mono uppercase tracking-wider font-bold">PTS</span>
                    </GlassPanel>
                  </div>

                  <div className="relative aspect-[16/7] overflow-hidden rounded-3xl border border-border/40">
                    <img src={heroPit} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
                    <div className="absolute inset-0 flex flex-col justify-end p-6">
                      <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground font-bold">GARAGE LOGISTICS</div>
                      <div className="mt-2 font-display text-2xl max-w-2xl">
                        Technical telemetry sensors calibrated, ready for real-time race weekend streaming.
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
