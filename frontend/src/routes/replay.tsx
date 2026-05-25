import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState, useMemo } from "react";
import { Play, Radio, BarChart3, CloudRain, Cloud, Sun, Compass, Film, ArrowRight } from "lucide-react";
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
      { title: "ApexF1 — Replay Series Catalog" },
      { name: "description", content: "Browse completed Grand Prix sessions like chapters in a racing documentary series." },
    ],
  }),
  component: ReplayPage,
});

function WeatherIcon({ kind, className }: { kind: string; className?: string }) {
  const Icon = kind === "rainy" ? CloudRain : kind === "sunny" ? Sun : Cloud;
  return <Icon className={className} strokeWidth={1.5} />;
}

export function ReplayPage() {
  const { schedule } = useSessionContext();
  
  const completedGPs = useMemo(() => {
    return schedule.filter(e => e.is_completed);
  }, [schedule]);

  const fallbackEpisodes = [
    { round: 1, name: "Bahrain Grand Prix", date: "Completed", weather: "sunny", note: "Opening chapter. A tactical tire war under the desert floodlights.", img: heroPit },
    { round: 2, name: "Saudi Arabian Grand Prix", date: "Completed", weather: "cloudy", note: "High speed sweeps along the Red Sea. Milliseconds separate the top three.", img: heroSession },
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
        note: `Episodic review of the weekend at ${g.location}. Tap below to run visual replay and sync timing logs.`,
        img: bgImg,
      };
    });
  }, [completedGPs]);

  return (
    <div className="pb-32">
      {/* Cinematic Banner */}
      <section className="relative h-[55vh] min-h-[420px] overflow-hidden">
        <motion.img initial={{ scale: 1.06 }} animate={{ scale: 1 }} transition={{ duration: 1.5, ease: [0.16,1,0.3,1] }}
          src={heroDriver} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
          
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-background/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/70 via-transparent to-transparent" />
        
        <div className="relative z-10 mx-auto flex h-full max-w-[1400px] flex-col justify-end px-6 pb-14 lg:px-12">
          <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground uppercase">Episodic archives</div>
          <h1 className="mt-3 font-display text-6xl md:text-7xl leading-none">Replays</h1>
          <p className="mt-3 max-w-md text-muted-foreground text-sm leading-relaxed">
            Every completed Grand Prix session archived in premium editorial layouts. Explore team radios, pit timings, and race highlights like episodes of a sports documentary.
          </p>
        </div>
      </section>

      <section className="mx-auto -mt-16 max-w-[1400px] px-6 lg:px-12 relative z-20 space-y-12">
        <div>
          <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground uppercase">Documentary episodes</div>
          <h2 className="mt-1 font-display text-4xl">Championship series</h2>
        </div>

        {/* Netflix-style episodic cards list */}
        <div className="grid gap-8 sm:grid-cols-2">
          {episodes.map((e, i) => (
            <motion.article key={e.round}
              initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ duration: 0.55, delay: i * 0.04 }}
              className="group relative flex flex-col justify-between overflow-hidden rounded-3xl glass border border-border/40 hover:border-primary/20 transition duration-300"
            >
              <div className="relative aspect-[16/9] w-full overflow-hidden border-b border-border/30">
                <img src={e.img} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-60 transition duration-700 group-hover:scale-103" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                <span className="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[8px] font-mono tracking-widest glass-strong text-muted-foreground font-bold uppercase">
                  EPISODE {e.round}
                </span>
              </div>
              
              <div className="p-6 flex-1 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3 text-[9px] font-mono tracking-[0.2em] text-primary/80 font-bold uppercase">
                    <span>{e.date}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1"><WeatherIcon kind={e.weather} className="h-3 w-3" /> {e.weather}</span>
                  </div>
                  <h3 className="font-display text-3xl leading-tight group-hover:text-primary transition">{e.name}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed max-w-sm">{e.note}</p>
                </div>

                <div className="mt-8 grid grid-cols-2 gap-2 border-t border-border/20 pt-6">
                  <Link
                    to="/race-center"
                    search={{ mode: "replay", round: e.round, session: "Race" }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-foreground text-background py-2 text-xs font-bold transition hover:bg-foreground/90"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" /> Watch Replay
                  </Link>
                  <Link
                    to="/race-center"
                    search={{ mode: "replay", round: e.round, session: "Race" }}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl glass py-2 text-xs font-bold transition hover:bg-white/10 text-muted-foreground hover:text-foreground"
                  >
                    <Radio className="h-3.5 w-3.5" /> Radio Highlight
                  </Link>
                </div>
              </div>
            </motion.article>
          ))}
        </div>

        {/* Dynamic quotes and editorial breakdowns */}
        <div className="mt-16 grid gap-6 lg:grid-cols-2">
          <GlassPanel variant="strong" className="p-7 border border-border/40">
            <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground font-bold uppercase">Garage radio feeds</div>
            <h3 className="mt-1 font-display text-3xl">Paddock commentary</h3>
            <div className="mt-6 space-y-5">
              {[
                { driver: "Verstappen", text: "Rear traction profiles felt incredibly stable during the final stint." },
                { driver: "Norris", text: "Pushing as hard as possible, but we just lacked the straight-line velocity." },
                { driver: "Leclerc", text: "We executed Plan C correctly, but tyre wear was higher than expected." }
              ].map((r, i) => (
                <div key={i} className="flex gap-4">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full glass border border-border/40">
                    <Radio className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                  <div>
                    <div className="text-[9px] font-mono tracking-[0.2em] text-muted-foreground font-bold uppercase">{r.driver}</div>
                    <p className="mt-1 max-w-md text-sm leading-relaxed text-foreground/80 font-medium font-sans">“{r.text}”</p>
                  </div>
                </div>
              ))}
            </div>
          </GlassPanel>

          <GlassPanel className="p-7 border border-border/40 flex flex-col justify-between">
            <div>
              <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground font-bold uppercase">Episodic breakdown</div>
              <h3 className="mt-1 font-display text-3xl">Strategy analysis</h3>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                Lap charts, throttle traces, speed deltas, and tyre stints are immediately compiled once official timing logs are published. Access visual graphs and compare driver lines directly inside the unified replay player.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-3 rounded-2xl border border-border/40 p-5 bg-white/[0.005]">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider font-bold">
                archived data ready
              </span>
            </div>
          </GlassPanel>
        </div>
      </section>
    </div>
  );
}
