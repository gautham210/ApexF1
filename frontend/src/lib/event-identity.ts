/**
 * Canonical event identity and Race Center deep link validation (M-03 + M-04).
 *
 * Ensures:
 * - Deterministic parsing of archive and replay modes.
 * - Explicit error states for invalid/unsupported years, rounds, and sessions.
 * - URL serialize and parse round-trips.
 * - Truthful event labeling without inventing Grand Prix identities.
 */
import type { ScheduleEvent } from "@/lib/store";

export const MIN_SUPPORTED_YEAR = 2018;

export const VALID_SESSIONS = [
  "Race",
  "Qualifying",
  "Sprint",
  "Sprint Qualifying",
  "Practice 1",
  "Practice 2",
  "Practice 3",
] as const;

export type ValidSession = (typeof VALID_SESSIONS)[number];

export const VALID_MODES = ["archive", "replay"] as const;
export type RaceCenterMode = (typeof VALID_MODES)[number];

export interface RaceCenterSearch {
  mode?: RaceCenterMode;
  year?: number;
  round?: number;
  session?: string;
  error?: string;
  rawMode?: unknown;
  rawYear?: unknown;
  rawRound?: unknown;
  rawSession?: unknown;
}

/**
 * Validate and parse incoming search parameters for Race Center.
 *
 * Rejects silent fallbacks. If an invalid or unsupported year, round, session,
 * or mode is requested, records an explicit error instead of substituting
 * a different season or event.
 */
export function parseRaceCenterSearch(
  search: Record<string, unknown>,
  currentYear = new Date().getFullYear(),
): RaceCenterSearch {
  const maxYear = currentYear + 1;
  const result: RaceCenterSearch = {};

  // 1. Mode validation: accept both "archive" and "replay"
  if (search.mode !== undefined && search.mode !== null && search.mode !== "") {
    result.rawMode = search.mode;
    if (search.mode === "archive" || search.mode === "replay") {
      result.mode = search.mode;
    } else if (typeof search.mode === "string") {
      result.error = `Unsupported mode '${search.mode}'. Race Center supports 'archive' and 'replay' modes.`;
    }
  }

  // 2. Year validation: 2018 through currentYear + 1
  if (search.year !== undefined && search.year !== null && search.year !== "") {
    result.rawYear = search.year;
    const yNum = Number(search.year);
    if (!Number.isInteger(yNum)) {
      result.error = result.error || `Invalid year '${search.year}'. Year must be an integer.`;
    } else if (yNum < MIN_SUPPORTED_YEAR || yNum > maxYear) {
      result.error =
        result.error ||
        `Unsupported season: ${yNum}. Race Center timing and telemetry archives are supported from ${MIN_SUPPORTED_YEAR} to ${maxYear}.`;
    } else {
      result.year = yNum;
    }
  }

  // 3. Round validation: integer between 1 and 24
  if (search.round !== undefined && search.round !== null && search.round !== "") {
    result.rawRound = search.round;
    const rNum = Number(search.round);
    if (!Number.isInteger(rNum) || rNum < 1 || rNum > 24) {
      result.error =
        result.error ||
        `Invalid round '${search.round}'. Expected a round number between 1 and 24.`;
    } else {
      result.round = rNum;
    }
  }

  // 4. Session validation: must match recognized F1 session types
  if (search.session !== undefined && search.session !== null && search.session !== "") {
    result.rawSession = search.session;
    if (
      typeof search.session === "string" &&
      VALID_SESSIONS.includes(search.session as ValidSession)
    ) {
      result.session = search.session;
    } else {
      result.error =
        result.error ||
        `Invalid session '${search.session}'. Expected one of: ${VALID_SESSIONS.join(", ")}.`;
    }
  }

  return result;
}

/**
 * Format search parameters for navigation or URL generation.
 * Omits undefined or empty values.
 */
export function formatRaceCenterSearch(params: {
  mode?: RaceCenterMode;
  year?: number;
  round?: number;
  session?: string;
}): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  if (params.mode) out.mode = params.mode;
  if (params.year) out.year = params.year;
  if (params.round) out.round = params.round;
  if (params.session) out.session = params.session;
  return out;
}

/**
 * Return truthful display label for an event.
 * Never invents a Grand Prix name if the event has not resolved.
 */
export function getVerifiedEventLabel(
  event?: ScheduleEvent | null,
  isResolving = false,
): { label: string; isVerified: boolean; isConflict: boolean } {
  if (isResolving) {
    return { label: "Resolving event...", isVerified: false, isConflict: false };
  }
  if (!event) {
    return { label: "Event details unavailable", isVerified: false, isConflict: false };
  }
  if (event.has_conflict) {
    return { label: event.event_name, isVerified: false, isConflict: true };
  }
  return { label: event.event_name, isVerified: true, isConflict: false };
}

/**
 * Return truthful venue information for an event.
 * If there is a venue conflict, never asserts one provider's circuit or location
 * as confirmed truth. Exposes explicit conflict status and raw candidate venues.
 */
export function getVerifiedEventVenue(event?: ScheduleEvent | null): {
  circuitName: string | null;
  location: string | null;
  isDisputed: boolean;
  conflictDetails?: Record<string, unknown> | null;
} {
  if (!event) {
    return {
      circuitName: null,
      location: null,
      isDisputed: false,
      conflictDetails: null,
    };
  }
  if (event.has_conflict && event.conflict) {
    return {
      circuitName: null, // Do not declare a confirmed circuit when providers dispute venue
      location: event.location || "Disputed Venue",
      isDisputed: true,
      conflictDetails: event.conflict as Record<string, unknown>,
    };
  }
  return {
    circuitName: event.circuit_name || null,
    location: event.location || null,
    isDisputed: false,
    conflictDetails: null,
  };
}

export type TelemetryAvailabilityStatus =
  | "unsupported_season"
  | "known_available"
  | "known_unavailable"
  | "unverified";

export interface SessionTelemetryState {
  status: TelemetryAvailabilityStatus;
  label: string;
  canNavigate: boolean;
  reason?: string;
}

/**
 * Deterministically evaluate telemetry availability for a session.
 * Prevents presenting telemetry comparison as available solely because
 * a session is in the past.
 */
export function getSessionTelemetryState(
  year: number | undefined,
  sessionName: string,
  roundNumber: number,
  telemetryAvailability: Record<string, boolean> = {},
): SessionTelemetryState {
  if (!year || year < MIN_SUPPORTED_YEAR) {
    return {
      status: "unsupported_season",
      label: `Telemetry unavailable (< ${MIN_SUPPORTED_YEAR})`,
      canNavigate: false,
      reason: `Historical telemetry data is only supported from ${MIN_SUPPORTED_YEAR} to ${new Date().getFullYear() + 1}.`,
    };
  }

  const sessionKey = `${year}-${roundNumber}-${sessionName}`;
  const known = telemetryAvailability[sessionKey];

  if (known === false) {
    return {
      status: "known_unavailable",
      label: "Telemetry data unavailable",
      canNavigate: false,
      reason: "No telemetry recorded or provider returned no data for this session.",
    };
  }

  if (known === true) {
    return {
      status: "known_available",
      label: "Explore session telemetry",
      canNavigate: true,
      reason: "Telemetry data verified and available.",
    };
  }

  return {
    status: "unverified",
    label: "Attempt to load telemetry",
    canNavigate: true,
    reason: "Telemetry availability unverified until requested.",
  };
}
