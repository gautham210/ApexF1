import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Compass,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Tag,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { getReplayMetadata, getReplayPositions, type ReplayMetadata } from "@/lib/api/telemetry";
import { formatLapDuration, formatReplayClock } from "@/lib/replay-helpers";
import {
  clampViewport,
  computeDriverStatesAt,
  DEFAULT_VIEWPORT,
  getWindowBoundsForTime,
  mergeChunkIntoMap,
  REPLAY_SPEEDS,
  sampleDriverPositionsAt,
  viewportToViewBox,
  type ReplaySpeed,
  type TrackViewport,
} from "@/lib/replay-engine";

interface TrackReplayEngineProps {
  year: number;
  round: number;
  session: string;
  trackLabel?: string;
  eventName?: string;
}

export function TrackReplayEngine({
  year,
  round,
  session,
  trackLabel,
  eventName,
}: TrackReplayEngineProps) {
  const {
    data: meta,
    isLoading: metaLoading,
    isError: metaError,
  } = useQuery<ReplayMetadata | null>({
    queryKey: ["replay-meta", year, round, session],
    queryFn: () => getReplayMetadata(year, round, session),
    staleTime: (q) => (q.state.data?.replay_available ? 10 * 60_000 : 15_000),
    retry: 1,
  });

  const [cursor, setCursor] = useState<number>(0);
  const [playing, setPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<ReplaySpeed>(5);
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [hoveredDriver, setHoveredDriver] = useState<string | null>(null);
  const [showAllLabels, setShowAllLabels] = useState<boolean>(false);
  const [viewport, setViewport] = useState<TrackViewport>(DEFAULT_VIEWPORT);
  const [buffering, setBuffering] = useState<boolean>(false);
  const [frameTick, setFrameTick] = useState<number>(0);

  const framesMapRef = useRef<Map<number, Record<string, [number, number]>>>(new Map());
  const fetchedWindowsRef = useRef<Set<string>>(new Set());
  const inflightWindowsRef = useRef<Set<string>>(new Set());
  const cursorRef = useRef<number>(0);
  const dragStateRef = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    origPanX: number;
    origPanY: number;
  }>({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    origPanX: 0,
    origPanY: 0,
  });
  const svgRef = useRef<SVGSVGElement | null>(null);

  const sessionKeyId = `${year}-${round}-${session}-${meta?.session_key ?? "none"}`;

  // Reset buffers when session changes
  useEffect(() => {
    framesMapRef.current.clear();
    fetchedWindowsRef.current.clear();
    inflightWindowsRef.current.clear();
    setPlaying(false);
    setViewport(DEFAULT_VIEWPORT);
    setHoveredDriver(null);
    const startOffset = meta?.replay_available ? (meta.race_start_offset ?? 0) : 0;
    cursorRef.current = startOffset;
    setCursor(startOffset);
    setSelectedDriver(meta?.drivers?.[0]?.number ?? null);
    setFrameTick((v) => v + 1);
  }, [sessionKeyId, meta?.replay_available, meta?.race_start_offset, meta?.drivers]);

  const chunkDuration = meta?.chunk_seconds ?? 300;
  const totalDuration = meta?.duration_seconds ?? 0;

  const ensureWindow = useCallback(
    async (startS: number, endS: number, showIndicator: boolean) => {
      if (!meta?.replay_available || endS <= startS) return;
      const winKey = `${meta.session_key ?? sessionKeyId}:${startS}:${endS}`;
      if (fetchedWindowsRef.current.has(winKey) || inflightWindowsRef.current.has(winKey)) {
        return;
      }
      inflightWindowsRef.current.add(winKey);
      if (showIndicator) setBuffering(true);
      try {
        const chunk = await getReplayPositions(year, round, session, startS, endS);
        if (chunk?.frames?.length) {
          mergeChunkIntoMap(framesMapRef.current, chunk.frames);
          fetchedWindowsRef.current.add(winKey);
          setFrameTick((v) => v + 1);
        }
      } finally {
        inflightWindowsRef.current.delete(winKey);
        if (inflightWindowsRef.current.size === 0) {
          setBuffering(false);
        }
      }
    },
    [meta?.replay_available, meta?.session_key, round, session, sessionKeyId, year],
  );

  // Fetch active window + lookahead window whenever cursor enters a new chunk
  useEffect(() => {
    if (!meta?.replay_available || totalDuration <= 0) return;
    const { startS, endS } = getWindowBoundsForTime(cursor, totalDuration, chunkDuration);
    const hasCurrentFrame = framesMapRef.current.has(Math.floor(cursor));
    void ensureWindow(startS, endS, !hasCurrentFrame);

    // Prefetch next chunk smoothly when within 60s of current window boundary
    if (endS < totalDuration && cursor >= endS - 60) {
      const nextEnd = Math.min(totalDuration, endS + chunkDuration);
      void ensureWindow(endS, nextEnd, false);
    }
  }, [cursor, chunkDuration, ensureWindow, meta?.replay_available, totalDuration]);

  // Keep cursorRef synced
  useEffect(() => {
    cursorRef.current = cursor;
  }, [cursor]);

  // 60fps animation clock when playing
  useEffect(() => {
    if (!playing || !meta?.replay_available || totalDuration <= 0) return;
    let rafId = 0;
    let lastTs = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.1, (now - lastTs) / 1000);
      lastTs = now;
      const nextT = cursorRef.current + dt * speed;
      if (nextT >= totalDuration) {
        cursorRef.current = totalDuration;
        setCursor(totalDuration);
        setPlaying(false);
        return;
      }
      cursorRef.current = nextT;
      setCursor(nextT);
      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [playing, speed, totalDuration, meta?.replay_available]);

  const coordsByDriver = useMemo(() => {
    void frameTick;
    if (!meta?.replay_available) return {};
    return sampleDriverPositionsAt(framesMapRef.current, cursor);
  }, [cursor, frameTick, meta?.replay_available]);

  const { currentLap, states: driverStates } = useMemo(() => {
    if (!meta?.replay_available) return { currentLap: 0, states: [] };
    return computeDriverStatesAt(meta, cursor, coordsByDriver);
  }, [meta, cursor, coordsByDriver]);

  const selectedState = useMemo(() => {
    if (!driverStates.length) return null;
    return driverStates.find((s) => s.driver.number === selectedDriver) ?? driverStates[0];
  }, [driverStates, selectedDriver]);

  const polylinePoints = useMemo(() => {
    const pts = meta?.circuit?.points;
    if (!pts?.length) return "";
    return pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  }, [meta?.circuit?.points]);

  const startFinishLine = useMemo(() => {
    const sf = meta?.circuit?.start_finish;
    if (!sf) return null;
    // Perpendicular vector to track direction tangent
    const nx = -sf.dy;
    const ny = sf.dx;
    const halfLen = 24;
    return {
      cx: sf.x,
      cy: sf.y,
      x1: sf.x - nx * halfLen,
      y1: sf.y - ny * halfLen,
      x2: sf.x + nx * halfLen,
      y2: sf.y + ny * halfLen,
    };
  }, [meta?.circuit?.start_finish]);

  const handleRestart = () => {
    const startT = meta?.race_start_offset ?? 0;
    cursorRef.current = startT;
    setCursor(startT);
  };

  const handleSeek = (nextT: number) => {
    const clamped = Math.max(0, Math.min(totalDuration, nextT));
    cursorRef.current = clamped;
    setCursor(clamped);
  };

  const handleZoom = (delta: number) => {
    setViewport((prev) => clampViewport({ ...prev, zoom: prev.zoom * (delta > 0 ? 1.28 : 0.78) }));
  };

  const handleWheel: React.WheelEventHandler<SVGSVGElement> = (e) => {
    if (viewport.zoom <= 1 && e.deltaY > 0) return;
    e.preventDefault();
    handleZoom(e.deltaY < 0 ? 1 : -1);
  };

  const handlePointerDown: React.PointerEventHandler<SVGSVGElement> = (e) => {
    if (viewport.zoom <= 1) return;
    dragStateRef.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      origPanX: viewport.panX,
      origPanY: viewport.panY,
    };
  };

  const handlePointerMove: React.PointerEventHandler<SVGSVGElement> = (e) => {
    if (!dragStateRef.current.active || !svgRef.current) return;
    const dxPx = e.clientX - dragStateRef.current.startX;
    const dyPx = e.clientY - dragStateRef.current.startY;
    if (Math.hypot(dxPx, dyPx) > 4) {
      dragStateRef.current.moved = true;
    }
    const rect = svgRef.current.getBoundingClientRect();
    const span = 1000 / viewport.zoom;
    const scaleX = span / Math.max(1, rect.width);
    const scaleY = span / Math.max(1, rect.height);
    setViewport((prev) =>
      clampViewport({
        zoom: prev.zoom,
        panX: dragStateRef.current.origPanX - dxPx * scaleX,
        panY: dragStateRef.current.origPanY - dyPx * scaleY,
      }),
    );
  };

  const handlePointerUp = () => {
    dragStateRef.current.active = false;
  };

  if (metaLoading) {
    return (
      <div className="apex-card p-6 sm:p-8 flex flex-col items-center justify-center min-h-[380px] gap-4">
        <div className="h-10 w-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        <div className="text-center space-y-1">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Loading Track Replay Engine
          </p>
          <p className="text-sm text-muted-foreground">
            Resolving circuit geometry and recorded car positions…
          </p>
        </div>
      </div>
    );
  }

  if (metaError || !meta || !meta.replay_available || !polylinePoints) {
    return (
      <div className="apex-card p-6 sm:p-8 space-y-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center shrink-0">
            <Compass className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-1.5 min-w-0">
            <span className="apex-eyebrow">Track Replay Unavailable</span>
            <h3 className="text-lg font-display text-foreground">
              {eventName ? `${eventName} — ${session}` : `${session} Track Replay`}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
              {meta?.reason ??
                "Multi-car positional track replay data is not available for this session. Recorded classification and lap results remain available below when published."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const activeCarsCount = driverStates.filter((d) => d.coords !== null).length;
  const viewBox = viewportToViewBox(viewport);
  const progressPct =
    totalDuration > 0 ? Math.min(100, Math.max(0, (cursor / totalDuration) * 100)) : 0;
  const lightsOutPct =
    totalDuration > 0 && meta.race_start_offset
      ? Math.min(100, Math.max(0, (meta.race_start_offset / totalDuration) * 100))
      : null;

  return (
    <section
      aria-label="Interactive visual track replay"
      className="apex-card-strong overflow-hidden"
    >
      {/* Top status bar */}
      <div className="px-4 sm:px-6 py-4 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-3 bg-white/[0.015]">
        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="apex-eyebrow text-primary">Visual Track Replay</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] border border-white/10 px-2.5 py-0.5 text-[11px] font-mono text-muted-foreground">
              {meta.source} Positional Feed
            </span>
            {buffering && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-[11px] font-mono text-amber-200">
                Buffering track window…
              </span>
            )}
          </div>
          <div className="text-sm sm:text-base font-medium text-foreground truncate">
            {trackLabel || meta.circuit?.circuit_name || eventName || `Round ${round}`} ·{" "}
            {meta.session}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 font-mono text-xs">
          <div className="rounded-lg bg-white/[0.04] border border-white/10 px-3 py-1.5">
            <span className="text-muted-foreground mr-2">LAP</span>
            <span className="font-semibold text-foreground">
              {currentLap || "—"}
              {meta.total_laps > 0 ? ` / ${meta.total_laps}` : ""}
            </span>
          </div>
          <div className="rounded-lg bg-white/[0.04] border border-white/10 px-3 py-1.5">
            <span className="text-muted-foreground mr-2">TIME</span>
            <span className="font-semibold text-foreground">{formatReplayClock(cursor)}</span>
          </div>
          <div className="rounded-lg bg-white/[0.04] border border-white/10 px-3 py-1.5 hidden sm:block">
            <span className="text-muted-foreground mr-2">CARS</span>
            <span className="font-semibold text-foreground">
              {activeCarsCount} / {meta.drivers.length}
            </span>
          </div>
        </div>
      </div>

      {/* Main split workspace: Circuit Canvas + Synchronized Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Track Canvas */}
        <div className="lg:col-span-8 relative bg-[#080a0f] border-b lg:border-b-0 lg:border-r border-white/[0.08] flex flex-col">
          {/* Canvas toolbar */}
          <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
            <div className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-[#0b0e14]/85 backdrop-blur-md border border-white/12 px-2 py-1">
              <button
                type="button"
                onClick={() => handleZoom(1)}
                title="Zoom in"
                aria-label="Zoom in"
                className="p-1.5 rounded-full hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleZoom(-1)}
                title="Zoom out"
                aria-label="Zoom out"
                className="p-1.5 rounded-full hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewport(DEFAULT_VIEWPORT)}
                title="Fit to track"
                aria-label="Fit to track"
                className="px-2 py-1 rounded-full hover:bg-white/10 text-[11px] font-mono text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                <Maximize2 className="h-3 w-3" />
                <span>Fit</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowAllLabels((v) => !v)}
              aria-pressed={showAllLabels}
              className={`pointer-events-auto inline-flex items-center gap-1.5 rounded-full backdrop-blur-md border px-3 py-1.5 text-[11px] font-mono transition-colors ${
                showAllLabels
                  ? "bg-foreground text-background border-foreground font-semibold"
                  : "bg-[#0b0e14]/85 border-white/12 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Tag className="h-3 w-3" />
              <span>{showAllLabels ? "Labels: All" : "Labels: Focus"}</span>
            </button>
          </div>

          {/* Interactive SVG */}
          <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] lg:aspect-[16/11] min-h-[300px] sm:min-h-[420px] select-none touch-none overflow-hidden">
            <svg
              ref={svgRef}
              viewBox={viewBox}
              className={`w-full h-full ${viewport.zoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
              role="img"
              aria-label={`Interactive track replay for ${eventName || trackLabel || "circuit"}`}
              onWheel={handleWheel}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            >
              <defs>
                <radialGradient id="track-stage-vignette" cx="50%" cy="50%" r="60%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.03)" />
                  <stop offset="100%" stopColor="rgba(0,0,0,0)" />
                </radialGradient>
              </defs>

              <rect x="0" y="0" width="1000" height="1000" fill="url(#track-stage-vignette)" />

              {/* Circuit surface layers */}
              <polygon
                points={polylinePoints}
                fill="none"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="36"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <polygon
                points={polylinePoints}
                fill="none"
                stroke="#1d2330"
                strokeWidth="22"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <polygon
                points={polylinePoints}
                fill="none"
                stroke="rgba(255,255,255,0.18)"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />

              {/* Verified Sector markers */}
              {(meta.circuit?.sectors ?? []).map((sec) => (
                <g key={sec.label} transform={`translate(${sec.x}, ${sec.y})`}>
                  <circle r="7" fill="#090b0e" stroke="#f59e0b" strokeWidth="2.5" />
                  <text
                    x="12"
                    y="4"
                    fontSize="19"
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight="700"
                    fill="#fbbf24"
                  >
                    {sec.label}
                  </text>
                </g>
              ))}

              {/* Start / Finish gate */}
              {startFinishLine && (
                <g>
                  <line
                    x1={startFinishLine.x1}
                    y1={startFinishLine.y1}
                    x2={startFinishLine.x2}
                    y2={startFinishLine.y2}
                    stroke="#10b981"
                    strokeWidth="6"
                    strokeLinecap="round"
                  />
                  <line
                    x1={startFinishLine.x1}
                    y1={startFinishLine.y1}
                    x2={startFinishLine.x2}
                    y2={startFinishLine.y2}
                    stroke="#ffffff"
                    strokeWidth="2"
                    strokeDasharray="5 5"
                  />
                  <text
                    x={startFinishLine.cx + 16}
                    y={startFinishLine.cy - 14}
                    fontSize="20"
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight="700"
                    fill="#34d399"
                  >
                    S/F
                  </text>
                </g>
              )}

              {/* Driver car markers — render selected driver last so it sits visually on top */}
              {[...driverStates]
                .sort((a, b) => {
                  const aSel = a.driver.number === selectedDriver ? 1 : 0;
                  const bSel = b.driver.number === selectedDriver ? 1 : 0;
                  return aSel - bSel;
                })
                .map((state) => {
                  if (!state.coords) return null;
                  const isSel = state.driver.number === selectedState?.driver.number;
                  const isHovered = state.driver.number === hoveredDriver;
                  const showBadge = isSel || isHovered || showAllLabels;
                  const markerR = isSel ? 15.5 : 11.5;

                  return (
                    <g
                      key={state.driver.number}
                      role="button"
                      tabIndex={0}
                      data-driver-marker={state.driver.abbr}
                      aria-label={`${state.driver.abbr} · ${state.driver.full_name}`}
                      transform={`translate(${state.coords.x.toFixed(2)}, ${state.coords.y.toFixed(2)})`}
                      className="cursor-pointer outline-none"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!dragStateRef.current.moved) {
                          setSelectedDriver(state.driver.number);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedDriver(state.driver.number);
                        }
                      }}
                      onPointerEnter={() => setHoveredDriver(state.driver.number)}
                      onPointerLeave={() => setHoveredDriver(null)}
                    >
                      {isSel && (
                        <circle
                          r={markerR + 8}
                          fill={state.driver.color}
                          fillOpacity="0.24"
                          stroke={state.driver.color}
                          strokeOpacity="0.85"
                          strokeWidth="2.5"
                        />
                      )}
                      <circle
                        r={markerR}
                        fill={state.driver.color}
                        stroke="#090b0e"
                        strokeWidth={isSel ? "3.5" : "2.5"}
                      />
                      {isSel && <circle r="4" fill="#ffffff" />}
                      {showBadge && (
                        <g transform={`translate(0, ${-(markerR + 18)})`}>
                          <rect
                            x="-27"
                            y="-11"
                            width="54"
                            height="21"
                            rx="5"
                            fill="#090b0e"
                            fillOpacity="0.92"
                            stroke={isSel ? state.driver.color : "rgba(255,255,255,0.28)"}
                            strokeWidth="1.5"
                          />
                          <text
                            x="0"
                            y="3"
                            textAnchor="middle"
                            fontSize="13.5"
                            fontFamily="JetBrains Mono, monospace"
                            fontWeight="700"
                            fill="#f4f4f5"
                          >
                            {state.driver.abbr}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
            </svg>
          </div>

          {/* Transport Controls & Scrubber Bar */}
          <div className="px-4 sm:px-6 py-4 border-t border-white/[0.08] bg-[#0b0e14]/90 space-y-3">
            {/* Scrubber */}
            <div className="relative flex items-center gap-3">
              <span className="font-mono text-[11px] text-muted-foreground w-12 shrink-0">
                {formatReplayClock(cursor)}
              </span>
              <div className="relative flex-1 flex items-center">
                <input
                  type="range"
                  min={0}
                  max={Math.max(1, totalDuration)}
                  step={0.5}
                  value={cursor}
                  aria-label="Replay timeline scrubber"
                  onChange={(e) => handleSeek(Number(e.target.value))}
                  className="w-full accent-primary cursor-pointer h-1.5 rounded-full bg-white/15"
                  style={{
                    background: `linear-gradient(to right, var(--primary) 0%, var(--primary) ${progressPct}%, rgba(255,255,255,0.14) ${progressPct}%, rgba(255,255,255,0.14) 100%)`,
                  }}
                />
                {lightsOutPct !== null && (
                  <span
                    title="Lap 1 start / Lights out"
                    style={{ left: `${lightsOutPct}%` }}
                    className="pointer-events-none absolute -top-2 h-5 w-0.5 bg-emerald-400/75"
                  />
                )}
              </div>
              <span className="font-mono text-[11px] text-muted-foreground w-12 text-right shrink-0">
                {formatReplayClock(totalDuration)}
              </span>
            </div>

            {/* Playback buttons & speed pills */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRestart}
                  title="Restart to Lap 1"
                  aria-label="Restart replay"
                  className="h-9 px-3 rounded-full border border-white/12 bg-white/[0.04] hover:bg-white/[0.09] text-foreground text-xs font-mono inline-flex items-center gap-1.5 transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Restart</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSeek(cursor - 15)}
                  title="Step back 15s"
                  aria-label="Back 15 seconds"
                  className="h-9 w-9 rounded-full border border-white/12 bg-white/[0.04] hover:bg-white/[0.09] text-foreground inline-flex items-center justify-center transition-colors"
                >
                  <SkipBack className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPlaying((p) => !p)}
                  aria-label={playing ? "Pause replay" : "Play replay"}
                  className="h-10 px-5 rounded-full bg-foreground text-background hover:opacity-90 font-semibold text-xs inline-flex items-center gap-2 transition-opacity"
                >
                  {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  <span>{playing ? "Pause" : "Play"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSeek(cursor + 15)}
                  title="Step forward 15s"
                  aria-label="Forward 15 seconds"
                  className="h-9 w-9 rounded-full border border-white/12 bg-white/[0.04] hover:bg-white/[0.09] text-foreground inline-flex items-center justify-center transition-colors"
                >
                  <SkipForward className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-1 rounded-full bg-white/[0.04] border border-white/10 p-1">
                {REPLAY_SPEEDS.map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => setSpeed(spd)}
                    aria-pressed={speed === spd}
                    className={`px-2.5 py-1 rounded-full font-mono text-[11px] transition-colors ${
                      speed === spd
                        ? "bg-primary text-white font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Synchronized Driver Rail & Selected Driver Inspector */}
        <div className="lg:col-span-4 flex flex-col max-h-[680px]">
          {selectedState && (
            <div className="p-4 border-b border-white/[0.08] bg-white/[0.025] space-y-2.5 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="h-3.5 w-3.5 rounded-full shrink-0 border border-white/25"
                    style={{ backgroundColor: selectedState.driver.color }}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">
                      {selectedState.driver.full_name}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {selectedState.driver.team} · #{selectedState.driver.number}
                    </div>
                  </div>
                </div>
                <span className="font-mono text-xs px-2.5 py-1 rounded-full bg-white/[0.07] border border-white/10 text-foreground shrink-0">
                  {selectedState.position ? `P${selectedState.position}` : "—"}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
                <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-2.5 py-1.5">
                  <div className="text-muted-foreground text-[10px]">LAP</div>
                  <div className="text-foreground font-semibold">{selectedState.lap || "—"}</div>
                </div>
                <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-2.5 py-1.5">
                  <div className="text-muted-foreground text-[10px]">LAST LAP</div>
                  <div className="text-foreground font-semibold">
                    {formatLapDuration(selectedState.lastLapDuration)}
                  </div>
                </div>
                <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-2.5 py-1.5">
                  <div className="text-muted-foreground text-[10px]">TRACK</div>
                  <div
                    className={`font-semibold ${
                      selectedState.status === "on-track"
                        ? "text-emerald-400"
                        : selectedState.status === "finished"
                          ? "text-sky-300"
                          : "text-muted-foreground"
                    }`}
                  >
                    {selectedState.status === "on-track"
                      ? "ACTIVE"
                      : selectedState.status === "finished"
                        ? "FIN"
                        : "NO GPS"}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center justify-between text-[11px] font-mono uppercase tracking-[0.16em] text-muted-foreground shrink-0">
            <span>Order ({driverStates.length})</span>
            <span>Lap · Status</span>
          </div>

          <div className="overflow-y-auto divide-y divide-white/[0.05] flex-1">
            {driverStates.map((st) => {
              const isSel = st.driver.number === selectedState?.driver.number;
              return (
                <button
                  key={st.driver.number}
                  type="button"
                  onClick={() => setSelectedDriver(st.driver.number)}
                  onMouseEnter={() => setHoveredDriver(st.driver.number)}
                  onMouseLeave={() => setHoveredDriver(null)}
                  className={`w-full px-4 py-2.5 flex items-center justify-between gap-2 text-left transition-colors ${
                    isSel ? "bg-white/[0.09]" : "hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="font-mono text-xs w-6 text-muted-foreground shrink-0">
                      {st.position ?? "—"}
                    </span>
                    <span
                      className="w-1 h-5 rounded-full shrink-0"
                      style={{ backgroundColor: st.driver.color }}
                    />
                    <span className="font-mono text-xs font-semibold text-foreground shrink-0">
                      {st.driver.abbr}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">{st.driver.team}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                    <span className="text-muted-foreground">L{st.lap || 0}</span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        st.status === "on-track"
                          ? "bg-emerald-400"
                          : st.status === "finished"
                            ? "bg-sky-400"
                            : "bg-zinc-600"
                      }`}
                      title={st.status}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
