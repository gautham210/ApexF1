/**
 * Session Timing and State Computation Module
 *
 * Implements deterministic Formula 1 weekend session timing rules:
 * - Upcoming: Scheduled start time is in the future (countdown active).
 * - In Progress: Current time is within the scheduled session duration window.
 * - Completed: Scheduled session duration window has fully elapsed.
 * - Unknown: Scheduled timestamp is missing or unparseable.
 */

export type SessionState = "upcoming" | "in_progress" | "completed" | "unknown";

export interface SessionTimingState {
  state: SessionState;
  label: string;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  startTime: number | null;
  endTime: number | null;
  durationMinutes: number;
}

export function getSessionDurationMinutes(sessionName?: string): number {
  if (!sessionName) return 120;
  const norm = sessionName.toLowerCase();
  if (norm.includes("race") || norm.includes("grand prix")) return 150; // 2.5 hours
  if (norm.includes("sprint shootout") || norm.includes("sprint qualifying")) return 60; // 1 hour
  if (norm.includes("sprint")) return 60; // 1 hour
  if (norm.includes("qualifying") || norm.includes("quali")) return 90; // 1.5 hours
  if (norm.includes("practice") || norm.includes("fp")) return 90; // 1.5 hours
  return 120; // 2 hours default
}

export function computeSessionTiming(
  targetDate?: string | Date | number | null,
  sessionName?: string,
  nowInput?: Date | number,
): SessionTimingState {
  if (!targetDate) {
    return {
      state: "unknown",
      label: "Schedule unavailable",
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      startTime: null,
      endTime: null,
      durationMinutes: getSessionDurationMinutes(sessionName),
    };
  }

  const start =
    typeof targetDate === "number"
      ? targetDate
      : targetDate instanceof Date
        ? targetDate.getTime()
        : Date.parse(String(targetDate));

  if (!Number.isFinite(start)) {
    return {
      state: "unknown",
      label: "Schedule unavailable",
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      startTime: null,
      endTime: null,
      durationMinutes: getSessionDurationMinutes(sessionName),
    };
  }

  const now =
    nowInput instanceof Date
      ? nowInput.getTime()
      : typeof nowInput === "number"
        ? nowInput
        : Date.now();
  const durationMinutes = getSessionDurationMinutes(sessionName);
  const durationMs = durationMinutes * 60 * 1000;
  const end = start + durationMs;

  // 1. Before scheduled start -> Upcoming
  if (now < start) {
    const diff = start - now;
    return {
      state: "upcoming",
      label: "Upcoming",
      days: Math.floor(diff / 86_400_000),
      hours: Math.floor((diff % 86_400_000) / 3_600_000),
      minutes: Math.floor((diff % 3_600_000) / 60_000),
      seconds: Math.floor((diff % 60_000) / 1000),
      startTime: start,
      endTime: end,
      durationMinutes,
    };
  }

  // 2. Between start and end -> In Progress
  if (now < end) {
    return {
      state: "in_progress",
      label: "Session in progress",
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      startTime: start,
      endTime: end,
      durationMinutes,
    };
  }

  // 3. After duration has elapsed -> Completed
  return {
    state: "completed",
    label: "Session completed",
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    startTime: start,
    endTime: end,
    durationMinutes,
  };
}

export interface TimetableSession {
  name: string;
  date: string;
  key: string;
}

/**
 * Resolve the current active or upcoming session from an event timetable.
 */
export function resolveEventSessionFocus(
  sessions: TimetableSession[],
  nowInput?: Date | number,
): {
  session: TimetableSession | null;
  timing: SessionTimingState;
} {
  const now =
    nowInput instanceof Date
      ? nowInput.getTime()
      : typeof nowInput === "number"
        ? nowInput
        : Date.now();
  const valid = sessions.filter((s) => s.date && Number.isFinite(Date.parse(s.date)));

  if (valid.length === 0) {
    return {
      session: sessions[0] || null,
      timing: computeSessionTiming(null, undefined, now),
    };
  }

  // 1. Check if any session is currently in progress
  for (const s of valid) {
    const timing = computeSessionTiming(s.date, s.name, now);
    if (timing.state === "in_progress") {
      return { session: s, timing };
    }
  }

  // 2. Check for the earliest upcoming session
  const upcoming = valid
    .filter((s) => Date.parse(s.date) > now)
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));

  if (upcoming.length > 0) {
    const next = upcoming[0];
    return { session: next, timing: computeSessionTiming(next.date, next.name, now) };
  }

  // 3. All sessions have elapsed -> Return the latest completed session
  const sorted = [...valid].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const latest = sorted[0];
  return {
    session: latest,
    timing: computeSessionTiming(latest.date, latest.name, now),
  };
}

export function formatSessionCountdown(diffMs: number): string {
  if (diffMs <= 0) return "0s";
  const days = Math.floor(diffMs / 86_400_000);
  const hours = Math.floor((diffMs % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000);
  const seconds = Math.floor((diffMs % 60_000) / 1000);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function computeSessionTimingState(
  targetDate?: string | Date | number | null,
  sessionName?: string,
  nowInput?: Date | number,
) {
  const t = computeSessionTiming(targetDate, sessionName, nowInput);
  const now =
    nowInput instanceof Date
      ? nowInput.getTime()
      : typeof nowInput === "number"
        ? nowInput
        : Date.now();
  const diffMs = t.startTime && t.state === "upcoming" ? Math.max(0, t.startTime - now) : 0;

  let label = t.label;
  if (t.state === "upcoming") {
    label = formatSessionCountdown(diffMs);
  } else if (t.state === "unknown") {
    label = "Schedule unannounced";
  }

  return {
    status: t.state,
    remainingMs: diffMs,
    label,
    days: t.days,
    hours: t.hours,
    minutes: t.minutes,
    seconds: t.seconds,
  };
}

export function findFocusedSession(
  event: {
    session1?: string;
    session1_date?: string;
    session2?: string;
    session2_date?: string;
    session3?: string;
    session3_date?: string;
    session4?: string;
    session4_date?: string;
    session5?: string;
    session5_date?: string;
  },
  nowInput?: Date | number,
) {
  const sessions: TimetableSession[] = [];
  for (let i = 1; i <= 5; i++) {
    const name = event[`session${i}` as keyof typeof event];
    const date = event[`session${i}_date` as keyof typeof event];
    if (name && date) {
      sessions.push({ name, date, key: `session${i}` });
    }
  }
  const res = resolveEventSessionFocus(sessions, nowInput);
  return res.session;
}
