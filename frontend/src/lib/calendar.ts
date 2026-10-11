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
      if (!date || !name || !Number.isFinite(Date.parse(date))) continue;
      lines.push(
        "BEGIN:VEVENT",
        `UID:${year}-${event.round_number}-${key}@apexf1`,
        `DTSTAMP:${stamp(now)}`,
        `DTSTART:${stamp(new Date(date))}`,
        `SUMMARY:${escapeText(`${event.event_name} — ${name}`)}`,
        `LOCATION:${escapeText(`${event.location}, ${event.country}`)}`,
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
