"use client";
import React, { useState, useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import { f1Api } from "@/lib/api/client";
import { useSettingsStore } from "@/lib/store";

/**
 * GlobalContextInit — runs ONCE on app boot (and when year changes).
 *
 * Boot order (CRITICAL — order matters for race-condition prevention):
 *   1. Fetch dashboard context AND schedule in parallel
 *   2. FIRST: bootstrapFromBackend — sets currentRace + stamps scheduleYear
 *   3. THEN:  setScheduleCache — sees year already stamped, will NOT re-derive currentRace
 *
 * This ordering guarantees exactly ONE source of truth for currentRace.
 * Any component must use useSessionContext() — never access useSettingsStore directly
 * for session-derived values.
 */
function GlobalContextInit() {
  const { selectedYear, bootstrapFromBackend, setScheduleCache } = useSettingsStore();

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const [ctxRes, schedRes] = await Promise.allSettled([
          f1Api.getDashboardContext(selectedYear),
          f1Api.getSchedule(selectedYear),
        ]);

        if (cancelled) return;

        // ── STEP 1: Bootstrap from backend FIRST ──────────────────────────
        // This stamps scheduleYear so setScheduleCache (step 2) won't re-derive.
        if (ctxRes.status === "fulfilled") {
          const data = (ctxRes.value as any)?.data ?? ctxRes.value;
          const sc = data?.season_context;
          if (sc?.current_round) {
            // If next_race matches current_round, we're in a live/upcoming weekend
            // → use next_race as currentRace (not completed → live mode)
            // Otherwise use latest_completed_race (completed → archive mode)
            const nextRaceRound = sc.next_race?.round_number;
            const isLiveWeekend = nextRaceRound === sc.current_round;
            const canonicalRace = isLiveWeekend
              ? sc.next_race ?? sc.latest_completed_race ?? null
              : sc.latest_completed_race ?? null;

            bootstrapFromBackend(
              sc.current_round,
              canonicalRace,
              selectedYear,
            );
          }
        }

        // ── STEP 2: Cache the schedule AFTER bootstrap ─────────────────────
        // setScheduleCache will see scheduleYear === selectedYear and skip
        // currentRace derivation, preserving what bootstrap just set.
        if (schedRes.status === "fulfilled") {
          const data = (schedRes.value as any)?.data ?? schedRes.value;
          const events = Array.isArray(data) ? data : [];
          setScheduleCache(events, selectedYear);
        }
      } catch {
        // Silent — pages degrade gracefully without context
      }
    }

    boot();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear]); // re-runs when user changes year (which resets contextBootstrapped)

  return null;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="flex h-screen overflow-hidden bg-apex-bg">
      <GlobalContextInit />
      <Sidebar expanded={expanded} setExpanded={setExpanded} />
      <div
        className="flex flex-col min-w-0 transition-all duration-300 flex-1"
        style={{ marginLeft: expanded ? "260px" : "80px" }}
      >
        <TopBar />
        <main className="flex-1 overflow-y-auto ambient-bg">{children}</main>
      </div>
    </div>
  );
}
