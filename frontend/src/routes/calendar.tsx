import type { ScheduleEvent } from "@/lib/store";
import { createCalendar, sessionKeys, googleCalendarUrl } from "@/lib/calendar";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Check, Calendar } from "lucide-react";
import { useState, useMemo, useEffect, useRef } from "react";
import { useSessionContext } from "@/hooks/useSessionContext";
import { GlassPanel } from "@/components/GlassPanel";
import { PageHeader } from "@/components/PageHeader";
import { presentEvent } from "@/lib/event-presentation";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "ApexF1 — Export race calendar" },
      {
        name: "description",
        content:
          "Export standard .ics calendar schedules to import Formula 1 session timetables into your calendar app.",
      },
    ],
  }),
  component: CalendarPage,
});

const integrations = [
  { id: "apple", name: "Apple iCal", sub: "macOS, iOS, iPadOS" },
  { id: "google", name: "Google Calendar", sub: "Google accounts, Android" },
  { id: "outlook", name: "Outlook 365", sub: "Microsoft accounts" },
];

function CalendarPage() {
  const { schedule, season } = useSessionContext();
  const followedStorageKey = `apexf1.followed.rounds.v1.${season}`;
  const loadedKeyRef = useRef<string | null>(null);
  const [followed, setFollowed] = useState<Set<number>>(() => {
    try {
      const raw = localStorage.getItem(followedStorageKey);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? new Set(parsed.filter((n): n is number => typeof n === "number" && Number.isInteger(n)))
        : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    if (loadedKeyRef.current !== followedStorageKey) {
      loadedKeyRef.current = followedStorageKey;
      try {
        const raw = localStorage.getItem(followedStorageKey);
        if (!raw) {
          setFollowed(new Set());
          return;
        }
        const parsed = JSON.parse(raw);
        setFollowed(
          Array.isArray(parsed)
            ? new Set(
                parsed.filter((n): n is number => typeof n === "number" && Number.isInteger(n)),
              )
            : new Set(),
        );
      } catch {
        setFollowed(new Set());
      }
      return;
    }
    try {
      localStorage.setItem(followedStorageKey, JSON.stringify([...followed]));
    } catch {
      // Ignore storage quota errors cleanly
    }
  }, [followed, followedStorageKey]);

  const toggle = (r: number) =>
    setFollowed((s) => {
      const next = new Set(s);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });

  const downloadCalendar = () => {
    const url = URL.createObjectURL(
      new Blob([createCalendar(schedule, season)], { type: "text/calendar;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `apexf1-${season}.ics`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="apex-page pb-32">
      <div className="mx-auto max-w-[1440px]">
        <PageHeader
          eyebrow={`CALENDAR EXPORT · ${season} SEASON`}
          title="Export calendar"
          subtitle="Standard .ics calendar files. Export session timetables directly into your daily calendar app or add individual sessions to Google Calendar."
          actions={
            <button
              onClick={downloadCalendar}
              disabled={!schedule.length}
              className="apex-control inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-xs text-background font-bold transition hover:bg-foreground/90 disabled:opacity-40"
            >
              <Calendar className="h-4 w-4" /> Download .ics ({season})
            </button>
          }
        />

        <div className="mt-6">
          <div className="grid gap-4 md:grid-cols-3">
            {integrations.map((it, i) => (
              <motion.div
                key={it.id}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
              >
                <GlassPanel
                  variant="strong"
                  className="apex-card-strong flex h-full flex-col p-6 justify-between"
                >
                  <div>
                    <div className="apex-eyebrow">{it.sub}</div>
                    <div className="mt-2 font-display text-2xl">{it.name}</div>
                    <p className="mt-2.5 text-xs text-muted-foreground leading-relaxed">
                      Export the {season} schedule for import. Times use UTC; export again after
                      timetable changes.
                    </p>
                  </div>
                  <button
                    onClick={downloadCalendar}
                    disabled={!schedule.length}
                    className="apex-control mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-foreground py-2.5 text-xs text-background font-bold transition hover:bg-foreground/90 w-full disabled:opacity-40"
                  >
                    <Calendar className="h-4 w-4" /> Export calendar
                  </button>
                </GlassPanel>
              </motion.div>
            ))}
          </div>

          <div className="mt-12">
            <div className="apex-eyebrow">PICK BY ROUND</div>
            <h2 className="mt-1 font-display text-3xl sm:text-4xl">Follow weekends one-by-one</h2>

            <div className="mt-5 grid gap-3 xl:grid-cols-2">
              {schedule.map((w, i) => {
                const on = followed.has(w.round_number);
                const presented = presentEvent(w);
                const eventDateStr = w.event_date
                  ? new Date(w.event_date).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "TBD";
                return (
                  <motion.div
                    key={w.round_number}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.35, delay: Math.min(i * 0.02, 0.2) }}
                  >
                    <GlassPanel className="apex-card flex flex-wrap items-center gap-4 p-5">
                      <span className="font-mono text-[10px] text-muted-foreground w-9 font-bold uppercase tabular-nums">
                        R{String(w.round_number).padStart(2, "0")}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-display text-2xl truncate">
                            {presented.displayName}
                          </div>
                          {presented.conflictBadge ? (
                            <span
                              title={presented.conflictDetail ?? undefined}
                              className="rounded border border-amber-400/35 bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono text-amber-300"
                            >
                              {presented.conflictBadge}
                            </span>
                          ) : null}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                          {eventDateStr} · {presented.cleanVenue}
                        </div>

                        {/* Granular session calendar links */}
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {sessionKeys.map((sk) => {
                            const sName = w[sk] || (sk === "session5" ? "Race" : null);
                            const sDate = w[`${sk}_date`];
                            if (!sName || !sDate || !googleCalendarUrl(w, sk)) return null;
                            return (
                              <a
                                key={sk}
                                href={googleCalendarUrl(w, sk) ?? undefined}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-[10px] font-mono tracking-wider font-bold bg-white/5 border border-border/30 px-2.5 py-1 rounded-md hover:bg-white/10 transition uppercase text-muted-foreground hover:text-foreground"
                              >
                                +{sName}
                              </a>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggle(w.round_number)}
                          className={cn(
                            "apex-control inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs transition font-bold",
                            on ? "bg-foreground text-background" : "glass hover:bg-foreground/10",
                          )}
                        >
                          {on ? (
                            <>
                              <Check className="h-3.5 w-3.5" /> Following
                            </>
                          ) : (
                            "Follow round"
                          )}
                        </button>
                      </div>
                    </GlassPanel>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
