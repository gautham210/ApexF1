import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { CloudRain, Flag, Play, Timer, BellRing } from "lucide-react";
import { GlassPanel } from "@/components/GlassPanel";
import { usePreferences } from "@/lib/preferences";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "ApexF1 — Alerts" },
      { name: "description", content: "Quiet, premium notifications for the Formula 1 weekend." },
    ],
  }),
  component: NotificationsPage,
});

const inbox = [
  { icon: Timer, title: "Qualifying begins in 30 minutes", time: "16:30 local · Spa", read: false },
  { icon: CloudRain, title: "Rain expected for FP3", time: "Earlier today", read: false },
  { icon: Flag, title: "Formation lap starts soon", time: "Tomorrow · 14:55", read: true },
  { icon: Play, title: "Replay available — Sprint Qualifying", time: "Yesterday", read: true },
  { icon: BellRing, title: "Driver of the Day voting opens", time: "After lights out", read: true },
];

function NotificationsPage() {
  const [prefs, update] = usePreferences();

  return (
    <div className="min-h-screen px-6 pb-32 pt-12 lg:px-12">
      <div className="mx-auto max-w-[1100px]">
        <header className="mb-10">
          <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground">ATTENTION, NOT NOISE</div>
          <h1 className="mt-2 font-display text-5xl md:text-6xl">Alerts</h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            We only knock when the weekend asks us to. You choose what counts.
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <section>
            <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground mb-3">INBOX</div>
            <div className="flex flex-col gap-2">
              {inbox.map((n, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.04 }}
                >
                  <GlassPanel className={cn("flex items-start gap-4 p-5 transition", !n.read && "ring-1 ring-foreground/5")}>
                    <div className="grid h-10 w-10 place-items-center rounded-full glass-subtle">
                      <n.icon className="h-4 w-4 text-foreground/80" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-4">
                        <div className="font-display text-lg text-balance">{n.title}</div>
                        {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0 mt-2" />}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{n.time}</div>
                    </div>
                  </GlassPanel>
                </motion.div>
              ))}
            </div>
          </section>

          <aside>
            <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground mb-3">PREFERENCES</div>
            <GlassPanel variant="strong" className="p-6">
              <Toggle label="Qualifying reminders" desc="A nudge 30 minutes before the session." value={prefs.notifications.qualifying}
                onChange={(v) => update({ notifications: { ...prefs.notifications, qualifying: v } })} />
              <Divider />
              <Toggle label="Formation lap" desc="Right before lights out on Sunday." value={prefs.notifications.formationLap}
                onChange={(v) => update({ notifications: { ...prefs.notifications, formationLap: v } })} />
              <Divider />
              <Toggle label="Weather changes" desc="Only when the forecast shifts the weekend." value={prefs.notifications.weather}
                onChange={(v) => update({ notifications: { ...prefs.notifications, weather: v } })} />
              <Divider />
              <Toggle label="Replay available" desc="A quiet ping after each session ends." value={prefs.notifications.replay}
                onChange={(v) => update({ notifications: { ...prefs.notifications, replay: v } })} />
            </GlassPanel>

            <GlassPanel className="mt-4 p-6">
              <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground">QUIET HOURS</div>
              <div className="mt-2 font-display text-2xl">22:00 — 07:00</div>
              <div className="mt-1 text-xs text-muted-foreground">No alerts during your evenings, even on race day eve.</div>
            </GlassPanel>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Toggle({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} className="flex w-full items-start justify-between gap-4 text-left">
      <div>
        <div className="font-display text-lg">{label}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{desc}</div>
      </div>
      <span className={cn(
        "relative mt-1 h-6 w-11 rounded-full transition shrink-0",
        value ? "bg-primary/60" : "bg-foreground/10",
      )}>
        <span className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-foreground transition",
          value ? "left-[22px]" : "left-0.5",
        )} />
      </span>
    </button>
  );
}

function Divider() { return <div className="my-5 h-px bg-border" />; }
