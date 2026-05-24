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
    <header className="h-14 flex items-center justify-between border-b border-white/[0.05] bg-[#07070c]/90 backdrop-blur-2xl flex-shrink-0 z-40 sticky top-0 px-6">

      {/* ── Left: Breadcrumb context ribbon ── */}
      <div className="flex items-center gap-0 min-w-0 overflow-hidden">

        {/* Year badge */}
        <span className="font-sans text-[12px] font-bold text-white/40 tracking-wider mr-3 flex-shrink-0">
          {selectedYear}
        </span>

        {/* Separator */}
        <span className="text-white/10 mr-3 text-xs">·</span>

        {/* Race label */}
        <span className="font-sans font-semibold text-[13px] text-white/80 tracking-wide truncate max-w-[220px] mr-3">
          {raceLabel}
        </span>

        {/* Separator */}
        <span className="text-white/10 mr-3 text-xs hidden sm:block">·</span>

        {/* Session */}
        <span className="font-sans font-bold text-[11px] text-apex-red tracking-wider uppercase mr-3 flex-shrink-0 hidden sm:block">
          {selectedSession}
        </span>

        {/* Separator */}
        <span className="text-white/10 mr-3 text-xs hidden md:block">·</span>

        {/* Mode indicator */}
        <span className="hidden md:flex items-center gap-1.5 flex-shrink-0">
          {isArchive ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md border border-blue-500/10 bg-blue-500/[0.03] text-[9px] font-sans font-bold tracking-widest text-blue-400 uppercase">
              <Archive className="w-2.5 h-2.5" />
              Archive
            </span>
          ) : live.is_live ? (
            live.ws_connected ? (
              <span className="status-live font-sans font-bold tracking-widest text-[9px]">Live</span>
            ) : (
              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-amber-400/5 border border-amber-400/10 font-sans text-[9px] font-bold text-amber-400 uppercase tracking-widest animate-pulse">
                ⚠️ Live Data Not Available
              </span>
            )
          ) : isLiveWeekend ? (
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-md border border-white/5 bg-white/[0.02] font-sans text-[9px] font-bold text-white/50 tracking-widest uppercase">
              <Clock className="w-2.5 h-2.5 text-white/30" />
              ACTIVE WEEKEND
            </span>
          ) : (
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-md border border-transparent font-sans text-[9px] font-bold text-white/30 tracking-widest uppercase">
              <Clock className="w-2.5 h-2.5 text-white/20" />
              Upcoming
            </span>
          )}
        </span>
      </div>

      {/* ── Right: Page label + search ── */}
      <div className="flex items-center gap-4 flex-shrink-0">

        {/* Page label pill */}
        <span className="hidden lg:block font-sans text-[10px] font-bold tracking-widest text-white/50 border border-white/[0.05] px-2.5 py-1 rounded bg-white/[0.02] uppercase">
          {pageLabel}
        </span>

        {/* Search */}
        <button
          id="topbar-search"
          onClick={() => setCommandPalette(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/40 hover:bg-white/[0.06] hover:text-white/80 transition-all duration-200"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="text-[12px] font-sans hidden md:block w-28 text-left">Search...</span>
          <kbd className="text-[9px] border border-white/10 px-1.5 py-0.5 rounded text-white/20 hidden md:block font-mono">⌘K</kbd>
        </button>

        {/* Avatar */}
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-sans font-bold bg-gradient-to-br from-apex-red to-red-900 text-white border border-white/10 flex-shrink-0 shadow-lg">
          F1
        </div>
      </div>
    </header>
  );
}
