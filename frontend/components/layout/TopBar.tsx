"use client";
import { Search } from "lucide-react";
import { useSettingsStore } from "@/lib/store";
import { usePathname } from "next/navigation";

export default function TopBar() {
  const { selectedYear, currentRace, selectedSession, setCommandPalette } = useSettingsStore();
  const pathname = usePathname();
  const pageName = pathname === "/" ? "Dashboard"
    : pathname.replace("/", "").charAt(0).toUpperCase() + pathname.slice(2).replace("-", " ");

  // Canonical race label — use event_name or location, NEVER country (country="United States" for Miami)
  const raceLabel = currentRace?.event_name || currentRace?.location || currentRace?.country || "—";

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-white/10 bg-black/40 backdrop-blur-md flex-shrink-0 z-40 sticky top-0">
      <div className="flex items-center text-sm text-apex-muted gap-2">
        <span className="font-semibold text-white/90">{selectedYear}</span>
        <span className="text-white/20">•</span>
        <span className="text-white/70">{raceLabel}</span>
        <span className="text-white/20">•</span>
        <span className="text-apex-red font-medium">{selectedSession}</span>
        <span className="text-white/20">•</span>
        <span className="text-white/50">{pageName}</span>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => setCommandPalette(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white transition-all duration-300"
        >
          <Search className="w-4 h-4" />
          <span className="text-sm hidden md:block w-32 text-left">Search...</span>
          <span className="text-[10px] border border-white/10 px-1.5 py-0.5 rounded text-white/30 hidden md:block">⌘K</span>
        </button>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-gradient-to-br from-apex-red to-red-800 text-white shadow-[0_0_15px_rgba(224,0,45,0.4)] border border-white/10">
          F1
        </div>
      </div>
    </header>
  );
}
