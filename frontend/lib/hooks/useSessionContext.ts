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
  // Authoritative Canonical Season Context
  season: number;
  selectedYear: number;
  currentRound: number;
  selectedRound: number;
  selectedSession: string;
  selectedLap: number | "all";
  raceStatus: string;
  isLiveWeekend: boolean;
  isArchive: boolean;
  activeEvent: ScheduleEvent | null;
  nextEvent: ScheduleEvent | null;
  completedEvent: ScheduleEvent | null;
  timezone: string;

  // Canonical displays derived safely from the active event
  currentRace: ScheduleEvent | null;
  schedule: ScheduleEvent[];
  raceLabel: string;
  activeWeekendLabel: string;
  isNextRace: boolean;

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
    currentRound, raceStatus, isLiveWeekend, isArchive,
    activeEvent, nextEvent, completedEvent, timezone,
    schedule,
    setSelectedYear, setSelectedRound, setCurrentRace,
    setSelectedSession, setSelectedLap, setScheduleCache,
  } = store;

  // The race being viewed maps to the selected round, or dynamically falls back to nextEvent/completedEvent
  const currentRace = schedule.find((e) => e.round_number === selectedRound) || activeEvent || nextEvent || completedEvent || null;

  // Canonical label
  const raceLabel = currentRace?.event_name || currentRace?.location || currentRace?.country || "—";

  const isNextRace = nextEvent ? selectedRound === nextEvent.round_number : false;

  // Dynamic active status label
  let activeWeekendLabel = "UPCOMING";
  if (isLiveWeekend && activeEvent) {
    activeWeekendLabel = "CURRENT WEEKEND";
  } else if (isArchive) {
    activeWeekendLabel = "EVENT ARCHIVE";
  }

  return {
    season: selectedYear,
    selectedYear,
    currentRound,
    selectedRound,
    selectedSession,
    selectedLap,
    raceStatus,
    isLiveWeekend,
    isArchive,
    activeEvent,
    nextEvent,
    completedEvent,
    timezone,
    
    currentRace,
    schedule,
    raceLabel,
    activeWeekendLabel,
    isNextRace,

    setSelectedYear,
    setSelectedRound,
    setCurrentRace,
    setSelectedSession,
    setSelectedLap,
    setScheduleCache,
  };
}
