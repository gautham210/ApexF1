// Stylized but recognizable circuit outlines (Monaco, Spa, Suzuka, Silverstone, Monza, Marina Bay)
// Hand-tuned SVG paths — not random squiggles.

type CircuitKey = "monaco" | "spa" | "suzuka" | "silverstone" | "monza" | "marina-bay";

const PATHS: Record<CircuitKey, string> = {
  monaco:
    "M40 220 L120 220 Q150 220 160 195 L185 130 Q195 105 220 105 L300 105 Q320 105 325 125 L335 175 Q340 200 360 200 L420 200 Q445 200 450 178 L460 130 Q462 110 445 105 L380 90 Q360 85 358 70 L355 45 Q353 30 335 30 L260 30 Q240 30 232 50 L220 80 Q212 100 190 100 L130 100 Q105 100 90 120 L55 175 Q35 200 40 220 Z",
  spa:
    "M30 180 L80 90 Q95 60 130 65 L200 80 Q230 87 240 115 L260 175 Q270 205 305 205 L380 205 Q420 205 430 175 L445 110 Q450 80 425 70 L340 45 Q310 40 295 65 L260 115 Q245 135 215 130 L150 120 Q120 115 105 140 L60 215 Q40 240 30 180 Z",
  suzuka:
    "M50 130 Q70 60 140 60 L230 60 Q280 60 290 100 L295 145 Q298 175 270 180 L210 188 Q180 192 178 215 L175 240 Q173 255 195 258 L320 270 Q360 274 380 245 L425 175 Q445 140 420 120 L355 80 Q330 70 332 50 Q333 35 355 35 L420 35",
  silverstone:
    "M40 150 L100 90 Q130 65 175 75 L250 95 Q285 105 295 135 L310 185 Q318 215 285 222 L210 235 Q175 240 175 215 L175 195 Q175 175 200 170 L290 155 Q330 148 360 170 L420 215 Q445 235 425 250 L120 250 Q60 250 50 220 L40 150 Z",
  monza:
    "M40 200 L80 80 Q90 50 125 55 L380 90 Q415 95 415 130 L415 195 Q415 220 385 225 L290 230 Q260 232 258 210 L255 175 Q253 155 230 155 L150 155 Q120 155 110 180 L80 230 Q60 245 40 230 L40 200 Z",
  "marina-bay":
    "M40 90 L130 65 Q175 55 195 90 L225 145 Q245 180 285 175 L380 165 Q420 160 425 195 L432 245 Q435 270 405 270 L120 270 Q70 270 60 240 L40 90 Z",
};

interface Props {
  circuit?: CircuitKey;
  className?: string;
  animated?: boolean;
}

export function CircuitOutline({ circuit = "spa", className, animated = false }: Props) {
  const d = PATHS[circuit] ?? PATHS.spa;
  return (
    <svg
      viewBox="0 0 480 300"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="trace" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.82 0.13 75)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="oklch(0.82 0.13 75)" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      {/* Glow */}
      <path
        d={d}
        stroke="oklch(0.82 0.13 75 / 0.15)"
        strokeWidth="14"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Base */}
      <path
        d={d}
        stroke="oklch(0.95 0.005 250 / 0.18)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Trace */}
      <path
        d={d}
        stroke="url(#trace)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={animated ? "8 12" : undefined}
        style={animated ? { animation: "dash 6s linear infinite" } : undefined}
      />
      <style>{`@keyframes dash { to { stroke-dashoffset: -200; } }`}</style>
    </svg>
  );
}

export const circuitKeys: CircuitKey[] = [
  "monaco", "spa", "suzuka", "silverstone", "monza", "marina-bay",
];
