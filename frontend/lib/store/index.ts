import { create } from "zustand";
import { persist } from "zustand/middleware";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Driver {
  driver_number: string;
  full_name: string;
  abbreviation: string;
  team_name: string;
  team_color: string;
  nationality: string;
  points?: number;
  position?: number;
}

export interface LeaderboardEntry {
  position: number;
  driver_number: string;
  driver_name: string;
  abbreviation: string;
  team: string;
  team_color: string;
  gap_to_leader?: string;
  interval?: string;
  last_lap?: string;
  best_lap?: string;
  current_tyre?: string;
  tyre_age?: number;
  pits?: number;
  status?: string;
  speed?: number;
}

export interface SessionInfo {
  year: number;
  round_number: number;
  country: string;
  circuit: string;
  session_name: string;
  session_type: string;
  date?: string;
  status?: string;
  is_live: boolean;
}

export interface StandingsEntry {
  position: number;
  name: string;
  points: number;
  wins?: number;
  team?: string;
  nationality?: string;
  color?: string;
}

export interface WeatherData {
  air_temp?: number;
  track_temp?: number;
  humidity?: number;
  pressure?: number;
  wind_speed?: number;
  wind_direction?: number;
  rainfall?: boolean;
}

export interface TelemetryPoint {
  time: number;
  speed?: number;
  rpm?: number;
  throttle?: number;
  brake?: number;
  gear?: number;
  drs?: number;
  distance?: number;
  x?: number;
  y?: number;
  z?: number;
}

export interface ScheduleEvent {
  round_number: number;
  country: string;
  location: string;
  event_name: string;
  event_date?: string;
  session5?: string;
  session5_date?: string;
  is_completed: boolean;
  is_upcoming: boolean;
}

export const DRIVER_DATABASE: Record<string, { abbr: string; team: string; color: string; name: string }> = {
  "1": { abbr: "VER", team: "Red Bull Racing", color: "#3671C6", name: "Max Verstappen" },
  "4": { abbr: "NOR", team: "McLaren", color: "#FF8000", name: "Lando Norris" },
  "16": { abbr: "LEC", team: "Ferrari", color: "#E8002D", name: "Charles Leclerc" },
  "44": { abbr: "HAM", team: "Ferrari", color: "#E8002D", name: "Lewis Hamilton" },
  "81": { abbr: "PIA", team: "McLaren", color: "#FF8000", name: "Oscar Piastri" },
  "63": { abbr: "RUS", team: "Mercedes", color: "#27F4D2", name: "George Russell" },
  "12": { abbr: "ANT", team: "Mercedes", color: "#27F4D2", name: "Kimi Antonelli" },
  "55": { abbr: "SAI", team: "Williams", color: "#64C4FF", name: "Carlos Sainz" },
  "14": { abbr: "ALO", team: "Aston Martin", color: "#229971", name: "Fernando Alonso" },
  "18": { abbr: "STR", team: "Aston Martin", color: "#229971", name: "Lance Stroll" },
  "11": { abbr: "PER", team: "Red Bull Racing", color: "#3671C6", name: "Sergio Perez" },
  "10": { abbr: "GAS", team: "Alpine", color: "#FF87BC", name: "Pierre Gasly" },
  "7": { abbr: "DOO", team: "Alpine", color: "#FF87BC", name: "Jack Doohan" },
  "23": { abbr: "ALB", team: "Williams", color: "#64C4FF", name: "Alexander Albon" },
  "22": { abbr: "TSU", team: "RB", color: "#6692FF", name: "Yuki Tsunoda" },
  "30": { abbr: "LAW", team: "RB", color: "#6692FF", name: "Liam Lawson" },
  "27": { abbr: "HUL", team: "Kick Sauber", color: "#52E252", name: "Nico Hulkenberg" },
  "5": { abbr: "BOR", team: "Kick Sauber", color: "#52E252", name: "Gabriel Bortoleto" },
  "31": { abbr: "OCO", team: "Haas F1 Team", color: "#B6BABD", name: "Esteban Ocon" },
  "87": { abbr: "BEA", team: "Haas F1 Team", color: "#B6BABD", name: "Oliver Bearman" },
  "33": { abbr: "VER", team: "Red Bull Racing", color: "#3671C6", name: "Max Verstappen" }, // Fallback for historical
};

interface SettingsState {
  commandPaletteOpen: boolean;
  notificationsEnabled: boolean;
  selectedYear: number;
  selectedRound: number;
  selectedRace: ScheduleEvent | null;
  activeRace: ScheduleEvent | null;
  selectedSession: string;
  selectedLap: number | "all";
  selectedDrivers: string[];
  globalContextSynced: boolean;
  setCommandPalette: (open: boolean) => void;
  setSelectedYear: (y: number) => void;
  setSelectedRound: (r: number) => void;
  setSelectedRace: (r: ScheduleEvent | null) => void;
  setActiveRace: (r: ScheduleEvent | null) => void;
  setSelectedSession: (s: string) => void;
  setSelectedLap: (l: number | "all") => void;
  setSelectedDrivers: (d: string[]) => void;
  syncGlobalContext: (schedule: ScheduleEvent[]) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      commandPaletteOpen: false,
      notificationsEnabled: true,
      selectedYear: new Date().getFullYear(),
      selectedRound: 1,
      selectedRace: null,
      activeRace: null,
      selectedSession: "Race",
      selectedLap: "all",
      selectedDrivers: ["1", "16"],
      globalContextSynced: false,
      setCommandPalette: (open) => set({ commandPaletteOpen: open }),
      setSelectedYear: (y) => set({ selectedYear: y }),
      setSelectedRound: (r) => set({ selectedRound: r }),
      setSelectedRace: (r) => set({ selectedRace: r }),
      setActiveRace: (r) => set({ activeRace: r }),
      setSelectedSession: (s) => set({ selectedSession: s }),
      setSelectedLap: (l) => set({ selectedLap: l }),
      setSelectedDrivers: (d) => set({ selectedDrivers: d }),
      syncGlobalContext: (schedule: ScheduleEvent[]) => {
        const state = get();
        if (schedule.length === 0) return;
        
        // Find the current active or next upcoming race
        const nextRace = schedule.find((e) => e.is_upcoming);
        const lastCompleted = [...schedule].reverse().find((e) => e.is_completed);
        const currentActive = nextRace || lastCompleted || schedule[0];
        
        // Set everything to match this unified context exactly
        set({
          activeRace: currentActive,
          selectedRound: currentActive.round_number,
          selectedRace: currentActive,
          globalContextSynced: true
        });
      }
    }),
    { name: "apex-settings" }
  )
);

// ─── Live Timing Store ────────────────────────────────────────────────────────

interface LiveStore {
  leaderboard: LeaderboardEntry[];
  session: SessionInfo | null;
  weather: WeatherData | null;
  isConnected: boolean;
  lastUpdate: string | null;
  setLeaderboard: (l: LeaderboardEntry[]) => void;
  setSession: (s: SessionInfo | null) => void;
  setWeather: (w: WeatherData | null) => void;
  setConnected: (c: boolean) => void;
  replayMode: boolean;
  setReplayMode: (r: boolean) => void;
  applyLiveUpdate: (payload: { leaderboard?: LeaderboardEntry[]; session?: SessionInfo; weather?: WeatherData; timestamp?: string }) => void;
}

export const useLiveStore = create<LiveStore>((set) => ({
  leaderboard: [],
  session: null,
  weather: null,
  isConnected: false,
  lastUpdate: null,
  replayMode: false,
  setLeaderboard: (l) => set({ leaderboard: l }),
  setSession: (s) => set({ session: s }),
  setWeather: (w) => set({ weather: w }),
  setConnected: (c) => set({ isConnected: c }),
  setReplayMode: (r) => set({ replayMode: r }),
  applyLiveUpdate: (payload) =>
    set({
      leaderboard: payload.leaderboard ?? [],
      session: payload.session ?? null,
      weather: payload.weather ?? null,
      lastUpdate: payload.timestamp ?? new Date().toISOString(),
    }),
}));

// ─── Telemetry Store ──────────────────────────────────────────────────────────

interface TelemetryStore {
  driver1: string;
  driver2: string;
  driver1Data: TelemetryPoint[];
  driver2Data: TelemetryPoint[];
  scrubberPosition: number;
  isPlaying: boolean;
  setDriver1: (d: string) => void;
  setDriver2: (d: string) => void;
  setDriver1Data: (d: TelemetryPoint[]) => void;
  setDriver2Data: (d: TelemetryPoint[]) => void;
  setScrubberPosition: (p: number) => void;
  setIsPlaying: (p: boolean) => void;
}

export const useTelemetryStore = create<TelemetryStore>((set) => ({
  driver1: "1",
  driver2: "16",
  driver1Data: [],
  driver2Data: [],
  scrubberPosition: 0,
  isPlaying: false,
  setDriver1: (d) => set({ driver1: d }),
  setDriver2: (d) => set({ driver2: d }),
  setDriver1Data: (d) => set({ driver1Data: d }),
  setDriver2Data: (d) => set({ driver2Data: d }),
  setScrubberPosition: (p) => set({ scrubberPosition: p }),
  setIsPlaying: (p) => set({ isPlaying: p }),
}));

// ─── Standings Store ──────────────────────────────────────────────────────────

interface StandingsStore {
  drivers: StandingsEntry[];
  constructors: StandingsEntry[];
  engines: StandingsEntry[];
  setDrivers: (d: StandingsEntry[]) => void;
  setConstructors: (c: StandingsEntry[]) => void;
  setEngines: (e: StandingsEntry[]) => void;
}

export const useStandingsStore = create<StandingsStore>((set) => ({
  drivers: [],
  constructors: [],
  engines: [],
  setDrivers: (d) => set({ drivers: d }),
  setConstructors: (c) => set({ constructors: c }),
  setEngines: (e) => set({ engines: e }),
}));
