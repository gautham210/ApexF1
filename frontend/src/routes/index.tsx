import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useMemo } from "react";
import { Cloud, Wind, Thermometer, MapPin, ChevronRight, Play, Clock, Trophy, Zap, Compass, Radio, Flag, AlertTriangle, ArrowRight } from "lucide-react";
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
      { title: "ApexF1 — Cinematic Motorsport Companion" },
      { name: "description", content: "A luxurious, content-first motorsport companion for the Grand Prix weekend." },
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
    return { key: "spa" as CircuitKey, desc: "A historic ribbon winding through the Ardennes forest.", turns: 19, fastest: "1:46.286", holder: "V. Bottas (2018)", opened: "1950" };
  }
  if (norm.includes("monaco") || norm.includes("monte")) {
    return { key: "monaco" as CircuitKey, desc: "Floating barriers, tunnel glare, and absolute precision.", turns: 19, fastest: "1:12.909", holder: "L. Hamilton (2021)", opened: "1950" };
  }
  if (norm.includes("japan") || norm.includes("suzuka")) {
    return { key: "suzuka" as CircuitKey, desc: "The ultimate figure-eight flowing test of chassis dynamics.", turns: 18, fastest: "1:30.983", holder: "L. Hamilton (2019)", opened: "1987" };
  }
  if (norm.includes("britain") || norm.includes("silverstone")) {
    return { key: "silverstone" as CircuitKey, desc: "Ultra high speed sweeping bends at the home of motorsport.", turns: 18, fastest: "1:27.097", holder: "M. Verstappen (2020)", opened: "1950" };
  }
  if (norm.includes("italy") || norm.includes("monza")) {
    return { key: "monza" as CircuitKey, desc: "Monza, the Temple of Speed, where slipstreams write legends.", turns: 11, fastest: "1:18.887", holder: "R. Barrichello (2004)", opened: "1950" };
  }
  if (norm.includes("singapore") || norm.includes("marina")) {
    return { key: "marina-bay" as CircuitKey, desc: "Night races under millions of lumens, concrete heat.", turns: 19, fastest: "1:35.867", holder: "L. Hamilton (2018)", opened: "2008" };
  }
  return { key: "spa" as CircuitKey, desc: "Championship circuit design with deep motorsport legacy.", turns: 19, fastest: "1:46.286", holder: "V. Bottas (2018)", opened: "1950" };
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

  // Derive dynamic weekend state
  const weekendState = useMemo<"BEFORE" | "DURING" | "AFTER">(() => {
    if (live.is_live) return "DURING";
    if (currentRace?.is_completed) return "AFTER";
    return "BEFORE";
  }, [live.is_live, currentRace?.is_completed]);

  // Bind dynamic body class for visual mood states
  useEffect(() => {
    document.body.classList.remove("theme-practice", "theme-qualifying", "theme-race", "theme-post-race");
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
      document.body.classList.remove("theme-practice", "theme-qualifying", "theme-race", "theme-post-race");
    };
  }, [live.is_live, live.session_info?.session_name, currentRace?.is_completed]);

  const news = ctx?.news ?? [];
  const insights = ctx?.insights ?? {};

  const activeEventName = currentRace?.event_name || currentRace?.location || "Grand Prix";
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
    return heroGarage;
  }, [activeCountry]);

  return (
    <div className="pb-32 relative" style={{ "--primary": favoriteTeam ? favoriteTeam.accent : "oklch(0.82 0.13 75)" } as any}>
      
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
                  Round {currentRace?.round_number || 1}
                </span>
              )}
              <span>·</span>
              <span>{currentRace?.location || "Paddock"}</span>
            </div>

            <h1 className="mt-5 font-display text-5xl leading-[0.95] text-balance md:text-7xl">
              {activeEventName}
            </h1>
            <p className="mt-4 max-w-md text-sm text-muted-foreground leading-relaxed">
              {circuitData.desc} A cinematic companion syncing real timings, tire stints, and paddock reports.
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
                <Clock className="h-3 w-3" /> session clock
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
                {live.weather?.rainfall ? "Rainy" : live.weather?.air_temp ? "On Track" : "Dry Standby"}
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1">
                <span className="inline-flex items-center gap-0.5">
                  <Thermometer className="h-3 w-3" /> {live.weather?.air_temp?.toFixed(0) || "21"}°
                </span>
                <span className="inline-flex items-center gap-0.5">
                  <Wind className="h-3 w-3" /> {live.weather?.wind_speed?.toFixed(0) || "3.4"} m/s
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
              <GlassPanel variant="strong" className="grid gap-8 p-8 lg:grid-cols-[1.2fr_1fr] border border-border/40">
                <div>
                  <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground uppercase">CIRCUIT OUTLINE</div>
                  <h2 className="mt-2 font-display text-4xl">Layout geometry</h2>
                  <div className="mt-6 aspect-[16/10] w-full rounded-xl bg-gradient-to-br from-surface to-background/50 p-6 border border-border/40 flex items-center justify-center">
                    <CircuitOutline circuit={circuitData.key} className="h-full w-full max-h-[220px]" animated />
                  </div>
                </div>
                <div className="flex flex-col justify-center gap-6">
                  <div>
                    <div className="text-[9px] font-mono tracking-[0.2em] text-muted-foreground uppercase font-bold">Corners</div>
                    <div className="mt-1 font-display text-3xl">{circuitData.turns} turns</div>
                  </div>
                  <div className="h-px bg-border/40" />
                  <div>
                    <div className="text-[9px] font-mono tracking-[0.2em] text-muted-foreground uppercase font-bold">Lap Record</div>
                    <div className="mt-1 font-display text-3xl">{circuitData.fastest}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{circuitData.holder}</div>
                  </div>
                  <div className="h-px bg-border/40" />
                  <div>
                    <div className="text-[9px] font-mono tracking-[0.2em] text-muted-foreground uppercase font-bold">Year Opened</div>
                    <div className="mt-1 font-display text-3xl">{circuitData.opened}</div>
                  </div>
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
              <GlassPanel variant="strong" className="p-6 border border-border/40 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground uppercase font-bold flex items-center gap-2">
                        <Radio className="w-3.5 h-3.5 text-primary animate-pulse" /> Live leaderboard tower
                      </div>
                      <h2 className="mt-1 font-display text-3xl">Active standings</h2>
                    </div>
                    <Link to="/race-center" className="text-xs text-muted-foreground hover:text-foreground font-mono transition">
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
                            <span className="font-mono text-xs text-muted-foreground w-4 text-center">{d.position}</span>
                            <div>
                              <div className="font-display text-lg leading-none">{d.abbreviation}</div>
                              <div className="text-[9px] text-muted-foreground mt-1 uppercase font-bold tracking-wider">{d.team}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-mono text-xs text-foreground/80">{d.gap_to_leader || "LEADER"}</span>
                            <span className="text-[8px] text-muted-foreground font-mono ml-2 uppercase border border-border/20 px-1 py-0.5 rounded">{d.current_tyre || "S"}</span>
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
                {live.session_info?.track_status && live.session_info.track_status !== "GREEN" && (
                  <GlassPanel variant="strong" className="p-6 border border-primary/20 bg-primary/[0.02]">
                    <div className="flex items-center gap-3 text-primary font-mono text-xs uppercase font-bold tracking-widest">
                      <AlertTriangle className="w-5 h-5 animate-pulse" />
                      Track Flag alert
                    </div>
                    <div className="mt-3 font-display text-3xl uppercase tracking-wider text-foreground">
                      {live.session_info.track_status} FLAG ACTIVE
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                      Sectors are yellow-flagged. Drivers are instructed to decelerate and maintain interval gaps immediately.
                    </p>
                  </GlassPanel>
                )}

                <GlassPanel variant="strong" className="p-6 border border-border/40 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground uppercase font-bold">LIVE TYRES</div>
                    <h3 className="mt-1 font-display text-3xl">Degradation metrics</h3>
                    <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                      Aggregated tyre compounds stint durations show high-speed asphalt decay profiles. Soft variants degrade in 14-16 laps.
                    </p>
                  </div>
                  <div className="mt-6 space-y-2 bg-white/[0.01] p-4 rounded-xl border border-border/20">
                    <div className="flex justify-between text-[9px] font-mono text-muted-foreground font-bold uppercase">
                      <span>Soft variant compound</span>
                      <span>12 laps remaining</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: "65%" }} />
                    </div>
                  </div>
                </GlassPanel>
              </div>
            </motion.div>
          )}

          {/* AFTER STATE: Winner showcase, podium, standings split */}
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
              <GlassPanel variant="strong" className="p-8 border border-border/40 flex flex-col justify-between overflow-hidden relative min-h-[320px]">
                <div className="absolute right-0 bottom-0 h-full w-[240px] opacity-10 pointer-events-none">
                  <Trophy className="w-full h-full text-foreground" strokeWidth={1} />
                </div>
                <div>
                  <div className="text-[10px] font-mono tracking-[0.2em] text-primary font-bold uppercase flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5" /> Race results summary
                  </div>
                  <h2 className="mt-2 font-display text-4xl">Weekend champions</h2>
                  <p className="mt-2 text-sm text-muted-foreground max-w-md">
                    Grand Prix session complete. Explore the final top-three drivers classification on the podium.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-4 mt-8 border-t border-border/20 pt-6 items-end">
                  <div className="text-center p-3 rounded-2xl bg-white/[0.01] border border-border/10">
                    <div className="text-[9px] font-mono text-muted-foreground uppercase font-bold">2nd Place</div>
                    <div className="font-display text-xl mt-1 leading-none">Norris</div>
                    <div className="text-[8px] font-mono text-primary font-bold uppercase mt-1">MCL</div>
                  </div>
                  <div className="text-center p-4 rounded-2xl bg-primary/5 border border-primary/20 shadow-2xl relative -top-2">
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-primary text-[8px] font-mono font-black text-background uppercase">Winner</span>
                    <div className="text-[9px] font-mono text-primary font-bold uppercase">1st Place</div>
                    <div className="font-display text-2xl mt-1.5 leading-none">Verstappen</div>
                    <div className="text-[8px] font-mono text-primary/80 font-bold uppercase mt-1">RBR</div>
                  </div>
                  <div className="text-center p-3 rounded-2xl bg-white/[0.01] border border-border/10">
                    <div className="text-[9px] font-mono text-muted-foreground uppercase font-bold">3rd Place</div>
                    <div className="font-display text-xl mt-1 leading-none">Leclerc</div>
                    <div className="text-[8px] font-mono text-primary font-bold uppercase mt-1">FER</div>
                  </div>
                </div>
              </GlassPanel>

              {/* Standings Impact Summary */}
              <GlassPanel variant="strong" className="p-6 border border-border/40 flex flex-col justify-between">
                <div>
                  <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground uppercase font-bold">STANDINGS IMPACT</div>
                  <h3 className="mt-1 font-display text-3xl">Championship splits</h3>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                    Following their podium finishes, Verstappen expands his championship gap, while McLaren solidifies their constructor lead.
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
                    <Play className="h-3.5 w-3.5 fill-current" /> Watch documentary replay
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
              <h3 className="font-display text-3xl leading-tight">
                {favoriteDriver} is gearing up
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                As a registered supporter of {favoriteTeam?.name || "the paddock"}, your custom interface alerts, reminders, and charts are synced to track their session campaign.
              </p>
            </div>
            <div className="mt-6 flex items-center justify-between rounded-xl border border-border/20 p-3 bg-white/[0.01]">
              <span className="text-[10px] font-mono text-muted-foreground uppercase font-bold">Championship status</span>
              <span className="text-xs font-bold font-mono text-foreground">Personalized</span>
            </div>
          </GlassPanel>
        )}

        {/* Stories list */}
        <div className={favoriteDriver ? "lg:col-span-2 space-y-6" : "md:col-span-2 lg:col-span-3 space-y-6"}>
          <div className="flex justify-between items-end border-b border-border/40 pb-4">
            <div>
              <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground uppercase font-bold">EDITORIAL</div>
              <h2 className="mt-1 font-display text-4xl">Stories from the paddock</h2>
            </div>
            <Link to="/sessions" className="text-xs text-muted-foreground hover:text-foreground font-mono transition">
              WEEKEND TIMETABLE →
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Array(2).fill(0).map((_, i) => (
                <div key={i} className="h-32 skeleton rounded-2xl bg-white/5" />
              ))}
            </div>
          ) : news.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {news.slice(0, 2).map((a: any, i: number) => {
                const bgStory = i === 0 ? heroSession : heroRain;
                return (
                  <a
                    key={i}
                    href={a.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block relative overflow-hidden rounded-2xl border border-border/40 h-44 shadow-lg"
                  >
                    <img
                      src={bgStory}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04] opacity-40"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/40 to-transparent" />
                    <div className="absolute inset-0 flex flex-col justify-end p-5">
                      <span className="text-[9px] font-mono tracking-[0.2em] text-primary font-bold uppercase">
                        {a.tag || "Paddock Update"}
                      </span>
                      <h3 className="mt-2 font-display text-2xl leading-tight text-balance group-hover:text-primary transition truncate">
                        {a.title}
                      </h3>
                      <span className="mt-1 text-[10px] text-muted-foreground">{a.source || "Formula 1"}</span>
                    </div>
                  </a>
                );
              })}
            </div>
          ) : (
            <GlassPanel className="p-8 py-12 text-center max-w-md mx-auto border border-border/40">
              <Compass className="w-10 h-10 text-muted-foreground/30 mx-auto mb-4" />
              <div className="font-display text-2xl">Stories offline</div>
              <p className="mt-2 text-xs text-muted-foreground">Paddock reports will update as the weekend unfolds.</p>
            </GlassPanel>
          )}
        </div>
      </section>
    </div>
  );
}
