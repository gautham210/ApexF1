import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo } from "react";
import { Cloud, Sun, CloudRain, Play, Clock, ChevronRight, Compass } from "lucide-react";
import { useSessionContext } from "@/hooks/useSessionContext";
import { useLiveSession } from "@/hooks/useLiveSession";
import { getCircuitMap } from "@/lib/api/telemetry";
import { useCanonicalStore } from "@/lib/store";
import { getSessionTelemetryState } from "@/lib/event-identity";
import { GlassPanel } from "@/components/GlassPanel";
import { PageHeader } from "@/components/PageHeader";
import { presentEvent } from "@/lib/event-presentation";
import { type CircuitKey } from "@/components/CircuitOutline";
import { CircuitTrackMap } from "@/components/CircuitTrackMap";
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
      key: selected.has_conflict ? null : getCircuitKey(selected.country, selected.location),
      name: selected.has_conflict
        ? "Venue unconfirmed — provider disagreement"
        : selected.location || selected.country,
    };
  }, [selected]);

  const circuitMapQuery = useQuery({
    queryKey: ["circuit-map", season, selected?.round_number],
    queryFn: () => getCircuitMap(season, selected!.round_number, "Race"),
    enabled: Boolean(selected && season >= 2018 && selected.is_completed),
    staleTime: 1000 * 60 * 60,
  });

  const selectedPres = presentEvent(selected);

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

  const isSprintWeekend = parsedSessions.some((s) => s.name.toLowerCase().includes("sprint"));

  return (
    <div className="apex-page pb-24 space-y-8">
      <PageHeader
        eyebrow={`${season} Championship Programme`}
        title="Sessions"
        subtitle="Explore every Grand Prix weekend — sprint schedules, qualifying times in your local timezone, and historical track replays."
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[310px_minmax(0,1fr)] items-start">
        {/* Calendar Rail */}
        <aside className="space-y-3 min-w-0">
          <div className="apex-eyebrow px-1">Calendar Rail ({schedule.length})</div>
          <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible lg:max-h-[72vh] lg:overflow-y-auto scrollbar-none pb-2 lg:pb-0 lg:pr-1">
            {schedule.map((r) => {
              const active = r.round_number === selectedRound;
              const rPres = presentEvent(r);
              const emoji = getFlagEmoji(rPres.cleanCountry);
              return (
                <button
                  key={r.round_number}
                  type="button"
                  onClick={() => setSelectedRound(r.round_number)}
                  className={cn(
                    "group relative flex items-center gap-3.5 rounded-xl p-3 text-left transition shrink-0 min-w-[230px] lg:min-w-0 lg:w-full",
                    active
                      ? "glass-strong border border-white/15"
                      : "hover:bg-foreground/[0.03] border border-transparent",
                  )}
                >
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-background/50 border border-white/10 text-lg">
                    {emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">
                        Round {r.round_number}
                      </span>
                      {r.is_upcoming && !r.is_completed && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-mono text-primary font-bold uppercase tracking-wider">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Next
                        </span>
                      )}
                    </div>
                    <div className="truncate font-display text-lg leading-snug mt-0.5">
                      {rPres.displayName}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate font-mono">
                      {rPres.cleanVenue}
                    </div>
                  </div>
                  {active && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto hidden lg:block" />
                  )}
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
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6 min-w-0"
            >
              {/* Hero Banner card */}
              <div className="relative min-h-[300px] sm:h-[340px] overflow-hidden rounded-3xl border border-white/10">
                <img
                  src={heroCircuit}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-55"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-background/20" />
                <div className="relative z-10 h-full flex flex-col justify-end p-6 sm:p-8 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono tracking-[0.2em] text-muted-foreground font-bold uppercase">
                    <span>
                      ROUND {selected.round_number} · {selectedPres.cleanVenue.toUpperCase()}
                    </span>
                    <span className="rounded-full bg-white/10 border border-white/15 px-2.5 py-0.5 text-[9px] text-foreground">
                      {isSprintWeekend ? "Sprint Weekend" : "Grand Prix Weekend"}
                    </span>
                    {selectedPres.hasConflict && (
                      <span className="rounded-full bg-amber-500/15 border border-amber-500/35 px-2.5 py-0.5 text-[9px] text-amber-300">
                        {selectedPres.conflictBadge}
                      </span>
                    )}
                  </div>
                  <h2 className="mt-2 font-display text-3xl sm:text-5xl leading-none">
                    {selectedPres.displayName}
                  </h2>
                  {selectedPres.cleanCircuit && (
                    <p className="mt-2 text-xs font-mono text-muted-foreground">
                      {selectedPres.cleanCircuit}
                    </p>
                  )}
                </div>
                <div className="absolute right-6 top-6 opacity-90 max-sm:hidden">
                  <div className="h-32 w-48">
                    <CircuitTrackMap
                      circuitMap={circuitMapQuery.data}
                      loading={circuitMapQuery.isLoading}
                      fallbackCircuitKey={activeCircuit.key}
                      trackName={selectedPres.displayName}
                      showCorners={false}
                      className="h-full w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Session lists */}
              <div>
                <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <div className="apex-eyebrow">Weekend Timetables</div>
                    <h3 className="mt-1 font-display text-3xl">Session programme</h3>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">
                    Times shown in your browser timezone
                  </span>
                </div>

                {parsedSessions.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {parsedSessions.map((s, i) => (
                      <motion.article
                        key={s.name}
                        initial={{ opacity: 0, y: 12 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.35, delay: i * 0.04 }}
                        className="group relative h-64 overflow-hidden rounded-2xl border border-white/10"
                      >
                        <img
                          src={s.bg}
                          alt=""
                          loading="lazy"
                          className="absolute inset-0 h-full w-full object-cover opacity-45 transition duration-700 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-background/15" />
                        <div className="relative z-10 h-full flex flex-col justify-between p-5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-mono tracking-widest text-muted-foreground font-bold uppercase">
                              {s.date}
                            </span>
                            {s.isPast ? (
                              <span className="rounded-full glass px-2.5 py-0.5 text-[9px] font-mono tracking-wider text-muted-foreground uppercase">
                                Completed
                              </span>
                            ) : (
                              <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[9px] font-mono tracking-wider text-primary uppercase font-bold">
                                Upcoming
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="font-display text-2xl">{s.name}</div>
                            <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
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

                                if (!telState.canNavigate || season < 2023) {
                                  return (
                                    <Link
                                      to="/race-center"
                                      search={{
                                        mode: "archive",
                                        year: season,
                                        round: selected.round_number,
                                        session: s.name,
                                      }}
                                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full glass-strong py-2 text-xs transition hover:bg-foreground/10"
                                    >
                                      <span>View Classification</span>
                                    </Link>
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
                                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground text-background font-semibold py-2 text-xs transition hover:bg-foreground/90"
                                  >
                                    <Play className="h-3 w-3 fill-current" /> Track Replay
                                  </Link>
                                );
                              })()}
                          </div>
                        </div>
                      </motion.article>
                    ))}
                  </div>
                ) : (
                  <GlassPanel className="p-8 py-14 text-center border border-white/10">
                    <Compass className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                    <div className="font-display text-2xl">Timetable unavailable</div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Session times for this round have not been published by the schedule provider.
                    </p>
                  </GlassPanel>
                )}
              </div>

              {/* Circuit Info block */}
              <GlassPanel className="p-6">
                <div className="apex-eyebrow">Circuit Overview</div>
                <p className="mt-2 max-w-2xl leading-relaxed text-foreground/85 text-sm">
                  {selectedPres.cleanCircuit || activeCircuit.name} hosts Round{" "}
                  {selected.round_number} ({selectedPres.cleanVenue || selected.location}). Session
                  times convert automatically to your local browser timezone.
                </p>
                {selectedPres.conflictDetail && (
                  <p className="mt-2 text-xs font-mono text-amber-300/90">
                    {selectedPres.conflictDetail}
                  </p>
                )}
              </GlassPanel>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
