"use client";
import { useEffect, useState } from "react";
import { useSettingsStore } from "@/lib/store";
import { f1Api } from "@/lib/api/client";
import { CalendarDays, ChevronRight, Activity, Radio, CheckCircle2, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

const AVAILABLE_YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020];
const STANDARD_SESSIONS = ["FP1", "FP2", "FP3", "Qualifying", "Race"];
const SPRINT_SESSIONS = ["FP1", "Sprint Qualifying", "Sprint", "Qualifying", "Race"];

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

function formatDateRange(session1Date?: string, session5Date?: string): string {
  try {
    const start = session1Date ? new Date(session1Date) : null;
    const end   = session5Date ? new Date(session5Date) : (session1Date ? new Date(session1Date) : null);
    if (!start && !end) return "";
    const endD   = end!;
    const month  = MONTHS[endD.getMonth()];
    if (start && end && start.getMonth() === end.getMonth()) {
      return `${start.getDate()}\u2013${end.getDate()} ${month}`;
    }
    if (start && end) {
      return `${start.getDate()} ${MONTHS[start.getMonth()]} \u2013 ${end.getDate()} ${month}`;
    }
    return `${endD.getDate()} ${month}`;
  } catch {
    return "";
  }
}

export default function SessionsPage() {
  const router = useRouter();
  const { selectedYear, selectedRound, selectedSession, setSelectedYear, setSelectedRound, setSelectedSession } = useSettingsStore();
  const [schedule, setSchedule] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRound, setExpandedRound] = useState<number | null>(null);

  // The one and only NEXT round — smallest round_number that is not completed
  const nextRound = schedule
    .filter(e => !e.is_completed)
    .sort((a, b) => a.round_number - b.round_number)[0] ?? null;

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await f1Api.getSchedule(selectedYear);
        const data = (res as any).data || res;
        setSchedule(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    }
    load();
  }, [selectedYear]);

  // Smart routing: completed sessions → Telemetry (archive browse)
  //                upcoming/live sessions → Live Timing
  const handleSelectSession = (round: number, session: string, isCompleted: boolean) => {
    setSelectedRound(round);
    setSelectedSession(session);
    router.push(isCompleted ? "/telemetry" : "/live-timing");
  };

  return (
    <div className="p-4 lg:p-8 min-h-screen max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-apex-red/20 to-transparent flex items-center justify-center border border-apex-red/20">
              <CalendarDays className="w-5 h-5 text-apex-red" />
            </div>
            <h1 className="font-orbitron font-bold text-white text-3xl tracking-tight">SESSION BROWSER</h1>
          </div>
          <p className="text-white/40 text-sm font-rajdhani tracking-widest uppercase mt-2">Select a Grand Prix and Session context</p>
        </div>
        
        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-xl p-1.5 rounded-2xl border border-white/10 shadow-lg overflow-x-auto max-w-full hide-scrollbar">
          {AVAILABLE_YEARS.map(y => (
            <button key={y} onClick={() => setSelectedYear(y)}
              className={`px-5 py-2 rounded-xl text-sm font-rajdhani font-bold transition-all duration-300 flex-shrink-0 ${
                selectedYear === y ? "bg-white/10 text-white shadow-[0_4px_15px_rgba(0,0,0,0.2)]" : "text-white/40 hover:text-white hover:bg-white/5"
              }`}>
              {y}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          Array(10).fill(0).map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl bg-white/5" />)
        ) : schedule.length === 0 ? (
          <div className="bg-black/20 backdrop-blur-xl border border-white/5 rounded-3xl p-16 text-center text-white/30 font-rajdhani tracking-widest uppercase text-sm shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
            No schedule data available for {selectedYear}
          </div>
        ) : (
          schedule.map((event) => {
            const isExpanded = expandedRound === event.round_number;
            const isSprint = event.event_name?.toLowerCase().includes("sprint") || false;
            const sessions = isSprint ? SPRINT_SESSIONS : STANDARD_SESSIONS;
            
            return (
              <motion.div key={event.round_number} layout className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-all hover:shadow-[0_8px_32px_rgba(255,255,255,0.02)] hover:border-white/20">
                <div 
                  className={`flex items-center justify-between p-5 cursor-pointer hover:bg-white/[0.04] transition-colors ${
                    isExpanded ? 'bg-white/[0.04] border-b border-white/5' : ''
                  }`}
                  onClick={() => setExpandedRound(isExpanded ? null : event.round_number)}
                >
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                      <span className="font-orbitron font-bold text-white/40 text-base">{event.round_number}</span>
                    </div>
                    <div>
                      <h3 className="font-rajdhani font-bold text-white/90 text-xl tracking-wide">{event.event_name || `${event.country} Grand Prix`}</h3>
                    <div className="flex items-center gap-3 text-xs text-white/40 mt-1 font-bold">
                        <span className="uppercase tracking-widest">{event.location || event.country}</span>
                        {event.is_completed ? (
                          <span className="text-[#229971] flex items-center gap-1.5 bg-[#229971]/10 px-2 py-0.5 rounded-md">
                            <CheckCircle2 className="w-3.5 h-3.5" /> COMPLETED
                          </span>
                        ) : nextRound?.round_number === event.round_number ? (
                          <span className="text-apex-red flex items-center gap-1.5 bg-apex-red/10 px-2 py-0.5 rounded-md border border-apex-red/20">
                            <Clock className="w-3.5 h-3.5" /> NEXT RACE
                          </span>
                        ) : (
                          <span className="text-blue-400 flex items-center gap-1.5 bg-blue-400/10 px-2 py-0.5 rounded-md">
                            <Clock className="w-3.5 h-3.5" /> UPCOMING
                          </span>
                        )}
                        {/* Date range */}
                        {formatDateRange(event.session1_date, event.session5_date) && (
                          <span className="text-white/50 font-rajdhani text-[10px] tracking-widest font-bold">
                            {formatDateRange(event.session1_date, event.session5_date)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {selectedRound === event.round_number && !isExpanded && (
                      <span className="text-[10px] font-rajdhani font-bold text-apex-red uppercase tracking-widest border border-apex-red/20 bg-apex-red/10 px-2 py-1 rounded-md hidden sm:block">
                        Current
                      </span>
                    )}
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 border border-white/5">
                      <ChevronRight className={`w-5 h-5 text-white/50 transition-transform duration-300 ${isExpanded ? "rotate-90" : ""}`} />
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden bg-black/40"
                    >
                      <div className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        {sessions.map(session => {
                          const isSelected = selectedRound === event.round_number && selectedSession === session;
                          return (
                            <div 
                              key={session}
                            onClick={() => handleSelectSession(event.round_number, session, event.is_completed)}
                              className={`group p-4 rounded-2xl border cursor-pointer transition-all duration-300 ${
                                isSelected 
                                  ? "bg-white/10 border-white/20 shadow-[0_8px_32px_rgba(255,255,255,0.05)] scale-[1.02]" 
                                  : "bg-white/5 border-white/5 hover:border-white/20 hover:bg-white/10"
                              }`}
                            >
                              <div className="flex items-start justify-between mb-4">
                                <span className={`text-sm font-rajdhani font-bold uppercase tracking-widest transition-colors ${isSelected ? "text-white" : "text-white/50 group-hover:text-white/80"}`}>
                                  {session}
                                </span>
                                {isSelected && <div className="w-2 h-2 rounded-full bg-apex-red shadow-[0_0_10px_#e10600]" />}
                              </div>
                              <div className="flex items-center text-[10px] font-rajdhani font-bold text-white/40 uppercase tracking-widest mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                {event.is_completed
                                  ? <><Activity className="w-3.5 h-3.5 mr-1.5" /> Browse Archive</>
                                  : <><Radio className="w-3.5 h-3.5 mr-1.5" /> Live Timing</>
                                }
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
