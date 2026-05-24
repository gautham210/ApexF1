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
  activeWeekendLabel: string; // Dynamic label like "CURRENT WEEKEND", "QUALIFYING LIVE", "RACE LIVE", etc.
  isCurrentlyInActiveWeekend: boolean;

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

  const now = new Date();

  // Find if there is an active race weekend right now in the schedule
  let activeWeekendEvent: ScheduleEvent | null = null;
  for (const event of schedule) {
    const s1 = event.session1_date ? new Date(event.session1_date) : null;
    const s5 = event.session5_date ? new Date(event.session5_date) : (event.event_date ? new Date(event.event_date) : null);
    if (s5) {
      // Canada / active weekend detection: FP1 start - 6h to Race start + 4h buffer
      const weekendStart = s1 
        ? new Date(s1.getTime() - 6 * 60 * 60 * 1000) 
        : new Date(s5.getTime() - 2 * 24 * 60 * 60 * 1000);
      const weekendEnd = new Date(s5.getTime() + 4 * 60 * 60 * 1000);
      if (now >= weekendStart && now <= weekendEnd) {
        activeWeekendEvent = event;
        break;
      }
    }
  }

  const isCurrentlyInActiveWeekend = activeWeekendEvent !== null;

  // Derive from schedule cache (no network call here)
  const completed = schedule
    .filter((e) => e.is_completed)
    .sort((a, b) => b.round_number - a.round_number);
  const upcoming = schedule
    .filter((e) => !e.is_completed)
    .sort((a, b) => a.round_number - b.round_number);

  // Archive = the currently selected race is completed
  const isArchive = currentRace?.is_completed ?? false;
  
  // If we are currently in an active weekend for this race, or if it is not completed yet
  const isLiveWeekend = currentRace && activeWeekendEvent
    ? currentRace.round_number === activeWeekendEvent.round_number
    : (currentRace ? !currentRace.is_completed : false);

  // Avoid duplicate counting: if Canada is active right now, nextRace is the first race after Canada
  const nextRace = isCurrentlyInActiveWeekend
    ? (upcoming.find(e => e.round_number !== activeWeekendEvent?.round_number) || null)
    : (upcoming[0] || null);
    
  const prevRace = completed[0] || null;
  const isNextRace = nextRace ? currentRace?.round_number === nextRace.round_number : false;

  // Dynamic weekend/live labeling based on active weekend
  let activeWeekendLabel = "UPCOMING";
  if (isLiveWeekend) {
    if (activeWeekendEvent && currentRace?.round_number === activeWeekendEvent.round_number) {
      const s1 = currentRace.session1_date ? new Date(currentRace.session1_date) : null;
      const s5 = currentRace.session5_date ? new Date(currentRace.session5_date) : (currentRace.event_date ? new Date(currentRace.event_date) : null);
      if (s5) {
        const time = now.getTime();
        const raceStart = s5.getTime();
        
        // Race session window
        if (time >= raceStart && time <= raceStart + 3.5 * 60 * 60 * 1000) {
          activeWeekendLabel = "RACE LIVE";
        } else if (time >= raceStart - 3 * 60 * 60 * 1000 && time < raceStart) {
          activeWeekendLabel = "RACE WARMUP";
        } else {
          activeWeekendLabel = "CURRENT WEEKEND";
        }
      } else {
        activeWeekendLabel = "LIVE WEEKEND";
      }
    } else {
      activeWeekendLabel = "CURRENT WEEKEND";
    }
  } else if (isArchive) {
    activeWeekendLabel = "EVENT ARCHIVE";
  }

  // Canonical label — event_name is preferred (contains "Grand Prix"),
  // then location (city), then country (can be ambiguous, e.g. "United States" for Miami)
  const raceLabel = currentRace?.event_name || currentRace?.location || currentRace?.country || "—";

  return {
    selectedYear, selectedRound, selectedSession, selectedLap,
    currentRace, schedule,
    isArchive, isLiveWeekend, isNextRace,
    raceLabel, nextRace, prevRace, activeWeekendLabel, isCurrentlyInActiveWeekend,
    setSelectedYear, setSelectedRound, setCurrentRace,
    setSelectedSession, setSelectedLap, setScheduleCache,
  };
}
