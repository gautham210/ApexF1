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
    data = query.data;
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
    <div className="min-h-screen px-5 lg:px-12 pt-10 pb-32">
      <div className="max-w-[1300px] mx-auto">
        <header className="relative overflow-hidden rounded-3xl min-h-56 p-8 mb-8">
          <img
            src={heroDriver}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-35"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-transparent" />
          <div className="relative">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Championship archive · {year}
            </p>
            <h1 className="font-display text-5xl md:text-6xl mt-4">
              Every season.
              <br />
              Every point.
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
          data={data}
          retry={() => void query.refetch()}
        />
        <div className="flex gap-2 my-6" role="group" aria-label="Championship category">
          {(["drivers", "constructors", "engines"] as const).map((t) => (
            <button
              className={`px-4 py-3 rounded-full text-sm ${tab === t ? "bg-foreground text-background" : "glass"}`}
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
                    "Grid poles",
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
                        {data?.errors.races ? "Unavailable" : (metric?.poles ?? "—")}
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
                {data.schedule.map((event) => (
                  <Link
                    key={event.round}
                    to="/race-center"
                    search={{ mode: "archive", year, round: event.round, session: "Race" }}
                    className="glass rounded-xl p-5 flex items-center justify-between gap-4 hover:bg-foreground/5"
                  >
                    <span>
                      <span className="font-mono text-muted-foreground">
                        {String(event.round).padStart(2, "0")}
                      </span>
                      <span className="ml-3">{event.raceName}</span>
                      <span className="block ml-9 mt-1 text-xs text-muted-foreground">
                        {event.Circuit.circuitName} · {event.Circuit.Location.locality},{" "}
                        {event.Circuit.Location.country}
                      </span>
                    </span>
                    <time
                      dateTime={event.time ? `${event.date}T${event.time}` : event.date}
                      className="text-xs text-right text-muted-foreground"
                    >
                      {event.date}
                      {event.time ? <span className="block">{event.time} UTC</span> : null}
                    </time>
                  </Link>
                ))}
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
              separate. Grid poles count race grid position 1; qualifying rank is shown
              independently. Fastest-lap coverage varies by era.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
