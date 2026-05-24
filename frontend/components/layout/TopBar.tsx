"use client";
import { Search, Radio, Archive, Clock } from "lucide-react";
import { useSettingsStore } from "@/lib/store";
import { useSessionContext } from "@/lib/hooks/useSessionContext";
import { useLiveSession } from "@/lib/hooks/useLiveSession";
import { usePathname } from "next/navigation";

const PAGE_LABELS: Record<string, string> = {
  "/":            "Dashboard",
  "/sessions":    "Sessions",
  "/live-timing": "Live Timing",
  "/telemetry":   "Telemetry",
  "/standings":   "Standings",
};

export default function TopBar() {
  const { setCommandPalette } = useSettingsStore();
  const { selectedYear, selectedSession, currentRace, isArchive, isLiveWeekend, raceLabel } = useSessionContext();
  const live = useLiveSession();
  const pathname = usePathname();
  const pageLabel = PAGE_LABELS[pathname] ?? pathname.replace("/", "").replace("-", " ").toUpperCase();

  return (
    <header className="h-12 flex items-center justify-between border-b border-white/[0.06] bg-[#080810]/80 backdrop-blur-xl flex-shrink-0 z-40 sticky top-0" style={{ paddingInline: "20px" }}>

      {/* ── Left: Breadcrumb context ribbon ── */}
      <div className="flex items-center gap-0 min-w-0 overflow-hidden">

        {/* Year badge */}
        <span className="font-orbitron text-[11px] font-bold text-white/30 tracking-widest mr-3 flex-shrink-0">
          {selectedYear}
        </span>

        {/* Separator */}
        <span className="text-white/10 mr-3 text-xs">·</span>

        {/* Race label */}
        <span className="font-rajdhani font-bold text-[13px] text-white/80 tracking-wide truncate max-w-[220px] mr-3">
          {raceLabel}
        </span>

        {/* Separator */}
        <span className="text-white/10 mr-3 text-xs hidden sm:block">·</span>

        {/* Session */}
        <span className="font-rajdhani font-bold text-[12px] text-apex-red tracking-widest uppercase mr-3 flex-shrink-0 hidden sm:block">
          {selectedSession}
        </span>

        {/* Separator */}
        <span className="text-white/10 mr-3 text-xs hidden md:block">·</span>

        {/* Mode indicator */}
        <span className="hidden md:flex items-center gap-1.5 flex-shrink-0">
          {isArchive ? (
            <span className="status-archive">
              <Archive className="w-3 h-3" />
              Archive
            </span>
          ) : live.is_live ? (
            live.ws_connected ? (
              <span className="status-live">Live</span>
            ) : (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-400/10 border border-amber-400/20 font-orbitron text-[9px] font-bold text-amber-400 uppercase tracking-widest animate-pulse">
                ⚠️ Live Data Not Available
              </span>
            )
          ) : isLiveWeekend ? (
            <span className="flex items-center gap-1.5 label-xs border border-white/10 px-2 py-0.5 rounded bg-white/[0.02] text-white/50">
              <Clock className="w-3 h-3" />
              ACTIVE WEEKEND
            </span>
          ) : (
            <span className="flex items-center gap-1.5 label-xs text-white/30">
              <Clock className="w-3 h-3" />
              Upcoming
            </span>
          )}
        </span>
      </div>

      {/* ── Right: Page label + search ── */}
      <div className="flex items-center gap-3 flex-shrink-0">

        {/* Page label pill */}
        <span className="hidden lg:block label-xs border border-white/10 px-2.5 py-1 rounded-md bg-white/[0.03]">
          {pageLabel}
        </span>

        {/* Search */}
        <button
          id="topbar-search"
          onClick={() => setCommandPalette(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.07] text-white/40 hover:bg-white/[0.08] hover:text-white/80 transition-all duration-200"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="text-[12px] font-rajdhani hidden md:block w-28 text-left">Search...</span>
          <kbd className="text-[9px] border border-white/10 px-1.5 py-0.5 rounded text-white/25 hidden md:block font-mono">⌘K</kbd>
        </button>

        {/* Avatar */}
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold bg-gradient-to-br from-apex-red to-red-900 text-white border border-white/10 shadow-[0_0_12px_rgba(225,6,0,0.3)] font-orbitron flex-shrink-0">
          F1
        </div>
      </div>
    </header>
  );
}
