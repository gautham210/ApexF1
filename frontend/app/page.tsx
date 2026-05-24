"use client";
import { useEffect, useState } from "react";
import { f1Api } from "@/lib/api/client";
import { useSessionContext } from "@/lib/hooks/useSessionContext";
import { Flag, Clock, TrendingUp, Award, CalendarDays, ChevronRight, Trophy, Zap } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  // Read ONLY from canonical context — no local race state derivation
  const { selectedYear, currentRace, nextRace } = useSessionContext();

  const [ctx, setCtx]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res  = await f1Api.getDashboardContext(selectedYear);
        const data = (res as any)?.data ?? res;
        setCtx(data);
        // NOTE: Do NOT call setCurrentRace or setSelectedRound here.
        // AppLayout.GlobalContextInit already did that on boot.
        // Dashboard only reads — it never writes to session context.
      } catch (e) {
        console.error("[Dashboard] context fetch failed:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [selectedYear]);

  if (!mounted) return null;

  const sc           = ctx?.season_context         ?? {};
  const insights     = ctx?.insights               ?? {};
  const news         = ctx?.news                   ?? [];
  const upcoming     = ctx?.upcoming_schedule       ?? [];
  const drivers      = ctx?.driver_standings        ?? [];
  const constructors = ctx?.constructor_standings   ?? [];

  const raceLabel = currentRace?.event_name || currentRace?.location || `${selectedYear} Season`;

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
      color: "#60a5fa",
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
      color: "#4ade80",
    },
  ];

  return (
    <div className="p-4 lg:p-6 min-h-screen max-w-[1600px] mx-auto animate-fade-up">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4">
        <div>
          <p className="label-xs mb-2">{selectedYear} · Formula 1 Season</p>
          <h1 className="font-orbitron font-bold text-white text-3xl lg:text-4xl tracking-tight">
            {loading
              ? <span className="inline-block w-64 h-9 skeleton rounded-lg" />
              : raceLabel.toUpperCase()}
          </h1>
          {!loading && currentRace && (
            <p className="font-rajdhani text-white/40 text-sm tracking-widest uppercase mt-1">
              {currentRace.location} · Round {currentRace.round_number}
              {currentRace.is_completed && <span className="ml-3 text-[#4ade80]">✓ Completed</span>}
            </p>
          )}
        </div>

        {/* Next race chip */}
        {!loading && nextRace && (
          <div className="card px-5 py-3 flex items-center gap-3 flex-shrink-0">
            <Clock className="w-4 h-4 text-apex-red flex-shrink-0" />
            <div>
              <p className="label-xs">Next Race</p>
              <p className="font-orbitron font-bold text-white text-base tracking-wider">
                {nextRace.country}
              </p>
              <p className="label-xs mt-0.5">Round {nextRace.round_number}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Stat cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {stats.map((s, i) => (
          <div key={i} className="card p-4 flex flex-col gap-3 group hover:border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${s.color}15` }}>
                <s.icon className="w-3.5 h-3.5" style={{ color: s.color }} />
              </div>
              <span className="label-xs">{s.label}</span>
            </div>
            {loading ? (
              <div className="space-y-1.5">
                <div className="h-6 w-3/4 skeleton rounded" />
                <div className="h-3 w-1/2 skeleton rounded" />
              </div>
            ) : (
              <>
                <p className="font-orbitron font-bold text-white text-xl tracking-tight leading-none">
                  {s.value}
                </p>
                {s.sub && <p className="label-xs truncate" style={{ color: s.color }}>{s.sub}</p>}
              </>
            )}
          </div>
        ))}
      </div>

      {/* ── Middle: Insights + Upcoming ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">

        {/* Insights */}
        <div className="lg:col-span-3 card p-5">
          <div className="flex items-center gap-2 mb-5">
            <Zap className="w-4 h-4 text-apex-red" />
            <h2 className="font-orbitron font-bold text-white text-sm tracking-widest">WEEKEND INSIGHTS</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { color: "#4ade80",  key: "driver_in_form",    label: "Driver In Form" },
              { color: "#e10600",  key: "biggest_gainer",    label: "Biggest Gainer" },
              { color: "#60a5fa",  key: "fastest_qualifier", label: "Fastest Qualifier" },
              { color: "#facc15",  key: "recent_winner",     label: "Recent Winner" },
            ].map(({ color, key, label }) => {
              const item = insights[key];
              return (
                <div key={key} className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-4 hover:bg-white/[0.05] transition-colors">
                  <p className="label-xs mb-2" style={{ color }}>{label}</p>
                  {loading ? (
                    <div className="space-y-1.5">
                      <div className="h-5 w-3/4 skeleton rounded" />
                      <div className="h-3 w-1/2 skeleton rounded" />
                    </div>
                  ) : (
                    <>
                      <p className="font-orbitron font-bold text-white text-lg leading-tight">{item?.name || "—"}</p>
                      <p className="font-rajdhani text-white/40 text-xs mt-1">{item?.stat || "No data"}</p>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming schedule */}
        <div className="lg:col-span-2 card p-5 flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-white/50" />
              <h2 className="font-orbitron font-bold text-white text-sm tracking-widest">UPCOMING</h2>
            </div>
            <Link
              href="/sessions"
              className="label-xs border border-white/10 px-2.5 py-1 rounded-md bg-white/[0.03] hover:bg-white/[0.07] transition-colors flex items-center gap-1"
            >
              All <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="flex-1 space-y-2">
            {loading ? (
              Array(3).fill(0).map((_, i) => <div key={i} className="h-14 skeleton rounded-xl" />)
            ) : upcoming.length > 0 ? (
              upcoming.slice(0, 4).map((event: any, i: number) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-xl border transition-colors"
                  style={{
                    borderColor: i === 0 ? "rgba(225,6,0,0.3)" : "rgba(255,255,255,0.04)",
                    background:  i === 0 ? "rgba(225,6,0,0.06)" : "rgba(255,255,255,0.02)",
                  }}
                >
                  <div>
                    <p className="label-xs mb-1">Round {event.round_number}</p>
                    <p className="font-rajdhani font-bold text-white text-sm tracking-wide">{event.country}</p>
                  </div>
                  <span
                    className="label-xs border px-2 py-0.5 rounded"
                    style={{
                      borderColor: i === 0 ? "rgba(225,6,0,0.4)" : "rgba(255,255,255,0.08)",
                      color:       i === 0 ? "#e10600" : "rgba(255,255,255,0.3)",
                    }}
                  >
                    {i === 0 ? "NEXT" : "SOON"}
                  </span>
                </div>
              ))
            ) : (
              <div className="py-10 text-center label-xs">No upcoming races</div>
            )}
          </div>
        </div>
      </div>

      {/* ── News ─────────────────────────────────────────────── */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-5">
          <TrendingUp className="w-4 h-4 text-white/50" />
          <h2 className="font-orbitron font-bold text-white text-sm tracking-widest">PADDOCK NEWS</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {loading ? (
            Array(3).fill(0).map((_, i) => <div key={i} className="h-28 skeleton rounded-xl" />)
          ) : news.length > 0 ? (
            news.slice(0, 3).map((item: any, i: number) => (
              <a
                key={i}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 hover:border-white/10 hover:bg-white/[0.05] transition-all group flex flex-col justify-between cursor-pointer"
              >
                <div>
                  <span className="label-xs border border-white/10 px-2 py-0.5 rounded mb-3 inline-block">
                    {item.tag}
                  </span>
                  <h3 className="font-rajdhani font-bold text-white text-base leading-snug group-hover:text-apex-red transition-colors line-clamp-3">
                    {item.title}
                  </h3>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-white/[0.05] mt-3">
                  <span className="label-xs">{item.source}</span>
                </div>
              </a>
            ))
          ) : (
            <div className="col-span-3 py-8 text-center label-xs">News feed unavailable</div>
          )}
        </div>
      </div>
    </div>
  );
}
