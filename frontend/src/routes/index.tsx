import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useState, useMemo } from "react";
import { Cloud, Wind, Thermometer, MapPin, ChevronRight, Play, Clock, Trophy, Zap, Compass, CalendarDays } from "lucide-react";
import { f1Api } from "@/lib/api/client";
import { useSessionContext } from "@/hooks/useSessionContext";
import { useLiveSession } from "@/hooks/useLiveSession";
import { usePreferences, TEAMS } from "@/lib/preferences";

import heroRace from "@/assets/hero-race.jpg";
import heroPit from "@/assets/hero-pit.jpg";
import heroCircuit from "@/assets/hero-circuit.jpg";
import heroDriver from "@/assets/hero-driver.jpg";
import heroSession from "@/assets/hero-session.jpg";
import heroNight from "@/assets/hero-night.jpg";
import heroRain from "@/assets/hero-rain.jpg";
import heroGarage from "@/assets/hero-garage.jpg";
import heroHelmet from "@/assets/hero-helmet.jpg";

import { GlassPanel } from "@/components/GlassPanel";
import { CircuitOutline, type CircuitKey } from "@/components/CircuitOutline";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ApexF1 — A cinematic F1 companion" },
      { name: "description", content: "A luxurious, content-first motorsport companion for the Formula 1 season." },
    ],
  }),
  component: Dashboard,
});

function CountdownTimer({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);

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
    return <span className="font-mono text-xs text-primary/80 uppercase tracking-widest animate-pulse">WEEKEND ACTIVE</span>;
  }

  return (
    <div className="flex gap-3">
      {[
        { value: timeLeft.days, label: "d" },
        { value: timeLeft.hours, label: "h" },
        { value: timeLeft.minutes, label: "m" },
      ].map((t, idx) => (
        <div key={idx} className="flex items-baseline gap-0.5">
          <span className="font-display text-2xl md:text-3xl font-medium leading-none text-foreground">{String(t.value).padStart(2, "0")}</span>
          <span className="text-xs text-muted-foreground font-mono">{t.label}</span>
        </div>
      ))}
    </div>
  );
}

function getCircuitData(countryName?: string) {
  const norm = (countryName || "").toLowerCase().trim();
  if (norm.includes("belgium") || norm.includes("spa")) {
    return { key: "spa" as CircuitKey, desc: "A historic ribbon winding through the Ardennes forest.", turns: 19, fastest: "1:46.286", holder: "V. Bottas (2018)" };
  }
  if (norm.includes("monaco") || norm.includes("monte")) {
    return { key: "monaco" as CircuitKey, desc: "Floating barriers, tunnel glare, and absolute precision.", turns: 19, fastest: "1:12.909", holder: "L. Hamilton (2021)" };
  }
  if (norm.includes("japan") || norm.includes("suzuka")) {
    return { key: "suzuka" as CircuitKey, desc: "The ultimate figure-eight flowing test of chassis dynamics.", turns: 18, fastest: "1:30.983", holder: "L. Hamilton (2019)" };
  }
  if (norm.includes("britain") || norm.includes("silverstone")) {
    return { key: "silverstone" as CircuitKey, desc: "Ultra high speed sweeping bends at the home of motorsport.", turns: 18, fastest: "1:27.097", holder: "M. Verstappen (2020)" };
  }
  if (norm.includes("italy") || norm.includes("monza")) {
    return { key: "monza" as CircuitKey, desc: "Monza, the Temple of Speed, where slipstreams write legends.", turns: 11, fastest: "1:18.887", holder: "R. Barrichello (2004)" };
  }
  if (norm.includes("singapore") || norm.includes("marina")) {
    return { key: "marina-bay" as CircuitKey, desc: "Night races under millions of lumens, concrete heat.", turns: 19, fastest: "1:35.867", holder: "L. Hamilton (2018)" };
  }
  return { key: "spa" as CircuitKey, desc: "Championship circuit design with deep motorsport legacy.", turns: 19, fastest: "1:46.286", holder: "V. Bottas (2018)" };
}

export function Dashboard() {
  const { season, currentRace, nextEvent, isLiveWeekend } = useSessionContext();
  const live = useLiveSession();
  const [prefs] = usePreferences();
  const favoriteTeam = prefs.team ? TEAMS[prefs.team] : null;
  const favoriteDriver = prefs.driver;

  const [ctx, setCtx] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await f1Api.getDashboardContext(season);
        const data = (res as any)?.data ?? res;
        setCtx(data);
      } catch (e) {
        console.error("[Dashboard] Context load failed:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [season]);

  const insights = ctx?.insights ?? {};
  const news = ctx?.news ?? [];
  const drivers = ctx?.driver_standings ?? [];
  const constructors = ctx?.constructor_standings ?? [];

  const activeEventName = currentRace?.event_name || currentRace?.location || `${season} Grand Prix`;
  const activeCountry = currentRace?.country || "";
  const circuitData = useMemo(() => getCircuitData(activeCountry), [activeCountry]);

  // Restrained, beautiful dynamic backdrop imagery
  const heroImage = useMemo(() => {
    const norm = activeCountry.toLowerCase();
    if (norm.includes("belgium") || norm.includes("spa")) return heroRace;
    if (norm.includes("monaco")) return heroHelmet;
    if (norm.includes("japan")) return heroCircuit;
    if (norm.includes("britain")) return heroPit;
    if (norm.includes("italy")) return heroNight;
    if (norm.includes("singapore")) return heroRain;
    return heroRace;
  }, [activeCountry]);

  return (
    <div className="pb-32 relative" style={{ "--primary": favoriteTeam ? favoriteTeam.accent : "oklch(0.82 0.13 75)" } as any}>
      {/* 1. CINEMATIC HERO */}
      <section className="relative h-[88vh] min-h-[640px] w-full overflow-hidden">
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
            <div className="flex items-center gap-3 text-xs font-mono tracking-[0.2em] text-muted-foreground">
              {live.is_live ? (
                <span className="flex items-center gap-1.5 text-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  LIVE NOW
                </span>
              ) : isLiveWeekend ? (
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                  ACTIVE WEEKEND
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                  ROUND {currentRace?.round_number || 1}
                </span>
              )}
              <span>·</span>
              <span>{season} SEASON</span>
            </div>

            <h1 className="mt-5 font-display text-5xl leading-[0.95] text-balance md:text-7xl">
              {activeEventName}
            </h1>
            <p className="mt-4 max-w-md text-sm text-muted-foreground leading-relaxed">
              {circuitData.desc} Explore telemetry logs, session timetables, and standings updates.
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
                  <Clock className="h-3.5 w-3.5 fill-current" /> Telemetry logs
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
              <div className="flex items-center gap-2 text-[10px] font-mono tracking-[0.18em] text-muted-foreground">
                <Clock className="h-3 w-3" /> SESSION TIMER
              </div>
              <div className="mt-2">
                {nextEvent?.session5_date || currentRace?.session5_date ? (
                  <CountdownTimer targetDate={nextEvent?.session5_date || currentRace?.session5_date || ""} />
                ) : (
                  <span className="font-display text-2xl text-muted-foreground">Completed</span>
                )}
              </div>
            </GlassPanel>
            <GlassPanel className="p-4">
              <div className="flex items-center gap-2 text-[10px] font-mono tracking-[0.18em] text-muted-foreground">
                <MapPin className="h-3 w-3" /> CIRCUIT LOCATION
              </div>
              <div className="mt-2 font-display text-2xl leading-none">
                {currentRace?.location || "Paddock"}
              </div>
              <div className="text-[10px] text-muted-foreground truncate mt-1">
                {currentRace?.country || "F1 Track"}
              </div>
            </GlassPanel>
            <GlassPanel className="p-4">
              <div className="flex items-center gap-2 text-[10px] font-mono tracking-[0.18em] text-muted-foreground">
                <Cloud className="h-3 w-3" /> CONDITIONS
              </div>
              <div className="mt-2 font-display text-2xl">
                {live.weather?.rainfall ? "Rainy" : live.weather?.air_temp ? "On Track" : "Standby"}
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1">
                <span className="inline-flex items-center gap-0.5">
                  <Thermometer className="h-3 w-3" /> {live.weather?.air_temp?.toFixed(0) || "—"}°
                </span>
                <span className="inline-flex items-center gap-0.5">
                  <Wind className="h-3 w-3" /> {live.weather?.wind_speed?.toFixed(0) || "—"} m/s
                </span>
              </div>
            </GlassPanel>
            <GlassPanel className="p-4">
              <div className="text-[10px] font-mono tracking-[0.18em] text-muted-foreground uppercase">
                Circuit distance
              </div>
              <div className="mt-2 font-display text-2xl">
                {circuitData.key === "spa" ? "7.004" : circuitData.key === "monaco" ? "3.337" : "5.891"}
                <span className="text-sm text-muted-foreground"> km</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">
                Turns: {circuitData.turns}
              </div>
            </GlassPanel>
          </motion.div>
        </div>
      </section>

      {/* 2. CIRCUIT LAYOUT */}
      <section className="mx-auto -mt-20 max-w-[1400px] px-6 lg:px-12 relative z-20">
        <GlassPanel variant="strong" className="grid gap-8 p-8 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground">CIRCUIT VECTOR</div>
            <h2 className="mt-2 font-display text-4xl">Layout geometry</h2>
            <div className="mt-6 aspect-[16/10] w-full rounded-xl bg-gradient-to-br from-surface to-background/50 p-6 border border-border/40">
              <CircuitOutline circuit={circuitData.key} className="h-full w-full" animated />
            </div>
          </div>
          <div className="flex flex-col justify-center gap-6">
            <div>
              <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground">CORNERS</div>
              <div className="mt-1 font-display text-3xl">{circuitData.turns} turns</div>
            </div>
            <div className="h-px bg-border" />
            <div>
              <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground">LAP RECORD</div>
              <div className="mt-1 font-display text-3xl">{circuitData.fastest}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{circuitData.holder}</div>
            </div>
            <div className="h-px bg-border" />
            <div>
              <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground">YEAR OPENED</div>
              <div className="mt-1 font-display text-3xl">
                {circuitData.key === "spa" ? "1950" : circuitData.key === "monaco" ? "1950" : "1987"}
              </div>
            </div>
          </div>
        </GlassPanel>
      </section>

      {/* PERSONALIZED DRIVER FOCUS */}
      {favoriteDriver && (
        <section className="mx-auto mt-24 max-w-[1400px] px-6 lg:px-12">
          <div className="mb-6">
            <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground">PERSONALIZED PROFILE</div>
            <h2 className="mt-1 font-display text-4xl">Driver Spotlight</h2>
          </div>
          <GlassPanel
            variant="strong"
            className="relative overflow-hidden p-8 flex flex-col md:flex-row items-center justify-between gap-8 border border-border/40"
            style={{ borderLeft: `4px solid ${favoriteTeam?.accent || "var(--primary)"}` }}
          >
            <div className="max-w-xl space-y-4">
              <div className="flex items-center gap-2 text-[10px] font-mono tracking-[0.18em] text-primary font-bold uppercase">
                <Zap className="w-3.5 h-3.5" /> Spotlight Focus · {favoriteTeam?.name || "Grid Competitor"}
              </div>
              <h3 className="font-display text-4xl leading-tight">
                {favoriteDriver} is preparing for the grid
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                As a registered {favoriteTeam?.name || "paddock"} supporter, your home room is synchronized to spotlight their session countdowns, telemetry logs, and standings updates.
              </p>
              <div className="text-[11px] font-mono text-foreground/80 flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg max-w-max border border-border/20">
                <Clock className="w-3.5 h-3.5 text-primary" />
                <span>Your driver goes green in 14 minutes</span>
              </div>
            </div>
            <div className="w-full md:w-[280px] aspect-[4/3] rounded-xl overflow-hidden relative border border-border/20">
              <img src={heroDriver} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
              <div className="absolute inset-0 flex flex-col justify-end p-4">
                <span className="text-[9px] font-mono tracking-widest text-primary/80 font-bold uppercase">MOMENTUM</span>
                <span className="font-display text-2xl mt-1 leading-none">{favoriteDriver}</span>
              </div>
            </div>
          </GlassPanel>
        </section>
      )}

      {/* 3. STORIES FROM THE PADDOCK */}
      <section className="mx-auto mt-24 max-w-[1400px] px-6 lg:px-12">
        <div className="mb-6">
          <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground">PADDOCK JOURNALISM</div>
          <h2 className="mt-1 font-display text-4xl">Stories</h2>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="aspect-[4/5] skeleton rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : news.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
            {news.slice(0, 4).map((a: any, i: number) => {
              const bgStory =
                i === 0 ? heroSession : i === 1 ? heroPit : i === 2 ? heroDriver : heroCircuit;
              return (
                <motion.a
                  key={i}
                  href={a.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.06 }}
                  className="group block relative aspect-[4/5] overflow-hidden rounded-2xl border border-border/40"
                >
                  <img
                    src={bgStory}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04] opacity-50"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/25 to-transparent" />
                  <div className="absolute inset-0 flex flex-col justify-end p-5">
                    <span className="text-[9px] font-mono tracking-[0.18em] text-primary/90 font-bold uppercase">
                      {a.tag || "Paddock Update"}
                    </span>
                    <h3 className="mt-2 font-display text-2xl leading-tight text-balance">
                      {a.title}
                    </h3>
                    <span className="mt-2 text-xs text-muted-foreground">{a.source || "Formula 1"}</span>
                  </div>
                </motion.a>
              );
            })}
          </div>
        ) : (
          <GlassPanel className="p-8 py-16 text-center max-w-md mx-auto">
            <Compass className="w-10 h-10 text-muted-foreground/30 mx-auto mb-4" />
            <div className="font-display text-2xl">Stories offline</div>
            <p className="mt-2 text-sm text-muted-foreground">Paddock journalism streams will synchronize dynamically during session windows.</p>
          </GlassPanel>
        )}
      </section>

      {/* 4. CHAMPIONSHIP SNAPSHOT */}
      <section className="mx-auto mt-24 max-w-[1400px] px-6 lg:px-12 grid gap-8 lg:grid-cols-2">
        {/* Drivers Standings */}
        <GlassPanel variant="strong" className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground">CHAMPIONSHIP LEADERBOARD</div>
              <h2 className="mt-1 font-display text-3xl">Drivers</h2>
            </div>
            <Link to="/standings" className="text-xs text-muted-foreground hover:text-foreground transition">
              Standings →
            </Link>
          </div>

          <div className="space-y-2.5">
            {loading ? (
              Array(4).fill(0).map((_, i) => <div key={i} className="h-14 skeleton rounded-xl" />)
            ) : drivers.length > 0 ? (
              drivers.slice(0, 4).map((d: any, i: number) => (
                <div
                  key={d.name}
                  className="flex items-center justify-between p-3.5 bg-white/[0.01] hover:bg-white/[0.02] border border-border/40 rounded-xl transition"
                  style={{ borderLeft: `3px solid ${d.color || "#888888"}` }}
                >
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-xs text-muted-foreground w-4 text-center">{d.position || i + 1}</span>
                    <div>
                      <div className="font-display text-lg leading-none">{d.name}</div>
                      <div className="text-[10px] text-muted-foreground mt-1 uppercase font-semibold">{d.team}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-display text-2xl tabular-nums">{d.points}</span>
                    <span className="text-[9px] text-muted-foreground font-mono ml-0.5">PTS</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-xs text-muted-foreground uppercase tracking-widest font-mono">
                Standings populate after Round 1
              </div>
            )}
          </div>
        </GlassPanel>

        {/* Dynamic Insights */}
        <GlassPanel variant="strong" className="p-6 flex flex-col justify-between">
          <div>
            <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground">EVENT INSIGHTS</div>
            <h2 className="mt-1 font-display text-3xl">Performance metrics</h2>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-4 mt-6">
              {Array(4).fill(0).map((_, i) => <div key={i} className="h-16 skeleton rounded-xl" />)}
            </div>
          ) : insights.driver_in_form ? (
            <div className="grid grid-cols-2 gap-3 mt-6">
              {[
                { label: "Driver in form", data: insights.driver_in_form },
                { label: "Fastest qualifier", data: insights.fastest_qualifier },
                { label: "Biggest gainer", data: insights.biggest_gainer },
                { label: "Recent winner", data: insights.recent_winner },
              ].map((ins) => (
                <div key={ins.label} className="bg-white/[0.01] border border-border/40 rounded-xl p-4 flex flex-col justify-between hover:bg-white/[0.02] transition">
                  <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest leading-none font-bold">
                    {ins.label}
                  </span>
                  <div className="mt-3">
                    <div className="font-display text-lg truncate leading-none text-foreground">
                      {ins.data?.name || "—"}
                    </div>
                    <div className="text-[9px] text-primary/80 font-semibold uppercase mt-1 tracking-wider">
                      {ins.data?.stat || "Waiting on timing"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center text-xs text-muted-foreground uppercase tracking-widest font-mono">
              Metrics unlock during weekend timing
            </div>
          )}
        </GlassPanel>
      </section>
    </div>
  );
}
