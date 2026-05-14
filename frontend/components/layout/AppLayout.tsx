"use client";
import React, { useState, useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import { f1Api } from "@/lib/api/client";
import { useSettingsStore } from "@/lib/store";

/** Runs once on app boot — syncs canonical season context regardless of which page the user lands on. */
function GlobalContextInit() {
  const { selectedYear, setSelectedRound, setCurrentRace } = useSettingsStore();
  useEffect(() => {
    f1Api.getDashboardContext(selectedYear)
      .then((res: any) => {
        const data = res?.data || res;
        const sc = data?.season_context;
        if (sc?.current_round) {
          setSelectedRound(sc.current_round);
          if (sc.latest_completed_race) setCurrentRace(sc.latest_completed_race);
        }
      })
      .catch(() => {}); // silent — pages degrade gracefully
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally [] — only on app mount
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
