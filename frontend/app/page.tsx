"use client";
import { useEffect, useState } from "react";
import { f1Api } from "@/lib/api/client";
import { useSettingsStore } from "@/lib/store";
import { Flag, Clock, TrendingUp, Award, CalendarDays, ChevronRight, Trophy } from "lucide-react";
import Link from "next/link";

const TEAM_COLORS: Record<string, string> = {
  "Red Bull Racing": "#3671C6", Ferrari: "#E8002D", Mercedes: "#27F4D2",
  McLaren: "#FF8000", "Aston Martin": "#229971", Alpine: "#FF87BC",
  Williams: "#64C4FF", RB: "#6692FF", "Kick Sauber": "#52E252", "Haas F1 Team": "#B6BABD",
};

export default function HomePage() {
  const { selectedYear, setSelectedRound, setActiveRace, setSelectedRace } = useSettingsStore();
  const [ctx, setCtx] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await f1Api.getDashboardContext(selectedYear);
        const data = (res as any).data || res;
        setCtx(data);

        // Sync global context from canonical backend resolver
        const sc = data?.season_context;
        if (sc?.current_round) {
          setSelectedRound(sc.current_round);
          const latestRace = sc.latest_completed_race;
          if (latestRace) {
            setActiveRace(latestRace);
            setSelectedRace(latestRace);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [selectedYear]);

  if (!mounted) return null;

  const sc       = ctx?.season_context   || {};
  const insights = ctx?.insights         || {};
  const news     = ctx?.news             || [];
  const upcoming = ctx?.upcoming_schedule || [];
  const drivers  = ctx?.driver_standings  || [];
  const constructors = ctx?.constructor_standings || [];

  const currentRace = sc.latest_completed_race;
  const nextRace    = sc.next_race;

  const statCards = [
    {
      icon: Flag,
      label: "Current Context",
      value: loading ? "—" : `${selectedYear} · Round ${sc.current_round ?? "—"}`,
    },
    {
      icon: CalendarDays,
      label: "Next Race",
      value: loading ? "—" : (nextRace?.country || "TBD"),
    },
    {
      icon: TrendingUp,
      label: "Championship Leader",
      value: loading ? "—" : (drivers[0]?.name?.split(" ").slice(-1)[0] || "—"),
    },
    {
      icon: Award,
      label: "Constructor Leader",
      value: loading ? "—" : (constructors[0]?.name || "—"),
    },
  ];

  return (
    <div className="p-4 lg:p-6 min-h-screen max-w-[1600px] mx-auto">
      {/* Hero header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <h1 className="text-4xl font-orbitron font-bold text-white tracking-tight uppercase">
            {loading ? "Loading…" : (currentRace?.event_name || `${currentRace?.country || selectedYear} Grand Prix`)}
          </h1>
          <p className="text-white/50 text-sm font-rajdhani tracking-widest uppercase mt-2">
            {selectedYear} · Round {sc.current_round ?? "—"} · {currentRace?.location || "—"}
          </p>
        </div>
        <div className="bg-black/40 backdrop-blur-xl px-5 py-3 rounded-2xl border border-white/10 flex items-center gap-4">
          <Clock className="w-5 h-5 text-apex-red" />
          <div className="flex flex-col">
            <span className="text-[10px] text-white/50 font-rajdhani tracking-widest uppercase">Next Race</span>
            <span className="font-orbitron font-bold text-white text-lg tracking-wider">
              {loading ? "—" : (nextRace?.country || "Season Complete")}
            </span>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((stat, i) => (
          <div key={i} className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-3xl p-6 flex flex-col justify-between shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-all hover:border-white/20 hover:bg-black/30">
            <div className="flex items-center gap-3 mb-4 text-white/50">
              <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center border border-white/5">
                <stat.icon className="w-4 h-4 text-white/80" />
              </div>
              <span className="text-[10px] font-bold font-rajdhani uppercase tracking-widest text-white/40">{stat.label}</span>
            </div>
            <p className="text-2xl font-orbitron font-bold text-white tracking-tight">
              {loading ? <span className="inline-block w-24 h-6 bg-white/5 rounded animate-pulse" /> : stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Middle: Insights + Upcoming */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
        {/* Insights */}
        <div className="lg:col-span-3 bg-black/20 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
              <Trophy className="w-5 h-5 text-white/80" />
            </div>
            <h2 className="text-xl font-orbitron font-bold text-white tracking-wide">WEEKEND INSIGHTS</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { color: "text-green-400",  key: "driver_in_form",     label: "Driver In Form" },
              { color: "text-apex-red",   key: "biggest_gainer",     label: "Biggest Gainer" },
              { color: "text-blue-400",   key: "fastest_qualifier",  label: "Fastest Qualifier" },
              { color: "text-yellow-500", key: "recent_winner",      label: "Recent Winner" },
            ].map(({ color, key, label }) => {
              const item = insights[key];
              return (
                <div key={key} className="bg-white/5 border border-white/5 rounded-2xl p-5 hover:bg-white/10 transition-colors">
                  <span className={`text-[10px] ${color} font-rajdhani tracking-widest uppercase font-bold mb-2 block`}>{label}</span>
                  {loading ? (
                    <div className="space-y-2">
                      <div className="h-6 w-3/4 bg-white/5 rounded animate-pulse" />
                      <div className="h-3 w-1/2 bg-white/5 rounded animate-pulse" />
                    </div>
                  ) : (
                    <>
                      <div className="font-orbitron font-bold text-xl text-white">{item?.name || "—"}</div>
                      <span className="text-xs text-white/40 font-rajdhani mt-1 block">{item?.stat || "No data available"}</span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming schedule */}
        <div className="lg:col-span-2 bg-black/20 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)] flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                <CalendarDays className="w-5 h-5 text-white/80" />
              </div>
              <h2 className="text-xl font-orbitron font-bold text-white tracking-wide">UPCOMING</h2>
            </div>
            <Link href="/sessions" className="text-[10px] font-rajdhani font-bold text-white/50 hover:text-white transition-colors flex items-center gap-1 uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 hover:border-white/20">
              Full <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="flex-1 space-y-3">
            {loading ? (
              Array(3).fill(0).map((_, i) => <div key={i} className="h-16 bg-white/5 rounded-2xl w-full animate-pulse" />)
            ) : upcoming.length > 0 ? (
              upcoming.slice(0, 3).map((event: any, i: number) => (
                <div key={i} className={`p-4 rounded-2xl border transition-all ${i === 0 ? "border-apex-red/50 bg-apex-red/10" : "border-white/5 bg-black/40"}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-white/50 font-rajdhani uppercase tracking-widest block mb-1 font-bold">Round {event.round_number}</span>
                      <strong className="text-base font-rajdhani font-bold text-white tracking-wide">{event.country}</strong>
                    </div>
                    <span className={`text-[10px] px-2.5 py-1 rounded-md font-rajdhani uppercase tracking-widest font-bold ${
                      i === 0 ? "bg-apex-red/20 text-white border border-apex-red/50" : "bg-white/5 border border-white/10 text-white/50"
                    }`}>
                      {i === 0 ? "Next" : "Soon"}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-white/30 font-rajdhani uppercase tracking-widest text-xs">No upcoming races</div>
            )}
          </div>
        </div>
      </div>

      {/* News */}
      <div className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
            <TrendingUp className="w-5 h-5 text-white/80" />
          </div>
          <h2 className="text-xl font-orbitron font-bold text-white tracking-wide">PADDOCK NEWS</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {loading ? (
            Array(3).fill(0).map((_, i) => <div key={i} className="h-32 bg-white/5 rounded-2xl animate-pulse" />)
          ) : news.length > 0 ? (
            news.slice(0, 3).map((item: any, i: number) => (
              <a key={i} href={item.link} target="_blank" rel="noopener noreferrer"
                className="bg-black/40 border border-white/5 rounded-2xl p-5 hover:border-white/20 transition-all cursor-pointer group flex flex-col justify-between">
                <div>
                  <span className="text-[9px] px-2 py-0.5 rounded border border-white/10 text-white/40 uppercase font-rajdhani tracking-widest mb-3 inline-block group-hover:bg-white/10 transition-colors">
                    {item.tag}
                  </span>
                  <h3 className="text-white font-rajdhani font-bold text-lg leading-tight mb-4 group-hover:text-apex-red transition-colors line-clamp-3">
                    {item.title}
                  </h3>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <span className="text-[10px] text-white/30 uppercase font-rajdhani tracking-widest">{item.source}</span>
                </div>
              </a>
            ))
          ) : (
            <div className="col-span-3 py-8 text-center text-white/30 font-rajdhani tracking-widest uppercase text-sm">
              News feed temporarily unavailable.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
