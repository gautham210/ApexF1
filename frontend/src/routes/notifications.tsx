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

function NotificationsPage() {
  const [prefs, update] = usePreferences();

  return (
    <div className="min-h-screen px-6 pb-32 pt-12 lg:px-12">
      <div className="mx-auto max-w-[1100px]">
        <header className="mb-10">
          <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground">
            ATTENTION, NOT NOISE
          </div>
          <h1 className="mt-2 font-display text-5xl md:text-6xl">Alerts</h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Choose your notification preferences for this device.
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <section>
            <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground mb-3">
              INBOX
            </div>
            <div className="flex flex-col gap-2">
              <GlassPanel className="p-6">
                <h2 className="font-display text-2xl">No delivered notifications</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Preferences are saved on this device. Push delivery and scheduled reminders are
                  not connected. Use Calendar to add session reminders to your calendar app.
                </p>
              </GlassPanel>
            </div>
          </section>

          <aside>
            <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground mb-3">
              PREFERENCES
            </div>
            <GlassPanel variant="strong" className="p-6">
              <Toggle
                label="Qualifying reminders"
                desc="A nudge 30 minutes before the session."
                value={prefs.notifications.qualifying}
                onChange={(v) =>
                  update({ notifications: { ...prefs.notifications, qualifying: v } })
                }
              />
              <Divider />
              <Toggle
                label="Formation lap"
                desc="Right before lights out on Sunday."
                value={prefs.notifications.formationLap}
                onChange={(v) =>
                  update({ notifications: { ...prefs.notifications, formationLap: v } })
                }
              />
              <Divider />
              <Toggle
                label="Weather changes"
                desc="Only when the forecast shifts the weekend."
                value={prefs.notifications.weather}
                onChange={(v) => update({ notifications: { ...prefs.notifications, weather: v } })}
              />
              <Divider />
              <Toggle
                label="Replay available"
                desc="A quiet ping after each session ends."
                value={prefs.notifications.replay}
                onChange={(v) => update({ notifications: { ...prefs.notifications, replay: v } })}
              />
            </GlassPanel>

            <GlassPanel className="mt-4 p-6">
              <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground">
                QUIET HOURS
              </div>
              <div className="mt-2 font-display text-2xl">22:00 — 07:00</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Suggested quiet hours. Notification delivery is not connected.
              </div>
            </GlassPanel>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Toggle({
  label,
  desc,
  value,
  onChange,
}: {
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={value}
      aria-label={label}
      onClick={() => onChange(!value)}
      className="flex w-full items-start justify-between gap-4 text-left"
    >
      <div>
        <div className="font-display text-lg">{label}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{desc}</div>
      </div>
      <span
        className={cn(
          "relative mt-1 h-6 w-11 rounded-full transition shrink-0",
          value ? "bg-primary/60" : "bg-foreground/10",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-foreground transition",
            value ? "left-[22px]" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

function Divider() {
  return <div className="my-5 h-px bg-border" />;
}
