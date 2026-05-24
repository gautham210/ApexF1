"use client";
import { useEffect, useState, useMemo } from "react";
import { f1Api } from "@/lib/api/client";
import { useSessionContext } from "@/lib/hooks/useSessionContext";
import { useLiveSession } from "@/lib/hooks/useLiveSession";
import {
  CalendarDays, ChevronRight, Trophy, Zap, Thermometer,
  Droplets, Radio, PlayCircle, Clock, Info, Compass, Activity
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

// High-fidelity dynamic circuit vector visualizer
function CircuitVector({ country, location }: { country: string; location: string }) {
  const norm = (country || location || "").toLowerCase().trim();
  
  const track = useMemo(() => {
    if (norm.includes("canada") || norm.includes("montreal")) {
      return {
        path: "M 10 50 C 12 32, 28 20, 36 28 L 44 38 C 48 44, 52 44, 56 38 L 70 18 C 74 12, 82 12, 86 18 L 110 46 C 114 50, 114 58, 108 62 L 94 70 C 88 74, 80 70, 76 62 L 70 50 C 66 44, 58 44, 54 50 L 46 68 C 42 76, 32 78, 26 70 L 12 56 Z",
        length: "4.361 km",
        laps: 70,
        drs: 3,
        name: "Circuit Gilles Villeneuve"
      };
    }
    if (norm.includes("monaco") || norm.includes("monte carlo")) {
      return {
        path: "M 10 35 C 12 30, 18 10, 26 12 C 32 14, 38 28, 48 30 C 58 32, 62 10, 72 8 C 82 6, 92 12, 94 22 C 96 32, 88 40, 84 46 C 80 52, 88 56, 86 64 C 84 72, 72 78, 62 76 C 52 74, 46 64, 42 66 C 38 68, 36 78, 30 80 C 24 82, 14 74, 12 64 C 10 54, 8 40, 10 35 Z",
        length: "3.337 km",
        laps: 78,
        drs: 1,
        name: "Circuit de Monaco"
      };
    }
    if (norm.includes("miami")) {
      return {
        path: "M 10 40 L 40 18 C 45 15, 55 15, 60 18 L 90 40 C 95 44, 95 56, 90 60 L 80 72 C 75 77, 65 77, 60 72 L 50 62 C 45 57, 35 57, 30 62 L 20 72 C 15 77, 5 72, 8 62 L 10 40 Z",
        length: "5.412 km",
        laps: 57,
        drs: 3,
        name: "Miami International Autodrome"
      };
    }
    if (norm.includes("abu dhabi") || norm.includes("yas marina")) {
      return {
        path: "M 10 20 L 48 20 C 52 20, 56 24, 58 28 L 74 62 C 76 66, 80 70, 84 70 L 108 70 C 112 70, 115 75, 112 80 L 98 94 C 94 98, 86 98, 82 94 L 54 66 C 50 62, 40 62, 36 66 L 24 78 C 20 82, 12 80, 10 74 L 6 34 C 5 26, 7 20, 10 20 Z",
        length: "5.281 km",
        laps: 58,
        drs: 2,
        name: "Yas Marina Circuit"
      };
    }
    if (norm.includes("bahrain") || norm.includes("sakhir")) {
      return {
        path: "M 15 25 L 50 18 L 85 25 C 90 28, 90 38, 85 42 L 55 58 C 50 62, 45 68, 48 74 L 62 82 C 65 85, 60 90, 52 88 L 22 74 C 18 70, 16 64, 18 58 Z",
        length: "5.412 km",
        laps: 57,
        drs: 3,
        name: "Bahrain International Circuit"
      };
    }
    return {
      path: "M 25 50 C 35 30, 58 28, 70 45 C 82 62, 102 62, 110 45 C 115 34, 105 18, 88 18 C 70 18, 60 35, 48 40 Z",
      length: "5.891 km",
      laps: 52,
      drs: 2,
      name: "Grand Prix Circuit Layout"
    };
  }, [norm]);

  return (
    <div className="relative w-full h-full flex flex-col justify-between p-8">
      {/* Subtle Spatial grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none rounded-3xl" />
      
      <div className="relative flex justify-between items-start z-10">
        <div>
          <span className="text-[10px] font-bold text-white/30 tracking-widest uppercase">
            Circuit Profile
          </span>
          <h4 className="font-sans font-bold text-white text-base tracking-tight mt-1">
            {track.name}
          </h4>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-white/30 tracking-wider uppercase">Distance</p>
          <p className="font-sans font-semibold text-sm text-white/80">{track.length}</p>
        </div>
      </div>

      {/* SVG Path rendering */}
      <div className="relative w-full h-[150px] flex items-center justify-center my-6">
        <svg className="w-full h-full max-w-[280px]" viewBox="0 0 120 100">
          <defs>
            <linearGradient id="circuit-glow" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.12)" stopOpacity={0.8} />
              <stop offset="100%" stopColor="rgba(255,255,255,0.05)" stopOpacity={0.4} />
            </linearGradient>
            <linearGradient id="active-glow" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff3333" stopOpacity={1} />
              <stop offset="100%" stopColor="#ff7700" stopOpacity={0.8} />
            </linearGradient>
          </defs>
          {/* Subtle back outline */}
          <path
            d={track.path}
            fill="none"
            stroke="rgba(255,255,255,0.02)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Main track contour */}
          <path
            d={track.path}
            fill="none"
            stroke="url(#circuit-glow)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Animated active racing line */}
          <path
            d={track.path}
            fill="none"
            stroke="url(#active-glow)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="circuit-animate"
          />
        </svg>
      </div>

      <div className="relative flex justify-between items-center z-10 border-t border-white/5 pt-4">
        <div className="flex gap-6">
          <div>
            <span className="text-[10px] text-white/30 uppercase tracking-wider">Laps</span>
            <p className="font-sans font-semibold text-sm text-white mt-0.5">{track.laps}</p>
          </div>
          <div>
            <span className="text-[10px] text-white/30 uppercase tracking-wider">DRS Sectors</span>
            <p className="font-sans font-semibold text-sm text-white mt-0.5">{track.drs}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[9px] font-sans text-white/35 uppercase tracking-widest font-semibold">
          <Compass className="w-3.5 h-3.5 text-white/20 animate-spin-slow" /> Official Outline
        </div>
      </div>
    </div>
  );
}

// Elegant Countdown visual
function CountdownTimer({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);

  useEffect(() => {
    if (!targetDate) return;
    const target = new Date(targetDate).getTime();
    const tick = () => {
      const difference = target - new Date().getTime();
      if (difference <= 0) {
        setTimeLeft(null);
      } else {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((difference % (1000 * 60)) / 1000),
        });
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (!timeLeft) {
    return <span className="text-emerald-400 font-sans font-bold text-xs tracking-widest uppercase animate-pulse">WEEKEND ACTIVE</span>;
  }

  return (
    <div className="flex gap-4">
      {[
        { value: timeLeft.days, label: "Days" },
        { value: timeLeft.hours, label: "Hours" },
        { value: timeLeft.minutes, label: "Mins" },
        { value: timeLeft.seconds, label: "Secs", highlight: true },
      ].map((t, idx) => (
        <div key={idx} className="flex flex-col items-center">
          <span className={`font-sans font-semibold text-2xl tracking-tight leading-none ${t.highlight ? "text-apex-red" : "text-white/90"}`}>
            {String(t.value).padStart(2, "0")}
          </span>
          <span className="text-[9px] text-white/30 uppercase mt-1.5 tracking-wider font-semibold">
            {t.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  const { season, currentRace, nextEvent, isLiveWeekend, activeEvent, completedEvent } = useSessionContext();
  const live = useLiveSession();

  const [ctx, setCtx] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await f1Api.getDashboardContext(season);
        const data = (res as any)?.data ?? res;
        setCtx(data);
      } catch (e) {
        console.error("[Dashboard] context fetch failed:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [season]);

  // Chronological Visual Timeline Rail
  const weekendTimeline = useMemo(() => {
    if (!currentRace) return [];
    const baseDate = currentRace.event_date ? new Date(currentRace.event_date) : new Date();
    
    const parse = (dStr: string | undefined, daysOffset: number, hour: number) => {
      if (dStr) return new Date(dStr);
      const d = new Date(baseDate);
      d.setDate(d.getDate() - daysOffset);
      d.setHours(hour, 0, 0, 0);
      return d;
    };

    return [
      { name: "Practice 1", code: "FP1", date: parse(currentRace.session1_date, 2, 13) },
      { name: "Practice 2", code: "FP2", date: parse(currentRace.session2_date, 2, 17) },
      { name: "Practice 3", code: "FP3", date: parse(currentRace.session3_date, 1, 12) },
      { name: "Qualifying", code: "QUALIFYING", date: parse(currentRace.session4_date, 1, 16) },
      { name: "Grand Prix", code: "RACE", date: parse(currentRace.session5_date, 0, 15) },
    ];
  }, [currentRace]);

  if (!mounted) return null;

  const insights = ctx?.insights ?? {};
  const news = ctx?.news ?? [];
  const drivers = ctx?.driver_standings ?? [];
  const constructors = ctx?.constructor_standings ?? [];

  const activeEventName = currentRace?.event_name || currentRace?.location || `${season} Season`;

  return (
    <div className="p-6 lg:p-12 min-h-screen max-w-[1600px] mx-auto space-y-16 animate-fade-up relative">
      
      {/* Soft atmospheric blurred race backdrop */}
      <div className="absolute top-[5%] left-[10%] w-[80%] h-[30%] bg-gradient-to-br from-apex-red/5 via-[#27F4D2]/2 to-transparent blur-[120px] pointer-events-none rounded-full z-0" />

      {/* ── 1. CINEMATIC HERO BROADCAST AREA ─────────────────── */}
      <div className="relative overflow-hidden glass rounded-[36px] shadow-2xl flex flex-col xl:flex-row min-h-[400px] z-10">
        
        {/* Organic overlay visual grids and shadows */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:32px_32px] opacity-20 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
        
        {/* Left: Metadata and cinematic info */}
        <div className="flex-1 p-10 lg:p-14 flex flex-col justify-between z-10 gap-10">
          <div>
            <div className="flex items-center gap-3 mb-6">
              {live.is_live ? (
                <div className="flex items-center gap-2 bg-[#ff3333]/10 border border-[#ff3333]/20 px-3 py-1 rounded-full text-[9px] font-bold text-[#ff3333] tracking-widest uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ff3333] animate-pulse" />
                  {live.state} Live Feed
                </div>
              ) : isLiveWeekend ? (
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1 rounded-full text-[9px] font-bold text-white/70 tracking-widest uppercase">
                  <CalendarDays className="w-3.5 h-3.5 text-white/40" /> Active Grand Prix Weekend
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1 rounded-full text-[9px] font-bold text-white/40 tracking-widest uppercase">
                  <Clock className="w-3.5 h-3.5 text-white/20" /> Historical Replay Center
                </div>
              )}

              {live.is_live && (
                <span className="text-[9px] font-semibold bg-white/5 text-white/50 border border-white/10 px-2.5 py-0.5 rounded uppercase tracking-wider">
                  Track Status: {live.session_info?.track_status || "GREEN"}
                </span>
              )}
            </div>

            <h1 className="font-sans font-bold text-white text-3xl lg:text-5xl tracking-tight leading-none uppercase max-w-2xl">
              {activeEventName}
            </h1>
            <p className="font-sans text-white/40 text-xs font-bold tracking-widest uppercase mt-4 flex items-center gap-3">
              <span>{currentRace?.location || currentRace?.country}</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span>Round {currentRace?.round_number}</span>
            </p>
          </div>

          {/* Interactive Info / Countdown Block */}
          <div className="flex flex-wrap items-center gap-10 border-t border-white/5 pt-8">
            {!live.is_live && nextEvent && (
              <div>
                <span className="text-[9px] text-white/35 font-bold tracking-widest uppercase">
                  Countdown to {nextEvent.country}
                </span>
                <div className="mt-3">
                  <CountdownTimer targetDate={nextEvent.session5_date || nextEvent.event_date || ""} />
                </div>
              </div>
            )}

            {live.is_live && (
              <Link
                href="/live-timing"
                className="px-6 py-3.5 rounded-xl font-sans font-bold text-xs tracking-widest uppercase flex items-center gap-2.5 text-black bg-white hover:bg-white/95 transition-all cursor-pointer shadow-lg"
              >
                <PlayCircle className="w-4 h-4" />
                Launch Live Center
              </Link>
            )}

            {!live.is_live && currentRace?.is_completed && (
              <Link
                href="/live-timing"
                className="px-6 py-3.5 rounded-xl font-sans font-bold text-xs tracking-widest uppercase flex items-center gap-2.5 text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer shadow-lg"
              >
                <Activity className="w-4 h-4 text-apex-red" />
                Analyze Telemetry Logs
              </Link>
            )}
          </div>
        </div>

        {/* Right: SVG Track outline */}
        <div className="w-full xl:w-[420px] border-t xl:border-t-0 xl:border-l border-white/10 bg-white/[0.01]">
          <CircuitVector country={currentRace?.country || ""} location={currentRace?.location || ""} />
        </div>
      </div>

      {/* ── 2. SCROLLABLE HORIZONTAL TIMELINE RAIL ───────────── */}
      <div className="space-y-6 z-10 relative">
        <div className="flex justify-between items-center px-2">
          <span className="text-xs font-bold tracking-widest text-white/40 uppercase flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-white/20" />
            Weekend Session Timeline
          </span>
          <span className="text-[9px] text-white/25 uppercase tracking-widest font-semibold">
            Chronological local track time
          </span>
        </div>

        <div className="flex gap-6 overflow-x-auto pb-4 pr-4 hide-scrollbar -mx-2 px-2">
          {weekendTimeline.map((s) => {
            const isFinished = currentRace?.is_completed || s.date < new Date();
            const isActive = live.is_live && live.state === s.code;

            return (
              <div
                key={s.code}
                className={`flex-shrink-0 w-[280px] glass p-6 rounded-2xl border apple-rail-item transition-all flex flex-col justify-between h-[130px] ${
                  isActive ? "border-[#ff3333]/30 bg-[#ff3333]/5" : "border-white/5"
                }`}
              >
                <div>
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-bold text-white/30 tracking-wider">{s.code}</span>
                    {isActive ? (
                      <span className="text-[8px] font-bold text-[#ff3333] bg-[#ff3333]/10 border border-[#ff3333]/20 px-2 py-0.5 rounded tracking-widest uppercase">
                        LIVE
                      </span>
                    ) : isFinished ? (
                      <span className="text-[8px] font-semibold text-white/40 bg-white/5 border border-white/10 px-2 py-0.5 rounded tracking-widest uppercase">
                        COMPLETED
                      </span>
                    ) : (
                      <span className="text-[8px] font-semibold text-white/25 bg-white/5 border border-white/5 px-2 py-0.5 rounded tracking-widest uppercase">
                        UPCOMING
                      </span>
                    )}
                  </div>
                  <h4 className="font-sans font-bold text-white text-base tracking-tight mt-2.5">
                    {s.name}
                  </h4>
                </div>

                <div className="flex justify-between items-center border-t border-white/5 pt-2 mt-2 text-[10px] text-white/35 font-medium">
                  <span>
                    {s.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                  </span>
                  <span className="font-semibold text-white/50">
                    {s.date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 3. NEWS RAIL (Apple TV Widescreen Cinematic Thumbnails) ──── */}
      <div className="space-y-6 z-10 relative">
        <span className="text-xs font-bold tracking-widest text-white/40 uppercase flex items-center gap-2 px-2">
          <Radio className="w-4 h-4 text-white/20" />
          Paddock Headlines & Analysis
        </span>

        <div className="flex gap-6 overflow-x-auto pb-4 pr-4 hide-scrollbar -mx-2 px-2">
          {loading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-[400px] h-[220px] skeleton rounded-3xl" />
            ))
          ) : news.length > 0 ? (
            news.slice(0, 4).map((item: any, i: number) => {
              return (
                <a
                  key={i}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 w-[400px] h-[220px] glass rounded-[24px] border border-white/5 apple-rail-item flex flex-col justify-between p-8 relative overflow-hidden group cursor-pointer"
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-white/[0.01] via-transparent to-black/40 z-0" />
                  
                  <div className="relative flex justify-between items-start z-10">
                    <span className="text-[9px] font-bold border border-white/10 px-2 py-0.5 rounded text-white/40 tracking-widest uppercase">
                      {item.tag || "PADDOCK"}
                    </span>
                    <span className="text-[9px] font-bold text-white/30 tracking-widest uppercase">
                      {item.source || "F1 Journal"}
                    </span>
                  </div>

                  <div className="relative z-10 space-y-4">
                    <h3 className="font-sans font-bold text-white text-base leading-snug tracking-wide group-hover:text-[#ff3333] transition-colors line-clamp-3">
                      {item.title}
                    </h3>
                    <div className="flex justify-between items-center border-t border-white/5 pt-2 text-[9px] font-bold tracking-widest text-[#ff3333] opacity-0 group-hover:opacity-100 transition-opacity">
                      <span>READ ARTICLE</span>
                      <ChevronRight className="w-3.5 h-3.5 transform translate-x-[-4px] group-hover:translate-x-0 transition-transform" />
                    </div>
                  </div>
                </a>
              );
            })
          ) : (
            <div className="w-full text-center py-10 text-white/30 text-xs font-sans tracking-wide">
              No event headlines compiled for this session.
            </div>
          )}
        </div>
      </div>

      {/* ── 4. VISUAL MOMENTUM & LEADERS ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 z-10 relative">
        
        {/* Visual Insights Card */}
        <div className="glass rounded-[28px] p-8 space-y-6">
          <div className="flex items-center gap-2.5 border-b border-white/5 pb-4">
            <Zap className="w-4 h-4 text-amber-500" />
            <h3 className="text-xs font-bold text-white/70 tracking-widest uppercase">
              Event Insights
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Pace Leader", key: "driver_in_form", color: "text-emerald-400" },
              { label: "Position Gain", key: "biggest_gainer", color: "text-[#ff3333]" },
              { label: "Qualifying Standard", key: "fastest_qualifier", color: "text-blue-400" },
              { label: "Recent Victor", key: "recent_winner", color: "text-yellow-400" },
            ].map((insight) => {
              const item = insights[insight.key];
              return (
                <div key={insight.key} className="bg-white/[0.01] border border-white/5 rounded-2xl p-5 flex flex-col justify-between hover:bg-white/[0.03] transition-colors">
                  <div>
                    <span className="text-[9px] text-white/30 font-bold uppercase tracking-widest leading-none">
                      {insight.label}
                    </span>
                    {loading ? (
                      <div className="h-5 w-3/4 skeleton rounded mt-2" />
                    ) : (
                      <h4 className="font-sans font-bold text-white text-sm mt-2 truncate">
                        {item?.name || "—"}
                      </h4>
                    )}
                  </div>
                  {!loading && item?.stat && (
                    <span className={`text-[10px] font-semibold uppercase mt-3 pt-2 border-t border-white/5 tracking-wider ${insight.color}`}>
                      {item.stat}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Championship Top Drivers */}
        <div className="glass rounded-[28px] p-8 flex flex-col justify-between h-full">
          <div className="flex justify-between items-center border-b border-white/5 pb-4">
            <div className="flex items-center gap-2.5">
              <Trophy className="w-4 h-4 text-yellow-500" />
              <h3 className="text-xs font-bold text-white/70 tracking-widest uppercase">
                Championship Leaders
              </h3>
            </div>
            <Link href="/standings" className="text-[9px] font-bold tracking-widest text-white/40 uppercase hover:text-white transition-colors">
              View Standings
            </Link>
          </div>

          <div className="space-y-3 mt-6 flex-1">
            {loading ? (
              Array(3).fill(0).map((_, i) => (
                <div key={i} className="h-12 skeleton rounded-xl" />
              ))
            ) : drivers.slice(0, 3).map((d: any, idx: number) => {
              // Minimalist team colors: subtle left border moment only!
              return (
                <div key={idx} className="flex items-center justify-between p-4 bg-white/[0.01] hover:bg-white/[0.03] transition-colors border border-white/5 rounded-xl"
                     style={{ borderLeft: `3px solid ${d.color || "#888888"}` }}>
                  <div className="flex items-center gap-4">
                    <span className="font-sans font-semibold text-xs text-white/30 w-4 text-center">{d.position}</span>
                    <div>
                      <p className="font-sans font-bold text-white text-sm leading-none">{d.name}</p>
                      <p className="text-[9px] text-white/35 font-sans font-semibold uppercase mt-1 tracking-wider">{d.team}</p>
                    </div>
                  </div>
                  <span className="font-sans font-bold text-xs text-white">
                    {d.points} <span className="text-[9px] text-white/40 font-normal ml-0.5">PTS</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
}
