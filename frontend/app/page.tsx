"use client";
import { useEffect, useState, useRef } from "react";
import { f1Api } from "@/lib/api/client";
import { useSessionContext } from "@/lib/hooks/useSessionContext";
import { useLiveSession } from "@/lib/hooks/useLiveSession";
import {
  Flag, Clock, TrendingUp, Award, CalendarDays, ChevronRight,
  Trophy, Zap, Thermometer, Wind, Droplet, Radio, PlayCircle
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

function CountdownTimer({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);

  useEffect(() => {
    if (!targetDate) return;
    const target = new Date(targetDate).getTime();

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const difference = target - now;

      if (difference <= 0) {
        clearInterval(interval);
        setTimeLeft(null);
      } else {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        setTimeLeft({ days, hours, minutes, seconds });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  if (!timeLeft) {
    return <span className="text-[#4ade80] font-bold">SESSION IN PROGRESS</span>;
  }

  return (
    <div className="flex gap-2 font-orbitron font-bold">
      <div className="flex flex-col items-center bg-white/5 border border-white/10 rounded-lg px-2 py-1 min-w-[48px]">
        <span className="text-white text-base leading-none">{String(timeLeft.days).padStart(2, "0")}</span>
        <span className="text-[8px] text-white/40 uppercase mt-0.5 font-sans">Days</span>
      </div>
      <div className="flex flex-col items-center bg-white/5 border border-white/10 rounded-lg px-2 py-1 min-w-[48px]">
        <span className="text-white text-base leading-none">{String(timeLeft.hours).padStart(2, "0")}</span>
        <span className="text-[8px] text-white/40 uppercase mt-0.5 font-sans">Hrs</span>
      </div>
      <div className="flex flex-col items-center bg-white/5 border border-white/10 rounded-lg px-2 py-1 min-w-[48px]">
        <span className="text-white text-base leading-none">{String(timeLeft.minutes).padStart(2, "0")}</span>
        <span className="text-[8px] text-white/40 uppercase mt-0.5 font-sans">Min</span>
      </div>
      <div className="flex flex-col items-center bg-white/5 border border-white/10 rounded-lg px-2 py-1 min-w-[48px]">
        <span className="text-apex-red text-base leading-none animate-pulse">{String(timeLeft.seconds).padStart(2, "0")}</span>
        <span className="text-[8px] text-white/40 uppercase mt-0.5 font-sans text-apex-red/80">Sec</span>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { selectedYear, currentRace, nextRace } = useSessionContext();
  const live = useLiveSession();

  const [ctx, setCtx] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await f1Api.getDashboardContext(selectedYear);
        const data = (res as any)?.data ?? res;
        setCtx(data);
      } catch (e) {
        console.error("[Dashboard] context fetch failed:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [selectedYear]);

  if (!mounted) return null;

  const sc = ctx?.season_context ?? {};
  const insights = ctx?.insights ?? {};
  const news = ctx?.news ?? [];
  const upcoming = ctx?.upcoming_schedule ?? [];
  const drivers = ctx?.driver_standings ?? [];
  const constructors = ctx?.constructor_standings ?? [];

  const raceLabel = currentRace?.event_name || currentRace?.location || `${selectedYear} Season`;

  // Dynamic live track status mapping
  const flagColor = 
    live.session_info?.track_status === "RED" ? "#ef4444" :
    live.session_info?.track_status === "YELLOW" ? "#facc15" :
    live.session_info?.track_status === "SC" || live.session_info?.track_status === "VSC" ? "#ff8000" :
    "#22c55e";

  const stats = [
    {
      icon: Flag,
      label: "Context",
      value: loading ? "—" : `Round ${sc.current_round ?? "—"}`,
      sub: loading ? "" : raceLabel,
      color: "#e10600",
    },
    {
      icon: CalendarDays,
      label: "Next Race",
      value: loading ? "—" : (nextRace?.country || "Season Complete"),
      sub: loading ? "" : (nextRace?.event_name ?? ""),
      color: "#3b82f6",
    },
    {
      icon: TrendingUp,
      label: "Championship Leader",
      value: loading ? "—" : (drivers[0]?.name?.split(" ").pop() || "—"),
      sub: loading ? "" : `${drivers[0]?.points ?? "—"} pts`,
      color: "#facc15",
    },
    {
      icon: Award,
      label: "Constructor Leader",
      value: loading ? "—" : (constructors[0]?.name || "—"),
      sub: loading ? "" : `${constructors[0]?.points ?? "—"} pts`,
      color: "#00ff66",
    },
  ];

  return (
    <div className="p-4 lg:p-6 min-h-screen max-w-[1600px] mx-auto animate-fade-up space-y-6">

      {/* ── REAL LIVE BROADCAST BANNER (OpenF1 Active State) ───────────────── */}
      <AnimatePresence>
        {live.is_live && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative overflow-hidden glass rounded-3xl border border-apex-red/40 shadow-[0_0_30px_rgba(225,6,0,0.15)] p-5 md:p-6"
          >
            {/* Pulsing red scan line for broadcast look */}
            <div className="absolute inset-0 bg-gradient-to-r from-apex-red/5 via-transparent to-transparent pointer-events-none" />
            <div className="scan-line" />

            <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4 z-10">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-apex-red/10 border border-apex-red/30 flex items-center justify-center flex-shrink-0 animate-pulse">
                  <Radio className="w-6 h-6 text-apex-red" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="status-live">LIVE</span>
                    <span className="text-[10px] font-rajdhani font-bold bg-white/10 px-2 py-0.5 rounded text-white tracking-widest uppercase">
                      {live.state} SESSION
                    </span>
                    <span 
                      className="text-[10px] font-rajdhani font-bold px-2 py-0.5 rounded text-black tracking-widest uppercase"
                      style={{ backgroundColor: flagColor }}
                    >
                      STATUS: {live.session_info?.track_status || "GREEN"}
                    </span>
                  </div>
                  <h2 className="font-orbitron font-bold text-white text-lg tracking-tight leading-snug">
                    {live.session_info?.circuit.toUpperCase()} · {live.session_info?.country.toUpperCase()}
                  </h2>
                  <p className="font-rajdhani text-white/60 text-xs tracking-wider uppercase mt-1">
                    Real-time track metrics streaming from OpenF1
                  </p>
                </div>
              </div>

              {/* Live Info & Quick Stats */}
              <div className="flex flex-wrap items-center gap-6">
                {live.weather && (
                  <div className="flex items-center gap-4 bg-white/5 border border-white/5 rounded-2xl px-4 py-2">
                    <div className="flex items-center gap-1.5">
                      <Thermometer className="w-3.5 h-3.5 text-orange-400" />
                      <div className="flex flex-col">
                        <span className="text-[9px] text-white/40 uppercase leading-none font-rajdhani">Track Temp</span>
                        <span className="font-orbitron font-bold text-xs text-white mt-0.5">{live.weather.track_temp}°C</span>
                      </div>
                    </div>
                    <div className="w-px h-6 bg-white/10" />
                    <div className="flex items-center gap-1.5">
                      <Droplet className="w-3.5 h-3.5 text-blue-400" />
                      <div className="flex flex-col">
                        <span className="text-[9px] text-white/40 uppercase leading-none font-rajdhani">Rainfall</span>
                        <span className="font-orbitron font-bold text-xs mt-0.5" style={{ color: live.weather.rainfall ? "#60a5fa" : "#8888aa" }}>
                          {live.weather.rainfall ? "RAIN" : "DRY"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Pulsating Go-to-Live CTA */}
                <Link
                  href="/live-timing"
                  className="px-6 py-3 rounded-2xl font-rajdhani font-bold text-sm tracking-wider uppercase flex items-center gap-2 hover:scale-105 active:scale-95 transition-all text-white"
                  style={{
                    background: "linear-gradient(135deg, #e10600, #ff4d00)",
                    boxShadow: "0 4px 20px rgba(225, 6, 0, 0.4)",
                  }}
                >
                  <PlayCircle className="w-4 h-4 text-white animate-spin-slow" />
                  View Live Feed
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Hero / Summary Row ───────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="label-xs mb-1.5">{selectedYear} · FORMULA 1 CHAMPIONSHIP</p>
          <h1 className="font-orbitron font-bold text-white text-3xl lg:text-4xl tracking-tight">
            {loading
              ? <span className="inline-block w-64 h-9 skeleton rounded-lg" />
              : raceLabel.toUpperCase()}
          </h1>
          {!loading && currentRace && (
            <p className="font-rajdhani text-white/50 text-xs tracking-widest uppercase mt-1.5 flex items-center gap-2">
              <span>{currentRace.location}</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span>Round {currentRace.round_number}</span>
              {currentRace.is_completed ? (
                <>
                  <span className="w-1 h-1 rounded-full bg-white/20" />
                  <span className="text-[#00ff66] font-bold">✓ COMPLETED</span>
                </>
              ) : (
                <>
                  <span className="w-1 h-1 rounded-full bg-white/20" />
                  <span className="text-apex-red font-bold animate-pulse">UPCOMING WEEKEND</span>
                </>
              )}
            </p>
          )}
        </div>

        {/* Live-derived next race card with countdown timer */}
        {!loading && nextRace && !live.is_live && (
          <div className="glass px-5 py-3 rounded-2xl flex items-center gap-4 flex-shrink-0 border border-white/10 shadow-lg">
            <Clock className="w-5 h-5 text-apex-red flex-shrink-0" />
            <div>
              <p className="label-xs">NEXT ROUND · {nextRace.country.toUpperCase()}</p>
              <p className="font-orbitron font-bold text-white text-sm tracking-wide mt-0.5">
                {nextRace.event_name}
              </p>
              <div className="mt-2">
                <CountdownTimer targetDate={nextRace.session5_date || nextRace.event_date || ""} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Visual Stat Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div key={i} className="glass p-4 rounded-2xl flex flex-col gap-3 group hover:border-white/10 transition-all">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: `${s.color}15` }}>
                <s.icon className="w-4 h-4" style={{ color: s.color }} />
              </div>
              <span className="label-xs">{s.label}</span>
            </div>
            {loading ? (
              <div className="space-y-2">
                <div className="h-6 w-3/4 skeleton rounded" />
                <div className="h-3 w-1/2 skeleton rounded" />
              </div>
            ) : (
              <div className="space-y-1">
                <p className="font-orbitron font-bold text-white text-xl tracking-tight leading-none">
                  {s.value}
                </p>
                {s.sub && (
                  <p className="font-rajdhani text-[10px] font-bold uppercase truncate tracking-wider" style={{ color: s.color }}>
                    {s.sub}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Middle Grid: Standings + Insights ─────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

        {/* Drivers & Constructors Standings Panel */}
        <div className="xl:col-span-3 glass rounded-2xl p-5 border border-white/5 flex flex-col h-[400px]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <h2 className="font-orbitron font-bold text-white text-xs tracking-widest uppercase">Championship Standings</h2>
            </div>
            <Link
              href="/standings"
              className="label-xs border border-white/10 px-2.5 py-1 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] transition-colors flex items-center gap-1"
            >
              Full Standings <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-1.5 hide-scrollbar">
            {loading ? (
              Array(6).fill(0).map((_, i) => <div key={i} className="h-10 skeleton rounded-xl" />)
            ) : drivers.length > 0 ? (
              drivers.slice(0, 7).map((item: any, i: number) => {
                const teamColor = item.color || "#888888";
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-white/[0.03] bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/10 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-orbitron font-bold text-xs text-white/40 w-4 text-center">
                        {item.position}
                      </span>
                      {/* Driver Team Accent Color Strip */}
                      <div className="w-1.5 h-6 rounded" style={{ backgroundColor: teamColor }} />
                      <div>
                        <p className="font-rajdhani font-bold text-white text-sm tracking-wide">
                          {item.name}
                        </p>
                        <p className="text-[10px] text-white/40 font-rajdhani uppercase tracking-wider">
                          {item.team || "Independent"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {item.wins > 0 && (
                        <span className="text-[9px] font-rajdhani font-bold px-1.5 py-0.5 rounded bg-yellow-400/10 text-yellow-400 border border-yellow-400/20">
                          {item.wins} W
                        </span>
                      )}
                      <span className="font-orbitron font-bold text-sm text-white min-w-[40px] text-right">
                        {item.points} <span className="text-[9px] text-white/40 font-sans font-normal ml-0.5">PTS</span>
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="h-full flex items-center justify-center label-xs">No standings data available</div>
            )}
          </div>
        </div>

        {/* Insights & Analysis */}
        <div className="xl:col-span-2 glass rounded-2xl p-5 border border-white/5 flex flex-col h-[400px]">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-apex-red animate-pulse" />
            <h2 className="font-orbitron font-bold text-white text-xs tracking-widest uppercase">WEEKEND ANALYTICS</h2>
          </div>

          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto pr-1 hide-scrollbar">
            {[
              { color: "#00ff66", key: "driver_in_form", label: "Driver In Form" },
              { color: "#e10600", key: "biggest_gainer", label: "Biggest Gainer" },
              { color: "#3b82f6", key: "fastest_qualifier", label: "Fastest Qualifier" },
              { color: "#facc15", key: "recent_winner", label: "Recent Winner" },
            ].map(({ color, key, label }) => {
              const item = insights[key];
              return (
                <div
                  key={key}
                  className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 flex flex-col justify-between hover:bg-white/[0.04] transition-all"
                >
                  <div>
                    <span className="text-[9px] font-rajdhani font-bold uppercase tracking-widest leading-none" style={{ color }}>
                      {label}
                    </span>
                    {loading ? (
                      <div className="space-y-1.5 mt-3">
                        <div className="h-5 w-3/4 skeleton rounded" />
                        <div className="h-3 w-1/2 skeleton rounded" />
                      </div>
                    ) : (
                      <h3 className="font-orbitron font-bold text-white text-base tracking-tight leading-tight mt-2">
                        {item?.name || "—"}
                      </h3>
                    )}
                  </div>
                  {!loading && item?.stat && (
                    <p className="font-rajdhani text-white/50 text-xs mt-2 uppercase tracking-wide leading-none border-t border-white/5 pt-2">
                      {item.stat}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── News Grid: Cinematic layout ──────────────────────── */}
      <div className="glass rounded-2xl p-5 border border-white/5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-white/60" />
          <h2 className="font-orbitron font-bold text-white text-xs tracking-widest uppercase">Paddock News Feed</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {loading ? (
            Array(3).fill(0).map((_, i) => <div key={i} className="h-32 skeleton rounded-2xl" />)
          ) : news.length > 0 ? (
            news.slice(0, 3).map((item: any, i: number) => (
              <a
                key={i}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white/[0.01] border border-white/[0.04] rounded-2xl p-4 hover:border-white/10 hover:bg-white/[0.03] transition-all group flex flex-col justify-between cursor-pointer"
              >
                <div>
                  <span className="text-[9px] font-rajdhani font-bold border border-white/15 px-2 py-0.5 rounded text-white/60 tracking-wider uppercase mb-3 inline-block">
                    {item.tag || "PADDOCK"}
                  </span>
                  <h3 className="font-rajdhani font-bold text-white text-base leading-snug group-hover:text-apex-red transition-colors line-clamp-3">
                    {item.title}
                  </h3>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-white/[0.05] mt-4">
                  <span className="text-[9px] font-rajdhani font-bold uppercase tracking-wider text-white/45">{item.source || "F1 Media"}</span>
                  <span className="text-[9px] font-rajdhani font-bold uppercase tracking-wider text-apex-red group-hover:translate-x-1 transition-transform flex items-center gap-0.5">
                    READ <ChevronRight className="w-2.5 h-2.5" />
                  </span>
                </div>
              </a>
            ))
          ) : (
            <div className="col-span-3 py-10 text-center label-xs">News stream momentarily offline</div>
          )}
        </div>
      </div>

    </div>
  );
}

