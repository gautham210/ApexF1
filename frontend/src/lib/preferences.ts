// Lightweight personal preferences (client-side only, no fake backend)
import { useEffect, useState, useCallback } from "react";

export type TeamKey =
  | "red-bull"
  | "mclaren"
  | "ferrari"
  | "mercedes"
  | "aston-martin"
  | "alpine"
  | "williams"
  | "rb"
  | "sauber"
  | "haas";

export interface TeamMeta {
  key: TeamKey;
  name: string;
  accent: string; // oklch micro-accent
  warmth: "warm" | "cool" | "neutral";
}

export const TEAMS: Record<TeamKey, TeamMeta> = {
  "red-bull": {
    key: "red-bull",
    name: "Red Bull Racing",
    accent: "oklch(0.55 0.18 250)",
    warmth: "cool",
  },
  mclaren: { key: "mclaren", name: "McLaren", accent: "oklch(0.78 0.16 50)", warmth: "warm" },
  ferrari: { key: "ferrari", name: "Ferrari", accent: "oklch(0.62 0.20 25)", warmth: "warm" },
  mercedes: { key: "mercedes", name: "Mercedes", accent: "oklch(0.78 0.06 195)", warmth: "cool" },
  "aston-martin": {
    key: "aston-martin",
    name: "Aston Martin",
    accent: "oklch(0.55 0.09 175)",
    warmth: "cool",
  },
  alpine: { key: "alpine", name: "Alpine", accent: "oklch(0.62 0.14 240)", warmth: "cool" },
  williams: { key: "williams", name: "Williams", accent: "oklch(0.66 0.13 230)", warmth: "cool" },
  rb: { key: "rb", name: "Visa RB", accent: "oklch(0.55 0.13 255)", warmth: "cool" },
  sauber: { key: "sauber", name: "Sauber", accent: "oklch(0.68 0.20 145)", warmth: "neutral" },
  haas: { key: "haas", name: "Haas", accent: "oklch(0.85 0.005 250)", warmth: "neutral" },
};

export interface Preferences {
  driver?: string;
  team?: TeamKey;
  circuit?: string;
  notifications: {
    qualifying: boolean;
    formationLap: boolean;
    weather: boolean;
    replay: boolean;
  };
  onboarded: boolean;
}

const KEY = "apexf1.prefs.v1";
const DEFAULTS: Preferences = {
  notifications: { qualifying: true, formationLap: true, weather: true, replay: false },
  onboarded: false,
};

function read(): Preferences {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const saved = JSON.parse(raw);
    return {
      ...DEFAULTS,
      ...saved,
      team: saved.team in TEAMS ? saved.team : undefined,
      notifications: { ...DEFAULTS.notifications, ...saved.notifications },
    };
  } catch {
    return DEFAULTS;
  }
}

const listeners = new Set<() => void>();

export function usePreferences() {
  const [prefs, setPrefs] = useState<Preferences>(read);

  useEffect(() => {
    setPrefs(read());
    const handler = () => setPrefs(read());
    listeners.add(handler);
    window.addEventListener("storage", handler);
    return () => {
      listeners.delete(handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const update = useCallback((patch: Partial<Preferences>) => {
    const next = { ...read(), ...patch };
    localStorage.setItem(KEY, JSON.stringify(next));
    setPrefs(next);
    listeners.forEach((l) => l());
  }, []);

  return [prefs, update] as const;
}

export function teamAccent(key?: TeamKey): string {
  if (!key) return "oklch(0.82 0.13 75)";
  return TEAMS[key]?.accent ?? "oklch(0.82 0.13 75)";
}
