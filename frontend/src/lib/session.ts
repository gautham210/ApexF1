import type { ScheduleEvent } from "./store";
import { sessionKeys } from "./calendar";
export function matchesSession(
  event: ScheduleEvent | undefined,
  name: string,
  dateStart?: string,
): boolean {
  if (!event || !dateStart || !Number.isFinite(Date.parse(dateStart))) return false;
  return sessionKeys.some(
    (key) =>
      event[key] === name &&
      event[`${key}_date`] &&
      Date.parse(event[`${key}_date`]!) === Date.parse(dateStart),
  );
}
