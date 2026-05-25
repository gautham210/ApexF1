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
      { title: "ApexF1 — Sync race calendar" },
      { name: "description", content: "Sync the complete Formula 1 race calendar directly with Google or Apple." },
    ],
  }),
  component: CalendarPage,
});

const integrations = [
  { id: "apple",   name: "Apple iCal",       sub: "macOS, iOS, iPadOS" },
  { id: "google",  name: "Google Calendar",  sub: "Google accounts, Android" },
  { id: "outlook", name: "Outlook 365",      sub: "Microsoft accounts" },
];

export function CalendarPage() {
  const { schedule, season } = useSessionContext();
  const [followed, setFollowed] = useState<Set<number>>(new Set());

  const toggle = (r: number) => setFollowed((s) => {
    const next = new Set(s);
    next.has(r) ? next.delete(r) : next.add(r);
    return next;
  });

  const getGoogleCalendarUrl = (event: any) => {
    const start = event.session5_date ? new Date(event.session5_date) : (event.event_date ? new Date(event.event_date) : new Date());
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // 2 hours duration
    const formatTime = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
    const text = encodeURIComponent(event.event_name);
    const dates = `${formatTime(start)}/${formatTime(end)}`;
    const details = encodeURIComponent(`ApexF1 Companion Race Session: ${event.event_name} at ${event.location}, ${event.country}`);
    const location = encodeURIComponent(`${event.location}, ${event.country}`);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}&location=${location}`;
  };

  const getCalendarSyncUrl = () => {
    // Premium webcal F1 feed url
    return "webcal://files.apexf1.onrender.com/calendar/f1.ics";
  };

  return (
    <div className="pb-32">
      {/* Immersive banner */}
      <section className="relative h-[48vh] min-h-[380px] overflow-hidden">
        <motion.img initial={{ scale: 1.05 }} animate={{ scale: 1 }} transition={{ duration: 1.4 }}
          src={heroCircuit} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-background/40" />
        <div className="relative z-10 mx-auto flex h-full max-w-[1200px] flex-col justify-end px-6 pb-12 lg:px-12">
          <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground">CALENDAR INBOX</div>
          <h1 className="mt-3 font-display text-5xl md:text-7xl leading-none">Sync the season</h1>
          <p className="mt-3 max-w-lg text-muted-foreground text-sm leading-relaxed">
            Quiet calendar schedules. Push every session directly to the daily calendar you already live in.
          </p>
        </div>
      </section>

      <div className="mx-auto -mt-10 max-w-[1200px] px-6 lg:px-12 relative z-20">
        <div className="grid gap-6 md:grid-cols-3">
          {integrations.map((it, i) => (
            <motion.div key={it.id}
              initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.06 }}
            >
              <GlassPanel variant="strong" className="flex h-full flex-col p-6 border border-border/40 justify-between">
                <div>
                  <div className="text-[9px] font-mono tracking-[0.2em] text-muted-foreground font-bold uppercase">{it.sub}</div>
                  <div className="mt-2 font-display text-2xl">{it.name}</div>
                  <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                    Subscribe to the full {season} season. Automated time conversions synced when timetables shift.
                  </p>
                </div>
                <a
                  href={getCalendarSyncUrl()}
                  className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-foreground py-2.5 text-xs text-background font-bold transition hover:bg-foreground/90 w-full"
                >
                  <Calendar className="h-4 w-4" /> Subscribe
                </a>
              </GlassPanel>
            </motion.div>
          ))}
        </div>

        <div className="mt-16">
          <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground">PICK BY ROUND</div>
          <h2 className="mt-1 font-display text-4xl">Follow weekends one-by-one</h2>

          <div className="mt-6 grid gap-3 max-h-[60vh] overflow-y-auto pr-1 scrollbar-none">
            {schedule.map((w, i) => {
              const on = followed.has(w.round_number);
              const eventDateStr = w.event_date ? new Date(w.event_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "TBD";
              return (
                <motion.div key={w.round_number}
                  initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.03 }}
                >
                  <GlassPanel className="flex flex-wrap items-center gap-5 p-5 border border-border/40">
                    <span className="font-mono text-[10px] text-muted-foreground w-10 font-bold uppercase">R{String(w.round_number).padStart(2, "0")}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-display text-2xl truncate">{w.event_name}</div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">{eventDateStr} · {w.location}, {w.country}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={getGoogleCalendarUrl(w)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center rounded-full glass px-4 py-2 text-xs transition font-mono tracking-wider font-bold"
                      >
                        Add to GCal
                      </a>
                      <button
                        onClick={() => toggle(w.round_number)}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs transition font-bold",
                          on ? "bg-foreground/10 text-foreground border border-transparent" : "glass hover:bg-foreground/10",
                        )}
                      >
                        {on ? <><Check className="h-3.5 w-3.5" /> Following</> : "Follow round"}
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
