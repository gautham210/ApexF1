import { matchesSession } from "@/lib/session";
import type { CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useMemo } from "react";
import {
  Cloud,
  Wind,
  Thermometer,
  MapPin,
  ChevronRight,
  Play,
  Clock,
  Trophy,
  Zap,
  Radio,
  Flag,
  AlertTriangle,
} from "lucide-react";
import { f1Api } from "@/lib/api/client";
import { useSessionContext } from "@/hooks/useSessionContext";
import { useLiveSession } from "@/hooks/useLiveSession";
import { usePreferences, TEAMS } from "@/lib/preferences";
import { useCanonicalStore } from "@/lib/store";
import { getNewsFeed } from "@/lib/api/news";

import heroRace from "@/assets/hero-race.jpg";
import heroPit from "@/assets/hero-pit.jpg";
import heroCircuit from "@/assets/hero-circuit.jpg";
import heroDriver from "@/assets/hero-driver.jpg";
import heroNight from "@/assets/hero-night.jpg";
import heroRain from "@/assets/hero-rain.jpg";
import heroGarage from "@/assets/hero-garage.jpg";
import heroHelmet from "@/assets/hero-helmet.jpg";

import { GlassPanel } from "@/components/GlassPanel";
import { CircuitOutline, type CircuitKey } from "@/components/CircuitOutline";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ApexF1 — Cinematic Motorsport Companion" },
      {
        name: "description",
        content: "A luxurious, content-first motorsport companion for the Grand Prix weekend.",
      },
    ],
  }),
  component: Dashboard,
});

function CountdownTimer({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  useEffect(() => {
    if (!targetDate) return;
    const target = new Date(targetDate).getTime();
    const tick = () => {
      const difference = target - Date.now();
      if (difference <= 0) {
        setTimeLeft(null);
      } else {
        setTimeLeft({
          days: Math.floor(difference / 86_400_000),
          hours: Math.floor((difference % 86_400_000) / 3_600_000),
          minutes: Math.floor((difference % 3_600_000) / 60_000),
          seconds: Math.floor((difference % 60_000) / 1000),
        });
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (!timeLeft) {
    return (
      <span className="font-mono text-xs text-primary/80 uppercase tracking-widest animate-pulse">
        Session time reached
      </span>
    );
  }

  return (
    <div className="flex gap-3">
      {[
        { value: timeLeft.days, label: "d" },
        { value: timeLeft.hours, label: "h" },
        { value: timeLeft.minutes, label: "m" },
      ].map((t, idx) => (
        <div key={idx} className="flex items-baseline gap-0.5">
          <span className="font-display text-2xl md:text-3xl font-medium leading-none text-foreground">
            {String(t.value).padStart(2, "0")}
          </span>
          <span className="text-xs text-muted-foreground font-mono">{t.label}</span>
        </div>
      ))}
    </div>
  );
}

function Dashboard() {
  const { season, currentRace, nextEvent, isLiveWeekend } = useSessionContext();
  const live = useLiveSession();
  const [prefs] = usePreferences();
  const favoriteTeam = prefs.team ? TEAMS[prefs.team] : null;
  const favoriteDriver = prefs.driver;

  // Canonical store — single source of truth for race results
  const { sessionResults } = useCanonicalStore();

  const { data: dashboard, isPending: loading } = useQuery({
    queryKey: ["dashboard", season],
    queryFn: () => f1Api.getDashboardContext(season),
    staleTime: 60000,
  });
  const ctx = dashboard?.data;

  // Derive dynamic weekend state
  const weekendState = useMemo<"BEFORE" | "DURING" | "AFTER">(() => {
    if (live.is_live) return "DURING";
    if (currentRace?.is_completed) return "AFTER";
    return "BEFORE";
  }, [live.is_live, currentRace?.is_completed]);

  // Bind dynamic body class for visual mood states
  useEffect(() => {
    document.body.classList.remove(
      "theme-practice",
      "theme-qualifying",
      "theme-race",
      "theme-post-race",
    );
    if (live.is_live) {
      const sName = (live.session_info?.session_name || "").toLowerCase();
      if (sName.includes("practice") || sName.includes("fp")) {
        document.body.classList.add("theme-practice");
      } else if (sName.includes("qualifying") || sName.includes("quali") || sName.includes("q1")) {
        document.body.classList.add("theme-qualifying");
      } else {
        document.body.classList.add("theme-race");
      }
    } else if (currentRace?.is_completed) {
      document.body.classList.add("theme-post-race");
    }
    return () => {
      document.body.classList.remove(
        "theme-practice",
        "theme-qualifying",
        "theme-race",
        "theme-post-race",
      );
    };
  }, [live.is_live, live.session_info?.session_name, currentRace?.is_completed]);

  const newsQuery = useQuery({
    queryKey: ["news-feed"],
    queryFn: getNewsFeed,
    staleTime: 600000,
    retry: 1,
  });
  const news = newsQuery.data?.articles ?? [];
  const insights = ctx?.insights ?? {};

  const activeEventName = currentRace?.event_name || currentRace?.location || "Grand Prix";
  const activeCountry = currentRace?.country || "";
  const weather =
    live.session_info?.year === season &&
    matchesSession(
      currentRace ?? undefined,
      live.session_info.session_name,
      live.session_info.date_start,
    )
      ? live.weather
      : null;
  const nextSession = currentRace
    ? [1, 2, 3, 4, 5]
        .map((i) => ({
          name: currentRace[`session${i}` as keyof typeof currentRace],
          date: currentRace[`session${i}_date` as keyof typeof currentRace],
        }))
        .filter((s) => typeof s.date === "string" && Date.parse(s.date) > Date.now())
        .sort((a, b) => Date.parse(String(a.date)) - Date.parse(String(b.date)))[0]
    : null;

  // Restrained, beautiful dynamic backdrop imagery
  const heroImage = useMemo(() => {
    const norm = activeCountry.toLowerCase();
    if (norm.includes("belgium") || norm.includes("spa")) return heroRace;
    if (norm.includes("monaco")) return heroHelmet;
    if (norm.includes("japan")) return heroCircuit;
    if (norm.includes("britain")) return heroPit;
    if (norm.includes("italy")) return heroNight;
    if (norm.includes("singapore")) return heroRain;
    return heroGarage;
  }, [activeCountry]);

  return (
    <div
      className="pb-32 relative"
      style={
        { "--primary": favoriteTeam ? favoriteTeam.accent : "oklch(0.82 0.13 75)" } as CSSProperties
      }
    >
      {/* SECTION 1: CINEMATIC HERO */}
      <section className="relative h-[88vh] min-h-[620px] w-full overflow-hidden">
        <motion.img
          initial={{ scale: 1.05, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
          src={heroImage}
          alt="Race weekend hero"
          className="absolute inset-0 h-full w-full object-cover"
          width={1920}
          height={1080}
        />
        {/* Soft edge highlights & layered gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-background/50" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/70 via-transparent to-transparent" />

        <div className="relative z-10 mx-auto flex h-full max-w-[1400px] flex-col justify-end px-6 pb-16 lg:px-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.3 }}
            className="max-w-2xl"
          >
            <div className="flex items-center gap-3 text-xs font-mono tracking-[0.2em] text-muted-foreground uppercase">
              {live.is_live ? (
                <span className="flex items-center gap-1.5 text-primary font-bold">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  Live timing stream
                </span>
              ) : isLiveWeekend ? (
                <span className="flex items-center gap-1.5 text-foreground/80 font-semibold">
                  <span className="h-1.5 w-1.5 rounded-full bg-foreground/60" />
                  Active race weekend
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                  {currentRace ? `Round ${currentRace.round_number}` : "Schedule unavailable"}
                </span>
              )}
              <span>·</span>
              <span>{currentRace?.location || "Paddock"}</span>
            </div>

            <h1 className="mt-5 font-display text-5xl leading-[0.95] text-balance md:text-7xl">
              {activeEventName}
            </h1>
            <p className="mt-4 max-w-md text-sm text-muted-foreground leading-relaxed">
              Follow the weekend schedule, championship standings and latest paddock reporting.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              {live.is_live ? (
                <Link
                  to="/race-center"
                  className="group inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition hover:bg-foreground/90"
                >
                  <Play className="h-3.5 w-3.5 fill-current" /> Tune in Live
                </Link>
              ) : (
                <Link
                  to="/race-center"
                  className="group inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition hover:bg-foreground/90"
                >
                  <Clock className="h-3.5 w-3.5 fill-current" /> Explore Telemetry
                </Link>
              )}
              <Link
                to="/sessions"
                className="inline-flex items-center gap-2 rounded-full glass-strong px-5 py-2.5 text-sm transition hover:bg-foreground/10"
              >
                Weekend schedule <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </motion.div>

          {/* Floating metadata panel */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.6 }}
            className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4 lg:max-w-3xl"
          >
            <GlassPanel className="p-4">
              <div className="flex items-center gap-2 text-[10px] font-mono tracking-[0.18em] text-muted-foreground uppercase">
                <Clock className="h-3 w-3" /> {nextSession?.name || "Session clock"}
              </div>
              <div className="mt-2">
                {nextSession ? (
                  <CountdownTimer targetDate={String(nextSession.date)} />
                ) : (
                  <span className="font-display text-2xl text-muted-foreground">Unavailable</span>
                )}
              </div>
            </GlassPanel>
            <GlassPanel className="p-4">
              <div className="flex items-center gap-2 text-[10px] font-mono tracking-[0.18em] text-muted-foreground uppercase">
                <MapPin className="h-3 w-3" /> Location
              </div>
              <div className="mt-2 font-display text-2xl leading-none truncate">
                {currentRace?.location || "Paddock"}
              </div>
              <div className="text-[10px] text-muted-foreground truncate mt-1">
                {currentRace?.country || "F1 Track"}
              </div>
            </GlassPanel>
            <GlassPanel className="p-4">
              <div className="flex items-center gap-2 text-[10px] font-mono tracking-[0.18em] text-muted-foreground uppercase">
                <Cloud className="h-3 w-3" /> Conditions
              </div>
              <div className="mt-2 font-display text-2xl">
                {weather?.rainfall === true
                  ? "Rain observed"
                  : weather?.rainfall === false
                    ? "No rain observed"
                    : "Unavailable"}
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1">
                <span className="inline-flex items-center gap-0.5">
                  <Thermometer className="h-3 w-3" />{" "}
                  {weather?.air_temp != null
                    ? `${weather.air_temp.toFixed(0)}°`
                    : "Air temperature unavailable"}
                </span>
                <span className="inline-flex items-center gap-0.5">
                  <Wind className="h-3 w-3" />{" "}
                  {weather?.wind_speed != null
                    ? `${weather.wind_speed.toFixed(0)} m/s`
                    : "Wind unavailable"}
                </span>
              </div>
            </GlassPanel>
            <GlassPanel className="p-4">
              <div className="text-[10px] font-mono tracking-[0.18em] text-muted-foreground uppercase">
                Championship
              </div>
              <div className="mt-2 font-display text-2xl">{season}</div>
              <div className="text-[10px] text-muted-foreground mt-1">
                {ctx?.season_context?.completed_rounds ?? "Unavailable"} completed rounds
              </div>
            </GlassPanel>
          </motion.div>
        </div>
      </section>

      {/* SECTION 2: LIVE CONTEXTUAL HUB */}
      <section className="mx-auto -mt-20 max-w-[1400px] px-6 lg:px-12 relative z-20">
        <AnimatePresence mode="wait">
          {/* BEFORE STATE: Countdown, weather, and circuit overview */}
          {weekendState === "BEFORE" && (
            <motion.div
              key="before"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6 }}
            >
              <GlassPanel
                variant="strong"
                className="grid gap-8 p-8 lg:grid-cols-[1.2fr_1fr] border border-border/40"
              >
                <div>
                  <div className="text-[10px] font-mono text-muted-foreground uppercase">
                    Weekend programme
                  </div>
                  <h2 className="mt-2 font-display text-4xl">
                    {currentRace?.event_name || "Schedule unavailable"}
                  </h2>
                  <p className="mt-4 text-sm text-muted-foreground">
                    Explore session times and results as they become available.
                  </p>
                </div>
                <div className="flex items-center">
                  <Link to="/sessions" className="rounded-full glass px-6 py-3">
                    View session schedule
                  </Link>
                </div>
              </GlassPanel>
            </motion.div>
          )}

          {/* DURING STATE: Live timing table, strategy details, flags */}
          {weekendState === "DURING" && (
            <motion.div
              key="during"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6 }}
              className="grid gap-6 lg:grid-cols-[1.5fr_1fr]"
            >
              {/* Timing Tower snapshot */}
              <GlassPanel
                variant="strong"
                className="p-6 border border-border/40 flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground uppercase font-bold flex items-center gap-2">
                        <Radio className="w-3.5 h-3.5 text-primary animate-pulse" /> Live
                        leaderboard tower
                      </div>
                      <h2 className="mt-1 font-display text-3xl">Active standings</h2>
                    </div>
                    <Link
                      to="/race-center"
                      className="text-xs text-muted-foreground hover:text-foreground font-mono transition"
                    >
                      FULL COMMAND FEED →
                    </Link>
                  </div>

                  <div className="space-y-2">
                    {live.leaderboard.length > 0 ? (
                      live.leaderboard.slice(0, 5).map((d, i) => (
                        <div
                          key={d.driver_number}
                          className="flex items-center justify-between p-3 bg-white/[0.01] hover:bg-white/[0.02] border border-border/30 rounded-xl transition"
                          style={{ borderLeft: `3px solid ${d.team_color || "#888"}` }}
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-xs text-muted-foreground w-4 text-center">
                              {d.position}
                            </span>
                            <div>
                              <div className="font-display text-lg leading-none">
                                {d.abbreviation}
                              </div>
                              <div className="text-[9px] text-muted-foreground mt-1 uppercase font-bold tracking-wider">
                                {d.team}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-mono text-xs text-foreground/80">
                              {d.gap_to_leader || "Unavailable"}
                            </span>
                            <span className="text-[8px] text-muted-foreground font-mono ml-2 uppercase border border-border/20 px-1 py-0.5 rounded">
                              {d.current_tyre || "Unavailable"}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-12 text-center text-xs text-muted-foreground uppercase tracking-widest font-mono">
                        Standings populate as laps unfold
                      </div>
                    )}
                  </div>
                </div>
              </GlassPanel>

              {/* Marshal flags and live tyre strategies */}
              <div className="flex flex-col gap-6">
                {live.session_info?.track_status &&
                  !["GREEN", "UNKNOWN"].includes(live.session_info.track_status) && (
                    <GlassPanel
                      variant="strong"
                      className="p-6 border border-primary/20 bg-primary/[0.02]"
                    >
                      <div className="flex items-center gap-3 text-primary font-mono text-xs uppercase font-bold tracking-widest">
                        <AlertTriangle className="w-5 h-5 animate-pulse" />
                        Track Flag alert
                      </div>
                      <div className="mt-3 font-display text-3xl uppercase tracking-wider text-foreground">
                        {live.session_info.track_status} FLAG ACTIVE
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                        See Race Center for the available race control messages.
                      </p>
                    </GlassPanel>
                  )}

                <GlassPanel
                  variant="strong"
                  className="p-6 border border-border/40 flex-1 flex flex-col justify-between"
                >
                  <div>
                    <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground uppercase font-bold">
                      FULL TIMING
                    </div>
                    <h3 className="mt-1 font-display text-3xl">Race command feed</h3>
                    <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                      Live tyre selections, pit strategies, gap intervals, and sector splits are
                      available in the full Race Center timing feed.
                    </p>
                  </div>
                  <div className="mt-6">
                    <Link
                      to="/race-center"
                      className="inline-flex items-center justify-center w-full gap-2 rounded-xl bg-foreground text-background py-2.5 text-xs font-bold transition hover:bg-foreground/90"
                    >
                      Open Race Center →
                    </Link>
                  </div>
                </GlassPanel>
              </div>
            </motion.div>
          )}

          {/* AFTER STATE: Winner showcase, podium, standings split — sourced from canonical store only */}
          {weekendState === "AFTER" && (
            <motion.div
              key="after"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6 }}
              className="grid gap-6 lg:grid-cols-[1.5fr_1fr]"
            >
              {/* GP Winner & Podium Card */}
              <GlassPanel
                variant="strong"
                className="p-8 border border-border/40 flex flex-col justify-between overflow-hidden relative min-h-[320px]"
              >
                <div className="absolute right-0 bottom-0 h-full w-[240px] opacity-10 pointer-events-none">
                  <Trophy className="w-full h-full text-foreground" strokeWidth={1} />
                </div>
                <div>
                  <div className="text-[10px] font-mono tracking-[0.2em] text-primary font-bold uppercase flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5" /> Race results summary
                  </div>
                  <h2 className="mt-2 font-display text-4xl">Weekend champions</h2>
                </div>

                {/* Render top-3 only from canonical verified data */}
                {(() => {
                  const raceKey = `${season}-${currentRace?.round_number}-Race`;
                  const results = sessionResults[raceKey];
                  const top3 = results?.slice(0, 3) ?? [];

                  if (top3.length === 0) {
                    return (
                      <div className="mt-8 py-8 text-center border-t border-border/20">
                        <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                          Official classification unavailable from the configured provider.
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1">
                          Historical telemetry coverage is independent of race results.
                        </p>
                      </div>
                    );
                  }

                  const [p1, p2, p3] = [
                    top3.find((d) => d.position === 1),
                    top3.find((d) => d.position === 2),
                    top3.find((d) => d.position === 3),
                  ];

                  return (
                    <div className="grid grid-cols-3 gap-4 mt-8 border-t border-border/20 pt-6 items-end">
                      {p2 && (
                        <div className="text-center p-3 rounded-2xl bg-white/[0.01] border border-border/10">
                          <div className="text-[9px] font-mono text-muted-foreground uppercase font-bold">
                            2nd Place
                          </div>
                          <div className="font-display text-xl mt-1 leading-none">
                            {p2.abbreviation || p2.driver_name}
                          </div>
                          <div className="text-[8px] font-mono text-primary font-bold uppercase mt-1">
                            {p2.team?.slice(0, 3).toUpperCase()}
                          </div>
                        </div>
                      )}
                      {p1 && (
                        <div className="text-center p-4 rounded-2xl bg-primary/5 border border-primary/20 shadow-2xl relative -top-2">
                          <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-primary text-[8px] font-mono font-black text-background uppercase">
                            Winner
                          </span>
                          <div className="text-[9px] font-mono text-primary font-bold uppercase">
                            1st Place
                          </div>
                          <div className="font-display text-2xl mt-1.5 leading-none">
                            {p1.abbreviation || p1.driver_name}
                          </div>
                          <div className="text-[8px] font-mono text-primary/80 font-bold uppercase mt-1">
                            {p1.team?.slice(0, 3).toUpperCase()}
                          </div>
                        </div>
                      )}
                      {p3 && (
                        <div className="text-center p-3 rounded-2xl bg-white/[0.01] border border-border/10">
                          <div className="text-[9px] font-mono text-muted-foreground uppercase font-bold">
                            3rd Place
                          </div>
                          <div className="font-display text-xl mt-1 leading-none">
                            {p3.abbreviation || p3.driver_name}
                          </div>
                          <div className="text-[8px] font-mono text-primary font-bold uppercase mt-1">
                            {p3.team?.slice(0, 3).toUpperCase()}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </GlassPanel>

              {/* Post-race navigation */}
              <GlassPanel
                variant="strong"
                className="p-6 border border-border/40 flex flex-col justify-between"
              >
                <div>
                  <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground uppercase font-bold">
                    NEXT STEPS
                  </div>
                  <h3 className="mt-1 font-display text-3xl">Explore the weekend</h3>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                    Championship standings have been updated. View the full classification or
                    revisit the race through the archive.
                  </p>
                </div>
                <div className="mt-6 flex flex-col gap-2">
                  <Link
                    to="/standings"
                    className="inline-flex items-center justify-between rounded-xl bg-foreground px-4 py-2.5 text-xs font-bold text-background transition hover:bg-foreground/90"
                  >
                    Explore updated standings <ChevronRight className="h-4 w-4" />
                  </Link>
                  <Link
                    to="/replay"
                    className="inline-flex items-center justify-center gap-2 rounded-xl glass-strong py-2.5 text-xs font-bold text-foreground transition hover:bg-white/10"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" /> Browse race archives
                  </Link>
                </div>
              </GlassPanel>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* SECTION 3: STORIES & DOCUMENTARY FEED */}
      <section className="mx-auto mt-24 max-w-[1400px] px-6 lg:px-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {/* Personalization Driver Spotlight (Accent & Alert personalization) */}
        {favoriteDriver && (
          <GlassPanel
            variant="strong"
            className="p-6 flex flex-col justify-between relative overflow-hidden border border-border/40 md:col-span-2 lg:col-span-1"
            style={{ borderLeft: `4px solid ${favoriteTeam?.accent || "var(--primary)"}` }}
          >
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[9px] font-mono tracking-[0.2em] text-primary font-black uppercase">
                <Zap className="w-3.5 h-3.5" /> Driver spotlight · {favoriteTeam?.name || "Support"}
              </div>
              <h3 className="font-display text-3xl leading-tight">{favoriteDriver}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your favourite driver is saved on this device. Visit Standings for their available
                championship results.
              </p>
            </div>
            <div className="mt-6 flex items-center justify-between rounded-xl border border-border/20 p-3 bg-white/[0.01]">
              <span className="text-[10px] font-mono text-muted-foreground uppercase font-bold">
                Championship status
              </span>
              <span className="text-xs font-bold font-mono text-foreground">Personalized</span>
            </div>
          </GlassPanel>
        )}

        {/* Stories list */}
        <div
          className={
            favoriteDriver ? "lg:col-span-2 space-y-6" : "md:col-span-2 lg:col-span-3 space-y-6"
          }
        >
          <div className="flex justify-between items-end border-b border-border/40 pb-4">
            <div>
              <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground uppercase font-bold">
                EDITORIAL
              </div>
              <h2 className="mt-1 font-display text-4xl">Stories from the paddock</h2>
            </div>
            <Link
              to="/news"
              search={{ source: undefined, topic: undefined, q: undefined }}
              className="text-xs text-muted-foreground hover:text-foreground font-mono transition"
            >
              ALL NEWS →
            </Link>
          </div>
          {newsQuery.data && newsQuery.data.status !== "success" && (
            <p role="status" className="text-xs text-muted-foreground">
              {newsQuery.data.status === "stale"
                ? "Showing cached publisher stories; a feed refresh failed."
                : "Some publisher feeds are unavailable; the stories below remain attributed to their sources."}
            </p>
          )}

          {newsQuery.isPending ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Array(2)
                .fill(0)
                .map((_, i) => (
                  <div key={i} className="h-32 skeleton rounded-2xl bg-white/5" />
                ))}
            </div>
          ) : news.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {news.slice(0, 2).map((article) => (
                <article
                  key={article.link}
                  className="group rounded-2xl border border-border/40 bg-gradient-to-br from-white/[0.04] to-transparent p-6 min-h-44 flex flex-col justify-between"
                >
                  <div>
                    <p className="text-[10px] text-muted-foreground">
                      {article.source} ·{" "}
                      {article.published
                        ? new Date(article.published).toLocaleDateString()
                        : "Publication date unavailable"}
                    </p>
                    <h3 className="mt-3 font-display text-2xl leading-tight text-balance group-hover:text-primary transition">
                      <a
                        href={article.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="focus-visible:outline focus-visible:outline-2"
                      >
                        {article.title}
                      </a>
                    </h3>
                    <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                      {article.summary}
                    </p>
                  </div>
                  <p className="mt-4 text-[10px] text-muted-foreground">Read at {article.source}</p>
                </article>
              ))}
            </div>
          ) : (
            <GlassPanel className="p-8 py-12 text-center max-w-md mx-auto border border-border/40">
              <div className="font-display text-2xl">
                {newsQuery.isError ? "News unavailable" : "No current stories"}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Publisher feeds report their own articles and publication dates.
              </p>
              {newsQuery.isError && (
                <button className="underline text-xs p-3" onClick={() => void newsQuery.refetch()}>
                  Retry
                </button>
              )}
            </GlassPanel>
          )}
        </div>
      </section>
    </div>
  );
}
