import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { seasonSearch } from "@/lib/api/history";
import { useSettingsStore } from "@/lib/store";
import { f1Api } from "@/lib/api/client";
import {
  useSeason,
  SeasonControls,
  DataNotice,
  Progression,
  ResultTable,
} from "@/components/SeasonData";
import heroDriver from "@/assets/hero-driver.jpg";
export const Route = createFileRoute("/standings")({
  validateSearch: seasonSearch,
  component: StandingsPage,
});
function StandingsPage() {
  const search = Route.useSearch(),
    navigate = Route.useNavigate();
  const { selectedYear, setSelectedYear } = useSettingsStore();
  const year = search.year ?? selectedYear,
    round = search.round;
  useEffect(() => {
    if (year !== selectedYear) setSelectedYear(year);
  }, [year, selectedYear, setSelectedYear]);
  const query = useSeason(year, round),
    data = query.isError ? undefined : query.data;
  const [tab, setTab] = useState<"drivers" | "constructors" | "engines">("drivers");
  const [session, setSession] = useState("Race");
  const engines = useQuery({
    queryKey: ["engines", year],
    queryFn: () => f1Api.getEngineStandings(year),
    enabled: tab === "engines" && !round && year >= 2024,
    staleTime: 900000,
  });
  const standings = tab === "drivers" ? data?.driver_standings : data?.constructor_standings;
  const rows = standings?.rows ?? [];
  return (
    <div className="apex-page pb-24 space-y-6">
      <div className="w-full min-w-0 space-y-6">
        <header className="relative overflow-hidden rounded-3xl min-h-[180px] p-6 sm:p-8 border border-white/10">
          <img
            src={heroDriver}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/30" />
          <div className="relative">
            <p className="apex-eyebrow">Championship archive · {year}</p>
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl mt-2 leading-tight">
              Every season. Every point.
            </h1>
          </div>
        </header>
        <SeasonControls
          year={year}
          round={round}
          data={data}
          onChange={(year, round) => {
            setSelectedYear(year);
            void navigate({ search: { year, round } });
          }}
        />
        <DataNotice
          pending={query.isPending}
          error={query.isError}
          refreshing={query.isFetching}
          data={data}
          retry={() => void query.refetch()}
        />
        <div className="apex-tab-bar" role="group" aria-label="Championship category">
          {(["drivers", "constructors", "engines"] as const).map((t) => (
            <button
              className={`apex-tab ${tab === t ? "apex-tab-active" : ""}`}
              aria-pressed={tab === t}
              key={t}
              onClick={() => setTab(t)}
            >
              {t === "engines" ? "Power units" : t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        {tab === "engines" ? (
          <section className="glass rounded-2xl p-6">
            <h2 className="font-display text-2xl mb-4">Power-unit supplier aggregates</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Derived from official constructor points, not a separate FIA championship. Verified
              supplier mappings cover 2024–2026.
            </p>
            {round ? (
              <p>Supplier standings for selected rounds are not available.</p>
            ) : engines.isPending ? (
              <p role="status">Loading suppliers…</p>
            ) : engines.isError ? (
              <p role="alert">Supplier data unavailable.</p>
            ) : engines.data?.data?.length ? (
              engines.data.data.map((e) => (
                <div key={e.name} className="flex justify-between border-t border-border/40 py-4">
                  <span>{e.name}</span>
                  <span>{e.points} points</span>
                </div>
              ))
            ) : (
              <p>No verified supplier data for this season.</p>
            )}
          </section>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border/40">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <caption className="text-left p-4 text-muted-foreground">
                Official {tab} standings · {round ? `selected round ${round}` : "latest available"}{" "}
                · provider round {standings?.round ?? "unavailable"}
              </caption>
              <thead className="bg-muted/20">
                <tr>
                  {[
                    "Position",
                    tab === "drivers" ? "Driver" : "Constructor",
                    "Points",
                    "Wins",
                    "Podiums",
                    "Qualifying P1",
                    "Race starts from grid P1",
                  ].map((h) => (
                    <th key={h} className="p-4 font-normal text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const metric =
                    tab === "drivers" ? data?.drivers[row.id] : data?.constructors[row.id];
                  return (
                    <tr key={row.id} className="border-t border-border/30 hover:bg-foreground/5">
                      <td className="p-4 tabular-nums">
                        {row.positionText ?? row.position ?? "—"}
                      </td>
                      <td className="p-4">
                        {row.Driver ? (
                          <Link
                            className="hover:underline"
                            to="/drivers/$driverId"
                            params={{ driverId: row.id }}
                            search={{ year, round }}
                          >
                            {row.Driver.givenName} {row.Driver.familyName}
                            <span className="block text-xs text-muted-foreground mt-1">
                              {row.Constructors.map((c) => c.name).join(" · ")}
                            </span>
                          </Link>
                        ) : (
                          <Link
                            className="hover:underline"
                            to="/teams/$constructorId"
                            params={{ constructorId: row.id }}
                            search={{ year, round }}
                          >
                            {row.Constructor?.name}
                          </Link>
                        )}
                      </td>
                      <td className="p-4 font-mono">{row.points}</td>
                      <td className="p-4">{row.wins}</td>
                      <td className="p-4">
                        {data?.errors.races ? "Unavailable" : (metric?.podiums ?? "—")}
                      </td>
                      <td className="p-4">
                        {data?.metric_coverage.qualifying_p1 === "unavailable"
                          ? "Unavailable"
                          : (metric?.qualifying_p1 ?? "—")}
                      </td>
                      <td className="p-4">
                        {data?.errors.races ? "Unavailable" : (metric?.grid_p1_starts ?? "—")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!rows.length && (
              <p className="p-6 text-muted-foreground">
                No official standings available for this selection.
              </p>
            )}
          </div>
        )}
        {data && (
          <>
            <section className="mt-10">
              <h2 className="font-display text-3xl mb-5">{year} race calendar</h2>
              <div className="grid md:grid-cols-2 gap-3">
                {data.schedule.map((event) => {
                  const cleanRaceName = event.raceName
                    .replace(/\s*\[Provider Conflict\]\s*/gi, "")
                    .trim();
                  return (
                    <Link
                      key={event.round}
                      to="/race-center"
                      search={{ mode: "archive", year, round: event.round, session: "Race" }}
                      className="glass rounded-xl p-5 flex items-center justify-between gap-4 hover:bg-foreground/5"
                    >
                      <span className="min-w-0">
                        <span className="font-mono text-muted-foreground">
                          {String(event.round).padStart(2, "0")}
                        </span>
                        <span className="ml-3">{cleanRaceName}</span>
                        {event.has_conflict ? (
                          <span className="ml-2 inline-block rounded border border-amber-400/35 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-mono uppercase text-amber-300">
                            Provider note
                          </span>
                        ) : null}
                        <span className="block ml-9 mt-1 text-xs text-muted-foreground truncate">
                          {event.has_conflict
                            ? "Venue unconfirmed — provider disagreement"
                            : `${event.Circuit.circuitName} · ${event.Circuit.Location.locality}, ${event.Circuit.Location.country}`}
                        </span>
                      </span>
                      <time
                        dateTime={event.time ? `${event.date}T${event.time}` : event.date}
                        className="text-xs text-right text-muted-foreground shrink-0"
                      >
                        {event.date}
                        {event.time ? <span className="block">{event.time} UTC</span> : null}
                      </time>
                    </Link>
                  );
                })}
              </div>
            </section>
            <Progression data={data} />
            <section className="mt-10">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                <h2 className="font-display text-3xl">Race-by-race records</h2>
                <label>
                  Session
                  <select
                    className="ml-3 p-3 bg-background border border-border rounded-lg"
                    value={session}
                    onChange={(e) => setSession(e.target.value)}
                  >
                    {["Race", "Sprint", "Qualifying"].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </div>
              <ResultTable
                rows={data.results.filter(
                  (r) => r.session === session && (!round || r.round === round),
                )}
                year={year}
              />
            </section>
            <p className="text-xs text-muted-foreground mt-5">
              Wins and podiums use official Grand Prix finishing classifications. Sprints are
              separate. Qualifying P1 counts the classified qualifying result; it is not an all-era
              official pole tally. Race starts from grid P1 are tracked separately. Qualifying
              coverage is {data.metric_coverage.qualifying_p1}; fastest-lap coverage is{" "}
              {data.metric_coverage.fastest_laps} and can be unavailable or incomplete by era.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
