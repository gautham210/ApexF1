"use client";
import { useEffect, useState } from "react";
import { useSessionContext } from "@/lib/hooks/useSessionContext";
import { f1Api } from "@/lib/api/client";
import { ChevronRight, Radio, CheckCircle2, Clock, Calendar, CloudRain, Sun, Cloud, CloudSnow } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import type { ScheduleEvent } from "@/lib/store";

const AVAILABLE_YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020];
const STANDARD_SESSIONS = [
  { name: "Practice 1", code: "FP1", type: "practice" },
  { name: "Practice 2", code: "FP2", type: "practice" },
  { name: "Practice 3", code: "FP3", type: "practice" },
  { name: "Qualifying", code: "Qualifying", type: "qualifying" },
  { name: "Grand Prix", code: "Race", type: "race" }
];
const SPRINT_SESSIONS = [
  { name: "Practice 1", code: "FP1", type: "practice" },
  { name: "Sprint Qualifying", code: "Sprint Qualifying", type: "qualifying" },
  { name: "Sprint", code: "Sprint", type: "race" },
  { name: "Qualifying", code: "Qualifying", type: "qualifying" },
  { name: "Grand Prix", code: "Race", type: "race" }
];

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

function formatDateRange(s1?: string, s5?: string): string {
  try {
    const start = s1 ? new Date(s1) : null;
    const end   = s5 ? new Date(s5) : (s1 ? new Date(s1) : null);
    if (!end) return "";
    const m = MONTHS[end.getMonth()];
    if (start && end && start.getMonth() === end.getMonth())
      return `${start.getDate()}–${end.getDate()} ${m}`;
    if (start && end)
      return `${start.getDate()} ${MONTHS[start.getMonth()]} – ${end.getDate()} ${m}`;
    return `${end.getDate()} ${m}`;
  } catch { return ""; }
}

export default function SessionsPage() {
  const router = useRouter();
  const {
    season, selectedRound, selectedSession,
    setSelectedYear, setSelectedRound, setSelectedSession,
    setCurrentRace, setScheduleCache,
    schedule: cachedSchedule, nextEvent,
  } = useSessionContext();

  const [schedule, setSchedule]       = useState<ScheduleEvent[]>(cachedSchedule);
  const [loading, setLoading]         = useState(cachedSchedule.length === 0);
  const [selectedEventIndex, setSelectedEventIndex] = useState<number>(0);

  // Sync local schedule with store cache if already populated
  useEffect(() => {
    if (cachedSchedule.length > 0) {
      setSchedule(cachedSchedule);
      setLoading(false);
      
      // Auto-focus on selected round or active event
      const activeRound = selectedRound || 1;
      const idx = cachedSchedule.findIndex(e => e.round_number === activeRound);
      if (idx !== -1) {
        setSelectedEventIndex(idx);
      }
    }
  }, [cachedSchedule, selectedRound]);

  // Fetch schedule when cache is empty
  useEffect(() => {
    if (cachedSchedule.length > 0) return;
    setLoading(true);
    f1Api.getSchedule(season)
      .then((res: any) => {
        const data = (res as any)?.data ?? res;
        const events: ScheduleEvent[] = Array.isArray(data) ? data : [];
        setSchedule(events);
        setScheduleCache(events, season);
        if (events.length > 0) {
          const idx = events.findIndex(e => e.round_number === selectedRound);
          setSelectedEventIndex(idx !== -1 ? idx : 0);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [season, cachedSchedule, selectedRound, setScheduleCache]);

  const handleSelectSession = (event: ScheduleEvent, sessionCode: string) => {
    setSelectedRound(event.round_number);
    setSelectedSession(sessionCode);
    setCurrentRace(event);
    router.push("/live-timing");
  };

  const activeEvent = schedule[selectedEventIndex] || null;

  // procedural weather mapping based on track coordinates or generic
  const weatherIcon = (round: number) => {
    if (round % 5 === 0) return <CloudRain className="w-4 h-4 text-blue-400" />;
    if (round % 3 === 0) return <Cloud className="w-4 h-4 text-white/50" />;
    return <Sun className="w-4 h-4 text-amber-400" />;
  };

  return (
    <div className="p-6 lg:p-12 min-h-screen max-w-[1500px] mx-auto space-y-10 animate-fade-up relative">

      {/* Soft atmospheric blurred race backdrop */}
      <div className="absolute top-[5%] left-[20%] w-[60%] h-[35%] bg-gradient-to-br from-apex-red/5 via-blue-500/5 to-transparent blur-[120px] pointer-events-none rounded-full z-0" />

      {/* ── Cinematic Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/5 z-10 relative">
        <div>
          <p className="text-xs font-bold text-white/35 tracking-widest uppercase mb-2">Grand Prix Calendar</p>
          <h1 className="font-sans font-bold text-white text-3xl lg:text-4xl tracking-tight uppercase">
            Weekend Session Browser
          </h1>
        </div>

        {/* Year selector */}
        <div className="flex items-center gap-1 bg-white/5 p-1 rounded-2xl border border-white/10 self-start md:self-auto backdrop-blur-md">
          {AVAILABLE_YEARS.map(y => (
            <button
              key={y}
              onClick={() => setSelectedYear(y)}
              className={`px-4 py-2 rounded-xl font-sans font-bold text-xs flex-shrink-0 transition-all duration-300 cursor-pointer ${
                season === y ? "bg-white/10 text-white border border-white/10 shadow-lg" : "text-white/45 hover:text-white/90 border border-transparent"
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4 z-10 relative">
          <div className="h-[200px] skeleton rounded-3xl" />
          <div className="h-[120px] skeleton rounded-3xl" />
        </div>
      ) : schedule.length === 0 ? (
        <div className="py-24 text-center text-white/30 text-xs font-sans uppercase z-10 relative">
          No calendar sessions retrieved for {season}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 z-10 relative">
          
          {/* Left: Netflix episode list (Races) */}
          <div className="lg:col-span-1 space-y-3 max-h-[650px] overflow-y-auto pr-2 hide-scrollbar">
            <span className="text-[10px] font-bold text-white/30 tracking-widest uppercase px-1">
              Rounds Schedule
            </span>
            {schedule.map((event, idx) => {
              const isActive = selectedEventIndex === idx;
              const isNext = nextEvent?.round_number === event.round_number;
              const dateRange = formatDateRange(event.session1_date, event.session5_date);

              return (
                <div
                  key={event.round_number}
                  onClick={() => setSelectedEventIndex(idx)}
                  className={`p-4 rounded-xl border transition-all duration-300 cursor-pointer flex items-center justify-between apple-rail-item ${
                    isActive
                      ? "glass-strong border-white/15 bg-white/5"
                      : isNext
                      ? "glass border-apex-red/30 hover:border-apex-red/50 bg-[#ff3333]/5"
                      : "glass border-white/5 hover:border-white/10"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold text-white/30 tracking-wider">
                      ROUND {event.round_number} · {dateRange}
                    </p>
                    <h3 className="font-sans font-bold text-white text-[14px] tracking-tight leading-tight mt-1.5 truncate">
                      {event.location || event.country}
                    </h3>
                  </div>

                  <div className="flex items-center gap-3">
                    {event.is_completed ? (
                      <span className="text-[9px] font-semibold text-emerald-400 uppercase tracking-wider">Completed</span>
                    ) : isNext ? (
                      <span className="text-[9px] font-semibold text-[#ff3333] uppercase tracking-wider animate-pulse">Next GP</span>
                    ) : (
                      <span className="text-[9px] font-semibold text-white/30 uppercase tracking-wider">Upcoming</span>
                    )}
                    <ChevronRight className={`w-4 h-4 transition-transform ${isActive ? "text-white" : "text-white/20"}`} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: Selected Race Details & Episode (Session) Grid */}
          <div className="lg:col-span-2 space-y-8">
            {activeEvent && (
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeEvent.round_number}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="space-y-8"
                >
                  {/* Cinematic Mini-Hero for active event */}
                  <div className="relative overflow-hidden rounded-[24px] border border-white/5 glass-strong p-8 flex flex-col md:flex-row justify-between gap-6 min-h-[160px]">
                    <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/[0.01] blur-3xl pointer-events-none" />
                    <div>
                      <span className="text-[10px] font-bold text-white/30 tracking-widest uppercase">
                        Round {activeEvent.round_number} · {activeEvent.country}
                      </span>
                      <h2 className="font-sans font-bold text-white text-2xl tracking-tight mt-2 uppercase">
                        {activeEvent.event_name}
                      </h2>
                      <p className="font-sans text-white/40 text-xs mt-3 flex items-center gap-2">
                        <span>{activeEvent.location}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1 font-semibold">
                          {weatherIcon(activeEvent.round_number)}
                          Forecast Clear
                        </span>
                      </p>
                    </div>

                    <div className="self-end md:self-auto flex items-center bg-white/5 border border-white/10 p-4 rounded-xl">
                      <Calendar className="w-5 h-5 text-white/30 mr-3" />
                      <div>
                        <p className="text-[9px] text-white/30 font-bold uppercase tracking-widest leading-none">Schedule Dates</p>
                        <p className="font-sans text-white/80 text-xs mt-1 font-semibold">{formatDateRange(activeEvent.session1_date, activeEvent.session5_date)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Sessions Episodes Rail */}
                  <div className="space-y-4">
                    <span className="text-[10px] font-bold text-white/30 tracking-widest uppercase px-1">
                      Event Sessions & Replays
                    </span>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {((activeEvent.event_name?.toLowerCase().includes("sprint") ? SPRINT_SESSIONS : STANDARD_SESSIONS)).map((s, sIdx) => {
                        const isSprint = s.code.includes("Sprint");
                        const dateProp = sIdx === 0 ? activeEvent.session1_date 
                                      : sIdx === 1 ? (isSprint ? activeEvent.session2_date : activeEvent.session2_date) 
                                      : sIdx === 2 ? (isSprint ? activeEvent.session3_date : activeEvent.session3_date) 
                                      : sIdx === 3 ? activeEvent.session4_date 
                                      : activeEvent.session5_date;
                        const dateStr = dateProp ? new Date(dateProp).toLocaleTimeString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }) : "Schedule TBD";

                        return (
                          <div
                            key={s.code}
                            onClick={() => handleSelectSession(activeEvent, s.code)}
                            className="glass rounded-2xl p-5 flex flex-col justify-between h-[120px] transition-all cursor-pointer group border border-white/5 apple-rail-item"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="text-[9px] font-bold text-white/20 uppercase tracking-wider">{s.code}</span>
                                <h4 className="font-sans font-bold text-white text-base tracking-tight mt-1 group-hover:text-[#ff3333] transition-colors">
                                  {s.name}
                                </h4>
                              </div>

                              {activeEvent.is_completed ? (
                                <span className="text-[9px] font-semibold text-emerald-400 flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Replay Log Ready
                                </span>
                              ) : (
                                <span className="text-[9px] font-semibold text-white/25 flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> Standby
                                </span>
                              )}
                            </div>

                            <div className="flex justify-between items-center border-t border-white/5 pt-2 mt-2">
                              <span className="text-[10px] text-white/35 font-medium">{dateStr}</span>
                              <span className="text-[10px] font-bold text-[#ff3333] opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-wider">
                                {activeEvent.is_completed ? "Load Replay" : "Standby"} →
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </motion.div>
              </AnimatePresence>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
