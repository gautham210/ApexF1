import type { ReplayDriver, ReplayFrame, ReplayMetadata } from "./api/telemetry";

export const REPLAY_SPEEDS = [0.5, 1, 2, 5, 10, 20] as const;
export type ReplaySpeed = (typeof REPLAY_SPEEDS)[number];

export interface ReplayCarPosition {
  x: number;
  y: number;
}

export interface ReplayDriverState {
  driver: ReplayDriver;
  position: number | null;
  lap: number;
  lastLapDuration: number | null;
  coords: ReplayCarPosition | null;
  status: "on-track" | "finished" | "off-track";
}

export interface TrackViewport {
  zoom: number;
  panX: number;
  panY: number;
}

export const DEFAULT_VIEWPORT: TrackViewport = { zoom: 1, panX: 0, panY: 0 };

/** Clamp pan/zoom so the circuit can never disappear off-screen. */
export function clampViewport(next: TrackViewport): TrackViewport {
  const zoom = Math.min(5, Math.max(1, Number.isFinite(next.zoom) ? next.zoom : 1));
  const viewSpan = 1000 / zoom;
  const maxPan = Math.max(0, (1000 - viewSpan) * 0.65);
  const panX = Math.min(maxPan, Math.max(-maxPan, Number.isFinite(next.panX) ? next.panX : 0));
  const panY = Math.min(maxPan, Math.max(-maxPan, Number.isFinite(next.panY) ? next.panY : 0));
  return { zoom, panX, panY };
}

/** Convert normalized pan/zoom into SVG viewBox string for crisp vector scaling. */
export function viewportToViewBox(vp: TrackViewport): string {
  const clamped = clampViewport(vp);
  const span = 1000 / clamped.zoom;
  const minX = 500 - span / 2 + clamped.panX;
  const minY = 500 - span / 2 + clamped.panY;
  return `${minX.toFixed(1)} ${minY.toFixed(1)} ${span.toFixed(1)} ${span.toFixed(1)}`;
}

/** Determine [start_s, end_s] chunk window boundaries for a cursor timestamp t. */
export function getWindowBoundsForTime(
  tSeconds: number,
  durationSeconds: number,
  chunkSeconds = 300,
): { startS: number; endS: number } {
  const clampedT = Math.max(0, Math.min(durationSeconds, Math.floor(tSeconds)));
  const startS = Math.floor(clampedT / chunkSeconds) * chunkSeconds;
  const endS = Math.min(durationSeconds, startS + chunkSeconds);
  return { startS, endS };
}

/**
 * Sample smoothly interpolated SVG coordinates for every driver present at tSeconds.
 * Interpolates linearly only between adjacent keyframes (floor(t) and floor(t)+1)
 * when BOTH keyframes contain recorded coordinates for that driver.
 * Never fabricates positions for retired or offline cars.
 */
export function sampleDriverPositionsAt(
  framesBySecond: ReadonlyMap<number, Record<string, [number, number]>>,
  tSeconds: number,
): Record<string, ReplayCarPosition> {
  const secLow = Math.floor(tSeconds);
  const secHigh = secLow + 1;
  const frac = Math.min(1, Math.max(0, tSeconds - secLow));

  const frameLow = framesBySecond.get(secLow);
  const frameHigh = framesBySecond.get(secHigh);

  if (!frameLow && !frameHigh) return {};
  if (!frameLow && frameHigh) {
    // Only use adjacent frame if essentially aligned (< 0.5s away)
    if (1 - frac <= 0.5) {
      const out: Record<string, ReplayCarPosition> = {};
      for (const [drv, xy] of Object.entries(frameHigh)) {
        out[drv] = { x: xy[0], y: xy[1] };
      }
      return out;
    }
    return {};
  }

  const out: Record<string, ReplayCarPosition> = {};
  for (const [drv, xyLow] of Object.entries(frameLow!)) {
    const xyHigh = frameHigh?.[drv];
    if (xyHigh) {
      out[drv] = {
        x: xyLow[0] + (xyHigh[0] - xyLow[0]) * frac,
        y: xyLow[1] + (xyHigh[1] - xyLow[1]) * frac,
      };
    } else if (frac <= 0.65) {
      out[drv] = { x: xyLow[0], y: xyLow[1] };
    }
  }
  return out;
}

/** Store a fetched chunk into a Map keyed by integer second. */
export function mergeChunkIntoMap(
  target: Map<number, Record<string, [number, number]>>,
  frames: ReplayFrame[],
): void {
  for (const frame of frames) {
    target.set(frame.t, frame.cars);
  }
}

/**
 * Derive verified driver order, current lap, and track presence at replay timestamp tSeconds
 * strictly from recorded OpenF1 position_events, laps_by_driver, and active frames.
 */
export function computeDriverStatesAt(
  meta: ReplayMetadata,
  tSeconds: number,
  coordsByDriver: Record<string, ReplayCarPosition>,
): {
  currentLap: number;
  states: ReplayDriverState[];
} {
  // Latest recorded official race position for each driver at <= tSeconds
  const latestPos = new Map<string, number>();
  for (const ev of meta.position_events) {
    if (ev.t > tSeconds) break;
    latestPos.set(ev.driver_number, ev.position);
  }

  let maxLapSeen = 0;
  const states: ReplayDriverState[] = meta.drivers
    .map((drv, idx) => {
      const laps = meta.laps_by_driver[drv.number] ?? [];
      let currentLap = 0;
      let lastLapDuration: number | null = null;
      let maxDriverLapEnd = 0;

      for (const lap of laps) {
        if (lap.t_start <= tSeconds) {
          currentLap = lap.lap;
          if (typeof lap.duration === "number") {
            lastLapDuration = lap.duration;
          }
        }
        const end = lap.t_end ?? lap.t_start + (lap.duration ?? 95);
        if (end > maxDriverLapEnd) maxDriverLapEnd = end;
      }

      if (currentLap > maxLapSeen) maxLapSeen = currentLap;
      const coords = coordsByDriver[drv.number] ?? null;
      const totalLaps = meta.total_laps || 0;
      const status: ReplayDriverState["status"] = coords
        ? "on-track"
        : totalLaps > 0 && currentLap >= totalLaps && tSeconds >= maxDriverLapEnd
          ? "finished"
          : "off-track";

      return {
        driver: drv,
        position: latestPos.get(drv.number) ?? null,
        lap: currentLap,
        lastLapDuration,
        coords,
        status,
        _fallbackIndex: idx,
      };
    })
    .sort((a, b) => {
      if (a.position !== null && b.position !== null && a.position !== b.position) {
        return a.position - b.position;
      }
      if (a.position !== null && b.position === null) return -1;
      if (a.position === null && b.position !== null) return 1;
      if (a.lap !== b.lap) return b.lap - a.lap;
      return a._fallbackIndex - b._fallbackIndex;
    })
    .map(({ _fallbackIndex, ...rest }) => rest);

  return {
    currentLap: maxLapSeen > 0 ? maxLapSeen : meta.total_laps > 0 ? 1 : 0,
    states,
  };
}
