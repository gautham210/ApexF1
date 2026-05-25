import { create } from "zustand";
import { persist } from "zustand/middleware";

// ─── Types ───────────────────────────────────────────────────────────────────

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
  breakdown?: { team: string; points: number; pct: number }[];
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
  session1?: string;
  session1_date?: string;
  session2?: string;
  session2_date?: string;
  session3?: string;
  session3_date?: string;
  session4?: string;
  session4_date?: string;
  session5?: string;
  session5_date?: string;
  is_completed: boolean;
  is_upcoming: boolean;
}

// ─── Driver Database (Year-Aware) ────────────────────────────────────────────

type DriverEntry = { abbr: string; team: string; color: string; name: string };

const DRIVER_DB_2026: Record<string, DriverEntry> = {
  "1":  { abbr: "NOR", team: "McLaren",          color: "#FF8000", name: "Lando Norris" },
  "3":  { abbr: "VER", team: "Red Bull Racing",  color: "#3671C6", name: "Max Verstappen" },
  "5":  { abbr: "BOR", team: "Audi",             color: "#C0C0C0", name: "Gabriel Bortoleto" },
  "7":  { abbr: "DOO", team: "Alpine",            color: "#FF87BC", name: "Jack Doohan" },
  "10": { abbr: "GAS", team: "Alpine",            color: "#FF87BC", name: "Pierre Gasly" },
  "11": { abbr: "PER", team: "Red Bull Racing",  color: "#3671C6", name: "Sergio Perez" },
  "12": { abbr: "ANT", team: "Mercedes",          color: "#27F4D2", name: "Kimi Antonelli" },
  "14": { abbr: "ALO", team: "Aston Martin",      color: "#229971", name: "Fernando Alonso" },
  "16": { abbr: "LEC", team: "Ferrari",           color: "#E8002D", name: "Charles Leclerc" },
  "18": { abbr: "STR", team: "Aston Martin",      color: "#229971", name: "Lance Stroll" },
  "22": { abbr: "TSU", team: "Racing Bulls",      color: "#6692FF", name: "Yuki Tsunoda" },
  "23": { abbr: "ALB", team: "Williams",          color: "#64C4FF", name: "Alexander Albon" },
  "27": { abbr: "HUL", team: "Haas F1 Team",     color: "#B6BABD", name: "Nico Hülkenberg" },
  "30": { abbr: "LAW", team: "Racing Bulls",      color: "#6692FF", name: "Liam Lawson" },
  "31": { abbr: "OCO", team: "Haas F1 Team",     color: "#B6BABD", name: "Esteban Ocon" },
  "43": { abbr: "COL", team: "Alpine",            color: "#FF87BC", name: "Franco Colapinto" },
  "44": { abbr: "HAM", team: "Ferrari",           color: "#E8002D", name: "Lewis Hamilton" },
  "55": { abbr: "SAI", team: "Williams",          color: "#64C4FF", name: "Carlos Sainz" },
  "63": { abbr: "RUS", team: "Mercedes",          color: "#27F4D2", name: "George Russell" },
  "77": { abbr: "BOT", team: "Audi",             color: "#C0C0C0", name: "Valtteri Bottas" },
  "81": { abbr: "PIA", team: "McLaren",           color: "#FF8000", name: "Oscar Piastri" },
  "87": { abbr: "BEA", team: "Haas F1 Team",     color: "#B6BABD", name: "Oliver Bearman" },
  "98": { abbr: "HAD", team: "Red Bull Racing",  color: "#3671C6", name: "Isack Hadjar" },
  "99": { abbr: "LIN", team: "Racing Bulls",      color: "#6692FF", name: "Arvid Lindblad" },
};

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
  "43": { abbr: "COL", team: "Williams",          color: "#64C4FF", name: "Franco Colapinto" },
  "44": { abbr: "HAM", team: "Ferrari",           color: "#E8002D", name: "Lewis Hamilton" },
  "55": { abbr: "SAI", team: "Williams",          color: "#64C4FF", name: "Carlos Sainz" },
  "63": { abbr: "RUS", team: "Mercedes",          color: "#27F4D2", name: "George Russell" },
  "77": { abbr: "BOT", team: "Kick Sauber",      color: "#52E252", name: "Valtteri Bottas" },
  "81": { abbr: "PIA", team: "McLaren",           color: "#FF8000", name: "Oscar Piastri" },
  "87": { abbr: "BEA", team: "Haas F1 Team",     color: "#B6BABD", name: "Oliver Bearman" },
  "98": { abbr: "HAD", team: "Red Bull Racing",  color: "#3671C6", name: "Isack Hadjar" },
  "99": { abbr: "LIN", team: "RB",               color: "#6692FF", name: "Arvid Lindblad" },
};

const DRIVER_DB_HISTORICAL: Record<string, DriverEntry> = {
  "1":  { abbr: "VER", team: "Red Bull Racing",  color: "#3671C6", name: "Max Verstappen" },
  "2":  { abbr: "SAR", team: "Williams",          color: "#64C4FF", name: "Logan Sargeant" },
  "3":  { abbr: "RIC", team: "RB",               color: "#6692FF", name: "Daniel Ricciardo" },
  "4":  { abbr: "NOR", team: "McLaren",          color: "#FF8000", name: "Lando Norris" },
  "10": { abbr: "GAS", team: "Alpine",            color: "#FF87BC", name: "Pierre Gasly" },
  "11": { abbr: "PER", team: "Red Bull Racing",  color: "#3671C6", name: "Sergio Perez" },
  "14": { abbr: "ALO", team: "Aston Martin",      color: "#229971", name: "Fernando Alonso" },
  "16": { abbr: "LEC", team: "Ferrari",           color: "#E8002D", name: "Charles Leclerc" },
  "18": { abbr: "STR", team: "Aston Martin",      color: "#229971", name: "Lance Stroll" },
  "20": { abbr: "MAG", team: "Haas F1 Team",     color: "#B6BABD", name: "Kevin Magnussen" },
  "22": { abbr: "TSU", team: "RB",               color: "#6692FF", name: "Yuki Tsunoda" },
  "23": { abbr: "ALB", team: "Williams",          color: "#64C4FF", name: "Alexander Albon" },
  "24": { abbr: "ZHO", team: "Kick Sauber",      color: "#52E252", name: "Zhou Guanyu" },
  "27": { abbr: "HUL", team: "Haas F1 Team",     color: "#B6BABD", name: "Nico Hülkenberg" },
  "31": { abbr: "OCO", team: "Alpine",            color: "#FF87BC", name: "Esteban Ocon" },
  "43": { abbr: "COL", team: "Williams",          color: "#64C4FF", name: "Franco Colapinto" },
  "44": { abbr: "HAM", team: "Mercedes",          color: "#27F4D2", name: "Lewis Hamilton" },
  "55": { abbr: "SAI", team: "Ferrari",           color: "#E8002D", name: "Carlos Sainz" },
  "63": { abbr: "RUS", team: "Mercedes",          color: "#27F4D2", name: "George Russell" },
  "77": { abbr: "BOT", team: "Kick Sauber",      color: "#52E252", name: "Valtteri Bottas" },
  "81": { abbr: "PIA", team: "McLaren",           color: "#FF8000", name: "Oscar Piastri" },
  "87": { abbr: "BEA", team: "Ferrari",           color: "#E8002D", name: "Oliver Bearman" },
};

export interface CanonicalDriver {
  number: string;
  name: string;
  abbr: string;
  team: string;
  color: string;
  nationality: string;
  aliases: string[];
}

export const CANONICAL_DRIVERS: CanonicalDriver[] = [
  { number: "1", name: "Max Verstappen", abbr: "VER", team: "Red Bull Racing", color: "#3671C6", nationality: "Dutch", aliases: ["verstappen", "mverstappen", "maxverstappen"] },
  { number: "3", name: "Max Verstappen", abbr: "VER", team: "Red Bull Racing", color: "#3671C6", nationality: "Dutch", aliases: ["verstappen", "mverstappen", "maxverstappen"] },
  { number: "4", name: "Lando Norris", abbr: "NOR", team: "McLaren", color: "#FF8000", nationality: "British", aliases: ["norris", "lnorris", "landonorris"] },
  { number: "11", name: "Sergio Perez", abbr: "PER", team: "Red Bull Racing", color: "#3671C6", nationality: "Mexican", aliases: ["perez", "sperez", "sergioperez", "pere", "perezs", "perezmendoza", "sergioperezmendoza"] },
  { number: "16", name: "Charles Leclerc", abbr: "LEC", team: "Ferrari", color: "#E8002D", nationality: "Monegasque", aliases: ["leclerc", "cleclerc", "charlesleclerc"] },
  { number: "55", name: "Carlos Sainz", abbr: "SAI", team: "Williams", color: "#64C4FF", nationality: "Spanish", aliases: ["sainz", "csainz", "carlossainz"] },
  { number: "44", name: "Lewis Hamilton", abbr: "HAM", team: "Ferrari", color: "#E8002D", nationality: "British", aliases: ["hamilton", "lhamilton", "lewishamilton"] },
  { number: "63", name: "George Russell", abbr: "RUS", team: "Mercedes", color: "#27F4D2", nationality: "British", aliases: ["russell", "grussell", "georgerussell"] },
  { number: "81", name: "Oscar Piastri", abbr: "PIA", team: "McLaren", color: "#FF8000", nationality: "Australian", aliases: ["piastri", "opiastri", "oscarpiastri"] },
  { number: "14", name: "Fernando Alonso", abbr: "ALO", team: "Aston Martin", color: "#229971", nationality: "Spanish", aliases: ["alonso", "falonso", "fernandoalonso"] },
  { number: "18", name: "Lance Stroll", abbr: "STR", team: "Aston Martin", color: "#229971", nationality: "Canadian", aliases: ["stroll", "lstroll", "lancestroll"] },
  { number: "10", name: "Pierre Gasly", abbr: "GAS", team: "Alpine", color: "#FF87BC", nationality: "French", aliases: ["gasly", "pgasly", "pierregasly"] },
  { number: "31", name: "Esteban Ocon", abbr: "OCO", team: "Haas F1 Team", color: "#B6BABD", nationality: "French", aliases: ["ocon", "eocon", "estebanocon"] },
  { number: "22", name: "Yuki Tsunoda", abbr: "TSU", team: "Racing Bulls", color: "#6692FF", nationality: "Japanese", aliases: ["tsunoda", "ytsunoda", "yukitsunoda"] },
  { number: "23", name: "Alexander Albon", abbr: "ALB", team: "Williams", color: "#64C4FF", nationality: "Thai", aliases: ["albon", "aalbon", "alexanderalbon"] },
  { number: "77", name: "Valtteri Bottas", abbr: "BOT", team: "Audi", color: "#C0C0C0", nationality: "Finnish", aliases: ["bottas", "vbottas", "valtteribottas"] },
  { number: "27", name: "Nico Hulkenberg", abbr: "HUL", team: "Haas F1 Team", color: "#B6BABD", nationality: "German", aliases: ["hulkenberg", "nhulkenberg", "nicohulkenberg", "huelkenberg"] },
  { number: "43", name: "Franco Colapinto", abbr: "COL", team: "Alpine", color: "#FF87BC", nationality: "Argentinian", aliases: ["colapinto", "fcolapinto", "francocolapinto"] },
  { number: "87", name: "Oliver Bearman", abbr: "BEA", team: "Haas F1 Team", color: "#B6BABD", nationality: "British", aliases: ["bearman", "obearman", "oliverbearman"] },
  { number: "12", name: "Kimi Antonelli", abbr: "ANT", team: "Mercedes", color: "#27F4D2", nationality: "Italian", aliases: ["antonelli", "kantonelli", "kimiantonelli", "andreakimiantonelli"] },
  { number: "5", name: "Gabriel Bortoleto", abbr: "BOR", team: "Audi", color: "#C0C0C0", nationality: "Brazilian", aliases: ["bortoleto", "gbortoleto", "gabrielbortoleto"] },
  { number: "7", name: "Jack Doohan", abbr: "DOO", team: "Alpine", color: "#FF87BC", nationality: "Australian", aliases: ["doohan", "jdoohan", "jackdoohan"] },
  { number: "30", name: "Liam Lawson", abbr: "LAW", team: "Racing Bulls", color: "#6692FF", nationality: "New Zealander", aliases: ["lawson", "llawson", "liamlawson"] },
  { number: "20", name: "Kevin Magnussen", abbr: "MAG", team: "Haas F1 Team", color: "#B6BABD", nationality: "Danish", aliases: ["magnussen", "kmagnussen", "kevinmagnussen"] },
  { number: "24", name: "Zhou Guanyu", abbr: "ZHO", team: "Kick Sauber", color: "#52E252", nationality: "Chinese", aliases: ["zhou", "guanyuzhou", "zhouguanyu"] },
  { number: "2", name: "Logan Sargeant", abbr: "SAR", team: "Williams", color: "#64C4FF", nationality: "American", aliases: ["sargeant", "lsargeant", "logansargeant"] },
  { number: "3", name: "Daniel Ricciardo", abbr: "RIC", team: "RB", color: "#6692FF", nationality: "Australian", aliases: ["ricciardo", "dricciardo", "danielricciardo"] }
];

function cleanString(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritic accents
    .replace(/[^a-z0-9]/g, "") // strip spaces
    .trim();
}

export function getDriverByYear(year: number, driverNumber: string): DriverEntry {
  const match = CANONICAL_DRIVERS.find(d => d.number === driverNumber);
  if (match) {
    return {
      abbr: match.abbr,
      team: match.team,
      color: match.color,
      name: match.name
    };
  }

  const db = year >= 2026 ? DRIVER_DB_2026 : year === 2025 ? DRIVER_DB_2025 : DRIVER_DB_HISTORICAL;
  return db[driverNumber] || { abbr: `#${driverNumber}`, team: "Unknown", color: "#888888", name: `Driver #${driverNumber}` };
}

export function getDriverNumberByName(year: number, fullName: string): string | null {
  if (!fullName) return null;
  const target = cleanString(fullName);

  for (const d of CANONICAL_DRIVERS) {
    if (cleanString(d.name) === target) return d.number;
    if (d.aliases.some(alias => cleanString(alias) === target)) return d.number;
  }

  for (const d of CANONICAL_DRIVERS) {
    const lastName = cleanString(d.name.split(" ").pop() || "");
    if (lastName && (target.endsWith(lastName) || target === lastName)) {
      return d.number;
    }
  }

  const db = year >= 2026 ? DRIVER_DB_2026 : year === 2025 ? DRIVER_DB_2025 : DRIVER_DB_HISTORICAL;
  for (const [num, d] of Object.entries(db)) {
    const canonicalName = cleanString(d.name);
    if (canonicalName === target) return num;
    
    const lastName = cleanString(d.name.split(" ").pop() || "");
    if (lastName && (target.endsWith(lastName) || target === lastName)) {
      return num;
    }
  }

  return null;
}

export function getDriverNumberByAbbr(year: number, abbr: string): string | null {
  if (!abbr) return null;
  const upper = cleanString(abbr).toUpperCase();

  const match = CANONICAL_DRIVERS.find(d => d.abbr.toUpperCase() === upper);
  if (match) return match.number;

  const db = year >= 2026 ? DRIVER_DB_2026 : year === 2025 ? DRIVER_DB_2025 : DRIVER_DB_HISTORICAL;
  for (const [num, d] of Object.entries(db)) {
    if (cleanString(d.abbr).toUpperCase() === upper) return num;
  }

  return null;
}

export function getDriversListByYear(year: number): Record<string, DriverEntry> {
  const db = year >= 2026 ? DRIVER_DB_2026 : year === 2025 ? DRIVER_DB_2025 : DRIVER_DB_HISTORICAL;
  if (year >= 2025 && !db["11"]) {
    db["11"] = { abbr: "PER", team: "Red Bull Racing", color: "#3671C6", name: "Sergio Perez" };
  }
  return db;
}
export const DRIVER_DATABASE = DRIVER_DB_2026;

// ─── Settings Store ─────────────────────────────────────────────────────────

interface SettingsState {
  commandPaletteOpen: boolean;
  notificationsEnabled: boolean;
  selectedYear: number;
  selectedRound: number;
  currentRace: ScheduleEvent | null;
  selectedSession: string;
  selectedLap: number | "all";

  currentRound: number;
  raceStatus: string;
  isLiveWeekend: boolean;
  isArchive: boolean;
  activeEvent: ScheduleEvent | null;
  nextEvent: ScheduleEvent | null;
  completedEvent: ScheduleEvent | null;
  timezone: string;

  schedule: ScheduleEvent[];
  scheduleYear: number;
  contextBootstrapped: boolean;

  setCommandPalette: (open: boolean) => void;
  setSelectedYear: (y: number) => void;
  setSelectedRound: (r: number) => void;
  setCurrentRace: (r: ScheduleEvent | null) => void;
  setSelectedSession: (s: string) => void;
  setSelectedLap: (l: number | "all") => void;
  setScheduleCache: (schedule: ScheduleEvent[], year: number) => void;
  bootstrapFromBackend: (sc: any, year: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      commandPaletteOpen: false,
      notificationsEnabled: true,
      selectedYear: new Date().getFullYear(),
      selectedRound: 1,
      currentRace: null,
      selectedSession: "Race",
      selectedLap: "all",
      
      currentRound: 1,
      raceStatus: "GREEN",
      isLiveWeekend: false,
      isArchive: false,
      activeEvent: null,
      nextEvent: null,
      completedEvent: null,
      timezone: "UTC",

      schedule: [],
      scheduleYear: 0,
      contextBootstrapped: false,

      setCommandPalette: (open) => set({ commandPaletteOpen: open }),
      setSelectedYear: (y) => set({
        selectedYear: y,
        contextBootstrapped: false,
        scheduleYear: 0,
        schedule: [],
        currentRace: null,
        activeEvent: null,
        nextEvent: null,
        completedEvent: null,
      }),
      setSelectedRound: (r) => set({ selectedRound: r }),
      setCurrentRace: (r) => set({ currentRace: r }),
      setSelectedSession: (s) => set({ selectedSession: s }),
      setSelectedLap: (l) => set({ selectedLap: l }),

      setScheduleCache: (schedule, year) => {
        const state = get();
        const alreadyBootstrapped = state.contextBootstrapped && state.scheduleYear === year;
        const hasRaceForYear = !!state.currentRace && state.scheduleYear === year;
        const shouldDerive = !alreadyBootstrapped && !hasRaceForYear && schedule.length > 0;

        if (shouldDerive) {
          const completed = schedule
            .filter((e) => e.is_completed)
            .sort((a, b) => b.round_number - a.round_number);
          const upcoming = schedule
            .filter((e) => !e.is_completed)
            .sort((a, b) => a.round_number - b.round_number);
          const derived = completed[0] || upcoming[0] || schedule[0];
          set({
            schedule,
            scheduleYear: year,
            currentRace: derived,
            selectedRound: derived.round_number,
          });
        } else {
          set({ schedule, scheduleYear: year });
        }
      },

      bootstrapFromBackend: (sc, year) => {
        if (!sc) return;
        const compRace = sc.latest_completed_race;
        const nextRace = sc.next_race;
        const activeRace = sc.is_active_weekend ? nextRace : null;
        const round = sc.current_round || 1;

        set({
          selectedRound: round,
          currentRace: activeRace || nextRace || compRace || null,
          currentRound: round,
          isLiveWeekend: sc.is_active_weekend ?? false,
          isArchive: !sc.is_active_weekend,
          activeEvent: activeRace,
          nextEvent: nextRace,
          completedEvent: compRace,
          timezone: "UTC",
          scheduleYear: year,
          contextBootstrapped: true,
        });
      },
    }),
    {
      name: "apex-settings-v4",
      partialize: (state) => ({
        selectedYear: state.selectedYear,
        selectedRound: state.selectedRound,
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
  setLeaderboard: (l: LeaderboardEntry[]) => void;
  setSession: (s: SessionInfo | null) => void;
  setWeather: (w: WeatherData | null) => void;
  setConnected: (c: boolean) => void;
  applyLiveUpdate: (payload: { leaderboard?: LeaderboardEntry[]; session?: SessionInfo; weather?: WeatherData; timestamp?: string }) => void;
}

export const useLiveStore = create<LiveStore>((set) => ({
  leaderboard: [],
  session: null,
  weather: null,
  isConnected: false,
  lastUpdate: null,
  setLeaderboard: (l) => set({ leaderboard: l }),
  setSession: (s) => set({ session: s }),
  setWeather: (w) => set({ weather: w }),
  setConnected: (c) => set({ isConnected: c }),
  applyLiveUpdate: (payload) => set({
    ...(payload.leaderboard !== undefined && { leaderboard: payload.leaderboard }),
    ...(payload.session     !== undefined && { session: payload.session }),
    ...(payload.weather     !== undefined && { weather: payload.weather }),
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
  engines: any[];
  setDrivers: (d: StandingsEntry[]) => void;
  setConstructors: (c: StandingsEntry[]) => void;
  setEngines: (e: any[]) => void;
}

export const useStandingsStore = create<StandingsStore>((set) => ({
  drivers: [],
  constructors: [],
  engines: [],
  setDrivers: (d) => set({ drivers: d }),
  setConstructors: (c) => set({ constructors: c }),
  setEngines: (e) => set({ engines: e }),
}));

// ─── Unified Single Source of Truth Canonical Data Store ──────────────────────

export interface CanonicalStore {
  schedule: ScheduleEvent[];
  standings: StandingsEntry[];
  constructors: StandingsEntry[];
  engines: any[];
  sessionResults: Record<string, LeaderboardEntry[]>;
  telemetryAvailability: Record<string, boolean>;
  loading: boolean;
  error: string | null;
  
  setSchedule: (s: ScheduleEvent[]) => void;
  setStandings: (s: StandingsEntry[]) => void;
  setConstructors: (c: StandingsEntry[]) => void;
  setEngines: (e: any[]) => void;
  setSessionResults: (key: string, results: LeaderboardEntry[]) => void;
  setTelemetryAvailability: (key: string, available: boolean) => void;
  syncCanonicalData: (year: number) => Promise<void>;
}

export const useCanonicalStore = create<CanonicalStore>((set, get) => ({
  schedule: [],
  standings: [],
  constructors: [],
  engines: [],
  sessionResults: {},
  telemetryAvailability: {},
  loading: false,
  error: null,

  setSchedule: (schedule) => set({ schedule }),
  setStandings: (standings) => set({ standings }),
  setConstructors: (constructors) => set({ constructors }),
  setEngines: (engines) => set({ engines }),
  setSessionResults: (key, results) => set((state) => ({
    sessionResults: { ...state.sessionResults, [key]: results }
  })),
  setTelemetryAvailability: (key, available) => set((state) => ({
    telemetryAvailability: { ...state.telemetryAvailability, [key]: available }
  })),

  syncCanonicalData: async (year) => {
    set({ loading: true, error: null });
    try {
      // 1. Fetch schedule
      const schedRes = await f1Api.getSchedule(year);
      const schedule = Array.isArray(schedRes) ? schedRes : (schedRes as any)?.data ?? [];
      set({ schedule });

      // 2. Fetch Standings & Engine Standings in parallel
      const [standingsRes, enginesRes] = await Promise.allSettled([
        f1Api.getStandings(year),
        f1Api.getEngineStandings(year),
      ]);

      let driversList: StandingsEntry[] = [];
      let constructorsList: StandingsEntry[] = [];
      if (standingsRes.status === "fulfilled") {
        const val = standingsRes.value as any;
        const d = val.data || val;
        driversList = d.drivers || [];
        constructorsList = d.constructors || [];
        set({
          standings: driversList,
          constructors: constructorsList,
        });
      }

      if (enginesRes.status === "fulfilled") {
        const val = enginesRes.value as any;
        set({ engines: val.data || val || [] });
      }

      // 3. Gracefully fetch results for completed GP rounds to seed podiums
      const completedEvents = schedule.filter((w) => w.is_completed);
      const resultsPromises = completedEvents.map(async (w) => {
        const key = `${w.round_number}-Race`;
        try {
          const res = await f1Api.getLeaderboard(year, w.round_number, "Race");
          const list = Array.isArray(res) ? res : (res as any)?.data ?? [];
          return { key, list };
        } catch {
          return { key, list: [] };
        }
      });

      const results = await Promise.all(resultsPromises);
      const resultsMap: Record<string, LeaderboardEntry[]> = {};
      results.forEach((r) => {
        resultsMap[r.key] = r.list;
      });

      set((state) => ({
        sessionResults: { ...state.sessionResults, ...resultsMap }
      }));

    } catch (e: any) {
      set({ error: e.message || "Failed to load canonical data." });
    } finally {
      set({ loading: false });
    }
  }
}));

