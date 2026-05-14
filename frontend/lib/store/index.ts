import { create } from "zustand";
import { persist } from "zustand/middleware";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Driver {
  driver_number: string; full_name: string; abbreviation: string;
  team_name: string; team_color: string; nationality: string;
  points?: number; position?: number;
}
export interface LeaderboardEntry {
  position: number; driver_number: string; driver_name: string;
  abbreviation: string; team: string; team_color: string;
  gap_to_leader?: string; interval?: string; last_lap?: string; best_lap?: string;
  current_tyre?: string; tyre_age?: number; pits?: number; status?: string; speed?: number;
}
export interface SessionInfo {
  year: number; round_number: number; country: string; circuit: string;
  session_name: string; session_type: string; date?: string; status?: string; is_live: boolean;
}
export interface StandingsEntry {
  position: number; name: string; points: number; wins?: number;
  team?: string; nationality?: string; color?: string;
  breakdown?: { team: string; points: number; pct: number }[];
}
export interface WeatherData {
  air_temp?: number; track_temp?: number; humidity?: number;
  pressure?: number; wind_speed?: number; wind_direction?: number; rainfall?: boolean;
}
export interface TelemetryPoint {
  time: number; speed?: number; rpm?: number; throttle?: number; brake?: number;
  gear?: number; drs?: number; distance?: number; x?: number; y?: number; z?: number;
}
export interface ScheduleEvent {
  round_number: number; country: string; location: string; event_name: string;
  event_date?: string; session1_date?: string; session5?: string; session5_date?: string;
  is_completed: boolean; is_upcoming: boolean;
}

// ─── Driver Database (Year-Aware) ────────────────────────────────────────────

type DriverEntry = { abbr: string; team: string; color: string; name: string };

/** 2026 F1 Grid — Norris champion (#1), Verstappen permanent (#3) */
const DRIVER_DB_2026: Record<string, DriverEntry> = {
  "1":  { abbr: "NOR", team: "McLaren",          color: "#FF8000", name: "Lando Norris" },
  "3":  { abbr: "VER", team: "Red Bull Racing",  color: "#3671C6", name: "Max Verstappen" },
  "5":  { abbr: "BOR", team: "Audi",             color: "#C0C0C0", name: "Gabriel Bortoleto" },
  "7":  { abbr: "DOO", team: "Alpine",            color: "#FF87BC", name: "Jack Doohan" },
  "10": { abbr: "GAS", team: "Alpine",            color: "#FF87BC", name: "Pierre Gasly" },
  "12": { abbr: "ANT", team: "Mercedes",          color: "#27F4D2", name: "Kimi Antonelli" },
  "14": { abbr: "ALO", team: "Aston Martin",      color: "#229971", name: "Fernando Alonso" },
  "16": { abbr: "LEC", team: "Ferrari",           color: "#E8002D", name: "Charles Leclerc" },
  "18": { abbr: "STR", team: "Aston Martin",      color: "#229971", name: "Lance Stroll" },
  "22": { abbr: "TSU", team: "Racing Bulls",      color: "#6692FF", name: "Yuki Tsunoda" },
  "23": { abbr: "ALB", team: "Williams",          color: "#64C4FF", name: "Alexander Albon" },
  "27": { abbr: "HUL", team: "Haas F1 Team",     color: "#B6BABD", name: "Nico Hülkenberg" },
  "30": { abbr: "LAW", team: "Racing Bulls",      color: "#6692FF", name: "Liam Lawson" },
  "31": { abbr: "OCO", team: "Haas F1 Team",     color: "#B6BABD", name: "Esteban Ocon" },
  "44": { abbr: "HAM", team: "Ferrari",           color: "#E8002D", name: "Lewis Hamilton" },
  "55": { abbr: "SAI", team: "Williams",          color: "#64C4FF", name: "Carlos Sainz" },
  "63": { abbr: "RUS", team: "Mercedes",          color: "#27F4D2", name: "George Russell" },
  "81": { abbr: "PIA", team: "McLaren",           color: "#FF8000", name: "Oscar Piastri" },
  "87": { abbr: "BEA", team: "Haas F1 Team",     color: "#B6BABD", name: "Oliver Bearman" },
};

/** 2025 F1 Grid — Verstappen champion (#1) */
const DRIVER_DB_2025: Record<string, DriverEntry> = {
  "1":  { abbr: "VER", team: "Red Bull Racing",  color: "#3671C6", name: "Max Verstappen" },
  "4":  { abbr: "NOR", team: "McLaren",          color: "#FF8000", name: "Lando Norris" },
  "5":  { abbr: "BOR", team: "Kick Sauber",      color: "#52E252", name: "Gabriel Bortoleto" },
  "7":  { abbr: "DOO", team: "Alpine",            color: "#FF87BC", name: "Jack Doohan" },
  "10": { abbr: "GAS", team: "Alpine",            color: "#FF87BC", name: "Pierre Gasly" },
  "11": { abbr: "PER", team: "Red Bull Racing",  color: "#3671C6", name: "Sergio Perez" },
  "12": { abbr: "ANT", team: "Mercedes",          color: "#27F4D2", name: "Kimi Antonelli" },
  "14": { abbr: "ALO", team: "Aston Martin",      color: "#229971", name: "Fernando Alonso" },
  "16": { abbr: "LEC", team: "Ferrari",           color: "#E8002D", name: "Charles Leclerc" },
  "18": { abbr: "STR", team: "Aston Martin",      color: "#229971", name: "Lance Stroll" },
  "22": { abbr: "TSU", team: "RB",               color: "#6692FF", name: "Yuki Tsunoda" },
  "23": { abbr: "ALB", team: "Williams",          color: "#64C4FF", name: "Alexander Albon" },
  "27": { abbr: "HUL", team: "Kick Sauber",      color: "#52E252", name: "Nico Hülkenberg" },
  "30": { abbr: "LAW", team: "RB",               color: "#6692FF", name: "Liam Lawson" },
  "31": { abbr: "OCO", team: "Haas F1 Team",     color: "#B6BABD", name: "Esteban Ocon" },
  "44": { abbr: "HAM", team: "Ferrari",           color: "#E8002D", name: "Lewis Hamilton" },
  "55": { abbr: "SAI", team: "Williams",          color: "#64C4FF", name: "Carlos Sainz" },
  "63": { abbr: "RUS", team: "Mercedes",          color: "#27F4D2", name: "George Russell" },
  "81": { abbr: "PIA", team: "McLaren",           color: "#FF8000", name: "Oscar Piastri" },
  "87": { abbr: "BEA", team: "Haas F1 Team",     color: "#B6BABD", name: "Oliver Bearman" },
};

/** 2024 and earlier — Verstappen champion with #1, historical grid */
const DRIVER_DB_HISTORICAL: Record<string, DriverEntry> = {
  "1":  { abbr: "VER", team: "Red Bull Racing",  color: "#3671C6", name: "Max Verstappen" },
  "4":  { abbr: "NOR", team: "McLaren",          color: "#FF8000", name: "Lando Norris" },
  "11": { abbr: "PER", team: "Red Bull Racing",  color: "#3671C6", name: "Sergio Perez" },
  "14": { abbr: "ALO", team: "Aston Martin",      color: "#229971", name: "Fernando Alonso" },
  "16": { abbr: "LEC", team: "Ferrari",           color: "#E8002D", name: "Charles Leclerc" },
  "18": { abbr: "STR", team: "Aston Martin",      color: "#229971", name: "Lance Stroll" },
  "22": { abbr: "TSU", team: "RB",               color: "#6692FF", name: "Yuki Tsunoda" },
  "23": { abbr: "ALB", team: "Williams",          color: "#64C4FF", name: "Alexander Albon" },
  "27": { abbr: "HUL", team: "Haas F1 Team",     color: "#B6BABD", name: "Nico Hülkenberg" },
  "31": { abbr: "OCO", team: "Alpine",            color: "#FF87BC", name: "Esteban Ocon" },
  "44": { abbr: "HAM", team: "Mercedes",          color: "#27F4D2", name: "Lewis Hamilton" },
  "55": { abbr: "SAI", team: "Ferrari",           color: "#E8002D", name: "Carlos Sainz" },
  "63": { abbr: "RUS", team: "Mercedes",          color: "#27F4D2", name: "George Russell" },
  "81": { abbr: "PIA", team: "McLaren",           color: "#FF8000", name: "Oscar Piastri" },
};

/** Canonical driver lookup — year-aware, never stale */
export function getDriverByYear(year: number, driverNumber: string): DriverEntry {
  const db = year >= 2026 ? DRIVER_DB_2026 : year === 2025 ? DRIVER_DB_2025 : DRIVER_DB_HISTORICAL;
  return db[driverNumber] || { abbr: `#${driverNumber}`, team: "Unknown", color: "#888888", name: `Driver #${driverNumber}` };
}

/** Reverse lookup: full name → driver number for a given year */
export function getDriverNumberByName(year: number, fullName: string): string | null {
  const db = year >= 2026 ? DRIVER_DB_2026 : year === 2025 ? DRIVER_DB_2025 : DRIVER_DB_HISTORICAL;
  const normalised = fullName.toLowerCase().trim();
  for (const [num, d] of Object.entries(db)) {
    if (d.name.toLowerCase() === normalised) return num;
    // Partial match — last name only (Jolpica sometimes returns just surname)
    const lastName = d.name.split(" ").pop()?.toLowerCase();
    if (lastName && normalised.endsWith(lastName)) return num;
  }
  return null;
}

/** Reverse lookup: three-letter abbreviation → driver number */
export function getDriverNumberByAbbr(year: number, abbr: string): string | null {
  const db = year >= 2026 ? DRIVER_DB_2026 : year === 2025 ? DRIVER_DB_2025 : DRIVER_DB_HISTORICAL;
  const upper = abbr.toUpperCase();
  for (const [num, d] of Object.entries(db)) {
    if (d.abbr === upper) return num;
  }
  return null;
}

/** Default export for backward compat and dropdown rendering */
export const DRIVER_DATABASE = DRIVER_DB_2026;


// ─── Settings Store ──────────────────────────────────────────────────────────

interface SettingsState {
  commandPaletteOpen: boolean;
  notificationsEnabled: boolean;
  selectedYear: number;
  selectedRound: number;
  currentRace: ScheduleEvent | null;       // canonical race — replaces activeRace+selectedRace
  selectedSession: string;
  selectedLap: number | "all";
  setCommandPalette: (open: boolean) => void;
  setSelectedYear: (y: number) => void;
  setSelectedRound: (r: number) => void;
  setCurrentRace: (r: ScheduleEvent | null) => void;
  setSelectedSession: (s: string) => void;
  setSelectedLap: (l: number | "all") => void;
  syncGlobalContext: (schedule: ScheduleEvent[]) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      commandPaletteOpen: false,
      notificationsEnabled: true,
      selectedYear: new Date().getFullYear(),
      selectedRound: 1,
      currentRace: null,
      selectedSession: "Race",
      selectedLap: "all",
      setCommandPalette: (open) => set({ commandPaletteOpen: open }),
      setSelectedYear: (y) => set({ selectedYear: y }),
      setSelectedRound: (r) => set({ selectedRound: r }),
      setCurrentRace: (r) => set({ currentRace: r }),
      setSelectedSession: (s) => set({ selectedSession: s }),
      setSelectedLap: (l) => set({ selectedLap: l }),
      syncGlobalContext: (schedule: ScheduleEvent[]) => {
        if (schedule.length === 0) return;
        // CANONICAL RULE: default context = latest COMPLETED race.
        const completed = schedule
          .filter((e) => e.is_completed)
          .sort((a, b) => b.round_number - a.round_number);
        const upcoming = schedule
          .filter((e) => !e.is_completed)
          .sort((a, b) => a.round_number - b.round_number);
        const currentRace = completed[0] || upcoming[0] || schedule[0];
        set({ currentRace, selectedRound: currentRace.round_number });
      },
    }),
    {
      name: "apex-settings-v2",   // bumped version — clears stale v1 localStorage
      partialize: (state) => ({
        selectedYear: state.selectedYear,
        selectedRound: state.selectedRound,
        currentRace: state.currentRace,
        selectedSession: state.selectedSession,
      }),
    }
  )
);

// ─── Live Timing Store ────────────────────────────────────────────────────────

interface LiveStore {
  leaderboard: LeaderboardEntry[];
  session: SessionInfo | null;
  weather: WeatherData | null;
  isConnected: boolean;
  lastUpdate: string | null;
  replayMode: boolean;
  setLeaderboard: (l: LeaderboardEntry[]) => void;
  setSession: (s: SessionInfo | null) => void;
  setWeather: (w: WeatherData | null) => void;
  setConnected: (c: boolean) => void;
  setReplayMode: (r: boolean) => void;
  applyLiveUpdate: (payload: { leaderboard?: LeaderboardEntry[]; session?: SessionInfo; weather?: WeatherData; timestamp?: string }) => void;
}

export const useLiveStore = create<LiveStore>((set) => ({
  leaderboard: [], session: null, weather: null,
  isConnected: false, lastUpdate: null, replayMode: false,
  setLeaderboard: (l) => set({ leaderboard: l }),
  setSession: (s) => set({ session: s }),
  setWeather: (w) => set({ weather: w }),
  setConnected: (c) => set({ isConnected: c }),
  setReplayMode: (r) => set({ replayMode: r }),
  applyLiveUpdate: (payload) => set({
    ...(payload.leaderboard !== undefined && { leaderboard: payload.leaderboard }),
    ...(payload.session     !== undefined && { session: payload.session }),
    ...(payload.weather     !== undefined && { weather: payload.weather }),
    lastUpdate: payload.timestamp ?? new Date().toISOString(),
  }),
}));

// ─── Telemetry Store ──────────────────────────────────────────────────────────

interface TelemetryStore {
  driver1: string; driver2: string;
  driver1Data: TelemetryPoint[]; driver2Data: TelemetryPoint[];
  scrubberPosition: number; isPlaying: boolean;
  setDriver1: (d: string) => void; setDriver2: (d: string) => void;
  setDriver1Data: (d: TelemetryPoint[]) => void; setDriver2Data: (d: TelemetryPoint[]) => void;
  setScrubberPosition: (p: number) => void; setIsPlaying: (p: boolean) => void;
}

export const useTelemetryStore = create<TelemetryStore>((set) => ({
  driver1: "1", driver2: "16",
  driver1Data: [], driver2Data: [],
  scrubberPosition: 0, isPlaying: false,
  setDriver1: (d) => set({ driver1: d }), setDriver2: (d) => set({ driver2: d }),
  setDriver1Data: (d) => set({ driver1Data: d }), setDriver2Data: (d) => set({ driver2Data: d }),
  setScrubberPosition: (p) => set({ scrubberPosition: p }), setIsPlaying: (p) => set({ isPlaying: p }),
}));

// ─── Standings Store ──────────────────────────────────────────────────────────

interface StandingsStore {
  drivers: StandingsEntry[]; constructors: StandingsEntry[]; engines: any[];
  setDrivers: (d: StandingsEntry[]) => void;
  setConstructors: (c: StandingsEntry[]) => void;
  setEngines: (e: any[]) => void;
}

export const useStandingsStore = create<StandingsStore>((set) => ({
  drivers: [], constructors: [], engines: [],
  setDrivers: (d) => set({ drivers: d }),
  setConstructors: (c) => set({ constructors: c }),
  setEngines: (e) => set({ engines: e }),
}));
