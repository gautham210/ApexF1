import type { ScheduleEvent } from "../store";
import { z } from "zod";
import { api, f1Api } from "./client";

const driver = z.object({
  driverId: z.string(),
  givenName: z.string(),
  familyName: z.string(),
  code: z.string().nullable(),
  nationality: z.string().nullable(),
  dateOfBirth: z.string().nullable(),
});
const constructor = z.object({
  constructorId: z.string(),
  name: z.string(),
  nationality: z.string().nullable(),
});
const metrics = {
  wins: z.number(),
  podiums: z.number(),
  qualifying_p1: z.number().nullable(),
  grid_p1_starts: z.number(),
  race_points: z.number(),
  sprint_points: z.number(),
};
const standing = z.object({
  id: z.string(),
  position: z.number().nullable(),
  positionText: z.string().nullable(),
  points: z.number(),
  wins: z.number(),
  Driver: driver.nullable(),
  Constructor: constructor.nullable(),
  Constructors: z.array(constructor),
});
const standings = z.object({ round: z.number().nullable(), rows: z.array(standing) }).nullable();
const result = z.object({
  year: z.number(),
  round: z.number(),
  race: z.string(),
  date: z.string(),
  session: z.enum(["Race", "Sprint", "Qualifying"]),
  Driver: driver,
  Constructor: constructor,
  position: z.number().nullable(),
  positionText: z.string().nullable(),
  number: z.string().nullable(),
  points: z.number(),
  grid: z.number().nullable(),
  laps: z.number().nullable(),
  status: z.string().nullable(),
  FastestLap: z
    .object({
      rank: z.union([z.string(), z.number()]).optional(),
      Time: z.object({ time: z.string() }).optional(),
    })
    .passthrough()
    .nullable(),
  Q1: z.string().nullable(),
  Q2: z.string().nullable(),
  Q3: z.string().nullable(),
});
export const seasonSchema = z.object({
  year: z.number(),
  selected_round: z.number().nullable(),
  status: z.enum(["success", "partial"]),
  source: z.string(),
  fetched_at: z.string(),
  cache_seconds: z.number(),
  errors: z.record(z.string()),
  schedule: z.array(
    z.object({
      season: z.number(),
      round: z.number(),
      raceName: z.string(),
      has_conflict: z.boolean().optional(),
      conflict: z.unknown().optional(),
      date: z.string(),
      time: z.string().nullable(),
      Circuit: z.object({
        circuitId: z.string(),
        circuitName: z.string(),
        Location: z.object({
          locality: z.string(),
          country: z.string(),
          lat: z.string().optional(),
          long: z.string().optional(),
        }),
      }),
    }),
  ),
  driver_standings: standings,
  constructor_standings: standings,
  metric_coverage: z.object({
    qualifying_p1: z.enum(["complete", "partial", "unavailable"]),
    fastest_laps: z.enum(["complete", "partial", "unavailable"]),
  }),
  drivers: z.record(
    driver.extend({
      ...metrics,
      fastest_laps: z.number().nullable(),
      teams: z.record(z.string()),
      numbers: z.array(z.string()),
    }),
  ),
  constructors: z.record(
    constructor.extend({
      ...metrics,
      fastest_laps: z.number().nullable(),
      contributions: z.record(z.number()),
    }),
  ),
  results: z.array(result),
  progression: z.array(z.object({ round: z.number(), points: z.record(z.number()) })),
});
export type Season = z.infer<typeof seasonSchema>;
export type Result = z.infer<typeof result>;
export async function getSeason(year: number, round?: number, signal?: AbortSignal) {
  const response = await api.get<never, unknown>("/api/history/season", {
    params: { year, round },
    timeout: 90000,
    signal,
  });
  const payload = z.object({ success: z.literal(true), data: seasonSchema }).parse(response).data;
  if (payload.year !== year || payload.selected_round !== (round ?? null))
    throw new Error("Season identity mismatch");
  return payload;
}
export const careerSchema = z.object({
  season_coverage: z.enum(["complete", "partial"]),
  failed_seasons: z.array(z.number().int()),
  driver_id: z.string(),
  source: z.string(),
  fetched_at: z.string(),
  wins: z.number(),
  championship_points: z.number(),
  titles: z.number().nullable(),
  title_coverage: z.enum(["complete", "partial"]),
  records: z.array(standing.omit({ id: true }).extend({ year: z.number(), round: z.number() })),
  season_records: z.array(
    standing.omit({ id: true }).extend({ year: z.number(), round: z.number() }),
  ),
});
export async function getCareer(id: string, signal?: AbortSignal) {
  const response = await api.get<never, unknown>(
    `/api/history/drivers/${encodeURIComponent(id)}/career`,
    { timeout: 90000, signal },
  );
  const data = z.object({ success: z.literal(true), data: careerSchema }).parse(response).data;
  if (data.driver_id !== id) throw new Error("Driver identity mismatch");
  return data;
}
export async function getTeamPowerUnit(
  year: number,
  constructorName: string,
  signal?: AbortSignal,
) {
  const response = await api.get<never, unknown>("/api/engine-standings", {
    params: { year },
    signal,
  });
  const payload = z
    .object({
      success: z.literal(true),
      data: z.array(z.object({ name: z.string(), teams: z.array(z.string()), points: z.number() })),
    })
    .parse(response);
  return payload.data.find((row) => row.teams.includes(constructorName))?.name ?? null;
}
export function seasonSearch(input: Record<string, unknown>): { year?: number; round?: number } {
  const year = Number(input.year),
    round = Number(input.round);
  return {
    year:
      Number.isInteger(year) && year >= 1950 && year <= new Date().getFullYear() + 1
        ? year
        : undefined,
    round: Number.isInteger(round) && round > 0 && round <= 30 ? round : undefined,
  };
}

export const progressionSchema = z.object({
  year: z.number(),
  kind: z.enum(["drivers", "constructors"]),
  source: z.string(),
  status: z.enum(["success", "partial"]),
  fetched_at: z.string(),
  cache_seconds: z.number(),
  rounds: z.array(
    z.object({
      round: z.number(),
      points: z.record(z.number()).nullable(),
      positions: z.record(z.number().nullable()).nullable(),
      error: z.string().nullable(),
    }),
  ),
});
export async function getOfficialProgression(
  year: number,
  kind: "drivers" | "constructors",
  signal?: AbortSignal,
) {
  const response = await api.get<never, unknown>("/api/history/progression", {
    params: { year, kind },
    signal,
    timeout: 90000,
  });
  const data = z.object({ success: z.literal(true), data: progressionSchema }).parse(response).data;
  if (data.year !== year || data.kind !== kind) throw new Error("Progression identity mismatch");
  return data;
}
export async function getHistoricalSchedule(
  year: number,
  signal?: AbortSignal,
): Promise<{ success: boolean; data: ScheduleEvent[] }> {
  const response = await api.get<never, unknown>("/api/history/schedule", {
    params: { year },
    signal,
  });
  const data = z
    .object({
      success: z.literal(true),
      data: z.array(
        z.object({
          season: z.number(),
          round: z.number(),
          raceName: z.string(),
          date: z.string(),
          time: z.string().nullable(),
          Circuit: z.object({
            circuitId: z.string(),
            circuitName: z.string(),
            Location: z.object({ country: z.string(), locality: z.string() }),
          }),
        }),
      ),
    })
    .parse(response).data;
  if (data.some((r) => r.season !== year)) throw new Error("Schedule identity mismatch");
  return {
    success: true,
    data: data.map((r) => ({
      round_number: r.round,
      country: r.Circuit.Location.country,
      location: r.Circuit.Location.locality,
      event_name: r.raceName,
      circuit_name: r.Circuit.circuitName,
      session5: "Race",
      session5_date: r.time ? `${r.date}T${r.time}` : undefined,
      is_completed: false,
      is_upcoming: false,
    })),
  };
}

export const getScheduleForYear = (year: number, signal?: AbortSignal) =>
  year < 2018 ? getHistoricalSchedule(year, signal) : f1Api.getSchedule(year, signal);
