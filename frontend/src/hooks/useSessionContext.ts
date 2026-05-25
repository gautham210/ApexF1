import { useSettingsStore, type ScheduleEvent } from "@/lib/store";

export interface SessionContext {
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

  currentRace: ScheduleEvent | null;
  schedule: ScheduleEvent[];
  raceLabel: string;
  activeWeekendLabel: string;
  isNextRace: boolean;

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

  const currentRace = schedule.find((e) => e.round_number === selectedRound) || activeEvent || nextEvent || completedEvent || null;
  const raceLabel = currentRace?.event_name || currentRace?.location || currentRace?.country || "—";
  const isNextRace = nextEvent ? selectedRound === nextEvent.round_number : false;

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
