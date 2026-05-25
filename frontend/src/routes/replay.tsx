import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useMemo } from "react";
import { Play, Radio, Film, Compass } from "lucide-react";
import { useSessionContext } from "@/hooks/useSessionContext";
import { useCanonicalStore } from "@/lib/store";
import { GlassPanel } from "@/components/GlassPanel";

import heroRace from "@/assets/hero-race.jpg";
import heroPit from "@/assets/hero-pit.jpg";
import heroSession from "@/assets/hero-session.jpg";
import heroCircuit from "@/assets/hero-circuit.jpg";
import heroRain from "@/assets/hero-rain.jpg";
import heroDriver from "@/assets/hero-driver.jpg";

export const Route = createFileRoute("/replay")({
  head: () => ({
    meta: [
      { title: "ApexF1 — Replay Series Catalog" },
      {
        name: "description",
        content:
          "Browse completed Grand Prix sessions like chapters in a racing documentary series.",
      },
    ],
  }),
  component: ReplayPage,
});

export function ReplayPage() {
  const { schedule } = useSessionContext();
  const { sessionResults } = useCanonicalStore();

  // Only show races that are actually confirmed complete
  const completedGPs = useMemo(() => {
    return schedule.filter((e) => e.is_completed);
  }, [schedule]);

  // Build episode cards from real schedule data only — no fallback fabrication
  const episodes = useMemo(() => {
    const bgs = [heroPit, heroSession, heroRain, heroCircuit, heroRace];
    return completedGPs.map((g, idx) => {
      const bgImg = bgs[idx % bgs.length];
      const dateStr = g.event_date
        ? new Date(g.event_date).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })
        : "Completed";

      // Winner — only from verified canonical data
      const raceKey = `${g.round_number}-Race`;
      const results = sessionResults[raceKey] ?? [];
      const winner = results.find((d) => d.position === 1);
      const winnerLabel = winner
        ? winner.abbreviation || winner.driver_name
        : null;

      return {
        round: g.round_number,
        name: g.event_name,
        location: g.location,
        date: dateStr,
        img: bgImg,
        winner: winnerLabel,
      };
    });
  }, [completedGPs, sessionResults]);

  return (
    <div className="pb-32">
      {/* Cinematic Banner */}
      <section className="relative h-[55vh] min-h-[420px] overflow-hidden">
        <motion.img
          initial={{ scale: 1.06 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
          src={heroDriver}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-60"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-background/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/70 via-transparent to-transparent" />

        <div className="relative z-10 mx-auto flex h-full max-w-[1400px] flex-col justify-end px-6 pb-14 lg:px-12">
          <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground uppercase">
            Episodic archives
          </div>
          <h1 className="mt-3 font-display text-6xl md:text-7xl leading-none">
            Replays
          </h1>
          <p className="mt-3 max-w-md text-muted-foreground text-sm leading-relaxed">
            Every completed Grand Prix session archived in premium editorial
            layouts. Explore pit timings and race highlights like episodes of a
            sports documentary.
          </p>
        </div>
      </section>

      <section className="mx-auto -mt-16 max-w-[1400px] px-6 lg:px-12 relative z-20 space-y-12">
        <div>
          <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground uppercase">
            Documentary episodes
          </div>
          <h2 className="mt-1 font-display text-4xl">Championship series</h2>
        </div>

        {episodes.length === 0 ? (
          /* Editorial standby — no fabricated episodes */
          <GlassPanel className="py-24 text-center border border-border/40 rounded-3xl">
            <Compass className="w-12 h-12 text-muted-foreground/20 mx-auto mb-5" />
            <h3 className="font-display text-3xl">Archive opens after Round 1</h3>
            <p className="mt-3 text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
              Completed Grand Prix sessions appear here as official results are
              confirmed. Check back after the first race weekend concludes.
            </p>
          </GlassPanel>
        ) : (
          /* Netflix-style episodic cards list */
          <div className="grid gap-8 sm:grid-cols-2">
            {episodes.map((e, i) => (
              <motion.article
                key={e.round}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, delay: i * 0.04 }}
                className="group relative flex flex-col justify-between overflow-hidden rounded-3xl glass border border-border/40 hover:border-primary/20 transition duration-300"
              >
                <div className="relative aspect-[16/9] w-full overflow-hidden border-b border-border/30">
                  <img
                    src={e.img}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover opacity-60 transition duration-700 group-hover:scale-[1.03]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                  <span className="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[8px] font-mono tracking-widest glass-strong text-muted-foreground font-bold uppercase">
                    EPISODE {e.round}
                  </span>
                  {e.winner && (
                    <span className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[8px] font-mono tracking-widest glass-strong text-primary font-black uppercase">
                      🏆 {e.winner}
                    </span>
                  )}
                </div>

                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3 text-[9px] font-mono tracking-[0.2em] text-primary/80 font-bold uppercase">
                      <span>{e.date}</span>
                      <span>·</span>
                      <span>{e.location}</span>
                    </div>
                    <h3 className="font-display text-3xl leading-tight group-hover:text-primary transition">
                      {e.name}
                    </h3>
                    {!e.winner && (
                      <p className="text-xs text-muted-foreground leading-relaxed italic">
                        Race classification pending official confirmation.
                      </p>
                    )}
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
                      <Radio className="h-3.5 w-3.5" /> Race Archive
                    </Link>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        )}

        {/* Strategy analysis panel — factual, no driver quotes */}
        <div className="mt-16">
          <GlassPanel className="p-7 border border-border/40 flex flex-col justify-between">
            <div>
              <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground font-bold uppercase">
                Episodic breakdown
              </div>
              <h3 className="mt-1 font-display text-3xl">
                Strategy &amp; telemetry archive
              </h3>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-2xl">
                Lap charts, speed deltas, and tyre stints are compiled once
                official timing logs are published for each race. Access visual
                graphs and compare driver lines directly inside the unified
                replay player.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-3 rounded-2xl border border-border/40 p-5 bg-white/[0.005]">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider font-bold">
                Archived session data available on demand
              </span>
            </div>
          </GlassPanel>
        </div>
      </section>
    </div>
  );
}
