import { createFileRoute, Link } from "@tanstack/react-router";
import { seasonSearch } from "@/lib/api/history";
import { useSettingsStore } from "@/lib/store";
import { useQuery } from "@tanstack/react-query";
import { getTeamPowerUnit } from "@/lib/api/history";
import { useSeason, SeasonControls, DataNotice, Stats, ResultTable } from "@/components/SeasonData";
export const Route = createFileRoute("/teams/$constructorId")({
  validateSearch: seasonSearch,
  component: TeamProfile,
});
function TeamProfile() {
  const { constructorId } = Route.useParams(),
    search = Route.useSearch(),
    navigate = Route.useNavigate();
  const selectedYear = useSettingsStore((s) => s.selectedYear),
    setYear = useSettingsStore((s) => s.setSelectedYear);
  const year = search.year ?? selectedYear,
    round = search.round,
    query = useSeason(year, round),
    data = query.isError ? undefined : query.data,
    team = data?.constructors[constructorId],
    official = data?.constructor_standings?.rows.find((t) => t.id === constructorId);
  const powerUnit = useQuery({
    queryKey: ["team-power-unit", year, team?.name],
    queryFn: ({ signal }) => getTeamPowerUnit(year, team!.name, signal),
    enabled: !!team && year >= 2024,
    staleTime: 900000,
  });
  return (
    <main className="max-w-[1300px] mx-auto px-5 lg:px-12 pt-10 pb-32">
      <Link
        to="/standings"
        search={{ year, round }}
        className="text-sm text-muted-foreground hover:underline"
      >
        ← Championship standings
      </Link>
      <header className="glass rounded-3xl p-8 mt-8">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Constructor profile · {year}
        </p>
        <h1 className="font-display text-5xl md:text-6xl mt-4">
          {team?.name ?? official?.Constructor?.name ?? constructorId.replaceAll("_", " ")}
        </h1>
        <p className="text-muted-foreground mt-4">
          {team?.nationality ?? official?.Constructor?.nationality ?? "Nationality unavailable"}
        </p>
      </header>
      <SeasonControls
        year={year}
        round={round}
        data={data}
        onChange={(year, round) => {
          setYear(year);
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
      {data && (
        <>
          <Stats
            items={[
              ["Championship position", official?.positionText ?? official?.position ?? "—"],
              ["Official constructor points", official?.points ?? "—"],
              ["Grand Prix wins", official?.wins ?? "—"],
              ["Car podium finishes", data.errors.races ? "Unavailable" : (team?.podiums ?? "—")],
              [
                "Qualifying P1",
                data.metric_coverage.qualifying_p1 === "unavailable"
                  ? "Unavailable"
                  : (team?.qualifying_p1 ?? "—"),
              ],
              [
                "Race starts from grid P1",
                data.errors.races ? "Unavailable" : (team?.grid_p1_starts ?? "—"),
              ],
              [
                "Fastest laps",
                data.errors.races || data.metric_coverage.fastest_laps === "unavailable"
                  ? "Unavailable"
                  : (team?.fastest_laps ?? "—"),
              ],
            ]}
          />
          <p className="text-sm text-muted-foreground -mt-4 mb-6">
            Qualifying P1 coverage: {data.metric_coverage.qualifying_p1}; fastest-lap coverage:{" "}
            {data.metric_coverage.fastest_laps}. Qualifying P1 is an event classification statistic,
            not an all-era official pole tally.
          </p>
          <h2 className="font-display text-3xl my-6">Driver contributions</h2>
          <p className="text-sm text-muted-foreground mb-5">
            Season power unit:{" "}
            {powerUnit.isPending
              ? "Loading verified supplier mapping…"
              : powerUnit.isError
                ? "Supplier data unavailable"
                : (powerUnit.data ?? "No verified supplier mapping for this season")}
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            Points earned while representing this constructor in race and sprint classifications.
            Historical scoring and penalties may make this sum differ from official constructor
            points.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {Object.entries(team?.contributions ?? {}).map(([id, points]) => (
              <Link
                className="glass rounded-2xl p-6 flex justify-between"
                key={id}
                to="/drivers/$driverId"
                params={{ driverId: id }}
                search={{ year, round }}
              >
                <span>
                  {data.drivers[id]?.givenName} {data.drivers[id]?.familyName}
                </span>
                <span>{points} pts</span>
              </Link>
            ))}
          </div>
          <h2 className="font-display text-3xl my-8">Team classifications</h2>
          <ResultTable
            rows={data.results.filter((r) => r.Constructor.constructorId === constructorId)}
            year={year}
          />
          <p className="text-sm text-muted-foreground mt-6">
            Historical identity: {constructorId}. Records retain the provider’s constructor identity
            for this season. Renames and mergers are not automatically joined. Licensed team imagery
            and complete historical power-unit relationships are unavailable.
          </p>
        </>
      )}
    </main>
  );
}
