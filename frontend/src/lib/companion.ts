import type { Result } from "./api/history";
import type { ScheduleEvent } from "./store";
export type ChampionshipKind = "drivers" | "constructors";
export function formatInZone(instant: string | null | undefined, zone: string) {
  if (!instant || !/(Z|[+-]\d{2}:\d{2})$/.test(instant) || !Number.isFinite(Date.parse(instant)))
    return "Time unconfirmed";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      dateStyle: "full",
      timeStyle: "short",
    }).format(new Date(instant));
  } catch {
    return "Invalid timezone";
  }
}
export function raceWidgetData(events: ScheduleEvent[], now = Date.now(), season?: number) {
  const sessions = events
    .flatMap((event) =>
      Array.from({ length: 5 }, (_, i) => {
        const key = `session${i + 1}` as keyof ScheduleEvent;
        const instant = event[`${key}_date` as keyof ScheduleEvent];
        return {
          year: season ?? new Date(String(instant)).getUTCFullYear(),
          round: event.round_number,
          event: event.event_name,
          name: String(event[key] ?? ""),
          instant: typeof instant === "string" ? instant : null,
          disputed: Boolean(event.has_conflict),
        };
      }),
    )
    .filter(
      (s) =>
        s.name &&
        s.instant &&
        /(Z|[+-]\d{2}:\d{2})$/.test(s.instant) &&
        Number.isFinite(Date.parse(s.instant)),
    );
  const upcoming = sessions
    .filter((s) => Date.parse(s.instant!) > now)
    .sort((a, b) => Date.parse(a.instant!) - Date.parse(b.instant!));
  return {
    version: 1 as const,
    generatedAt: new Date(now).toISOString(),
    nextSession: upcoming[0] ?? null,
    nextRace: upcoming.find((s) => /^race$/i.test(s.name)) ?? null,
    sessions,
  };
}
export function eventProgression(results: Result[], kind: ChampionshipKind) {
  const points: Record<string, number> = {};
  const rounds = [
    ...new Set(
      results.filter((r) => r.session === "Race" || r.session === "Sprint").map((r) => r.round),
    ),
  ].sort((a, b) => a - b);
  return rounds.map((round) => {
    const earned: Record<string, number> = {};
    for (const r of results.filter((r) => r.round === round && r.session !== "Qualifying")) {
      const id = kind === "drivers" ? r.Driver.driverId : r.Constructor.constructorId;
      earned[id] = (earned[id] ?? 0) + r.points;
      points[id] = (points[id] ?? 0) + r.points;
    }
    return { round, earned, points: { ...points } };
  });
}
export interface Baseline {
  id: string;
  name: string;
  points: number;
  position: number | null;
}
export interface Adjustment {
  id: string;
  round: number;
  delta: number;
  note: string;
}
export function simulate(baseline: Baseline[], changes: Adjustment[]) {
  const known = new Set(baseline.map((r) => r.id));
  for (const c of changes)
    if (
      !known.has(c.id) ||
      !Number.isFinite(c.delta) ||
      Math.abs(c.delta) > 1000 ||
      !Number.isInteger(c.round) ||
      c.round < 1
    )
      throw new Error("Invalid scenario adjustment");
  const rows = baseline
    .map((row) => {
      const delta = changes.filter((c) => c.id === row.id).reduce((sum, c) => sum + c.delta, 0);
      return {
        ...row,
        baseline: row.points,
        delta,
        points: Math.round((row.points + delta) * 1000) / 1000,
      };
    })
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  if (!rows.some((r) => r.delta !== 0))
    rows.sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity));
  return rows.map((row, i) => ({
    ...row,
    rank: rows.some((r) => r.delta !== 0)
      ? rows.findIndex((r) => r.points === row.points) + 1
      : (row.position ?? i + 1),
    tied: rows.some((r) => r.delta !== 0) && rows.filter((r) => r.points === row.points).length > 1,
    positionChange:
      row.position === null
        ? null
        : row.position -
          (rows.some((r) => r.delta !== 0)
            ? rows.findIndex((r) => r.points === row.points) + 1
            : row.position),
  }));
}
export function readLocal<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
}
export function writeLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export const timezones = [
  "UTC",
  "Asia/Kolkata",
  "Europe/London",
  "Europe/Monaco",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Melbourne",
];

/** Rank identities, not response order, determine the official leader gap. */
export function championshipGap(rows: { position: number | null; points: number }[]) {
  const leader = rows.find((r) => r.position === 1);
  const runnerUp = rows.find((r) => r.position === 2);
  return leader && runnerUp ? leader.points - runnerUp.points : null;
}
export function latestRaceWinner(results: Result[]) {
  const races = results.filter((r) => r.session === "Race");
  const latestRound = Math.max(...races.map((r) => r.round));
  return races.find(
    (r) =>
      r.round === latestRound &&
      r.position === 1 &&
      !["disqualified", "did not start", "not classified", "excluded", "withdrawn"].includes(
        (r.status ?? "").trim().toLowerCase(),
      ) &&
      !["D", "E", "W", "F", "R", "N", "NC", "EX"].includes(
        (r.positionText ?? "").trim().toUpperCase(),
      ),
  );
}
