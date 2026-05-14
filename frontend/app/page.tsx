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
  const { selectedYear, selectedRound, selectedSession, activeRace, globalContextSynced, syncGlobalContext } = useSettingsStore();
  const [standings, setStandings] = useState<any>(null);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [insights, setInsights] = useState<any>(null);
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [sRes, schRes, insRes, newsRes] = await Promise.allSettled([
          f1Api.getStandings(selectedYear),
          f1Api.getSchedule(selectedYear),
          f1Api.getInsights(selectedYear),
          f1Api.getNews(),
        ]);
        if (sRes.status === "fulfilled") setStandings((sRes.value as any).data || sRes.value);
        if (schRes.status === "fulfilled") setSchedule(((schRes.value as any).data || schRes.value).slice(0, 10));
        if (insRes.status === "fulfilled") setInsights((insRes.value as any).data || insRes.value);
        if (newsRes.status === "fulfilled") setNews((newsRes.value as any).data || newsRes.value);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [selectedYear]);

  useEffect(() => {
    if (!globalContextSynced && schedule.length > 0) {
      syncGlobalContext(schedule);
    }
  }, [schedule, globalContextSynced, syncGlobalContext]);

  if (!mounted) return null;

  const nextRace = schedule.find((e) => e.is_upcoming);
  const currentRace = schedule.find((e) => e.round_number === selectedRound) || activeRace || nextRace || schedule[0];

  const driverStandings = Array.isArray(standings) 
    ? standings 
    : standings?.driver_standings 
      ? standings.driver_standings 
      : standings?.drivers 
        ? standings.drivers 
        : [];

  return (
    <div className="p-4 lg:p-6 min-h-screen max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <h1 className="text-4xl font-orbitron font-bold text-white tracking-tight uppercase">
            {currentRace?.event_name || `${currentRace?.country || "Current"} Grand Prix`}
          </h1>
          <p className="text-white/50 text-sm font-rajdhani tracking-widest uppercase mt-2">
            {selectedYear} Round {currentRace?.round_number || selectedRound} • {currentRace?.location || "TBD"}
          </p>
        </div>
        <div className="bg-black/40 backdrop-blur-xl px-5 py-3 rounded-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] flex items-center gap-4">
          <Clock className="w-5 h-5 text-apex-red" />
          <div className="flex flex-col">
            <span className="text-[10px] text-white/50 font-rajdhani tracking-widest uppercase">Next Session Starts In</span>
            <span className="font-orbitron font-bold text-white text-lg tracking-wider">-- : -- : --</span>
          </div>
        </div>
      </div>

      {/* TOP: Race Weekend Context */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { icon: Flag, label: "Current Context", value: `${selectedYear} Round ${selectedRound}` },
          { icon: CalendarDays, label: "Next Race", value: schedule.find((e) => e.is_upcoming)?.country || "TBD" },
          { icon: TrendingUp, label: "Championship Leader", value: driverStandings[0]?.name?.split(" ")[1] || insights?.driver_in_form?.name?.split(" ")[1] || "—" },
          { icon: Award, label: "Constructor Leader", value: insights?.constructor_leader?.name || "—" }
        ].map((stat, i) => (
          <div key={i} className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-3xl p-6 flex flex-col justify-between shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-all hover:border-white/20 hover:bg-black/30">
            <div className="flex items-center gap-3 mb-4 text-white/50">
              <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center border border-white/5">
                <stat.icon className="w-4 h-4 text-white/80" />
              </div>
              <span className="text-[10px] font-bold font-rajdhani uppercase tracking-widest text-white/40">{stat.label}</span>
            </div>
            <p className="text-2xl font-orbitron font-bold text-white tracking-tight">{loading ? "—" : stat.value}</p>
          </div>
        ))}
      </div>

      {/* MIDDLE: Form & Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
        <div className="lg:col-span-3 bg-black/20 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
              <Trophy className="w-5 h-5 text-white/80" />
            </div>
            <h2 className="text-xl font-orbitron font-bold text-white tracking-wide">WEEKEND INSIGHTS</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white/5 border border-white/5 rounded-2xl p-5 hover:bg-white/10 transition-colors">
              <span className="text-[10px] text-green-400 font-rajdhani tracking-widest uppercase font-bold mb-2 block">Driver In Form</span>
              <div className="font-orbitron font-bold text-xl text-white">{insights?.driver_in_form?.name || "—"}</div>
              <span className="text-xs text-white/40 font-rajdhani mt-1 block">{insights?.driver_in_form?.stat || "—"}</span>
            </div>
            <div className="bg-white/5 border border-white/5 rounded-2xl p-5 hover:bg-white/10 transition-colors">
              <span className="text-[10px] text-apex-red font-rajdhani tracking-widest uppercase font-bold mb-2 block">Biggest Gainer</span>
              <div className="font-orbitron font-bold text-xl text-white">{insights?.biggest_gainer?.name || "—"}</div>
              <span className="text-xs text-white/40 font-rajdhani mt-1 block">{insights?.biggest_gainer?.stat || "—"}</span>
            </div>
            <div className="bg-white/5 border border-white/5 rounded-2xl p-5 hover:bg-white/10 transition-colors">
              <span className="text-[10px] text-blue-400 font-rajdhani tracking-widest uppercase font-bold mb-2 block">Fastest Qualifier</span>
              <div className="font-orbitron font-bold text-xl text-white">{insights?.fastest_qualifier?.name || "—"}</div>
              <span className="text-xs text-white/40 font-rajdhani mt-1 block">{insights?.fastest_qualifier?.stat || "—"}</span>
            </div>
            <div className="bg-white/5 border border-white/5 rounded-2xl p-5 hover:bg-white/10 transition-colors">
              <span className="text-[10px] text-yellow-500 font-rajdhani tracking-widest uppercase font-bold mb-2 block">Recent Winner</span>
              <div className="font-orbitron font-bold text-xl text-white">{insights?.recent_winner?.name || "—"}</div>
              <span className="text-xs text-white/40 font-rajdhani mt-1 block">{insights?.recent_winner?.stat || "—"}</span>
            </div>
          </div>
        </div>
        
        {/* Upcoming Schedule snippet */}
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
            ) : schedule.length > 0 ? (
              schedule.filter(s => s.is_upcoming).slice(0, 3).map((event: any, i: number) => (
                <div key={i} className={`p-4 rounded-2xl border transition-all ${i === 0 ? 'border-apex-red/50 bg-apex-red/10 shadow-[0_4px_20px_rgba(224,0,45,0.15)]' : 'border-white/5 bg-black/40'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-white/50 font-rajdhani uppercase tracking-widest block mb-1 font-bold">Round {event.round_number}</span>
                      <strong className="text-base font-rajdhani font-bold text-white tracking-wide">{event.country}</strong>
                    </div>
                    {i === 0 ? (
                      <span className="text-[10px] px-2.5 py-1 bg-apex-red/20 text-white border border-apex-red/50 rounded-md font-rajdhani uppercase tracking-widest font-bold">Next</span>
                    ) : (
                      <span className="text-[10px] px-2.5 py-1 bg-white/5 border border-white/10 text-white/50 rounded-md font-rajdhani uppercase tracking-widest font-bold">Upcoming</span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-white/30 font-rajdhani uppercase tracking-widest text-xs">No schedule data</div>
            )}
          </div>
        </div>
      </div>

      {/* BOTTOM: News / Articles */}
      <div className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
            <TrendingUp className="w-5 h-5 text-white/80" />
          </div>
          <h2 className="text-xl font-orbitron font-bold text-white tracking-wide">PADDOCK NEWS</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {news.length > 0 ? news.map((item, i) => (
            <a key={i} href={item.link} target="_blank" rel="noopener noreferrer" className="bg-black/40 border border-white/5 rounded-2xl p-5 hover:border-white/20 transition-all cursor-pointer group flex flex-col justify-between">
              <div>
                <span className="text-[9px] px-2 py-0.5 rounded border border-white/10 text-white/40 uppercase font-rajdhani tracking-widest mb-3 inline-block group-hover:bg-white/10 group-hover:text-white transition-colors">{item.tag}</span>
                <h3 className="text-white font-rajdhani font-bold text-lg leading-tight mb-4 group-hover:text-apex-red transition-colors">{item.title}</h3>
              </div>
              <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/5">
                <span className="text-[10px] text-white/30 uppercase font-rajdhani tracking-widest">{item.source}</span>
                <span className="text-[10px] text-white/20 uppercase font-rajdhani tracking-widest truncate max-w-[100px]">{item.published}</span>
              </div>
            </a>
          )) : loading ? (
            Array(3).fill(0).map((_, i) => <div key={i} className="h-32 bg-white/5 rounded-2xl animate-pulse" />)
          ) : (
            <div className="col-span-3 py-8 text-center text-white/30 font-rajdhani tracking-widest uppercase text-sm">No recent news available.</div>
          )}
        </div>
      </div>
    </div>
  );
}
