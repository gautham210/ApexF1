import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useSeason, DataNotice } from "./SeasonData";
import { usePreferences } from "@/lib/preferences";
import { readLocal, writeLocal } from "@/lib/companion";
export function FavoriteSnapshot({ year }: { year: number }) {
  const query = useSeason(year);
  const [prefs, update] = usePreferences();
  const data = query.isError ? undefined : query.data;
  const [favorite, setFavorite] = useState(() => readLocal(`apexf1.favorite.driver.${year}`, ""));
  const [team, setTeam] = useState(() => readLocal(`apexf1.favorite.team.${year}`, ""));
  const drivers = data?.driver_standings?.rows ?? [];
  const teams = data?.constructor_standings?.rows ?? [];
  const winner = data?.results
    .filter((r) => r.session === "Race" && r.position === 1)
    .sort((a, b) => b.round - a.round)[0];
  return (
    <section className="glass rounded-2xl p-6 my-6">
      <h2 className="font-display text-2xl">Season snapshot · {year}</h2>
      <DataNotice
        pending={query.isPending}
        error={query.isError}
        refreshing={query.isFetching}
        data={data}
        retry={() => void query.refetch()}
      />
      <div className="grid sm:grid-cols-2 gap-5 my-4">
        {[
          { kind: "driver", value: favorite, set: setFavorite, rows: drivers },
          { kind: "team", value: team, set: setTeam, rows: teams },
        ].map((group) => {
          const selected =
            (group.kind === "driver"
              ? group.rows.find(
                  (r) =>
                    r.Driver && `${r.Driver.givenName} ${r.Driver.familyName}` === prefs.driver,
                )
              : undefined) ?? group.rows.find((r) => r.id === group.value);
          return (
            <div key={group.kind}>
              <label>
                Favorite {group.kind}
                <select
                  className="block bg-background border border-border rounded-lg p-3 w-full mt-2"
                  value={selected?.id ?? group.value}
                  onChange={(e) => {
                    group.set(e.target.value);
                    const driver = group.rows.find((r) => r.id === e.target.value)?.Driver;
                    if (group.kind === "driver")
                      update({
                        driver: driver ? `${driver.givenName} ${driver.familyName}` : undefined,
                      });
                    writeLocal(`apexf1.favorite.${group.kind}.${year}`, e.target.value);
                  }}
                >
                  <option value="">Choose</option>
                  {group.rows.map((r) => (
                    <option value={r.id} key={r.id}>
                      {r.Driver
                        ? `${r.Driver.givenName} ${r.Driver.familyName}`
                        : (r.Constructor?.name ?? r.id)}
                    </option>
                  ))}
                </select>
              </label>
              <p className="mt-3">
                {selected
                  ? `Official P${selected.position ?? "unavailable"} · ${selected.points} points`
                  : "Select a provider-recorded entry."}
              </p>
              {selected && (
                <Link
                  className="underline inline-block py-3"
                  to={group.kind === "driver" ? "/drivers/$driverId" : "/teams/$constructorId"}
                  params={
                    group.kind === "driver"
                      ? { driverId: selected.id }
                      : { constructorId: selected.id }
                  }
                  search={{ year }}
                >
                  Open profile
                </Link>
              )}
            </div>
          );
        })}
      </div>
      <p>
        Championship leader:{" "}
        {drivers.find((r) => r.position === 1)?.Driver?.familyName ?? "Unavailable"} · gap{" "}
        {drivers.length >= 2 ? drivers[0].points - drivers[1].points : "unavailable"} points
      </p>
      <p className="mt-3">
        Latest confirmed race winner:{" "}
        {winner
          ? `${winner.Driver.givenName} ${winner.Driver.familyName} · ${winner.race}`
          : "Unavailable"}
      </p>
      <p className="text-xs text-muted-foreground mt-3">
        Jolpica · fetched {data?.fetched_at ?? "unavailable"}. Official snapshot and event results
        remain separate.
      </p>
    </section>
  );
}
