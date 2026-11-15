import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ReplayPointMerged } from "@/lib/replay-helpers";

interface TelemetryChartsProps {
  frames: ReplayPointMerged[];
  cursorIndex: number;
  onSelectIndex: (idx: number) => void;
  driver1Label: string;
  driver1Color: string;
  driver2Label?: string;
  driver2Color?: string;
}

const axisStyle = {
  stroke: "rgba(255,255,255,0.28)",
  fontSize: 10,
  fontFamily: "JetBrains Mono, monospace",
};

const tooltipStyle = {
  backgroundColor: "rgba(14,16,22,0.94)",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: "12px",
  fontSize: "11px",
  fontFamily: "JetBrains Mono, monospace",
  color: "#f4f4f6",
};

export default function TelemetryCharts({
  frames,
  cursorIndex,
  onSelectIndex,
  driver1Label,
  driver1Color,
  driver2Label,
  driver2Color = "#06b6d4",
}: TelemetryChartsProps) {
  if (!frames.length) return null;
  const activeFrame = frames[Math.min(frames.length - 1, Math.max(0, cursorIndex))];
  const cursorDistance = activeFrame?.distance;

  const handleChartClick = (state: { activeTooltipIndex?: number | string | null } | null) => {
    const rawIdx = state?.activeTooltipIndex;
    const idx = typeof rawIdx === "number" ? rawIdx : Number(rawIdx);
    if (Number.isInteger(idx) && idx >= 0 && idx < frames.length) {
      onSelectIndex(idx);
    }
  };

  return (
    <div className="space-y-4">
      {/* Speed trace */}
      <div className="rounded-2xl glass p-4 border border-white/10">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
            Speed trace (km/h)
          </span>
          <div className="flex items-center gap-4 text-[11px] font-mono">
            <span className="inline-flex items-center gap-1.5" style={{ color: driver1Color }}>
              <span className="w-2 h-2 rounded-full" style={{ background: driver1Color }} />
              {driver1Label}: {activeFrame?.speedA ?? "—"}
            </span>
            {driver2Label && (
              <span className="inline-flex items-center gap-1.5" style={{ color: driver2Color }}>
                <span className="w-2 h-2 rounded-full" style={{ background: driver2Color }} />
                {driver2Label}: {activeFrame?.speedB ?? "—"}
              </span>
            )}
          </div>
        </div>
        <div className="h-[190px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={frames} onClick={handleChartClick}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="distance"
                tickFormatter={(v) => `${v}m`}
                tick={axisStyle}
                minTickGap={36}
              />
              <YAxis tick={axisStyle} domain={[0, "auto"]} width={38} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => `Distance ${v} m`} />
              {cursorDistance !== undefined && (
                <ReferenceLine x={cursorDistance} stroke="#ffffff" strokeOpacity={0.55} />
              )}
              <Line
                type="monotone"
                dataKey="speedA"
                name={`${driver1Label} Speed`}
                stroke={driver1Color}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              {driver2Label && (
                <Line
                  type="monotone"
                  dataKey="speedB"
                  name={`${driver2Label} Speed`}
                  stroke={driver2Color}
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={false}
                  isAnimationActive={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Throttle & Brake + Gear & RPM */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded-2xl glass p-4 border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
              Throttle &amp; Brake (%)
            </span>
            <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
              THR {activeFrame?.throttleA ?? "—"}% · BRK {activeFrame?.brakeA ?? "—"}%
            </span>
          </div>
          <div className="h-[155px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={frames} onClick={handleChartClick}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="distance"
                  tickFormatter={(v) => `${v}m`}
                  tick={axisStyle}
                  minTickGap={40}
                />
                <YAxis tick={axisStyle} domain={[0, 100]} width={34} />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => `Distance ${v} m`} />
                {cursorDistance !== undefined && (
                  <ReferenceLine x={cursorDistance} stroke="#ffffff" strokeOpacity={0.55} />
                )}
                <Area
                  type="monotone"
                  dataKey="throttleA"
                  name={`${driver1Label} Throttle %`}
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.14}
                  strokeWidth={1.75}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="brakeA"
                  name={`${driver1Label} Brake %`}
                  stroke="#ef4444"
                  fill="#ef4444"
                  fillOpacity={0.18}
                  strokeWidth={1.75}
                  isAnimationActive={false}
                />
                {driver2Label && (
                  <Line
                    type="monotone"
                    dataKey="throttleB"
                    name={`${driver2Label} Throttle %`}
                    stroke={driver2Color}
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    dot={false}
                    isAnimationActive={false}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl glass p-4 border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
              Gear &amp; Engine RPM
            </span>
            <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
              G{activeFrame?.gearA ?? "—"} · {activeFrame?.rpmA?.toLocaleString() ?? "—"} RPM · DRS{" "}
              {activeFrame?.drsA ? "OPEN" : "OFF"}
            </span>
          </div>
          <div className="h-[155px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={frames} onClick={handleChartClick}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="distance"
                  tickFormatter={(v) => `${v}m`}
                  tick={axisStyle}
                  minTickGap={40}
                />
                <YAxis yAxisId="gear" tick={axisStyle} domain={[0, 8]} width={26} />
                <YAxis
                  yAxisId="rpm"
                  orientation="right"
                  tick={axisStyle}
                  domain={[0, 14000]}
                  width={42}
                />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => `Distance ${v} m`} />
                {cursorDistance !== undefined && (
                  <ReferenceLine
                    x={cursorDistance}
                    yAxisId="gear"
                    stroke="#ffffff"
                    strokeOpacity={0.55}
                  />
                )}
                <Line
                  yAxisId="gear"
                  type="stepAfter"
                  dataKey="gearA"
                  name={`${driver1Label} Gear`}
                  stroke={driver1Color}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="rpm"
                  type="monotone"
                  dataKey="rpmA"
                  name={`${driver1Label} RPM`}
                  stroke="#a855f7"
                  strokeOpacity={0.85}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
