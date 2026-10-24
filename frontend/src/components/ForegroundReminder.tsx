import { useEffect, useState } from "react";
import { raceWidgetData, readLocal, writeLocal } from "@/lib/companion";
import type { ScheduleEvent } from "@/lib/store";
export function ForegroundReminder({ events }: { events: ScheduleEvent[] }) {
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      const now = Date.now();
      const next = raceWidgetData(events, now).nextSession;
      if (!next || next.disputed || !next.instant) return;
      const delay = Date.parse(next.instant) - now;
      const key = `apexf1.reminder.${next.year}.${next.round}.${next.name}.${next.instant}`;
      if (
        delay <= 600000 &&
        delay > 540000 &&
        !readLocal(key, false) &&
        Notification.permission === "granted"
      ) {
        if (writeLocal(key, true)) {
          try {
            new Notification("ApexF1 session reminder", {
              body: `${next.event} · ${next.name} starts in 10 minutes (provider schedule).`,
              tag: key,
            });
          } catch {
            setEnabled(false);
            setMessage(
              "This browser cannot display foreground notifications. Use calendar export.",
            );
          }
        }
      }
    };
    tick();
    const timer = setInterval(tick, 15000);
    return () => clearInterval(timer);
  }, [enabled, events]);
  return (
    <section className="glass rounded-2xl p-5 my-5">
      <h2 className="font-display text-2xl">Session reminders</h2>
      <p className="text-sm my-3">
        Optional 10-minute notifications while this page remains open. Background delivery,
        closed-app alarms and native widgets are not supported. Keep this page open;
        operating-system throttling may delay alerts.
      </p>
      <button
        className="border rounded-lg p-3"
        onClick={async () => {
          if (enabled) {
            setEnabled(false);
            return;
          }
          if (!("Notification" in window)) {
            setMessage("Notifications unavailable in this browser.");
            return;
          }
          const permission = await Notification.requestPermission();
          setEnabled(permission === "granted");
          setMessage(
            permission === "granted"
              ? "Reminders enabled for this visit."
              : "Permission not granted. Calendar export is available instead.",
          );
        }}
      >
        {enabled ? "Disable reminders" : "Enable foreground reminders"}
      </button>
      <p role="status" className="mt-3 text-sm">
        {message}
      </p>
    </section>
  );
}
