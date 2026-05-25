import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useMemo } from "react";
import { Radio, Film, BarChart3, Trophy, Compass } from "lucide-react";
import { f1Api } from "@/lib/api/client";
import { useSessionContext } from "@/hooks/useSessionContext";
import { getDriverByYear } from "@/lib/store";
import { GlassPanel } from "@/components/GlassPanel";
import { cn } from "@/lib/utils";

import heroHelmet from "@/assets/hero-helmet.jpg";
import heroDriver from "@/assets/hero-driver.jpg";
import heroGarage from "@/assets/hero-garage.jpg";

export const Route = createFileRoute("/drivers")({
  head: () => ({
    meta: [
      { title: "ApexF1 — Drivers roster" },
      { name: "description", content: "Cinematic driver rosters and profiles." },
    ],
  }),
  component: DriversPage,
});

interface DriverProfile {
  number: string;
  name: string;
  abbr: string;
  team: string;
  color: string;
  nationality: string;
  points: number;
  position: number;
  wins: number;
  story: string;
}

export function DriversPage() {
  const { season, currentRound } = useSessionContext();
  const [driverList, setDriverList] = useState<DriverProfile[]>([]);
  const [active, setActive] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [driversRes, standingsRes] = await Promise.allSettled([
          f1Api.getDrivers(season, currentRound),
          f1Api.getStandings(season),
        ]);

        let rawDrivers: any[] = [];
        let rawStandings: any[] = [];

        if (driversRes.status === "fulfilled") {
          rawDrivers = (driversRes.value as any).data || driversRes.value || [];
        }
        if (standingsRes.status === "fulfilled") {
          const s = (standingsRes.value as any).data || standingsRes.value || {};
          rawStandings = s.drivers || [];
        }

        const merged: DriverProfile[] = rawDrivers.map((d: any) => {
          const standing = rawStandings.find((s: any) => s.name?.toLowerCase().includes(d.full_name?.toLowerCase()) || d.full_name?.toLowerCase().includes(s.name?.toLowerCase()));
          const fallbackMeta = getDriverByYear(season, d.driver_number);
          
          return {
            number: d.driver_number,
            name: d.full_name,
            abbr: d.abbreviation,
            team: d.team_name,
            color: d.team_color || fallbackMeta.color,
            nationality: d.nationality || "INT",
            points: standing?.points || d.points || 0,
            position: standing?.position || d.position || 99,
            wins: standing?.wins || 0,
            story: `${d.full_name} competes for ${d.team_name} in the ${season} season. An expert racer showing elite speed control and sector precision.`,
          };
        });

        // Sort by standing position
        merged.sort((a, b) => a.position - b.position);
        setDriverList(merged);
        if (merged.length > 0) setActive(merged[0]);
      } catch (e) {
        console.error("[Drivers] hydration failed:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [season, currentRound]);

  return (
    <div className="min-h-screen px-6 pb-32 pt-12 lg:px-12">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-10">
          <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground">{season} SEASON</div>
          <h1 className="mt-2 font-display text-5xl md:text-6xl">Drivers</h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            The active Formula 1 racing grid, compiled with dynamic championship standings.
          </p>
        </header>

        {loading ? (
          <div className="space-y-4">
            <div className="h-12 skeleton rounded-xl" />
            <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
              <div className="h-96 skeleton rounded-2xl" />
              <div className="h-96 skeleton rounded-2xl" />
            </div>
          </div>
        ) : driverList.length === 0 ? (
          <GlassPanel className="p-8 py-16 text-center max-w-md mx-auto">
            <Compass className="w-10 h-10 text-muted-foreground/30 mx-auto mb-4" />
            <div className="font-display text-2xl">Drivers roster standby</div>
            <p className="mt-2 text-sm text-muted-foreground">Driver profiles and standings will populate once season timings go live.</p>
          </GlassPanel>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
            {/* Roster rail */}
            <aside className="flex flex-col gap-2 max-h-[70vh] overflow-y-auto scrollbar-none pr-1">
              {driverList.map((d) => {
                const selected = d.number === active?.number;
                return (
                  <button
                    key={d.number}
                    onClick={() => setActive(d)}
                    className={cn(
                      "group relative flex items-center gap-4 rounded-xl p-3 text-left transition duration-300",
                      selected ? "glass-strong" : "hover:bg-foreground/[0.03]",
                    )}
                  >
                    <span className="h-10 w-[3px] rounded-full" style={{ background: d.color }} />
                    <div className="font-display text-2xl text-muted-foreground w-8 tabular-nums text-center">
                      {String(d.position).padStart(2, "0")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-display text-lg">{d.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{d.team}</div>
                    </div>
                  </button>
                );
              })}
            </aside>

            {/* Profile Detail */}
            <AnimatePresence mode="wait">
              {active && (
                <motion.div
                  key={active.number}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-6"
                >
                  <div className="relative h-[480px] overflow-hidden rounded-3xl border border-border/40">
                    <img src={heroHelmet} alt={active.name} className="absolute inset-0 h-full w-full object-cover opacity-60" />
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-r from-background/50 via-transparent to-transparent" />
                    <div className="absolute inset-0 flex flex-col justify-end p-8">
                      <div className="flex items-center gap-3 text-[10px] font-mono tracking-[0.2em] text-muted-foreground font-bold">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: active.color }} />
                        {active.team.toUpperCase()} · #{active.number} · {active.nationality}
                      </div>
                      <h2 className="mt-3 font-display text-5xl md:text-6xl">{active.name}</h2>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <Stat icon={Trophy} label="Position" value={active.position} prefix="P" />
                    <Stat icon={Trophy} label="Wins" value={active.wins} />
                    <Stat icon={BarChart3} label="Total Points" value={active.points} suffix=" PTS" />
                  </div>

                  <GlassPanel className="p-7">
                    <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground font-bold">DRIVERS DESCRIPTION</div>
                    <p className="mt-3 max-w-2xl text-base leading-relaxed text-foreground/80">{active.story}</p>
                  </GlassPanel>

                  <div className="grid gap-4 md:grid-cols-3">
                    <ArchiveCard icon={Radio} title="Radio transmission log" body="Team channels sync post-race classification." img={heroGarage} />
                    <ArchiveCard icon={Film} title="Cinematic reels" body="Curated highlight clips from recent race weekends." img={heroDriver} />
                    <ArchiveCard icon={BarChart3} title="Lap-by-lap comparison" body="Advanced telemetry graphs unlock on weekend timings." img={heroHelmet} />
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

function Stat({ icon: Icon, label, value, prefix = "", suffix = "" }: { icon: any; label: string; value: number | string; prefix?: string; suffix?: string }) {
  return (
    <GlassPanel className="p-5">
      <div className="flex items-center gap-2 text-[10px] font-mono tracking-[0.2em] text-muted-foreground font-bold">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.5} /> {label.toUpperCase()}
      </div>
      <div className="mt-2 font-display text-3xl tabular-nums">{prefix}{value}{suffix}</div>
    </GlassPanel>
  );
}

function ArchiveCard({ icon: Icon, title, body, img }: { icon: any; title: string; body: string; img: string }) {
  return (
    <div className="group relative aspect-[5/6] overflow-hidden rounded-2xl border border-border/40">
      <img src={img} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-30 transition group-hover:opacity-50" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
      <div className="absolute inset-0 flex flex-col justify-end p-5">
        <Icon className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
        <div className="mt-3 font-display text-2xl">{title}</div>
        <div className="mt-1 text-xs text-muted-foreground leading-relaxed">{body}</div>
      </div>
    </div>
  );
}
