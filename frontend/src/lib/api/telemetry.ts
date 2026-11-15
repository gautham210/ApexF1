import { z } from "zod";
import { api, type APIResponse } from "./client";

export const circuitPointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const circuitCornerSchema = z.object({
  number: z.number().nullable().optional(),
  letter: z.string().optional().default(""),
  x: z.number(),
  y: z.number(),
});

export const circuitSectorSchema = z.object({
  sector: z.number(),
  label: z.string(),
  x: z.number(),
  y: z.number(),
});

export const circuitStartFinishSchema = z.object({
  x: z.number(),
  y: z.number(),
  dx: z.number(),
  dy: z.number(),
});

export const circuitMapSchema = z.object({
  available: z.boolean(),
  year: z.number().optional(),
  round_number: z.number().optional(),
  session: z.string().optional(),
  source: z.string().optional().default("FastF1"),
  circuit_name: z.string().nullable().optional(),
  rotation: z.number().nullable().optional(),
  reference_driver: z.string().nullable().optional(),
  points: z.array(circuitPointSchema).default([]),
  corners: z.array(circuitCornerSchema).default([]),
  sectors: z.array(circuitSectorSchema).optional().default([]),
  start_finish: circuitStartFinishSchema.nullable().optional(),
});

export type CircuitMapData = z.infer<typeof circuitMapSchema>;

export const sessionDriverSchema = z.object({
  driver_number: z.string(),
  abbreviation: z.string().optional().default(""),
  broadcast_name: z.string().optional().default(""),
  full_name: z.string().optional().default(""),
  name_acronym: z.string().optional().default(""),
  team_name: z.string().optional().default(""),
  team_color: z.string().optional().default("9CA3AF"),
  headshot_url: z.string().nullable().optional(),
});

export type SessionDriver = z.infer<typeof sessionDriverSchema>;

const durationFieldSchema = z.union([z.number(), z.string()]).nullable().optional();

export const sessionLapSchema = z.object({
  driver_number: z.string(),
  driver_code: z.string().optional().default(""),
  lap_number: z.number(),
  lap_time: durationFieldSchema,
  sector1: durationFieldSchema,
  sector2: durationFieldSchema,
  sector3: durationFieldSchema,
  compound: z.string().nullable().optional(),
  tyre_life: z.number().nullable().optional(),
  is_personal_best: z.boolean().nullable().optional().default(false),
  is_overall_best: z.boolean().nullable().optional().default(false),
  pit_in: z.boolean().nullable().optional().default(false),
  pit_out: z.boolean().nullable().optional().default(false),
});

export type SessionLap = z.infer<typeof sessionLapSchema>;

export const tyreStintSchema = z.object({
  lap: z.number().optional(),
  start_lap: z.number().optional(),
  end_lap: z.number().optional(),
  compound: z.string(),
  age: z.number().nullable().optional(),
  laps: z.number().optional(),
});

export type TyreStint = z.infer<typeof tyreStintSchema>;

export async function getCircuitMap(
  year: number,
  round: number,
  session = "Race",
): Promise<CircuitMapData | null> {
  const res = (await api.get<never, APIResponse<unknown>>("/api/circuit-map", {
    params: { year, round, session },
  })) as APIResponse<unknown>;
  if (!res?.success || !res.data) return null;
  const parsed = circuitMapSchema.safeParse(res.data);
  return parsed.success ? parsed.data : null;
}

export async function getSessionDrivers(
  year: number,
  round: number,
  session = "Race",
): Promise<SessionDriver[]> {
  const res = (await api.get<never, APIResponse<unknown>>("/api/drivers", {
    params: { year, round, session },
  })) as APIResponse<unknown>;
  if (!res?.success || !Array.isArray(res.data)) return [];
  const parsed = z.array(sessionDriverSchema).safeParse(res.data);
  return parsed.success ? parsed.data : [];
}

export async function getSessionLaps(
  year: number,
  round: number,
  session = "Race",
  driver?: string,
): Promise<SessionLap[]> {
  const res = (await api.get<never, APIResponse<unknown>>("/api/laps", {
    params: { year, round, session, driver },
  })) as APIResponse<unknown>;
  if (!res?.success || !Array.isArray(res.data)) return [];
  const parsed = z.array(sessionLapSchema).safeParse(res.data);
  return parsed.success ? parsed.data : [];
}

export async function getSessionTyres(
  year: number,
  round: number,
  session = "Race",
): Promise<Record<string, TyreStint[]>> {
  const res = (await api.get<never, APIResponse<unknown>>("/api/tyres", {
    params: { year, round, session },
  })) as APIResponse<unknown>;
  if (!res?.success || !res.data || typeof res.data !== "object") return {};
  const parsed = z.record(z.string(), z.array(tyreStintSchema)).safeParse(res.data);
  return parsed.success ? parsed.data : {};
}

export const replayDriverSchema = z.object({
  number: z.string(),
  abbr: z.string(),
  full_name: z.string(),
  team: z.string(),
  color: z.string(),
});

export type ReplayDriver = z.infer<typeof replayDriverSchema>;

export const replayLapSpanSchema = z.object({
  lap: z.number(),
  t_start: z.number(),
  t_end: z.number().nullable().optional(),
  duration: z.number().nullable().optional(),
});

export type ReplayLapSpan = z.infer<typeof replayLapSpanSchema>;

export const replayPositionEventSchema = z.object({
  t: z.number(),
  driver_number: z.string(),
  position: z.number(),
});

export type ReplayPositionEvent = z.infer<typeof replayPositionEventSchema>;

export const replayMetadataSchema = z.object({
  replay_available: z.boolean(),
  year: z.number(),
  round_number: z.number(),
  session: z.string(),
  session_key: z.number().optional(),
  source: z.string().optional().default("OpenF1"),
  reason: z.string().optional(),
  t0_iso: z.string().optional(),
  duration_seconds: z.number().optional(),
  race_start_offset: z.number().optional().default(0),
  total_laps: z.number().optional().default(0),
  chunk_seconds: z.number().optional().default(300),
  circuit: circuitMapSchema.optional(),
  drivers: z.array(replayDriverSchema).optional().default([]),
  laps_by_driver: z.record(z.string(), z.array(replayLapSpanSchema)).optional().default({}),
  position_events: z.array(replayPositionEventSchema).optional().default([]),
});

export type ReplayMetadata = z.infer<typeof replayMetadataSchema>;

export const replayFrameSchema = z.object({
  t: z.number(),
  cars: z.record(z.string(), z.tuple([z.number(), z.number()])),
});

export type ReplayFrame = z.infer<typeof replayFrameSchema>;

export const replayPositionsChunkSchema = z.object({
  session_key: z.number().optional(),
  start_s: z.number(),
  end_s: z.number(),
  frames: z.array(replayFrameSchema),
});

export type ReplayPositionsChunk = z.infer<typeof replayPositionsChunkSchema>;

export async function getReplayMetadata(
  year: number,
  round: number,
  session = "Race",
): Promise<ReplayMetadata | null> {
  const res = (await api.get<never, APIResponse<unknown>>("/api/replay/session-meta", {
    params: { year, round, session },
    timeout: 30000,
  })) as APIResponse<unknown>;
  if (!res?.success || !res.data) return null;
  const parsed = replayMetadataSchema.safeParse(res.data);
  return parsed.success ? parsed.data : null;
}

export async function getReplayPositions(
  year: number,
  round: number,
  session: string,
  startS: number,
  endS: number,
): Promise<ReplayPositionsChunk | null> {
  const res = (await api.get<never, APIResponse<unknown>>("/api/replay/positions", {
    params: { year, round, session, start_s: startS, end_s: endS },
    timeout: 35000,
  })) as APIResponse<unknown>;
  if (!res?.success || !res.data) return null;
  const parsed = replayPositionsChunkSchema.safeParse(res.data);
  return parsed.success ? parsed.data : null;
}
