import { useMemo } from "react";
import type { CircuitMapData } from "@/lib/api/telemetry";
import { interpolateTrackPosition } from "@/lib/replay-helpers";
import { CircuitOutline, type CircuitKey } from "@/components/CircuitOutline";
import { Compass } from "lucide-react";

export interface TrackDriverMarker {
  code: string;
  color: string;
  progress: number;
  speed?: number | null;
}

export function CircuitTrackMap({
  circuitMap,
  loading = false,
  fallbackCircuitKey = null,
  trackName,
  drivers = [],
  showCorners = true,
  className = "w-full h-full",
}: {
  circuitMap: CircuitMapData | null | undefined;
  loading?: boolean;
  fallbackCircuitKey?: CircuitKey | null;
  trackName?: string;
  drivers?: TrackDriverMarker[];
  showCorners?: boolean;
  className?: string;
}) {
  const polylinePoints = useMemo(() => {
    if (!circuitMap?.available || !circuitMap.points?.length) return "";
    return circuitMap.points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  }, [circuitMap]);

  const startPoint =
    circuitMap?.available && circuitMap.points?.length ? circuitMap.points[0] : null;

  const visibleCorners = useMemo(() => {
    if (!showCorners || !circuitMap?.available || !circuitMap.corners?.length) return [];
    const chosen: typeof circuitMap.corners = [];
    for (const c of circuitMap.corners) {
      if (c.number === null || c.number === undefined) continue;
      const tooClose = chosen.some(
        (existing) => Math.hypot(existing.x - c.x, existing.y - c.y) < 52,
      );
      if (!tooClose) chosen.push(c);
    }
    return chosen;
  }, [circuitMap, showCorners]);

  const driverMarkers = useMemo(() => {
    if (!circuitMap?.available || !circuitMap.points?.length) return [];
    return drivers
      .map((drv) => {
        const pos = interpolateTrackPosition(circuitMap.points, drv.progress);
        return pos ? { ...drv, ...pos } : null;
      })
      .filter((m): m is TrackDriverMarker & { x: number; y: number } => m !== null);
  }, [circuitMap, drivers]);

  if (loading) {
    return (
      <div className={`flex flex-col items-center justify-center gap-3 p-6 ${className}`}>
        <div className="h-32 w-48 rounded-full border border-white/10 bg-white/[0.03] animate-pulse" />
        <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
          Loading FastF1 track geometry…
        </span>
      </div>
    );
  }

  if (circuitMap?.available && polylinePoints) {
    return (
      <svg
        viewBox="0 0 1000 1000"
        className={className}
        role="img"
        aria-label={trackName ? `${trackName} FastF1 track map` : "FastF1 circuit track geometry"}
      >
        <defs>
          <filter id="apex-track-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer halo */}
        <polygon
          points={polylinePoints}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="30"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Tarmac base */}
        <polygon
          points={polylinePoints}
          fill="none"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="12"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Racing center line */}
        <polygon
          points={polylinePoints}
          fill="none"
          stroke="var(--primary)"
          strokeOpacity="0.82"
          strokeWidth="4"
          strokeLinejoin="round"
          strokeLinecap="round"
          filter="url(#apex-track-glow)"
        />

        {/* Start/Finish reference node */}
        {startPoint && (
          <g transform={`translate(${startPoint.x}, ${startPoint.y})`}>
            <circle r="11" fill="rgba(16,185,129,0.24)" stroke="#10b981" strokeWidth="3" />
            <text
              x="16"
              y="4"
              fontSize="24"
              fontFamily="JetBrains Mono, monospace"
              fontWeight="700"
              fill="#6ee7b7"
            >
              S/F
            </text>
          </g>
        )}

        {/* Official corner markers */}
        {visibleCorners.map((c) => (
          <g key={`${c.number}-${c.letter}`} transform={`translate(${c.x}, ${c.y})`}>
            <circle
              r="16"
              fill="rgba(12,14,18,0.88)"
              stroke="rgba(255,255,255,0.28)"
              strokeWidth="2"
            />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="17"
              fontFamily="JetBrains Mono, monospace"
              fontWeight="700"
              fill="rgba(255,255,255,0.85)"
            >
              {c.number}
              {c.letter}
            </text>
          </g>
        ))}

        {/* Live replay driver markers */}
        {driverMarkers.map((m) => (
          <g key={m.code} transform={`translate(${m.x}, ${m.y})`}>
            <circle r="24" fill={m.color} fillOpacity="0.24" />
            <circle r="13" fill={m.color} stroke="#0b0d11" strokeWidth="3.5" />
            <g transform="translate(18, -22)">
              <rect
                x="0"
                y="0"
                width="74"
                height="28"
                rx="8"
                fill="rgba(12,14,18,0.92)"
                stroke={m.color}
                strokeWidth="2"
              />
              <text
                x="37"
                y="18"
                textAnchor="middle"
                fontSize="17"
                fontFamily="JetBrains Mono, monospace"
                fontWeight="800"
                fill="#ffffff"
              >
                {m.code}
              </text>
            </g>
          </g>
        ))}
      </svg>
    );
  }

  if (fallbackCircuitKey) {
    return <CircuitOutline circuit={fallbackCircuitKey} className={className} />;
  }

  return (
    <div className={`flex flex-col items-center justify-center gap-2 p-6 text-center ${className}`}>
      <Compass className="w-8 h-8 text-muted-foreground/30" />
      <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
        Circuit geometry unavailable
      </p>
      <p className="text-xs text-muted-foreground/80 max-w-xs">
        FastF1 positional coordinates have not been published for this session yet.
      </p>
    </div>
  );
}
