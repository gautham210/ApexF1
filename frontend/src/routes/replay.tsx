import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Play, Radio, Film, Compass, RefreshCw } from "lucide-react";
import { useSessionContext } from "@/hooks/useSessionContext";
import { f1Api } from "@/lib/api/client";
import { useCanonicalStore, type LeaderboardEntry } from "@/lib/store";
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

function ReplayPage() {
  const { schedule: contextSchedule, season: contextSeason } = useSessionContext();
  const { sessionResults: contextResults } = useCanonicalStore();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(contextSeason || currentYear);

  useEffect(() => {
    if (contextSeason) setSelectedYear(contextSeason);
  }, [contextSeason]);

  const season = selectedYear;
  const availableYears = useMemo(
    () =>
      Array.from({ length: Math.max(1, currentYear - 2018 + 1) }, (_, idx) => currentYear - idx),
    [currentYear],
  );

  const scheduleQuery = useQuery({
    queryKey: ["replay-schedule", season],
    queryFn: async () => {
      const res = await f1Api.getSchedule(season);
      return Array.isArray(res?.data) ? res.data : [];
    },
    enabled: season !== contextSeason || contextSchedule.length === 0,
    staleTime: 1000 * 60 * 10,
  });

  const resultsQuery = useQuery<Record<string, LeaderboardEntry[]>>({
    queryKey: ["replay-results", season],
    queryFn: async () => {
      const res = await f1Api.getSeasonResults(season);
      const raw = res?.data;
      if (raw && typeof raw === "object" && "results" in raw && raw.results) {
        return raw.results;
      }
      return {};
    },
    staleTime: 1000 * 60 * 10,
  });

  const schedule = useMemo(
    () =>
      season === contextSeason && contextSchedule.length > 0
        ? contextSchedule
        : (scheduleQuery.data ?? []),
    [season, contextSeason, contextSchedule, scheduleQuery.data],
  );

  const sessionResults: Record<string, LeaderboardEntry[]> = useMemo(() => {
    if (resultsQuery.data && Object.keys(resultsQuery.data).length > 0) {
      return resultsQuery.data;
    }
    return season === contextSeason ? contextResults : {};
  }, [resultsQuery.data, season, contextSeason, contextResults]);

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
      const raceKey = `${season}-${g.round_number}-Race`;
      const results = sessionResults[raceKey] ?? [];
      const winner = results.find((d) => d.position === 1);
      const winnerLabel = winner ? winner.abbreviation || winner.driver_name : null;

      return {
        round: g.round_number,
        name: g.event_name,
        location: g.location,
        date: dateStr,
        img: bgImg,
        winner: winnerLabel,
      };
    });
  }, [completedGPs, sessionResults, season]);

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

        <div className="relative z-10 mx-auto flex h-full max-w-[1680px] flex-col justify-end px-6 pb-14 lg:px-12">
          <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground uppercase">
            Episodic archives
          </div>
          <h1 className="mt-3 font-display text-6xl md:text-7xl leading-none">Replays</h1>
          <p className="mt-3 max-w-md text-muted-foreground text-sm leading-relaxed">
            Browse completed Grands Prix, verified winners and available classifications. Telemetry
            coverage varies by event.
          </p>
        </div>
      </section>

      <section className="mx-auto mt-8 max-w-[1680px] px-5 lg:px-12 relative z-20 space-y-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground uppercase">
              Documentary episodes
            </div>
            <h2 className="mt-1 font-display text-4xl">Championship series</h2>
          </div>

          <label className="inline-flex items-center gap-3 text-xs font-mono uppercase tracking-[0.16em] text-muted-foreground">
            <span>Season</span>
            <select
              aria-label="Replay season"
              value={season}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="rounded-xl glass border border-white/12 bg-background/80 px-3.5 py-2 text-xs font-mono text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        </div>

        {(scheduleQuery.isLoading && schedule.length === 0) ||
        (resultsQuery.isLoading &&
          Object.keys(sessionResults).length === 0 &&
          completedGPs.length > 0) ? (
          <div className="grid gap-8 sm:grid-cols-2">
            {[1, 2, 3, 4].map((skeleton) => (
              <GlassPanel key={skeleton} className="overflow-hidden rounded-3xl animate-pulse">
                <div className="aspect-[16/9] bg-white/[0.04]" />
                <div className="p-6 space-y-3">
                  <div className="h-3 w-36 rounded bg-white/[0.06]" />
                  <div className="h-7 w-64 rounded bg-white/[0.08]" />
                  <div className="h-9 w-full rounded-xl bg-white/[0.05] mt-4" />
                </div>
              </GlassPanel>
            ))}
          </div>
        ) : (scheduleQuery.isError || resultsQuery.isError) && episodes.length === 0 ? (
          <GlassPanel className="py-20 px-6 text-center rounded-3xl space-y-4">
            <Compass className="w-10 h-10 text-muted-foreground/30 mx-auto" />
            <h3 className="font-display text-3xl">Archive provider temporarily unavailable</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              The historical archive backend may be waking up. Retry to load the {season} season
              episodes and classifications.
            </p>
            <button
              type="button"
              onClick={() => {
                void scheduleQuery.refetch();
                void resultsQuery.refetch();
              }}
              className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-5 py-2.5 text-xs font-semibold hover:bg-foreground/90 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry loading {season}
            </button>
          </GlassPanel>
        ) : episodes.length === 0 ? (
          /* Editorial standby — no fabricated episodes */
          <GlassPanel className="py-24 px-6 text-center border border-border/40 rounded-3xl">
            <Compass className="w-12 h-12 text-muted-foreground/20 mx-auto mb-5" />
            <h3 className="font-display text-3xl">No completed events available</h3>
            <p className="mt-3 text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
              No completed events were returned for the {season} season. Select another championship
              year above or check back once the first Grand Prix finishes.
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
                        Official classification unavailable from the configured provider.
                      </p>
                    )}
                  </div>

                  <div className="mt-8 grid grid-cols-2 gap-2 border-t border-border/20 pt-6">
                    <Link
                      to="/race-center"
                      search={{ mode: "replay", year: season, round: e.round, session: "Race" }}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-foreground text-background py-2 text-xs font-bold transition hover:bg-foreground/90"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" /> Race Replay
                    </Link>
                    <Link
                      to="/race-center"
                      search={{ mode: "archive", year: season, round: e.round, session: "Race" }}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl glass py-2 text-xs font-bold transition hover:bg-white/10 text-muted-foreground hover:text-foreground"
                    >
                      <Radio className="h-3.5 w-3.5" /> Archive Results
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
              <h3 className="mt-1 font-display text-3xl">Strategy &amp; telemetry archive</h3>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-2xl">
                Open a race for its classification. Where recorded telemetry is available, compare
                driver laps in Race Center. Video and team radio are not provided.
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
