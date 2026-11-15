import type { CircuitMapData } from "./api/telemetry";

export function formatLapDuration(seconds?: number | string | null): string {
  if (typeof seconds === "string") {
    const trimmed = seconds.trim();
    return trimmed.length > 0 ? trimmed : "—";
  }
  if (seconds === null || seconds === undefined || Number.isNaN(seconds) || seconds <= 0) {
    return "—";
  }
  const mins = Math.floor(seconds / 60);
  const rem = seconds - mins * 60;
  const remStr = rem.toFixed(3).padStart(6, "0");
  return mins > 0 ? `${mins}:${remStr}` : `${rem.toFixed(3)}s`;
}

export function formatSectorDuration(value?: number | string | null): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "—";
    return trimmed.endsWith("s") ? trimmed : `${trimmed}s`;
  }
  if (typeof value === "number" && !Number.isNaN(value) && value > 0) {
    return `${value.toFixed(3)}s`;
  }
  return "—";
}

export function formatReplayClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function interpolateTrackPosition(
  points: CircuitMapData["points"] | undefined,
  progress: number,
): { x: number; y: number } | null {
  if (!points || points.length === 0) return null;
  if (points.length === 1) return { x: points[0].x, y: points[0].y };

  const clamped = Math.min(1, Math.max(0, progress));
  const scaled = clamped * (points.length - 1);
  const low = Math.floor(scaled);
  const high = Math.min(points.length - 1, low + 1);
  const frac = scaled - low;

  return {
    x: points[low].x + (points[high].x - points[low].x) * frac,
    y: points[low].y + (points[high].y - points[low].y) * frac,
  };
}
