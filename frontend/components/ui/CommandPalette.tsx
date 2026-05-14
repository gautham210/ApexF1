"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Home, Radio, Activity, Trophy, CalendarDays, MapPin, User, Flag, Search as SearchIcon } from "lucide-react";
import { useSettingsStore, useTelemetryStore } from "@/lib/store";
import { useRouter } from "next/navigation";

const PAGES = [
  { id: "p1", label: "Dashboard", href: "/", icon: Home, type: "Page" },
  { id: "p2", label: "Live Timing", href: "/live-timing", icon: Radio, type: "Page" },
  { id: "p3", label: "Telemetry Viewer", href: "/telemetry", icon: Activity, type: "Page" },
  { id: "p4", label: "Standings", href: "/standings", icon: Trophy, type: "Page" },
  { id: "p5", label: "Sessions", href: "/sessions", icon: CalendarDays, type: "Page" },
];

const SEASONS = [2026, 2025, 2024, 2023, 2022, 2021, 2020].map(y => ({
  id: `s${y}`, label: `${y} Season`, year: y, icon: CalendarDays, type: "Season"
}));

const DRIVERS = [
  { id: "d33", label: "Max Verstappen", num: "33", abbr: "VER", icon: User, type: "Driver" },
  { id: "d16", label: "Charles Leclerc", num: "16", abbr: "LEC", icon: User, type: "Driver" },
  { id: "d44", label: "Lewis Hamilton", num: "44", abbr: "HAM", icon: User, type: "Driver" },
  { id: "d4", label: "Lando Norris", num: "4", abbr: "NOR", icon: User, type: "Driver" },
];

const RACES = [
  { id: "r1", label: "Bahrain Grand Prix", round: 1, icon: Flag, type: "Race" },
  { id: "r2", label: "Saudi Arabian Grand Prix", round: 2, icon: Flag, type: "Race" },
  { id: "r3", label: "Australian Grand Prix", round: 3, icon: Flag, type: "Race" },
  { id: "r4", label: "Japanese Grand Prix", round: 4, icon: Flag, type: "Race" },
  { id: "r5", label: "Monaco Grand Prix", round: 8, icon: MapPin, type: "Race" },
  { id: "r6", label: "British Grand Prix", round: 12, icon: MapPin, type: "Race" },
];

export default function CommandPalette() {
  const { commandPaletteOpen, setCommandPalette, setSelectedYear, setSelectedRound } = useSettingsStore();
  const { setDriver1 } = useTelemetryStore();
  const router = useRouter();
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPalette(!commandPaletteOpen);
      }
      if (e.key === "Escape") setCommandPalette(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [commandPaletteOpen, setCommandPalette]);

  useEffect(() => {
    if (!commandPaletteOpen) setQuery("");
  }, [commandPaletteOpen]);

  const allItems = [...PAGES, ...SEASONS, ...DRIVERS, ...RACES];
  const filtered = query.trim() === "" 
    ? allItems.slice(0, 8) 
    : allItems.filter(item => 
        item.label.toLowerCase().includes(query.toLowerCase()) || 
        item.type.toLowerCase().includes(query.toLowerCase())
      );

  const handleSelect = (item: any) => {
    setCommandPalette(false);
    if (item.type === "Page") {
      router.push(item.href);
    } else if (item.type === "Season") {
      setSelectedYear(item.year);
    } else if (item.type === "Driver") {
      setDriver1(item.num);
      router.push("/telemetry");
    } else if (item.type === "Race") {
      setSelectedRound(item.round);
      router.push("/sessions");
    }
  };

  return (
    <AnimatePresence>
      {commandPaletteOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-md z-[100]"
            onClick={() => setCommandPalette(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-2xl z-[101] rounded-2xl overflow-hidden bg-black/60 backdrop-blur-2xl border border-white/10 shadow-[0_30px_100px_rgba(0,0,0,0.8)]"
          >
            <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10 bg-white/5">
              <SearchIcon className="w-5 h-5 text-white/50" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search drivers, races, seasons, or pages..."
                className="flex-1 bg-transparent text-white placeholder-white/40 text-lg outline-none font-rajdhani tracking-wide"
              />
              <button onClick={() => setCommandPalette(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-5 h-5 text-white/50" />
              </button>
            </div>
            
            <div className="p-3 max-h-[400px] overflow-y-auto">
              {filtered.length > 0 ? (
                <div className="space-y-1">
                  {filtered.map((item) => (
                    <div 
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-white/10 cursor-pointer group transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-apex-red/20 group-hover:border-apex-red/30 transition-colors">
                          <item.icon className="w-4 h-4 text-white/50 group-hover:text-apex-red transition-colors" />
                        </div>
                        <span className="text-white/80 font-medium group-hover:text-white text-sm">{item.label}</span>
                      </div>
                      <span className="text-[10px] uppercase tracking-widest font-bold text-white/30 group-hover:text-white/50 bg-white/5 px-2 py-1 rounded">
                        {item.type}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <SearchIcon className="w-8 h-8 text-white/20 mx-auto mb-3" />
                  <p className="text-white/50 text-sm">No results found for "{query}"</p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
