import { useEffect } from "react";
import { usePreferences, TEAMS } from "@/lib/preferences";

/**
 * Whole-app ambient backdrop. Adjusts subtle hue based on favorite team warmth.
 * Restrained — never dominant. Sits behind everything as a fixed layer.
 */
export function AmbientBackdrop() {
  const [prefs] = usePreferences();
  const accent = prefs.team ? TEAMS[prefs.team].accent : "oklch(0.28 0.02 70)";
  const warmth = prefs.team ? TEAMS[prefs.team].warmth : "neutral";

  useEffect(() => {
    document.documentElement.style.setProperty("--ambient-accent", accent);
  }, [accent]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10"
      style={{
        backgroundImage:
          warmth === "warm"
            ? `radial-gradient(ellipse 70% 45% at 50% -8%, color-mix(in oklab, ${accent} 10%, transparent), transparent 65%), radial-gradient(ellipse 55% 35% at 85% 95%, oklch(0.25 0.02 260 / 0.35), transparent 70%)`
            : warmth === "cool"
              ? `radial-gradient(ellipse 70% 45% at 50% -8%, color-mix(in oklab, ${accent} 8%, transparent), transparent 65%), radial-gradient(ellipse 55% 35% at 15% 95%, color-mix(in oklab, ${accent} 12%, transparent), transparent 70%)`
              : `radial-gradient(ellipse 70% 45% at 50% -8%, oklch(0.28 0.02 70 / 0.18), transparent 65%), radial-gradient(ellipse 55% 35% at 85% 95%, oklch(0.25 0.02 260 / 0.30), transparent 70%)`,
      }}
    />
  );
}
