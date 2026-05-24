"use client";
import { useEffect, useState, useMemo } from "react";
import { f1Api } from "@/lib/api/client";
import { useSessionContext } from "@/lib/hooks/useSessionContext";
import { useLiveSession } from "@/lib/hooks/useLiveSession";
import {
  CalendarDays, ChevronRight, Trophy, Zap, Thermometer,
  Droplets, Radio, PlayCircle, Clock, Info, Compass
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

// High-fidelity dynamic circuit vector visualizer
function CircuitVector({ country, location }: { country: string; location: string }) {
  const norm = (country || location || "").toLowerCase().trim();
  
  const track = useMemo(() => {
    if (norm.includes("canada") || norm.includes("montreal")) {
      return {
        path: "M 20 40 L 45 42 L 55 30 L 80 34 L 95 48 L 80 72 L 55 65 L 50 78 L 30 72 L 25 54 Z",
        length: "4.361 km",
        laps: 70,
        drs: 3,
        name: "Circuit Gilles Villeneuve"
      };
    }
    if (norm.includes("monaco") || norm.includes("monte carlo")) {
      return {
        path: "M 15 35 C 25 22, 40 22, 45 32 C 50 44, 62 48, 68 36 C 78 20, 95 20, 100 32 C 105 48, 88 80, 70 85 C 52 90, 35 85, 18 68 Z",
        length: "3.337 km",
        laps: 78,
        drs: 1,
        name: "Circuit de Monaco"
      };
    }
    if (norm.includes("miami") || norm.includes("united states")) {
      return {
        path: "M 15 50 L 38 28 L 72 28 L 95 50 L 82 78 L 48 78 L 38 65 L 15 50 Z",
        length: "5.412 km",
        laps: 57,
        drs: 3,
        name: "Miami International Autodrome"
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
          <span className="text-[10px] font-bold text-white/40 tracking-widest uppercase">
            Circuit Profile
          </span>
          <h4 className="font-sans font-bold text-white text-base tracking-tight mt-1">
            {track.name}
          </h4>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-white/30 tracking-wider uppercase">Distance</p>
          <p className="font-sans font-bold text-sm text-white/80">{track.length}</p>
        </div>
      </div>

      {/* SVG Path rendering */}
      <div className="relative w-full h-[150px] flex items-center justify-center my-6">
        <svg className="w-full h-full max-w-[280px]" viewBox="0 0 120 100">
          <defs>
            <linearGradient id="circuit-glow" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#e10600" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#ff5e00" stopOpacity={0.6} />
            </linearGradient>
          </defs>
          <path
            d={track.path}
            fill="none"
            stroke="rgba(255,255,255,0.02)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={track.path}
            fill="none"
            stroke="url(#circuit-glow)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <div className="relative flex justify-between items-center z-10 border-t border-white/5 pt-4">
        <div className="flex gap-6">
          <div>
            <span className="text-[10px] text-white/30 uppercase tracking-wider">Laps</span>
            <p className="font-sans font-bold text-sm text-white mt-0.5">{track.laps}</p>
          </div>
          <div>
            <span className="text-[10px] text-white/30 uppercase tracking-wider">DRS Sectors</span>
            <p className="font-sans font-bold text-sm text-white mt-0.5">{track.drs}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[9px] font-sans text-white/40 uppercase tracking-widest">
          <Compass className="w-3.5 h-3.5 text-white/20" /> Scale Verifiable
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
    <div className="p-6 lg:p-12 min-h-screen max-w-[1600px] mx-auto space-y-16 animate-fade-up">

      {/* ── 1. CINEMATIC HERO BROADCAST AREA ─────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-white/[0.02] to-transparent rounded-[32px] border border-white/[0.05] shadow-2xl flex flex-col xl:flex-row min-h-[380px]">
        
        {/* Soft atmospheric radial gradients */}
        <div className="absolute top-0 left-0 w-96 h-96 rounded-full bg-apex-red/5 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-blue-500/5 blur-[140px] pointer-events-none" />
        
        {/* Left: Metadata and cinematic info */}
        <div className="flex-1 p-10 lg:p-12 flex flex-col justify-between z-10 gap-8">
          <div>
            <div className="flex items-center gap-3 mb-6">
              {live.is_live ? (
                <div className="flex items-center gap-2 bg-[#e10600]/10 border border-[#e10600]/20 px-3 py-1 rounded-full text-[10px] font-bold text-[#e10600] animate-pulse tracking-widest uppercase">
                  <Radio className="w-3 h-3" /> {live.state} Live Feed
                </div>
              ) : isLiveWeekend ? (
                <div className="flex items-center gap-2 bg-amber-400/10 border border-amber-400/20 px-3 py-1 rounded-full text-[10px] font-bold text-amber-400 tracking-widest uppercase">
                  <CalendarDays className="w-3 h-3" /> Current Weekend
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1 rounded-full text-[10px] font-bold text-white/50 tracking-widest uppercase">
                  <Clock className="w-3 h-3" /> Historical Archive
                </div>
              )}

              {live.is_live && (
                <span className="text-[9px] font-semibold bg-white/5 text-white/70 border border-white/10 px-2.5 py-0.5 rounded uppercase tracking-wider">
                  Track Status: {live.session_info?.track_status || "GREEN"}
                </span>
              )}
            </div>

            <h1 className="font-sans font-bold text-white text-3xl lg:text-5xl tracking-tight leading-none uppercase">
              {activeEventName}
            </h1>
            <p className="font-sans text-white/50 text-xs font-semibold tracking-widest uppercase mt-4 flex items-center gap-3">
              <span>{currentRace?.location || currentRace?.country}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-white/10" />
              <span>Round {currentRace?.round_number}</span>
            </p>
          </div>

          {/* Interactive Info / Countdown Block */}
          <div className="flex flex-wrap items-center gap-10 border-t border-white/5 pt-8">
            {!live.is_live && nextEvent && (
              <div>
                <span className="text-[10px] text-white/40 font-bold tracking-widest uppercase">
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
                className="px-6 py-3.5 rounded-xl font-sans font-bold text-xs tracking-widest uppercase flex items-center gap-2.5 text-white bg-gradient-to-r from-apex-red to-orange-600 shadow-xl hover:opacity-90 transition-all cursor-pointer"
              >
                <PlayCircle className="w-4 h-4 text-white animate-pulse" />
                Launch Live Stream
              </Link>
            )}

            {!live.is_live && currentRace?.is_completed && (
              <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl px-6 py-4 flex items-center gap-4">
                <Info className="w-5 h-5 text-blue-400" />
                <div>
                  <p className="text-[9px] text-white/35 font-bold uppercase tracking-widest leading-none">Session Complete</p>
                  <p className="font-sans text-white/70 text-xs font-semibold mt-1">
                    Event telemetry processed and available for analysis
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: SVG Track outline */}
        <div className="w-full xl:w-[400px] border-t xl:border-t-0 xl:border-l border-white/[0.05] bg-white/[0.005]">
          <CircuitVector country={currentRace?.country || ""} location={currentRace?.location || ""} />
        </div>
      </div>

      {/* ── 2. SCROLLABLE HORIZONTAL TIMELINE RAIL ───────────── */}
      <div className="space-y-6">
        <div className="flex justify-between items-center px-2">
          <span className="text-xs font-bold tracking-widest text-white/40 uppercase flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-white/30" />
            Weekend Session Timeline
          </span>
          <span className="text-[10px] text-white/20 uppercase tracking-widest">
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
                className={`flex-shrink-0 w-[260px] bg-[#0c0c16]/50 p-6 rounded-2xl border transition-all flex flex-col justify-between h-[120px] ${
                  isActive ? "border-apex-red/40 bg-apex-red/[0.02]" : "border-white/[0.04] hover:border-white/[0.08]"
                }`}
              >
                <div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-white/40 tracking-wider">{s.code}</span>
                    {isActive ? (
                      <span className="text-[8px] font-bold text-apex-red animate-pulse bg-apex-red/10 border border-apex-red/20 px-2 py-0.5 rounded tracking-widest uppercase">
                        LIVE
                      </span>
                    ) : isFinished ? (
                      <span className="text-[8px] font-bold text-emerald-400 bg-emerald-400/5 border border-emerald-400/10 px-2 py-0.5 rounded tracking-widest uppercase">
                        ✓ COMPLETED
                      </span>
                    ) : (
                      <span className="text-[8px] font-bold text-white/20 bg-white/5 border border-white/10 px-2 py-0.5 rounded tracking-widest uppercase">
                        UPCOMING
                      </span>
                    )}
                  </div>
                  <h4 className="font-sans font-bold text-white text-base tracking-tight mt-2.5">
                    {s.name}
                  </h4>
                </div>

                <div className="flex justify-between items-center border-t border-white/5 pt-2 mt-2">
                  <span className="text-[10px] text-white/40">
                    {s.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                  </span>
                  <span className="text-[10px] font-semibold text-white/60">
                    {s.date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 3. NEWS RAIL (Apple TV Widescreen Cinematic Thumbnails) ──── */}
      <div className="space-y-6">
        <span className="text-xs font-bold tracking-widest text-white/40 uppercase flex items-center gap-2 px-2">
          <Radio className="w-4 h-4 text-white/30" />
          Paddock Headlines & Analysis
        </span>

        <div className="flex gap-6 overflow-x-auto pb-4 pr-4 hide-scrollbar -mx-2 px-2">
          {loading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-[380px] h-[210px] skeleton rounded-3xl bg-white/[0.02]" />
            ))
          ) : news.length > 0 ? (
            news.slice(0, 4).map((item: any, i: number) => {
              const proceduralGradients = [
                "linear-gradient(135deg, #1b0404 0%, #080812 100%)",
                "linear-gradient(135deg, #021616 0%, #080812 100%)",
                "linear-gradient(135deg, #181002 0%, #080812 100%)",
                "linear-gradient(135deg, #090216 0%, #080812 100%)",
              ];
              const bg = proceduralGradients[i % proceduralGradients.length];

              return (
                <a
                  key={i}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 w-[380px] h-[210px] rounded-[24px] border border-white/[0.04] hover:border-white/[0.12] hover:scale-[1.01] transition-all flex flex-col justify-between p-8 relative overflow-hidden group cursor-pointer"
                  style={{ background: bg }}
                >
                  <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full bg-white/5 blur-3xl pointer-events-none group-hover:scale-125 transition-transform" />
                  
                  <div className="relative flex justify-between items-start z-10">
                    <span className="text-[9px] font-bold border border-white/10 px-2 py-0.5 rounded text-white/50 tracking-widest uppercase">
                      {item.tag || "PADDOCK"}
                    </span>
                    <span className="text-[9px] font-bold text-white/30 tracking-widest uppercase">
                      {item.source || "F1 Journal"}
                    </span>
                  </div>

                  <div className="relative z-10 space-y-4">
                    <h3 className="font-sans font-bold text-white text-base leading-snug tracking-wide group-hover:text-apex-red transition-colors line-clamp-3">
                      {item.title}
                    </h3>
                    <div className="flex justify-between items-center border-t border-white/5 pt-2 text-[9px] font-bold tracking-widest text-[#e10600] opacity-0 group-hover:opacity-100 transition-opacity">
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        
        {/* Visual Insights Card */}
        <div className="bg-[#0b0b14]/40 rounded-[28px] p-8 border border-white/[0.04] space-y-6">
          <div className="flex items-center gap-2.5 border-b border-white/5 pb-4">
            <Zap className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-white/80 tracking-widest uppercase">
              Championship Event Insights
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Pace Leader", key: "driver_in_form", color: "text-emerald-400" },
              { label: "Position Gain", key: "biggest_gainer", color: "text-apex-red" },
              { label: "Qualifying Standard", key: "fastest_qualifier", color: "text-blue-400" },
              { label: "Recent Victor", key: "recent_winner", color: "text-yellow-400" },
            ].map((insight) => {
              const item = insights[insight.key];
              return (
                <div key={insight.key} className="bg-white/[0.01] border border-white/5 rounded-2xl p-5 flex flex-col justify-between hover:bg-white/[0.02] transition-colors">
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
                    <span className={`text-[10px] font-bold uppercase mt-3 pt-2 border-t border-white/5 tracking-wider ${insight.color}`}>
                      {item.stat}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Championship Top Drivers */}
        <div className="bg-[#0b0b14]/40 rounded-[28px] p-8 border border-white/[0.04] flex flex-col justify-between h-full">
          <div className="flex justify-between items-center border-b border-white/5 pb-4">
            <div className="flex items-center gap-2.5">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <h3 className="text-xs font-bold text-white/80 tracking-widest uppercase">
                Championship Leaders
              </h3>
            </div>
            <Link href="/standings" className="text-[9px] font-bold tracking-widest text-[#e10600] uppercase hover:underline">
              View Standings
            </Link>
          </div>

          <div className="space-y-3 mt-6 flex-1">
            {loading ? (
              Array(3).fill(0).map((_, i) => (
                <div key={i} className="h-12 skeleton rounded-xl bg-white/5" />
              ))
            ) : drivers.slice(0, 3).map((d: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-4 bg-white/[0.01] border border-white/5 rounded-xl hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-4">
                  <span className="font-sans font-semibold text-xs text-white/40 w-4 text-center">{d.position}</span>
                  <div className="w-1 h-6 rounded-full" style={{ backgroundColor: d.color || "#888888" }} />
                  <div>
                    <p className="font-sans font-bold text-white text-sm leading-none">{d.name}</p>
                    <p className="text-[9px] text-white/35 font-sans font-semibold uppercase mt-1 tracking-wider">{d.team}</p>
                  </div>
                </div>
                <span className="font-sans font-bold text-xs text-white">
                  {d.points} <span className="text-[9px] text-white/40 font-normal ml-0.5">PTS</span>
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
