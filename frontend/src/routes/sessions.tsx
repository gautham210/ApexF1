import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo } from "react";
import { Cloud, Sun, CloudRain, Play, Clock, ChevronRight, Compass } from "lucide-react";
import { useSessionContext } from "@/hooks/useSessionContext";
import { useLiveSession } from "@/hooks/useLiveSession";
import { useCanonicalStore } from "@/lib/store";
import { getSessionTelemetryState } from "@/lib/event-identity";
import { GlassPanel } from "@/components/GlassPanel";
import { CircuitOutline, type CircuitKey } from "@/components/CircuitOutline";
import { cn } from "@/lib/utils";

import heroRace from "@/assets/hero-race.jpg";
import heroPit from "@/assets/hero-pit.jpg";
import heroCircuit from "@/assets/hero-circuit.jpg";
import heroSession from "@/assets/hero-session.jpg";
import heroRain from "@/assets/hero-rain.jpg";
import heroNight from "@/assets/hero-night.jpg";

export const Route = createFileRoute("/sessions")({
  head: () => ({
    meta: [
      { title: "ApexF1 — Sessions schedule" },
      {
        name: "description",
        content: "Explore the complete Formula 1 race calendar session by session.",
      },
    ],
  }),
  component: SessionsPage,
});

function getFlagEmoji(country: string): string {
  const norm = country.toLowerCase().trim();
  if (norm.includes("bahrain")) return "🇧🇭";
  if (norm.includes("saudi")) return "🇸🇦";
  if (norm.includes("australia")) return "🇦🇺";
  if (norm.includes("japan")) return "🇯🇵";
  if (norm.includes("china")) return "🇨🇳";
  if (norm.includes("miami")) return "🇺🇸";
  if (norm.includes("emilia") || norm.includes("imola")) return "🇮🇹";
  if (norm.includes("monaco")) return "🇲🇨";
  if (norm.includes("spain") || norm.includes("barcelona")) return "🇪🇸";
  if (norm.includes("canada") || norm.includes("montreal")) return "🇨🇦";
  if (norm.includes("austria") || norm.includes("spielberg")) return "🇦🇹";
  if (norm.includes("britain") || norm.includes("silverstone")) return "🇬🇧";
  if (norm.includes("hungary") || norm.includes("budapest")) return "🇭🇺";
  if (norm.includes("belgium") || norm.includes("spa")) return "🇧🇪";
  if (norm.includes("netherlands") || norm.includes("zandvoort")) return "🇳🇱";
  if (norm.includes("monza") || norm.includes("italy")) return "🇮🇹";
  if (norm.includes("azerbaijan") || norm.includes("baku")) return "🇦🇿";
  if (norm.includes("singapore")) return "🇸🇬";
  if (norm.includes("united states") || norm.includes("austin")) return "🇺🇸";
  if (norm.includes("mexico")) return "🇲🇽";
  if (norm.includes("brazil") || norm.includes("sao paulo")) return "🇧🇷";
  if (norm.includes("las vegas")) return "🇺🇸";
  if (norm.includes("qatar") || norm.includes("lusail")) return "🇶🇦";
  if (norm.includes("abu dhabi") || norm.includes("yas marina")) return "🇦🇪";
  return "🏳️";
}

function getCircuitKey(country: string, location: string): CircuitKey | null {
  const norm = (country || location || "").toLowerCase();
  if (norm.includes("belgium") || norm.includes("spa")) return "spa";
  if (norm.includes("monaco")) return "monaco";
  if (norm.includes("japan") || norm.includes("suzuka")) return "suzuka";
  if (norm.includes("britain") || norm.includes("silverstone")) return "silverstone";
  if (norm.includes("italy") || norm.includes("monza")) return "monza";
  if (norm.includes("singapore") || norm.includes("marina")) return "marina-bay";
  return null;
}

function getSessionDuration(name: string): string {
  const norm = name.toLowerCase();
  if (norm.includes("practice") || norm.includes("qualifying")) return "60 min";
  if (norm.includes("sprint")) return "100 km";
  return "305 km";
}

function SessionsPage() {
  const { schedule, season, selectedRound, setSelectedRound } = useSessionContext();
  const live = useLiveSession();
  const { telemetryAvailability } = useCanonicalStore();

  const selected = useMemo(() => {
    return schedule.find((e) => e.round_number === selectedRound) || schedule[0] || null;
  }, [schedule, selectedRound]);

  const activeCircuit = useMemo(() => {
    if (!selected) return { key: null, name: "Grand Prix Circuit" };
    return {
      key: getCircuitKey(selected.country, selected.location),
      name: selected.location || selected.country,
    };
  }, [selected]);

  const parsedSessions = useMemo(() => {
    if (!selected) return [];
    const items: {
      name: string;
      date: string;
      time: string;
      duration: string;
      isPast: boolean;
      bg: string;
    }[] = [];
    const push = (name?: string, dateStr?: string) => {
      if (!name || !dateStr) return;
      const d = new Date(dateStr);
      items.push({
        name,
        date: d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }),
        time: d.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
        duration: "Local time",
        isPast: d < new Date(),
        bg: name.toLowerCase().includes("race")
          ? heroRace
          : name.toLowerCase().includes("qual")
            ? heroSession
            : heroPit,
      });
    };
    push(selected.session1, selected.session1_date);
    push(selected.session2, selected.session2_date);
    push(selected.session3, selected.session3_date);
    push(selected.session4, selected.session4_date);
    push(selected.session5, selected.session5_date);
    return items;
  }, [selected]);

  return (
    <div className="min-h-screen px-6 pb-32 pt-12 lg:px-12">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-10">
          <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground uppercase">
            WEEKEND PROGRAMME
          </div>
          <h1 className="mt-2 font-display text-5xl md:text-6xl">Sessions</h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Explore the absolute Formula 1 calendar weekend by weekend — practices, shootouts, and
            races.
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
          {/* Calendar Rails */}
          <aside className="space-y-4">
            <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground">
              CALENDAR RAIL
            </div>
            <div className="flex flex-col gap-2 max-h-[70vh] overflow-y-auto scrollbar-none pr-1">
              {schedule.map((r) => {
                const active = r.round_number === selectedRound;
                const emoji = getFlagEmoji(r.country);
                return (
                  <button
                    key={r.round_number}
                    onClick={() => setSelectedRound(r.round_number)}
                    className={cn(
                      "group relative flex items-center gap-4 rounded-xl p-3.5 text-left transition duration-300",
                      active ? "glass-strong" : "hover:bg-foreground/[0.03]",
                    )}
                  >
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-background/40 border border-border/40 text-xl">
                      {emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[9px] text-muted-foreground uppercase font-bold tracking-wider">
                          Round {r.round_number}
                        </span>
                        {r.is_upcoming && !r.is_completed && (
                          <span className="inline-flex items-center gap-1 text-[8px] font-mono text-primary font-bold uppercase tracking-wider">
                            <span className="h-1 w-1 rounded-full bg-primary" /> NEXT
                          </span>
                        )}
                      </div>
                      <div className="truncate font-display text-lg mt-0.5">{r.event_name}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                        {r.location}
                      </div>
                    </div>
                    {active && <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />}
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Details Column */}
          <AnimatePresence mode="wait">
            {selected && (
              <motion.div
                key={selected.round_number}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-8"
              >
                {/* Hero Banner card */}
                <div className="relative h-[420px] overflow-hidden rounded-3xl border border-border/40">
                  <img
                    src={heroCircuit}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover opacity-60"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
                  <div className="absolute inset-0 flex flex-col justify-end p-8">
                    <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground font-bold uppercase">
                      ROUND {selected.round_number} · {selected.location.toUpperCase()}
                    </div>
                    <h2 className="mt-2 font-display text-5xl leading-none md:text-6xl">
                      {selected.event_name}
                    </h2>
                  </div>
                  <div className="absolute right-8 top-8 opacity-80 max-sm:hidden">
                    {activeCircuit.key ? (
                      <div className="h-32 w-48">
                        <CircuitOutline circuit={activeCircuit.key} className="h-full w-full" />
                      </div>
                    ) : (
                      <div className="rounded-2xl glass-strong border border-border/40 px-3.5 py-1.5 text-[9px] font-mono text-muted-foreground uppercase tracking-widest font-bold">
                        Circuit outline unavailable
                      </div>
                    )}
                  </div>
                </div>

                {/* Session lists */}
                <div>
                  <div className="mb-4">
                    <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground">
                      WEEKEND TIMETABLES
                    </div>
                    <h3 className="mt-1 font-display text-3xl">Session program</h3>
                  </div>

                  {parsedSessions.length > 0 ? (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {parsedSessions.map((s, i) => (
                        <motion.article
                          key={s.name}
                          initial={{ opacity: 0, y: 12 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.4, delay: i * 0.05 }}
                          className="group relative h-72 overflow-hidden rounded-2xl border border-border/40"
                        >
                          <img
                            src={s.bg}
                            alt=""
                            loading="lazy"
                            className="absolute inset-0 h-full w-full object-cover opacity-50 transition duration-700 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-background/10" />
                          <div className="absolute inset-0 flex flex-col justify-between p-5">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-mono tracking-widest text-muted-foreground font-bold uppercase">
                                {s.date}
                              </span>
                              {s.isPast ? (
                                <span className="rounded-full glass px-2.5 py-0.5 text-[8px] font-mono tracking-widest text-muted-foreground uppercase">
                                  START TIME PASSED
                                </span>
                              ) : (
                                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[8px] font-mono tracking-widest text-primary uppercase font-bold">
                                  UPCOMING
                                </span>
                              )}
                            </div>
                            <div>
                              <div className="font-display text-2xl">{s.name}</div>
                              <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                                <span className="inline-flex items-center gap-1.5">
                                  <Clock className="h-3.5 w-3.5" /> {s.time}
                                </span>
                                <span>{s.duration}</span>
                              </div>
                              {s.isPast &&
                                (() => {
                                  const telState = getSessionTelemetryState(
                                    season,
                                    s.name,
                                    selected.round_number,
                                    telemetryAvailability,
                                  );

                                  if (!telState.canNavigate) {
                                    return (
                                      <div
                                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-border/30 bg-muted/20 py-2 text-xs font-mono text-muted-foreground"
                                        title={telState.reason}
                                      >
                                        <span>{telState.label}</span>
                                      </div>
                                    );
                                  }

                                  return (
                                    <Link
                                      to="/race-center"
                                      search={{
                                        mode: "replay",
                                        year: season,
                                        round: selected.round_number,
                                        session: s.name,
                                      }}
                                      title={telState.reason}
                                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full glass-strong py-2 text-xs transition hover:bg-foreground/10"
                                    >
                                      <Play className="h-3 w-3 fill-current" /> {telState.label}
                                    </Link>
                                  );
                                })()}
                            </div>
                          </div>
                        </motion.article>
                      ))}
                    </div>
                  ) : (
                    <GlassPanel className="p-8 py-16 text-center border border-border/40">
                      <Compass className="w-10 h-10 text-muted-foreground/30 mx-auto mb-4" />
                      <div className="font-display text-2xl">Timetable unavailable</div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Detailed practice schedules will update dynamically during the race season.
                      </p>
                    </GlassPanel>
                  )}
                </div>

                {/* Circuit Info block */}
                <GlassPanel className="p-6">
                  <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground">
                    CIRCUIT OVERVIEW
                  </div>
                  <p className="mt-3 max-w-2xl leading-relaxed text-foreground/85 text-sm">
                    {activeCircuit.name} hosts Round {selected.round_number} of the championship.
                    Session times are shown in your local timezone.
                  </p>
                </GlassPanel>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
