import type { CircuitMapData } from "./api/telemetry";
import type { TelemetryPoint } from "./store";

export interface ReplayPointMerged {
  idx: number;
  progress: number;
  distance: number;
  label: string;
  speedA: number | null;
  speedB: number | null;
  throttleA: number | null;
  throttleB: number | null;
  brakeA: number | null;
  brakeB: number | null;
  gearA: number | null;
  gearB: number | null;
  rpmA: number | null;
  rpmB: number | null;
  drsA: boolean;
  drsB: boolean;
  timeA: number;
  timeB: number | null;
  deltaSec: number | null;
}

export function normalizeBrakePercent(raw?: number | null): number | null {
  if (raw === null || raw === undefined || Number.isNaN(raw)) return null;
  if (raw <= 1) return Math.round(Math.max(0, raw) * 100);
  return Math.round(Math.min(100, Math.max(0, raw)));
}

export function isDrsOpen(raw?: number | null): boolean {
  if (raw === null || raw === undefined || Number.isNaN(raw)) return false;
  return raw >= 10;
}

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

function findNearestByDistance(
  series: TelemetryPoint[],
  targetDist: number,
  fallbackIndex: number,
): TelemetryPoint | undefined {
  if (series.length === 0) return undefined;
  const hasDist = series.some((p) => typeof p.distance === "number" && p.distance > 0);
  if (!hasDist) {
    return series[Math.min(series.length - 1, fallbackIndex)];
  }
  let lo = 0;
  let hi = series.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const d = series[mid]?.distance ?? 0;
    if (d < targetDist) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0) {
    const dPrev = Math.abs((series[lo - 1]?.distance ?? 0) - targetDist);
    const dCurr = Math.abs((series[lo]?.distance ?? 0) - targetDist);
    if (dPrev < dCurr) return series[lo - 1];
  }
  return series[lo];
}

export function buildReplayFrames(
  seriesA: TelemetryPoint[],
  seriesB: TelemetryPoint[] = [],
  maxFrames = 260,
): ReplayPointMerged[] {
  if (!seriesA || seriesA.length === 0) return [];

  const step = Math.max(1, Math.floor(seriesA.length / maxFrames));
  const sampledA = seriesA.filter((_, i) => i % step === 0 || i === seriesA.length - 1);
  const maxDistA =
    sampledA[sampledA.length - 1]?.distance && sampledA[sampledA.length - 1]!.distance! > 0
      ? sampledA[sampledA.length - 1]!.distance!
      : Math.max(1, sampledA.length - 1);

  return sampledA.map((ptA, idx) => {
    const dist =
      typeof ptA.distance === "number" && ptA.distance >= 0
        ? ptA.distance
        : (idx / Math.max(1, sampledA.length - 1)) * maxDistA;
    const progress =
      maxDistA > 0
        ? Math.min(1, Math.max(0, dist / maxDistA))
        : idx / Math.max(1, sampledA.length - 1);

    const mappedBIdx =
      seriesB.length > 0 ? Math.round(progress * Math.max(0, seriesB.length - 1)) : 0;
    const ptB = findNearestByDistance(seriesB, dist, mappedBIdx);
    const deltaSec =
      ptB !== undefined && typeof ptB.time === "number" && typeof ptA.time === "number"
        ? Number((ptA.time - ptB.time).toFixed(3))
        : null;

    return {
      idx,
      progress,
      distance: Math.round(dist),
      label: typeof ptA.distance === "number" ? `${Math.round(dist)}m` : `${ptA.time.toFixed(1)}s`,
      speedA: typeof ptA.speed === "number" ? Math.round(ptA.speed) : null,
      speedB: typeof ptB?.speed === "number" ? Math.round(ptB.speed) : null,
      throttleA: typeof ptA.throttle === "number" ? Math.round(ptA.throttle) : null,
      throttleB: typeof ptB?.throttle === "number" ? Math.round(ptB.throttle) : null,
      brakeA: normalizeBrakePercent(ptA.brake),
      brakeB: normalizeBrakePercent(ptB?.brake),
      gearA: typeof ptA.gear === "number" ? ptA.gear : null,
      gearB: typeof ptB?.gear === "number" ? ptB.gear : null,
      rpmA: typeof ptA.rpm === "number" ? Math.round(ptA.rpm) : null,
      rpmB: typeof ptB?.rpm === "number" ? Math.round(ptB.rpm) : null,
      drsA: isDrsOpen(ptA.drs),
      drsB: isDrsOpen(ptB?.drs),
      timeA: ptA.time,
      timeB: typeof ptB?.time === "number" ? ptB.time : null,
      deltaSec,
    };
  });
}
