/** Schedule countdown only. A start instant cannot verify live or terminal status. */
export type SessionState = "upcoming" | "start_passed" | "unknown";
export interface SessionTimingState {
  state: SessionState;
  label: string;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  startTime: number | null;
  endTime: null;
}
export function computeSessionTiming(
  targetDate?: string | Date | number | null,
  _sessionName?: string,
  nowInput?: Date | number,
): SessionTimingState {
  const start =
    targetDate instanceof Date
      ? targetDate.getTime()
      : typeof targetDate === "number"
        ? targetDate
        : Date.parse(targetDate ?? "");
  const now = nowInput instanceof Date ? nowInput.getTime() : (nowInput ?? Date.now());
  const valid = Number.isFinite(start) && Number.isFinite(now);
  const diff = valid ? Math.max(0, start - now) : 0;
  return {
    state: !valid ? "unknown" : now < start ? "upcoming" : "start_passed",
    label: !valid
      ? "Schedule unavailable"
      : now < start
        ? "Upcoming"
        : "Scheduled start passed · status unverified",
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
    startTime: valid ? start : null,
    endTime: null,
  };
}
export interface TimetableSession {
  name: string;
  date: string;
  key: string;
}
/**
 * Resolve the next scheduled session from an event timetable.
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
  // Prefer the next scheduled start; elapsed starts cannot establish live status.
  const upcoming = valid
    .filter((s) => Date.parse(s.date) > now)
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  if (upcoming.length > 0) {
    const next = upcoming[0];
    return { session: next, timing: computeSessionTiming(next.date, next.name, now) };
  }
  // 3. All sessions have elapsed -> Return the latest scheduled session
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
