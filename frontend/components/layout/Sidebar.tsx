"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Radio, Activity, Trophy, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { motion } from "framer-motion";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/sessions", label: "Sessions", icon: CalendarDays },
  { href: "/live-timing", label: "Live Timing", icon: Radio },
  { href: "/telemetry", label: "Telemetry", icon: Activity },
  { href: "/standings", label: "Standings", icon: Trophy },
];

interface SidebarProps {
  expanded: boolean;
  setExpanded: (v: boolean) => void;
}

export default function Sidebar({ expanded, setExpanded }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside 
      className="fixed left-0 top-0 h-full z-50 flex flex-col bg-black/40 backdrop-blur-2xl border-r border-white/10 transition-all duration-300 shadow-[10px_0_30px_rgba(0,0,0,0.5)]"
      style={{ width: expanded ? '260px' : '80px' }}
    >
      
      {/* Logo */}
      <div className={`flex items-center ${expanded ? 'justify-start px-6' : 'justify-center'} py-6 h-20`}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-apex-red to-red-800 shadow-[0_0_20px_rgba(224,0,45,0.4)] border border-white/10">
          <span className="font-orbitron font-bold text-white text-lg tracking-tighter">F1</span>
        </div>
        {expanded && (
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="ml-4 flex flex-col">
            <span className="font-orbitron font-bold text-white text-sm tracking-widest whitespace-nowrap">
              APEX DASH
            </span>
            <span className="text-[10px] text-white/50 font-rajdhani tracking-widest uppercase">Premium Analytics</span>
          </motion.div>
        )}
      </div>

      <div className="px-4 mb-4 mt-2">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden">
        <ul className="space-y-3 px-4">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <li key={href} className="relative group">
                {active && (
                  <motion.div 
                    layoutId="activeTab"
                    className="absolute inset-0 bg-white/10 border border-white/10 rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.05)]"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <Link href={href}>
                  <div className={`relative flex items-center gap-4 px-3.5 py-3.5 rounded-xl cursor-pointer transition-all duration-300 ${
                      active ? "text-white" : "text-white/40 hover:text-white/80 hover:bg-white/5"
                    } ${expanded ? '' : 'justify-center'}`}
                    title={!expanded ? label : undefined}
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 transition-all duration-300 ${active ? "text-apex-red drop-shadow-[0_0_8px_rgba(224,0,45,0.8)]" : "group-hover:scale-110"}`} />
                    {expanded && (
                      <span className={`text-sm font-medium whitespace-nowrap transition-all duration-300 ${active ? "font-bold tracking-wide" : "tracking-normal"}`}>
                        {label}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Toggle */}
      <div className="p-4 border-t border-white/10 flex justify-center bg-black/20">
        <button 
          onClick={() => setExpanded(!expanded)}
          className="p-2.5 rounded-xl text-white/40 hover:bg-white/10 hover:text-white transition-all duration-300 border border-transparent hover:border-white/10 shadow-lg"
          title={expanded ? "Collapse Sidebar" : "Expand Sidebar"}
        >
          {expanded ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </button>
      </div>
    </aside>
  );
}
