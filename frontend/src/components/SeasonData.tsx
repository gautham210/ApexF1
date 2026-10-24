import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { getSeason, type Result, type Season } from "@/lib/api/history";
import { GlassPanel } from "./GlassPanel";

export function useSeason(year: number, round?: number) {
  return useQuery({
    queryKey: ["history", year, round ?? "latest"],
    queryFn: ({ signal }) => getSeason(year, round, signal),
    staleTime: 900000,
    retry: 1,
  });
}
export function SeasonControls({
  year,
  round,
  data,
  onChange,
}: {
  year: number;
  round?: number;
  data?: Season;
  onChange: (year: number, round?: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-4 my-6">
      <label className="text-sm">
        Season
        <select
          className="ml-3 rounded-lg border border-border bg-background p-3"
          value={year}
          onChange={(e) => onChange(Number(e.target.value))}
        >
          {Array.from(
            { length: new Date().getFullYear() - 1949 },
            (_, i) => new Date().getFullYear() - i,
          ).map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        Standings through
        <select
          className="ml-3 rounded-lg border border-border bg-background p-3 max-w-64"
          value={round ?? ""}
          onChange={(e) => onChange(year, e.target.value ? Number(e.target.value) : undefined)}
        >
          <option value="">Latest available round</option>
          {data?.schedule.map((r) => (
            <option value={r.round} key={r.round}>
              {r.round} · {r.raceName}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
export function DataNotice({
  pending,
  error,
  refreshing,
  data,
  retry,
}: {
  pending: boolean;
  error: boolean;
  refreshing: boolean;
  data?: Season;
  retry: () => void;
}) {
  if (pending)
    return (
      <div role="status" className="animate-pulse rounded-2xl bg-muted/30 p-10">
        Loading verified season records…
      </div>
    );
  if (error)
    return (
      <div role="alert" className="p-6 glass rounded-2xl">
        Season data is unavailable.{" "}
        <button className="underline p-3" onClick={retry}>
          Try again
        </button>
      </div>
    );
  return (
    data && (
      <p role="status" className="text-sm text-muted-foreground my-5">
        {data.status === "partial"
          ? `Partial coverage: ${Object.keys(data.errors).join(", ")} unavailable. `
          : ""}
        {refreshing ? "Refreshing; the previous snapshot remains visible. " : ""}
        {data.schedule.some((r) => r.has_conflict)
          ? "Provider event identity disagreement: inspect the source before relying on venue details. "
          : ""}
        Jolpica · standings after round {data.driver_standings?.round ?? "unavailable"}. Event
        totals can differ from championship points because of deductions or historical scoring
        rules.
      </p>
    )
  );
}
export function Stats({ items }: { items: [string, string | number][] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-8">
      {items.map(([label, value]) => (
        <GlassPanel key={label} className="p-5">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="font-display text-3xl mt-2 tabular-nums">{value}</p>
        </GlassPanel>
      ))}
    </div>
  );
}
export function ResultTable({ rows, year }: { rows: Result[]; year: number }) {
  if (!rows.length)
    return (
      <p className="p-6 text-muted-foreground">No classifications available for this selection.</p>
    );
  return (
    <div className="overflow-x-auto rounded-2xl border border-border/50">
      <table className="w-full text-sm text-left whitespace-nowrap">
        <caption className="sr-only">Official session classifications</caption>
        <thead className="bg-muted/20 text-muted-foreground">
          <tr>
            {[
              "Round / session",
              "Driver",
              "Constructor",
              "Grid",
              "Position",
              "Status / qualifying",
              "Points",
            ].map((h) => (
              <th key={h} className="p-4 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={`${r.round}-${r.session}-${r.Driver.driverId}-${i}`}
              className="border-t border-border/30"
            >
              <td className="p-4">
                <Link
                  className="hover:underline"
                  to="/race-center"
                  search={{ mode: "archive", year, round: r.round, session: r.session }}
                >
                  {r.round} · {r.race}
                  <span className="block text-xs text-muted-foreground">{r.session}</span>
                </Link>
              </td>
              <td className="p-4">
                <Link
                  className="hover:underline"
                  to="/drivers/$driverId"
                  params={{ driverId: r.Driver.driverId }}
                  search={{ year }}
                >
                  {r.Driver.givenName} {r.Driver.familyName}
                </Link>
              </td>
              <td className="p-4">
                <Link
                  className="hover:underline"
                  to="/teams/$constructorId"
                  params={{ constructorId: r.Constructor.constructorId }}
                  search={{ year }}
                >
                  {r.Constructor.name}
                </Link>
              </td>
              <td className="p-4">{r.grid === 0 ? "Pit / unavailable" : (r.grid ?? "—")}</td>
              <td className="p-4">{r.positionText ?? r.position ?? "—"}</td>
              <td className="p-4">
                {r.session === "Qualifying"
                  ? [r.Q1, r.Q2, r.Q3].filter(Boolean).join(" / ") || "—"
                  : (r.status ?? "Unavailable")}
              </td>
              <td className="p-4 tabular-nums">{r.session === "Qualifying" ? "—" : r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Progression({ data, driverId }: { data: Season; driverId?: string }) {
  const ids = driverId
    ? [driverId]
    : (data.driver_standings?.rows.slice(0, 5).map((d) => d.id) ?? []);
  return (
    <details className="glass rounded-2xl p-5 my-6">
      <summary className="cursor-pointer">
        Cumulative event points {driverId ? "" : "· top five drivers"}
      </summary>
      <p className="text-xs text-muted-foreground my-3">
        Race + sprint points as awarded in classifications. Not reconstructed official standings;
        historical dropped scores and penalties can differ.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr>
              <th className="p-3">Round</th>
              {ids.map((id) => (
                <th className="p-3" key={id}>
                  {data.drivers[id]?.familyName ?? id}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.progression.map((p) => (
              <tr key={p.round} className="border-t border-border/30">
                <td className="p-3">{p.round}</td>
                {ids.map((id) => (
                  <td className="p-3 tabular-nums" key={id}>
                    {p.points[id] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
