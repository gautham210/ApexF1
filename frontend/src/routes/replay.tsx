import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Play, Radio, Compass, RefreshCw, Search } from "lucide-react";
import { useSessionContext } from "@/hooks/useSessionContext";
import { f1Api } from "@/lib/api/client";
import { useCanonicalStore, type LeaderboardEntry } from "@/lib/store";
import { GlassPanel } from "@/components/GlassPanel";
import { PageHeader } from "@/components/PageHeader";
import { presentEvent } from "@/lib/event-presentation";

import heroRace from "@/assets/hero-race.jpg";
import heroPit from "@/assets/hero-pit.jpg";
import heroSession from "@/assets/hero-session.jpg";
import heroCircuit from "@/assets/hero-circuit.jpg";
import heroRain from "@/assets/hero-rain.jpg";

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
  const [searchFilter, setSearchFilter] = useState<string>("");
  const trackReplaySupported = selectedYear >= 2023;

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

      const pres = presentEvent(g);
      return {
        round: g.round_number,
        name: pres.displayName,
        location: pres.cleanVenue,
        conflictBadge: pres.conflictBadge,
        date: dateStr,
        img: bgImg,
        winner: winnerLabel,
      };
    });
  }, [completedGPs, sessionResults, season]);

  const filteredEpisodes = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    if (!q) return episodes;
    return episodes.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.location.toLowerCase().includes(q) ||
        (e.winner ?? "").toLowerCase().includes(q) ||
        `r${e.round}` === q ||
        String(e.round) === q,
    );
  }, [episodes, searchFilter]);

  return (
    <div className="apex-page pb-24 space-y-8">
      <PageHeader
        eyebrow={`${season} Archive · Historical Index`}
        title="Track Replays"
        subtitle="Browse completed Grands Prix, inspect verified classifications, and launch interactive car-position track replays for 2023+ seasons."
        badges={
          <span className="rounded-full glass-pill px-2.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            {trackReplaySupported
              ? "2023+ Track Replay + Classification"
              : "Classification Only (<2023)"}
          </span>
        }
        actions={
          <>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter GP, circuit, winner…"
                aria-label="Filter archive events"
                className="apex-control pl-8 pr-3 w-48 sm:w-56 font-mono text-xs"
              />
            </div>
            <select
              aria-label="Replay season"
              value={season}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="apex-control font-mono"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y} Season
                </option>
              ))}
            </select>
          </>
        }
      />

      {(scheduleQuery.isLoading && schedule.length === 0) ||
      (resultsQuery.isLoading &&
        Object.keys(sessionResults).length === 0 &&
        completedGPs.length > 0) ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((skeleton) => (
            <GlassPanel key={skeleton} className="overflow-hidden rounded-2xl animate-pulse">
              <div className="aspect-[16/9] bg-white/[0.04]" />
              <div className="p-5 space-y-3">
                <div className="h-3 w-36 rounded bg-white/[0.06]" />
                <div className="h-7 w-56 rounded bg-white/[0.08]" />
                <div className="h-9 w-full rounded-full bg-white/[0.05] mt-4" />
              </div>
            </GlassPanel>
          ))}
        </div>
      ) : (scheduleQuery.isError || resultsQuery.isError) && episodes.length === 0 ? (
        <GlassPanel className="py-20 px-6 text-center border border-amber-500/20 rounded-3xl space-y-4">
          <Compass className="w-10 h-10 text-amber-400/50 mx-auto" />
          <h3 className="font-display text-3xl">Archive data unavailable</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            Could not load {season} schedule or classification records from the backend right now.
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
      ) : filteredEpisodes.length === 0 ? (
        <GlassPanel className="py-20 px-6 text-center border border-white/10 rounded-3xl">
          <Compass className="w-10 h-10 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="font-display text-3xl">
            {episodes.length === 0 ? "No completed events available" : "No matching Grands Prix"}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
            {episodes.length === 0
              ? `No completed events were returned for ${season}. Select another season above.`
              : `No ${season} races matched "${searchFilter}". Clear the filter to see all rounds.`}
          </p>
        </GlassPanel>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredEpisodes.map((e, i) => (
            <motion.article
              key={e.round}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: Math.min(i, 6) * 0.03 }}
              className="group relative flex flex-col justify-between overflow-hidden rounded-2xl glass border border-white/[0.08] hover:border-primary/30 transition duration-300"
            >
              <div className="relative aspect-[16/9] w-full overflow-hidden border-b border-white/[0.08]">
                <img
                  src={e.img}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover opacity-55 transition duration-700 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
                <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-mono glass-strong text-muted-foreground font-semibold uppercase">
                  R{String(e.round).padStart(2, "0")}
                </span>
                <span
                  className={`absolute top-3 right-3 inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-mono font-semibold ${
                    trackReplaySupported
                      ? "bg-emerald-500/20 border border-emerald-500/35 text-emerald-200"
                      : "bg-white/10 border border-white/15 text-muted-foreground"
                  }`}
                >
                  {trackReplaySupported ? "Track Replay" : "Classification"}
                </span>
                {e.winner && (
                  <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-mono glass-strong text-primary font-bold uppercase">
                    P1 · {e.winner}
                  </span>
                )}
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-muted-foreground uppercase">
                    <span>{e.date}</span>
                    <span>·</span>
                    <span>{e.location}</span>
                  </div>
                  <h3 className="font-display text-2xl leading-tight group-hover:text-primary transition">
                    {e.name}
                  </h3>
                  {e.conflictBadge && (
                    <p className="text-[11px] font-mono text-amber-300/90">{e.conflictBadge}</p>
                  )}
                  {!e.winner && (
                    <p className="text-xs text-muted-foreground">
                      Official classification unavailable for this round.
                    </p>
                  )}
                </div>

                <div className="mt-5 pt-4 border-t border-white/[0.06] grid grid-cols-2 gap-2">
                  {trackReplaySupported ? (
                    <Link
                      to="/race-center"
                      search={{ mode: "replay", year: season, round: e.round, session: "Race" }}
                      className="inline-flex items-center justify-center gap-1.5 rounded-full bg-foreground text-background py-2 text-xs font-semibold transition hover:bg-foreground/90"
                    >
                      <Play className="h-3 w-3 fill-current" /> Track Replay
                    </Link>
                  ) : (
                    <span
                      title="Positional GPS track replay begins with 2023 OpenF1 archives"
                      className="inline-flex items-center justify-center rounded-full bg-white/[0.03] border border-white/[0.08] py-2 text-[11px] font-mono text-muted-foreground"
                    >
                      Pre-2023 Archive
                    </span>
                  )}
                  <Link
                    to="/race-center"
                    search={{ mode: "archive", year: season, round: e.round, session: "Race" }}
                    className="inline-flex items-center justify-center gap-1.5 rounded-full glass py-2 text-xs font-medium transition hover:bg-white/10 text-muted-foreground hover:text-foreground"
                  >
                    <Radio className="h-3.5 w-3.5" /> Results
                  </Link>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      )}

      <GlassPanel className="p-6 border border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="apex-eyebrow">Archive Coverage</div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Official classifications cover all seasons here. Interactive visual car-position track
            replays cover 2023+ sessions via OpenF1 archives. Video broadcasts and team radio are
            not hosted.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] border border-white/10 px-3.5 py-2 text-[11px] font-mono text-muted-foreground shrink-0">
          <span className="h-2 w-2 rounded-full bg-emerald-400" /> Verified data only
        </span>
      </GlassPanel>
    </div>
  );
}
