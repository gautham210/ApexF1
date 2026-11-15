import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { BellRing, Calendar } from "lucide-react";
import { GlassPanel } from "@/components/GlassPanel";
import { PageHeader } from "@/components/PageHeader";
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
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() =>
    typeof window !== "undefined" && "Notification" in window
      ? window.Notification.permission
      : "unsupported",
  );

  const requestPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    try {
      const next = await window.Notification.requestPermission();
      setPermission(next);
    } catch {
      // Ignore permission rejection
    }
  };

  const sendTestAlert = () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (window.Notification.permission !== "granted") return;
    new window.Notification("ApexF1 · Session alerts ready", {
      body: "Browser notifications are enabled on this device. Use Calendar export for scheduled push reminders.",
    });
  };

  return (
    <div className="apex-page pb-32">
      <div className="mx-auto max-w-[1160px]">
        <PageHeader
          eyebrow="ATTENTION, NOT NOISE"
          title="Alerts"
          subtitle="Choose your notification preferences for this device and manage browser permission."
          actions={
            <Link
              to="/calendar"
              className="apex-control glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium hover:bg-foreground/10"
            >
              <Calendar className="h-3.5 w-3.5" /> Open Calendar Export
            </Link>
          }
        />

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <section className="space-y-4">
            <div className="apex-eyebrow">DELIVERY STATUS</div>
            <GlassPanel className="apex-card p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl">On-device alert preferences</h2>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    Your alert toggles are stored locally in this browser. Background server push
                    delivery is not connected — use Calendar export for system calendar reminders 30
                    minutes before lights out or qualifying.
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-[10px] font-mono uppercase border shrink-0",
                    permission === "granted"
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      : permission === "denied"
                        ? "border-destructive/40 bg-destructive/10 text-destructive"
                        : "border-border/50 bg-foreground/5 text-muted-foreground",
                  )}
                >
                  Browser permission: {permission}
                </span>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {permission !== "granted" && permission !== "unsupported" && (
                  <button
                    type="button"
                    onClick={requestPermission}
                    className="apex-control inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background hover:bg-foreground/90"
                  >
                    <BellRing className="h-3.5 w-3.5" /> Enable browser permission
                  </button>
                )}
                {permission === "granted" && (
                  <button
                    type="button"
                    onClick={sendTestAlert}
                    className="apex-control glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium hover:bg-foreground/10"
                  >
                    <BellRing className="h-3.5 w-3.5" /> Send test notification
                  </button>
                )}
              </div>
            </GlassPanel>
          </section>

          <aside>
            <div className="apex-eyebrow mb-3">PREFERENCES</div>
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
