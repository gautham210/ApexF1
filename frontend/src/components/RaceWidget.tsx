import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { raceWidgetData, formatInZone } from "@/lib/companion";
import { formatSessionCountdown } from "@/lib/session-timing";
import type { ScheduleEvent } from "@/lib/store";
export function RaceWidget({
  events,
  year,
  zone = "UTC",
  expanded = false,
}: {
  events: ScheduleEvent[];
  year: number;
  zone?: string;
  expanded?: boolean;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const data = raceWidgetData(events, now, year);
  const s = data.nextSession;
  return (
    <article className="glass rounded-2xl p-6 min-w-0">
      <p className="text-xs text-muted-foreground">Next scheduled session</p>
      <h2 className="font-display text-2xl mt-2">
        {s ? `${s.event} · ${s.name}` : "No confirmed future session"}
      </h2>
      {s && (
        <>
          <p className="mt-3 text-sm">{formatInZone(s.instant, zone)}</p>
          <p className="font-mono text-2xl my-3">
            {formatSessionCountdown(Date.parse(s.instant!) - now)}
          </p>
          {s.disputed && <p role="status">Provider disagreement — venue unconfirmed.</p>}
        </>
      )}
      {expanded && (
        <p className="text-sm text-muted-foreground">
          Next Grand Prix: {data.nextRace?.event ?? "Unavailable"}. Schedule only; live status
          requires authenticated timing.
        </p>
      )}
      <Link
        className="inline-block underline py-3"
        to="/companion"
        search={{ view: "times", year }}
      >
        All race times
      </Link>
    </article>
  );
}
