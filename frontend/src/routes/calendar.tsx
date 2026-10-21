import type { ScheduleEvent } from "@/lib/store";
import { createCalendar, sessionKeys } from "@/lib/calendar";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Check, Calendar } from "lucide-react";
import { useState, useMemo } from "react";
import { useSessionContext } from "@/hooks/useSessionContext";
import { GlassPanel } from "@/components/GlassPanel";
import { cn } from "@/lib/utils";

import heroCircuit from "@/assets/hero-circuit.jpg";

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
  const [followed, setFollowed] = useState<Set<number>>(new Set());

  const toggle = (r: number) =>
    setFollowed((s) => {
      const next = new Set(s);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });

  const getGoogleCalendarUrl = (
    event: ScheduleEvent,
    sessionKey: (typeof sessionKeys)[number] = "session5",
  ) => {
    const dateKey = `${sessionKey}_date` as const;
    const nameKey = sessionKey;
    const sessionName = event[nameKey] || (sessionKey === "session5" ? "Race" : "Session");
    const startStr = event[dateKey] || event.event_date;
    if (!startStr) return "";

    const start = new Date(startStr);
    if (!Number.isFinite(start.getTime())) return "";
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // 2 hours duration
    const formatTime = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");

    const text = encodeURIComponent(`${event.event_name} — ${sessionName}`);
    const dates = `${formatTime(start)}/${formatTime(end)}`;
    const details = encodeURIComponent(
      `ApexF1 Companion Session: ${sessionName} for ${event.event_name} at ${event.location}, ${event.country}.`,
    );
    const location = encodeURIComponent(`${event.location}, ${event.country}`);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}&location=${location}`;
  };

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
    <div className="pb-32">
      {/* Immersive banner */}
      <section className="relative h-[48vh] min-h-[380px] overflow-hidden">
        <motion.img
          initial={{ scale: 1.05 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.4 }}
          src={heroCircuit}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-background/40" />
        <div className="relative z-10 mx-auto flex h-full max-w-[1200px] flex-col justify-end px-6 pb-12 lg:px-12">
          <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground">
            CALENDAR EXPORT
          </div>
          <h1 className="mt-3 font-display text-5xl md:text-7xl leading-none">Export calendar</h1>
          <p className="mt-3 max-w-lg text-muted-foreground text-sm leading-relaxed">
            Standard .ics calendar files. Export session timetables directly into your daily
            calendar app or add individual sessions to Google Calendar.
          </p>
        </div>
      </section>

      <div className="mx-auto -mt-10 max-w-[1200px] px-6 lg:px-12 relative z-20">
        <div className="grid gap-6 md:grid-cols-3">
          {integrations.map((it, i) => (
            <motion.div
              key={it.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.06 }}
            >
              <GlassPanel
                variant="strong"
                className="flex h-full flex-col p-6 border border-border/40 justify-between"
              >
                <div>
                  <div className="text-[9px] font-mono tracking-[0.2em] text-muted-foreground font-bold uppercase">
                    {it.sub}
                  </div>
                  <div className="mt-2 font-display text-2xl">{it.name}</div>
                  <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                    Export the {season} schedule for import. Times use UTC; export again after
                    timetable changes.
                  </p>
                </div>
                <button
                  onClick={downloadCalendar}
                  disabled={!schedule.length}
                  className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-foreground py-2.5 text-xs text-background font-bold transition hover:bg-foreground/90 w-full"
                >
                  <Calendar className="h-4 w-4" /> Export calendar
                </button>
              </GlassPanel>
            </motion.div>
          ))}
        </div>

        <div className="mt-16">
          <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground">
            PICK BY ROUND
          </div>
          <h2 className="mt-1 font-display text-4xl">Follow weekends one-by-one</h2>

          <div className="mt-6 grid gap-3 max-h-[60vh] overflow-y-auto pr-1 scrollbar-none">
            {schedule.map((w, i) => {
              const on = followed.has(w.round_number);
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
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.03 }}
                >
                  <GlassPanel className="flex flex-wrap items-center gap-5 p-5 border border-border/40">
                    <span className="font-mono text-[10px] text-muted-foreground w-10 font-bold uppercase">
                      R{String(w.round_number).padStart(2, "0")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-display text-2xl truncate">{w.event_name}</div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">
                        {eventDateStr} · {w.location}, {w.country}
                      </div>

                      {/* Granular session calendar links */}
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {sessionKeys.map((sk) => {
                          const sName = w[sk] || (sk === "session5" ? "Race" : null);
                          const sDate = w[`${sk}_date`];
                          if (!sName || !sDate) return null;
                          return (
                            <a
                              key={sk}
                              href={getGoogleCalendarUrl(w, sk)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[9px] font-mono tracking-wider font-bold bg-white/5 border border-border/20 px-2 py-0.5 rounded-md hover:bg-white/10 transition uppercase text-muted-foreground hover:text-foreground"
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
                          "inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs transition font-bold",
                          on
                            ? "bg-foreground/10 text-foreground border border-transparent"
                            : "glass hover:bg-foreground/10",
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
  );
}
