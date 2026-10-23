import type { ScheduleEvent } from "./store";
export const sessionKeys = ["session1", "session2", "session3", "session4", "session5"] as const;
const escapeText = (text: string) =>
  text.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
const stamp = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
export function createCalendar(events: ScheduleEvent[], year: number, now = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ApexF1//Session Calendar//EN",
    "CALSCALE:GREGORIAN",
  ];
  for (const event of events)
    for (const key of sessionKeys) {
      const date = event[`${key}_date`];
      const name = event[key];
      if (
        !date ||
        !name ||
        !/(Z|[+-]\d{2}:\d{2})$/.test(date) ||
        !Number.isFinite(Date.parse(date))
      )
        continue;
      lines.push(
        "BEGIN:VEVENT",
        `UID:${year}-${event.round_number}-${key}@apexf1`,
        `DTSTAMP:${stamp(now)}`,
        `DTSTART:${stamp(new Date(date))}`,
        `SUMMARY:${escapeText(`${event.event_name} — ${name}`)}`,
        `LOCATION:${escapeText(event.has_conflict ? "Venue unconfirmed: provider disagreement" : `${event.location}, ${event.country}`)}`,
        "DESCRIPTION:Schedule snapshot. Re-export after timetable changes. Session end time unavailable.",
        "END:VEVENT",
      );
    }
  lines.push("END:VCALENDAR");
  // Fold by UTF-8 octets so long international event names remain valid iCalendar.
  return (
    lines
      .map((line) => {
        let output = "",
          length = 0;
        for (const char of line) {
          const size = new TextEncoder().encode(char).length;
          if (length + size > 75) {
            output += "\r\n ";
            length = 1;
          }
          output += char;
          length += size;
        }
        return output;
      })
      .join("\r\n") + "\r\n"
  );
}

export function googleCalendarUrl(event: ScheduleEvent, key: (typeof sessionKeys)[number]) {
  const instant = event[`${key}_date`];
  if (
    !instant ||
    !event[key] ||
    !/(Z|[+-]\d{2}:\d{2})$/.test(instant) ||
    !Number.isFinite(Date.parse(instant))
  )
    return null;
  const start = stamp(new Date(instant));
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${event.event_name} — ${event[key]}`,
    dates: `${start}/${start}`,
    details: "Schedule snapshot. Session end time unavailable; this is a start-time marker.",
    location: event.has_conflict
      ? "Venue unconfirmed: provider disagreement"
      : `${event.location}, ${event.country}`,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
