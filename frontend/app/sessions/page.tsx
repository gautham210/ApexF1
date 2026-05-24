"use client";
import { useEffect, useState } from "react";
import { useSessionContext } from "@/lib/hooks/useSessionContext";
import { f1Api } from "@/lib/api/client";
import { CalendarDays, ChevronRight, Activity, Radio, CheckCircle2, Clock, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import type { ScheduleEvent } from "@/lib/store";

const AVAILABLE_YEARS = [2025, 2024, 2023, 2022, 2021, 2020];
const STANDARD_SESSIONS = ["FP1", "FP2", "FP3", "Qualifying", "Race"];
const SPRINT_SESSIONS   = ["FP1", "Sprint Qualifying", "Sprint", "Qualifying", "Race"];

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
    selectedYear, selectedRound, selectedSession,
    setSelectedYear, setSelectedRound, setSelectedSession,
    setCurrentRace, setScheduleCache,
    schedule: cachedSchedule, nextRace,
  } = useSessionContext();

  // Use store cache if available and for the same year; otherwise fetch
  const [schedule, setSchedule]       = useState<ScheduleEvent[]>(cachedSchedule);
  const [loading, setLoading]         = useState(cachedSchedule.length === 0);
  const [expandedRound, setExpanded]  = useState<number | null>(null);

  // Sync local schedule with store cache if already populated
  useEffect(() => {
    if (cachedSchedule.length > 0) {
      setSchedule(cachedSchedule);
      setLoading(false);
    }
  }, [cachedSchedule]);

  // Fetch schedule when cache is empty (year just changed or first load)
  useEffect(() => {
    if (cachedSchedule.length > 0) return; // cache hit — skip network call
    setLoading(true);
    f1Api.getSchedule(selectedYear)
      .then((res: any) => {
        const data = (res as any)?.data ?? res;
        const events: ScheduleEvent[] = Array.isArray(data) ? data : [];
        setSchedule(events);
        setScheduleCache(events, selectedYear);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear]);

  const handleSelect = (event: ScheduleEvent, session: string) => {
    setSelectedRound(event.round_number);
    setSelectedSession(session);
    setCurrentRace(event);
    router.push(event.is_completed ? "/telemetry" : "/live-timing");
  };

  return (
    <div className="p-4 lg:p-6 min-h-screen max-w-5xl mx-auto animate-fade-up">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <p className="label-xs mb-2">Formula 1 · Race Calendar</p>
          <h1 className="font-orbitron font-bold text-white text-3xl tracking-tight">SESSION BROWSER</h1>
        </div>

        {/* Year selector */}
        <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.07] p-1 rounded-xl overflow-x-auto hide-scrollbar">
          {AVAILABLE_YEARS.map(y => (
            <button
              key={y}
              onClick={() => setSelectedYear(y)}
              className="px-4 py-1.5 rounded-lg font-rajdhani font-bold text-sm flex-shrink-0 transition-all duration-200"
              style={{
                background: selectedYear === y ? "rgba(255,255,255,0.09)" : "transparent",
                color:      selectedYear === y ? "#fff" : "rgba(255,255,255,0.35)",
              }}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* ── Schedule list ───────────────────────────────────── */}
      <div className="space-y-2">
        {loading ? (
          Array(12).fill(0).map((_, i) => <div key={i} className="h-16 skeleton rounded-xl" />)
        ) : schedule.length === 0 ? (
          <div className="card p-16 text-center label-xs">No schedule data for {selectedYear}</div>
        ) : (
          schedule.map((event) => {
            const isExp     = expandedRound === event.round_number;
            const isSprint  = event.event_name?.toLowerCase().includes("sprint");
            const sessions  = isSprint ? SPRINT_SESSIONS : STANDARD_SESSIONS;
            const isNext    = nextRace?.round_number === event.round_number;
            const dateStr   = formatDateRange(event.session1_date, event.session5_date);

            return (
              <motion.div
                key={event.round_number}
                layout
                className="overflow-hidden rounded-xl border transition-colors"
                style={{
                  borderColor: isNext
                    ? "rgba(225,6,0,0.35)"
                    : isExp
                    ? "rgba(255,255,255,0.10)"
                    : "rgba(255,255,255,0.05)",
                  background: isNext
                    ? "rgba(225,6,0,0.04)"
                    : "rgba(15,15,26,0.8)",
                }}
              >
                {/* Row */}
                <div
                  className="flex items-center justify-between px-4 py-3.5 cursor-pointer hover:bg-white/[0.03] transition-colors"
                  onClick={() => setExpanded(isExp ? null : event.round_number)}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    {/* Round number */}
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      <span className="font-orbitron font-bold text-white/50 text-sm">{event.round_number}</span>
                    </div>

                    {/* Name + meta */}
                    <div className="min-w-0">
                      <h3 className="font-rajdhani font-bold text-white text-base tracking-wide leading-tight truncate">
                        {event.event_name || `${event.country} Grand Prix`}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="label-xs">{event.location || event.country}</span>
                        {dateStr && <span className="label-xs">· {dateStr}</span>}

                        {event.is_completed ? (
                          <span className="label-xs text-[#4ade80] flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Done
                          </span>
                        ) : isNext ? (
                          <span className="label-xs text-apex-red flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Next Race
                          </span>
                        ) : (
                          <span className="label-xs text-[#60a5fa] flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Upcoming
                          </span>
                        )}

                        {/* Currently selected indicator */}
                        {selectedRound === event.round_number && (
                          <span className="label-xs text-apex-red border border-apex-red/30 px-1.5 py-0.5 rounded">
                            Selected
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <ChevronDown
                    className="w-4 h-4 text-white/30 transition-transform flex-shrink-0"
                    style={{ transform: isExp ? "rotate(180deg)" : "rotate(0deg)" }}
                  />
                </div>

                {/* Expanded sessions */}
                <AnimatePresence>
                  {isExp && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 border-t border-white/[0.05]">
                        {sessions.map((session) => {
                          const isSel = selectedRound === event.round_number && selectedSession === session;
                          return (
                            <button
                              key={session}
                              onClick={() => handleSelect(event, session)}
                              className="p-3 rounded-lg border text-left transition-all duration-200 group"
                              style={{
                                borderColor: isSel ? "rgba(255,255,255,0.2)"  : "rgba(255,255,255,0.05)",
                                background:  isSel ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.02)",
                              }}
                            >
                              <p className="font-rajdhani font-bold text-sm text-white mb-1">{session}</p>
                              <div className="flex items-center gap-1 label-xs opacity-0 group-hover:opacity-100 transition-opacity">
                                {event.is_completed
                                  ? <><Activity className="w-3 h-3" /> Archive</>
                                  : <><Radio className="w-3 h-3" /> Live</>
                                }
                              </div>
                            </button>
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
