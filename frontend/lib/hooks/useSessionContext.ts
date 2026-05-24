/**
 * useSessionContext — THE canonical source of truth for session state.
 *
 * ALL pages derive from this hook. No page should compute isArchive,
 * isLive, raceLabel, or nextRace independently. Use this.
 *
 * Architecture:
 *   currentRace.is_completed  → isArchive (browse telemetry/replay)
 *   !currentRace.is_completed → isLive or isUpcoming
 *   schedule from store cache  → no per-page refetch
 */
import { useSettingsStore } from "@/lib/store";
import type { ScheduleEvent } from "@/lib/store";

export interface SessionContext {
  // Raw store values
  selectedYear: number;
  selectedRound: number;
  selectedSession: string;
  selectedLap: number | "all";
  currentRace: ScheduleEvent | null;
  schedule: ScheduleEvent[];

  // Derived — computed from currentRace, NEVER independently fetched
  isArchive: boolean;      // currentRace is completed → replay/archive mode
  isLiveWeekend: boolean;  // currentRace is NOT completed (live or upcoming)
  isNextRace: boolean;     // currentRace is the next upcoming race
  raceLabel: string;       // safe display label (event_name || location || country)
  nextRace: ScheduleEvent | null;    // first upcoming race in schedule
  prevRace: ScheduleEvent | null;    // most recent completed race

  // Store setters (passthrough)
  setSelectedYear: (y: number) => void;
  setSelectedRound: (r: number) => void;
  setCurrentRace: (r: ScheduleEvent | null) => void;
  setSelectedSession: (s: string) => void;
  setSelectedLap: (l: number | "all") => void;
  setScheduleCache: (s: ScheduleEvent[], year: number) => void;
}

export function useSessionContext(): SessionContext {
  const store = useSettingsStore();
  const {
    selectedYear, selectedRound, selectedSession, selectedLap,
    currentRace, schedule,
    setSelectedYear, setSelectedRound, setCurrentRace,
    setSelectedSession, setSelectedLap, setScheduleCache,
  } = store;

  // Derive from schedule cache (no network call here)
  const completed = schedule
    .filter((e) => e.is_completed)
    .sort((a, b) => b.round_number - a.round_number);
  const upcoming = schedule
    .filter((e) => !e.is_completed)
    .sort((a, b) => a.round_number - b.round_number);

  const nextRace = upcoming[0] || null;
  const prevRace = completed[0] || null;

  // Archive = the currently selected race is completed
  const isArchive = currentRace?.is_completed ?? false;
  const isLiveWeekend = currentRace ? !currentRace.is_completed : false;
  const isNextRace = nextRace ? currentRace?.round_number === nextRace.round_number : false;

  // Canonical label — event_name is preferred (contains "Grand Prix"),
  // then location (city), then country (can be ambiguous, e.g. "United States" for Miami)
  const raceLabel = currentRace?.event_name || currentRace?.location || currentRace?.country || "—";

  return {
    selectedYear, selectedRound, selectedSession, selectedLap,
    currentRace, schedule,
    isArchive, isLiveWeekend, isNextRace,
    raceLabel, nextRace, prevRace,
    setSelectedYear, setSelectedRound, setCurrentRace,
    setSelectedSession, setSelectedLap, setScheduleCache,
  };
}
