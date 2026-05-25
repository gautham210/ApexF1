import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo } from "react";
import { Play, Radio, BarChart3, CloudRain, Cloud, Sun, Compass } from "lucide-react";
import { useSessionContext } from "@/hooks/useSessionContext";
import { GlassPanel } from "@/components/GlassPanel";
import { cn } from "@/lib/utils";

import heroRace from "@/assets/hero-race.jpg";
import heroPit from "@/assets/hero-pit.jpg";
import heroSession from "@/assets/hero-session.jpg";
import heroCircuit from "@/assets/hero-circuit.jpg";
import heroDriver from "@/assets/hero-driver.jpg";
import heroRain from "@/assets/hero-rain.jpg";

export const Route = createFileRoute("/replay")({
  head: () => ({
    meta: [
      { title: "ApexF1 — Cinematic Replay Center" },
      { name: "description", content: "Explore completed race sessions like chapters in a documentary series." },
    ],
  }),
  component: ReplayPage,
});

function WeatherIcon({ kind, className }: { kind: string; className?: string }) {
  const Icon = kind === "rainy" ? CloudRain : kind === "sunny" ? Sun : Cloud;
  return <Icon className={className} strokeWidth={1.5} />;
}

export function ReplayPage() {
  const { schedule, season } = useSessionContext();
  
  const completedGPs = useMemo(() => {
    return schedule.filter(e => e.is_completed);
  }, [schedule]);

  const fallbackEpisodes = [
    { round: 1, name: "Bahrain GP", date: "Completed", weather: "sunny", note: "Opening session of the season.", img: heroPit },
    { round: 2, name: "Saudi Arabian GP", date: "Completed", weather: "cloudy", note: "High speed sweeps under streetlights.", img: heroSession },
  ];

  const episodes = useMemo(() => {
    if (completedGPs.length === 0) return fallbackEpisodes;
    return completedGPs.map((g, idx) => {
      const bgs = [heroPit, heroSession, heroRain, heroCircuit, heroRace];
      const bgImg = bgs[idx % bgs.length];
      const dateStr = g.event_date ? new Date(g.event_date).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "Completed";
      return {
        round: g.round_number,
        name: g.event_name,
        date: dateStr,
        weather: idx % 3 === 0 ? "sunny" : idx % 3 === 1 ? "cloudy" : "rainy",
        note: `Full session archive logs for the ${g.location} Grand Prix. Replay scrubber charts open.`,
        img: bgImg,
      };
    });
  }, [completedGPs]);

  return (
    <div className="pb-32">
      {/* Cinematic Banner */}
      <section className="relative h-[60vh] min-h-[460px] overflow-hidden">
        <motion.img initial={{ scale: 1.06 }} animate={{ scale: 1 }} transition={{ duration: 1.5, ease: [0.16,1,0.3,1] }}
          src={heroDriver} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-background/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/70 via-transparent to-transparent" />
        <div className="relative z-10 mx-auto flex h-full max-w-[1400px] flex-col justify-end px-6 pb-14 lg:px-12">
          <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground">{season} SEASON · BROADCASTS</div>
          <h1 className="mt-3 font-display text-6xl md:text-7xl leading-none">Replay center</h1>
          <p className="mt-3 max-w-md text-muted-foreground text-sm leading-relaxed">
            Five-part weekend programs archived in high fidelity — browse completed sessions like episodes of a racing documentary.
          </p>
        </div>
      </section>

      <section className="mx-auto -mt-16 max-w-[1400px] px-6 lg:px-12 relative z-20">
        <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground">EPISODES</div>
        <h2 className="mt-1 font-display text-4xl">Documentary series archive</h2>

        <div className="mt-8 flex flex-col gap-3">
          {episodes.map((e, i) => (
            <motion.article key={e.round}
              initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ duration: 0.55, delay: i * 0.04 }}
              className="group relative grid items-stretch gap-0 overflow-hidden rounded-3xl glass border border-border/40 md:grid-cols-[42%_1fr]"
            >
              <div className="relative aspect-[16/9] md:aspect-auto md:h-full overflow-hidden">
                <img src={e.img} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-50 transition duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-r from-background/60 via-background/10 to-transparent md:from-transparent md:to-background/40" />
                <Link
                  to="/race-center"
                  className="absolute bottom-5 left-5 inline-flex items-center gap-2 rounded-full glass-strong px-4 py-2 text-xs transition hover:bg-white/10 font-bold"
                >
                  <Play className="h-3 w-3 fill-current" /> Telemetry scrubber
                </Link>
              </div>
              <div className="flex flex-col justify-between p-7">
                <div>
                  <div className="flex flex-wrap items-center gap-3 text-[9px] font-mono tracking-[0.2em] text-muted-foreground font-bold uppercase">
                    <span>EP. {String(e.round).padStart(2, "0")}</span>
                    <span>·</span>
                    <span>{e.date}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1.5"><WeatherIcon kind={e.weather} className="h-3 w-3" /> {e.weather}</span>
                  </div>
                  <h3 className="mt-3 font-display text-3xl md:text-4xl">{e.name}</h3>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">{e.note}</p>
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                  <Chip icon={Play} label="Highlights" />
                  <Chip icon={Radio} label="Team Radio" />
                  <Chip icon={BarChart3} label="Telemetry logs" />
                </div>
              </div>
            </motion.article>
          ))}
        </div>

        <div className="mt-16 grid gap-6 lg:grid-cols-2">
          <GlassPanel variant="strong" className="p-7 border border-border/40">
            <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground font-bold">GARAGE RADIO FEEDS</div>
            <h3 className="mt-1 font-display text-3xl">Paddock transmission streams</h3>
            <div className="mt-6 space-y-5">
              {[
                { driver: "Verstappen", text: "Rear grip profiles felt stable during long runs." },
                { driver: "Norris", text: "Pushing through sector three, downforce is optimal." },
                { driver: "Leclerc", text: "We need to switch to plan C, tyre degradation is high." }
              ].map((r, i) => (
                <div key={i} className="flex gap-4">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full glass border border-border/40">
                    <Radio className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                  <div>
                    <div className="text-[9px] font-mono tracking-[0.2em] text-muted-foreground font-bold uppercase">{r.driver}</div>
                    <p className="mt-1 max-w-md text-sm leading-relaxed text-foreground/80 font-medium">“{r.text}”</p>
                  </div>
                </div>
              ))}
            </div>
          </GlassPanel>

          <GlassPanel className="p-7 border border-border/40 flex flex-col justify-between">
            <div>
              <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground font-bold">TELEMETRY ANALYSIS ARCHIVE</div>
              <h3 className="mt-1 font-display text-3xl">Archival sector classifications</h3>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                Lap coordinates splines, throttle metrics, and tyre stints analysis are compiled
                immediately once the FIA publishes the official classification logs.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-3 rounded-2xl border border-border/40 p-5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider font-bold">
                Standby — Telemetry logs synchronized and compiled
              </span>
            </div>
          </GlassPanel>
        </div>
      </section>
    </div>
  );
}

function Chip({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[9px] font-mono tracking-widest glass text-muted-foreground font-bold uppercase">
      <Icon className="h-3 w-3" strokeWidth={1.5} /> {label}
    </span>
  );
}
