import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { api } from "@/lib/api/client";
import { seasonSearch, getCareer } from "@/lib/api/history";
import { useSettingsStore } from "@/lib/store";
import {
  useSeason,
  SeasonControls,
  DataNotice,
  Stats,
  ResultTable,
  Progression,
} from "@/components/SeasonData";
import { ProviderImage } from "@/components/ProviderImage";

export const Route = createFileRoute("/drivers/$driverId")({
  validateSearch: seasonSearch,
  component: DriverProfile,
});
function DriverProfile() {
  const { driverId } = Route.useParams(),
    search = Route.useSearch(),
    navigate = Route.useNavigate();
  const selectedYear = useSettingsStore((s) => s.selectedYear),
    setYear = useSettingsStore((s) => s.setSelectedYear);
  const year = search.year ?? selectedYear,
    round = search.round;
  const query = useSeason(year, round),
    data = query.data,
    driver = data?.drivers[driverId];
  const [careerEnabled, setCareerEnabled] = useState(false);
  const career = useQuery({
    queryKey: ["career", driverId],
    queryFn: () => getCareer(driverId),
    enabled: careerEnabled,
    staleTime: 900000,
    retry: 1,
  });
  const portrait = useQuery({
    queryKey: ["portrait", year, driverId],
    queryFn: async () => {
      const response = await api.get<never, unknown>(
        `/api/history/drivers/${encodeURIComponent(driverId)}/portrait`,
        { params: { year } },
      );
      const media = z
        .object({
          success: z.literal(true),
          data: z.object({
            year: z.number(),
            driver_id: z.string(),
            url: z.string().nullable(),
            source: z.string(),
            source_url: z.string(),
            status: z.string(),
          }),
        })
        .parse(response).data;
      if (media.year !== year || media.driver_id !== driverId)
        throw new Error("Portrait identity mismatch");
      return media;
    },
    staleTime: 3600000,
    retry: 0,
  });
  const official = data?.driver_standings?.rows.find((d) => d.id === driverId);
  const knownName = driver ?? official?.Driver;
  const name = knownName
    ? `${knownName.givenName} ${knownName.familyName}`
    : driverId.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  return (
    <main className="max-w-[1300px] mx-auto px-5 lg:px-12 pt-10 pb-32">
      <Link
        to="/standings"
        search={{ year, round }}
        className="text-sm text-muted-foreground hover:underline"
      >
        ← Championship standings
      </Link>
      <div className="flex flex-wrap gap-8 items-center mt-8">
        <ProviderImage url={portrait.data?.url} alt={`${name}, ${year}`} />
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">
            Driver profile · {year}
          </p>
          <h1 className="font-display text-5xl md:text-6xl mt-3">{name}</h1>
          <p className="text-muted-foreground mt-4">
            {knownName?.nationality ?? "Nationality unavailable"} · Born{" "}
            {knownName?.dateOfBirth ?? "unavailable"}
          </p>
          <p className="mt-3">
            {driver?.code ?? "—"} · Car {driver?.numbers.join(" / ") || "number unavailable"}
          </p>
          {portrait.data?.url && (
            <a
              className="text-xs underline"
              href="https://openf1.org/docs/#drivers"
              target="_blank"
              rel="noreferrer"
            >
              Portrait supplied by OpenF1 · {year} session
            </a>
          )}
        </div>
      </div>
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
        data={data}
        retry={() => void query.refetch()}
      />
      {data && (
        <>
          <Stats
            items={[
              ["Championship position", official?.positionText ?? official?.position ?? "—"],
              ["Championship points", official?.points ?? "—"],
              ["Grand Prix wins", official?.wins ?? "—"],
              ["Race podiums", data.errors.races ? "Unavailable" : (driver?.podiums ?? "—")],
            ]}
          />
          <div className="flex flex-wrap gap-3">
            {Object.entries(driver?.teams ?? {}).map(([id, name]) => (
              <Link
                key={id}
                className="glass rounded-full px-4 py-3 text-sm"
                to="/teams/$constructorId"
                params={{ constructorId: id }}
                search={{ year, round }}
              >
                {name}
              </Link>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-5">
            Grid poles: {data.errors.races ? "unavailable" : (driver?.poles ?? "—")} · Recorded
            fastest laps: {data.errors.races ? "unavailable" : (driver?.fastest_laps ?? "—")}.
            Fastest-lap records are incomplete in some historical seasons.
          </p>
          <Progression data={data} driverId={driverId} />
          <h2 className="font-display text-3xl my-6">Season results & qualifying</h2>
          <ResultTable
            rows={data.results.filter((r) => r.Driver.driverId === driverId)}
            year={year}
          />
        </>
      )}
      <section className="mt-10 glass rounded-2xl p-6">
        <h2 className="font-display text-3xl">Career championship records</h2>
        <p className="text-sm text-muted-foreground my-4">
          Official season standings and points, preserving each era’s scoring. The current season
          may still be in progress.
        </p>
        <button
          className="border border-border px-5 py-3 rounded-full"
          onClick={() => {
            setCareerEnabled(true);
            if (career.isError) void career.refetch();
          }}
        >
          Load career records
        </button>
        {careerEnabled && career.isPending && (
          <p role="status" className="py-5">
            Loading career…
          </p>
        )}
        {career.isError && <p role="alert">Career records unavailable.</p>}
        {career.data && (
          <>
            <Stats
              items={[
                ["Seasons recorded", career.data.season_records.length],
                ["Grand Prix wins", career.data.wins],
                ["Championship points", career.data.championship_points],
                ["Titles", career.data.titles],
              ]}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr>
                    {["Season", "Position", "Points", "Wins", "Constructors"].map((h) => (
                      <th className="p-3" key={h}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {career.data.season_records.map((r) => (
                    <tr key={r.year} className="border-t border-border/30">
                      <td className="p-3">
                        <Link
                          className="underline"
                          to="/drivers/$driverId"
                          params={{ driverId }}
                          search={{ year: r.year }}
                        >
                          {r.year}
                        </Link>
                      </td>
                      <td>{r.positionText ?? r.position ?? "—"}</td>
                      <td>{r.points}</td>
                      <td>{r.wins}</td>
                      <td>{r.Constructors.map((c) => c.name).join(" · ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
