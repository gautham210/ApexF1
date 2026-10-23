import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { getOfficialProgression, getHistoricalSchedule } from "@/lib/api/history";
import { useSettingsStore } from "@/lib/store";
import { f1Api } from "@/lib/api/client";
import { useSeason, DataNotice, ResultTable } from "@/components/SeasonData";
import { ForegroundReminder } from "@/components/ForegroundReminder";
import { FavoriteSnapshot } from "@/components/FavoriteSnapshot";
import { RaceWidget } from "@/components/RaceWidget";
import {
  formatInZone,
  raceWidgetData,
  timezones,
  eventProgression,
  simulate,
  readLocal,
  writeLocal,
  type Adjustment,
  type ChampionshipKind,
} from "@/lib/companion";
import { cars } from "@/lib/museum";
const CarViewer = lazy(() => import("@/components/CarViewer"));
const views = ["times", "timeline", "simulator", "museum", "discover"] as const;
type View = (typeof views)[number];
export const Route = createFileRoute("/companion")({
  validateSearch: (s: Record<string, unknown>): { view: View; year: number; car?: string } => ({
    view: views.includes(s.view as View) ? (s.view as View) : ("times" as View),
    year:
      Number.isInteger(Number(s.year)) &&
      Number(s.year) >= 1950 &&
      Number(s.year) <= new Date().getFullYear()
        ? Number(s.year)
        : useSettingsStore.getState().selectedYear,
    car: typeof s.car === "string" ? s.car : undefined,
  }),
  component: Companion,
});
const control = "rounded-lg border border-border bg-background px-3 py-3 min-h-11";
function Companion() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const selectedYear = useSettingsStore((s) => s.selectedYear);
  const setSelectedYear = useSettingsStore((s) => s.setSelectedYear);
  useEffect(() => {
    if (selectedYear !== search.year) setSelectedYear(search.year);
  }, [selectedYear, search.year, setSelectedYear]);
  return (
    <div className="max-w-[1300px] mx-auto px-5 lg:px-12 pt-10 pb-32 min-w-0">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">ApexF1 companion</p>
      <h1 className="font-display text-5xl md:text-6xl mt-4">Your race weekend.</h1>
      <nav aria-label="Companion tools" className="flex flex-wrap gap-2 my-6">
        {views.map((view) => (
          <Link
            key={view}
            to="/companion"
            search={{ ...search, view }}
            aria-current={search.view === view ? "page" : undefined}
            className={`${control} ${search.view === view ? "bg-foreground/10" : ""}`}
          >
            {
              {
                times: "Race times",
                timeline: "Championship timeline",
                simulator: "What if?",
                museum: "History garage",
                discover: "Discover",
              }[view]
            }
          </Link>
        ))}
      </nav>
      <label className="block mb-6">
        Season{" "}
        <select
          className={control}
          value={search.year}
          onChange={(e) => void navigate({ search: { ...search, year: Number(e.target.value) } })}
        >
          {Array.from(
            { length: new Date().getFullYear() - 1949 },
            (_, i) => new Date().getFullYear() - i,
          ).map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>
      </label>
      {search.view === "times" ? (
        <TimeHub year={search.year} />
      ) : search.view === "museum" ? (
        <Museum year={search.year} carId={search.car} />
      ) : search.view === "discover" ? (
        <Discovery year={search.year} />
      ) : (
        <Championship
          key={`${search.year}-${search.view}`}
          year={search.year}
          simulation={search.view === "simulator"}
        />
      )}
    </div>
  );
}
function TimeHub({ year }: { year: number }) {
  const query = useQuery({
    queryKey: ["schedule", year],
    queryFn: ({ signal }) =>
      year < 2018 ? getHistoricalSchedule(year, signal) : f1Api.getSchedule(year, signal),
    staleTime: 900000,
    retry: 1,
  });
  const events = query.data?.data ?? [];
  const [zone, setZone] = useState(() => readLocal("apexf1.timezone", "Asia/Kolkata"));
  const [favorites, setFavorites] = useState<string[]>(() => {
    const s = readLocal<unknown>("apexf1.zones", timezones.slice(0, 4));
    return Array.isArray(s)
      ? s.filter((x) => typeof x === "string").slice(0, 12)
      : timezones.slice(0, 4);
  });
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [snapshot, setSnapshot] = useState(false);
  const [round, setRound] = useState<number | null>(null);
  const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const zones = Array.from(
    new Set([...timezones, browserZone, ...Intl.supportedValuesOf("timeZone")]),
  ).filter((z) => z.toLowerCase().includes(search.toLowerCase()));
  const event =
    events.find((e) => e.round_number === round) ??
    events.find((e) => raceWidgetData([e], Date.now(), year).nextSession) ??
    events[0];
  const data = raceWidgetData(event ? [event] : [], Date.now(), year);
  const allZones = Array.from(new Set(["UTC", "Asia/Kolkata", browserZone, zone, ...favorites]));
  const text = data.sessions
    .map((s) => `${s.event} · ${s.name} · ${formatInZone(s.instant, zone)} (${zone})`)
    .join("\n");
  return (
    <>
      <p className="text-muted-foreground mb-5">
        Canonical provider instants converted with IANA timezones. Session start does not establish
        live status. Event-local timezone is unavailable unless explicitly supplied by the provider.
      </p>
      {query.isPending && <p role="status">Loading schedules…</p>}
      {query.isError && (
        <p role="alert">
          Schedule unavailable.{" "}
          <button className={control} onClick={() => void query.refetch()}>
            Retry
          </button>
        </p>
      )}
      <div className="grid md:grid-cols-2 gap-5">
        <RaceWidget year={year} events={events} zone={zone} expanded />
        <section className="glass rounded-2xl p-6">
          <h2 className="font-display text-2xl">Your timezones</h2>
          <label className="block mt-4">
            Search city or IANA zone
            <input
              className={`${control} w-full mt-2`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="block mt-3">
            Display timezone
            <select
              className={`${control} w-full`}
              value={zone}
              onChange={(e) => {
                setZone(e.target.value);
                writeLocal("apexf1.timezone", e.target.value);
              }}
            >
              {Array.from(new Set([zone, ...zones])).map((z) => (
                <option key={z}>{z}</option>
              ))}
            </select>
          </label>
          <button
            className={`${control} mt-3`}
            onClick={() => {
              const next = favorites.includes(zone)
                ? favorites.filter((z) => z !== zone)
                : [...favorites.slice(-11), zone];
              setFavorites(next);
              if (!writeLocal("apexf1.zones", next))
                setMessage("Storage unavailable; preference retained for this visit.");
            }}
          >
            {favorites.includes(zone) ? "Remove favorite timezone" : "Favorite timezone"}
          </button>
          <p className="text-xs mt-3">{favorites.join(" · ")}</p>
        </section>
      </div>
      <label className="block my-6">
        Race weekend{" "}
        <select
          className={`${control} max-w-full`}
          value={event?.round_number ?? ""}
          onChange={(e) => setRound(Number(e.target.value))}
        >
          {events.map((e) => (
            <option key={e.round_number} value={e.round_number}>
              {e.round_number} · {e.event_name}
            </option>
          ))}
        </select>
      </label>
      {event?.has_conflict && (
        <p role="alert" className="my-4 text-amber-400">
          Providers disagree about this event. Venue unconfirmed; times remain provider-reported.
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="text-sm w-full whitespace-nowrap">
          <caption className="text-left my-3">
            {event?.event_name ?? "No event schedule available"} — timezone conversion
          </caption>
          <thead>
            <tr>
              <th className="p-3 text-left">Session</th>
              {allZones.map((z) => (
                <th className="p-3 text-left" key={z}>
                  {z}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.sessions.map((s) => (
              <tr className="border-t border-border" key={s.name}>
                <th className="p-3 text-left">{s.name}</th>
                {allZones.map((z) => (
                  <td className="p-3" key={z}>
                    {formatInZone(s.instant, z)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!data.sessions.length && !query.isPending && (
        <p className="py-4">
          No confirmed session instants. Date-only schedules are not converted into invented times.
        </p>
      )}
      <div className="flex flex-wrap gap-3 my-5">
        <button
          disabled={!text}
          className={control}
          onClick={() => {
            if (!navigator.clipboard) {
              setMessage("Copy unavailable in this browser.");
              return;
            }
            void navigator.clipboard
              .writeText(text)
              .then(() => setMessage("Schedule copied."))
              .catch(() => setMessage("Copy unavailable in this browser."));
          }}
        >
          Copy schedule
        </button>
        <button
          disabled={!text}
          className={control}
          onClick={() => {
            if (navigator.share)
              void navigator
                .share({ title: "ApexF1 race times", text, url: location.href })
                .catch(() => setMessage("Sharing cancelled or unavailable."));
            else setMessage("Sharing unavailable; use Copy schedule.");
          }}
        >
          Share
        </button>
        <Link to="/calendar" className={control}>
          Export calendar file
        </Link>
      </div>
      <p role="status">{message}</p>
      <ForegroundReminder events={events} />
      <section className="my-5 text-sm text-muted-foreground">
        <h2 className="font-display text-2xl text-foreground mb-3">Install ApexF1</h2>
        <p>
          Android: use your browser’s Install app menu when offered. iPhone/iPad: open in Safari,
          Share, then Add to Home Screen. Visit online first to save the interface; live and
          historical API data require a connection. Updates appear as a reload action when ready.
        </p>
      </section>
      <button className={control} onClick={() => setSnapshot((v) => !v)}>
        {snapshot ? "Hide season snapshot" : "Load favorites and latest confirmed result"}
      </button>
      {snapshot && <FavoriteSnapshot key={year} year={year} />}
      <p className="text-xs text-muted-foreground">
        Schedule fetched{" "}
        {query.dataUpdatedAt ? new Date(query.dataUpdatedAt).toLocaleString() : "not yet"}. No
        offline API cache. Background notifications and native home-screen widgets are not supplied
        by this PWA.
      </p>
    </>
  );
}
function Championship({ year, simulation }: { year: number; simulation: boolean }) {
  const query = useSeason(year);
  const data = query.isError ? undefined : query.data;
  const [kind, setKind] = useState<ChampionshipKind>("drivers");
  const [selected, setSelected] = useState<string[] | null>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [perEvent, setPerEvent] = useState(false);
  const [filter, setFilter] = useState("");
  const [officialMode, setOfficialMode] = useState(true);
  const officialQuery = useQuery({
    queryKey: ["official-progression", year, kind],
    queryFn: ({ signal }) => getOfficialProgression(year, kind, signal),
    enabled: !simulation && officialMode && !perEvent,
    staleTime: 900000,
    retry: 1,
  });
  const eventFrames = useMemo(() => eventProgression(data?.results ?? [], kind), [data, kind]);
  const progression =
    officialMode && !perEvent && !simulation
      ? (officialQuery.data?.rounds ?? []).map((r) => ({
          round: r.round,
          points: r.points ?? {},
          earned: eventFrames.find((e) => e.round === r.round)?.earned ?? {},
          unavailable: r.points === null,
        }))
      : eventFrames.map((r) => ({ ...r, unavailable: false }));
  const official = kind === "drivers" ? data?.driver_standings : data?.constructor_standings;
  const entries = Object.entries(
    kind === "drivers" ? (data?.drivers ?? {}) : (data?.constructors ?? {}),
  ).map(([id, row]) => ({
    id,
    name: "givenName" in row ? `${row.givenName} ${row.familyName}` : row.name,
  }));
  const chosen = selected ?? entries.slice(0, 3).map((e) => e.id);
  const frame = progression[Math.min(index, Math.max(0, progression.length - 1))];
  const colors = ["#f97316", "#60a5fa", "#4ade80", "#e879f9", "#facc15", "#fb7185"];
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () =>
        setIndex((i) => {
          if (i >= progression.length - 1) {
            setPlaying(false);
            return i;
          }
          return i + 1;
        }),
      900,
    );
    return () => clearInterval(timer);
  }, [playing, progression.length]);
  const baseline = (official?.rows ?? []).map((r) => ({
    id: r.id,
    name: r.Driver ? `${r.Driver.givenName} ${r.Driver.familyName}` : (r.Constructor?.name ?? r.id),
    points: r.points,
    position: r.position,
  }));
  const current = frame ? (perEvent ? frame.earned : frame.points) : {};
  const max = Math.max(
    1,
    ...progression.flatMap((p) => chosen.map((id) => (perEvent ? p.earned : p.points)[id] ?? 0)),
  );
  return (
    <>
      <DataNotice
        pending={query.isPending}
        error={query.isError}
        refreshing={query.isFetching}
        data={data}
        retry={() => void query.refetch()}
      />
      {data && (
        <>
          <div className="flex flex-wrap gap-3 my-5">
            <label>
              Championship{" "}
              <select
                className={control}
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value as ChampionshipKind);
                  setSelected(null);
                  setIndex(0);
                  setPlaying(false);
                }}
              >
                <option value="drivers">Drivers</option>
                <option value="constructors">Constructors</option>
              </select>
            </label>
            <Link
              to="/companion"
              search={{ year, view: simulation ? "timeline" : "simulator" }}
              className={control}
            >
              {simulation ? "Back to timeline" : "Open what-if simulator"}
            </Link>
            <Link to="/standings" search={{ year, round: frame?.round }} className={control}>
              Official standings at selected round
            </Link>
          </div>
          <p className="text-sm text-amber-300 my-4">
            {officialMode && !perEvent && !simulation
              ? "Published official standings snapshots, retaining historical scoring and adjustments. Gaps mean that a round snapshot is unavailable; they are never reconstructed."
              : "Event-point accumulation from provider race and sprint points. Not official historical standings: dropped scores, deductions and exclusions may differ."}
          </p>
          {(data.errors.races || data.errors.sprints) && (
            <p role="alert">Partial result coverage — this progression is incomplete.</p>
          )}
          {simulation ? (
            <Simulator
              key={`${year}-${kind}`}
              year={year}
              kind={kind}
              baseline={baseline}
              rounds={progression.map((p) => p.round)}
            />
          ) : (
            <>
              <label className="block">
                Find competitors
                <input
                  className={`${control} w-full mt-2`}
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </label>
              <fieldset className="flex flex-wrap gap-3 my-5">
                <legend className="sr-only">Compare up to six competitors</legend>
                {entries
                  .filter((e) => e.name.toLowerCase().includes(filter.toLowerCase()))
                  .map((e) => (
                    <label className="flex items-center gap-2 py-2" key={e.id}>
                      <input
                        type="checkbox"
                        checked={chosen.includes(e.id)}
                        onChange={() =>
                          setSelected(
                            chosen.includes(e.id)
                              ? chosen.filter((id) => id !== e.id)
                              : [...chosen.slice(-5), e.id],
                          )
                        }
                      />
                      {e.name}
                    </label>
                  ))}
              </fieldset>
              <label className="block my-3">
                <input
                  type="checkbox"
                  checked={officialMode}
                  onChange={(e) => {
                    setOfficialMode(e.target.checked);
                    setIndex(0);
                    setPlaying(false);
                  }}
                />{" "}
                Official championship snapshots
              </label>
              {officialQuery.isFetching && officialMode && !perEvent && (
                <p role="status">Loading official round snapshots…</p>
              )}
              {officialQuery.isError && officialMode && !perEvent && (
                <p role="alert">
                  Official progression unavailable. Select event-point accumulation or{" "}
                  <button className="underline p-3" onClick={() => void officialQuery.refetch()}>
                    retry official snapshots
                  </button>
                  .
                </p>
              )}
              <label>
                <input
                  type="checkbox"
                  checked={perEvent}
                  onChange={(e) => {
                    setPerEvent(e.target.checked);
                    setIndex(0);
                    setPlaying(false);
                  }}
                />{" "}
                Show points per event
              </label>
              {progression.length ? (
                <>
                  <svg
                    viewBox="0 0 800 260"
                    className="w-full my-5 border-b border-border"
                    role="img"
                    aria-label={`${perEvent ? "Per-event classification" : officialMode ? "Official championship snapshot" : "Cumulative event"} points. Values available in table below.`}
                  >
                    {chosen.map((id, c) => (
                      <path
                        key={id}
                        fill="none"
                        stroke={colors[c % colors.length]}
                        strokeWidth="3"
                        d={progression
                          .slice(0, index + 1)
                          .map((p, i) => {
                            const value = (perEvent ? p.earned : p.points)[id];
                            if (p.unavailable || value === undefined) return "";
                            const prev = progression[i - 1];
                            const connected =
                              prev &&
                              !prev.unavailable &&
                              (perEvent ? prev.earned : prev.points)[id] !== undefined;
                            return `${connected ? "L" : "M"} ${20 + (i * 760) / Math.max(1, progression.length - 1)} ${240 - (value / max) * 220}`;
                          })
                          .join(" ")}
                      />
                    ))}
                    {chosen.slice(0, 1).flatMap((id) =>
                      progression.map((p, i) => {
                        const value = (perEvent ? p.earned : p.points)[id];
                        if (p.unavailable || value === undefined) return null;
                        return (
                          <circle
                            key={`${id}-${p.round}`}
                            cx={20 + (i * 760) / Math.max(1, progression.length - 1)}
                            cy={240 - (value / max) * 220}
                            r={i === index ? 7 : 5}
                            fill={colors[0]}
                            role="button"
                            tabIndex={0}
                            aria-label={`Round ${p.round}: ${value} points. Inspect results.`}
                            onClick={() => {
                              setIndex(i);
                              setPlaying(false);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setIndex(i);
                                setPlaying(false);
                              }
                            }}
                          >
                            <title>
                              Round {p.round} · {value} points
                            </title>
                          </circle>
                        );
                      }),
                    )}
                  </svg>
                  <div className="flex flex-wrap gap-2 items-center">
                    {[
                      [
                        "Reset",
                        () => {
                          setIndex(0);
                          setPlaying(false);
                        },
                      ],
                      ["Previous", () => setIndex((i) => Math.max(0, i - 1))],
                      [playing ? "Pause" : "Play", () => setPlaying((v) => !v)],
                      ["Next", () => setIndex((i) => Math.min(progression.length - 1, i + 1))],
                    ].map(([label, fn]) => (
                      <button key={String(label)} className={control} onClick={fn as () => void}>
                        {String(label)}
                      </button>
                    ))}
                    <label className="flex-1 min-w-40">
                      Round {frame?.round}
                      <input
                        className="block w-full"
                        aria-label="Race round"
                        type="range"
                        min="0"
                        max={progression.length - 1}
                        value={index}
                        onChange={(e) => {
                          setIndex(Number(e.target.value));
                          setPlaying(false);
                        }}
                      />
                    </label>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm my-5">
                      <thead>
                        <tr>
                          {[
                            "Competitor",
                            "Points in view",
                            "Points this round",
                            "Gap to leader in selected source",
                          ].map((h) => (
                            <th className="p-3 text-left" key={h}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {chosen.map((id, c) => (
                          <tr key={id} className="border-t border-border">
                            <th className="p-3 text-left" style={{ color: colors[c % 6] }}>
                              {entries.find((e) => e.id === id)?.name}
                            </th>
                            <td>
                              {frame?.unavailable ? "Unavailable" : (current[id] ?? "No entry")}
                            </td>
                            <td>{frame?.earned[id] ?? "Unavailable"}</td>
                            <td>
                              {frame?.unavailable || frame?.points[id] === undefined
                                ? "Unavailable"
                                : Math.max(0, ...Object.values(frame?.points ?? {})) -
                                  frame.points[id]}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <h2 className="font-display text-2xl my-5">
                    Round {frame?.round} ·{" "}
                    {data.schedule.find((s) => s.round === frame?.round)?.raceName}
                  </h2>
                  <ResultTable
                    year={year}
                    rows={data.results.filter(
                      (r) => r.round === frame?.round && r.session !== "Qualifying",
                    )}
                  />
                </>
              ) : (
                <p>
                  {officialMode && !perEvent
                    ? officialQuery.isFetching
                      ? "Official snapshots are loading; classifications remain available via Standings."
                      : "No published round snapshots available for this view."
                    : "No race classifications supplied for this season."}
                </p>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
interface Saved {
  name: string;
  changes: Adjustment[];
}
function Simulator({
  year,
  kind,
  baseline,
  rounds,
}: {
  year: number;
  kind: ChampionshipKind;
  baseline: { id: string; name: string; points: number; position: number | null }[];
  rounds: number[];
}) {
  const [changes, setChanges] = useState<Adjustment[]>([]);
  const [id, setId] = useState("");
  const [round, setRound] = useState(rounds[0] ?? 1);
  const [delta, setDelta] = useState(0);
  const [note, setNote] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const key = `apexf1.scenarios.v1.${year}.${kind}`;
  const [saved, setSaved] = useState<Saved[]>(() => {
    const raw = readLocal<unknown>(key, []);
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(
        (s): s is Saved =>
          !!s &&
          typeof s.name === "string" &&
          Array.isArray(s.changes) &&
          s.changes.length <= 100 &&
          s.changes.every(
            (c: Adjustment) =>
              typeof c.id === "string" &&
              Number.isFinite(c.delta) &&
              Math.abs(c.delta) <= 1000 &&
              Number.isInteger(c.round) &&
              c.round > 0 &&
              typeof c.note === "string",
          ),
      )
      .slice(0, 10);
  });
  const [compare, setCompare] = useState("");
  const safeChanges = changes.filter((c) => baseline.some((b) => b.id === c.id));
  const rows = simulate(baseline, safeChanges);
  const comparison = saved.find((s) => s.name === compare);
  const compareRows = comparison
    ? simulate(
        baseline,
        comparison.changes.filter((c) => baseline.some((b) => b.id === c.id)),
      )
    : [];
  return (
    <section className="glass rounded-2xl p-5 md:p-8">
      <h2 className="font-display text-3xl">Hypothetical simulation — not official results</h2>
      <p className="my-4 text-muted-foreground">
        Explicit points adjustments to the provider’s latest official standings snapshot.
        Finishing-order re-scoring is disabled: this tool does not model dropped-score rules,
        historical countback or steward decisions. Tied points share a provisional rank. Saved
        adjustments are rebased on the current provider snapshot.
      </p>
      {!baseline.length ? (
        <p>Official baseline unavailable. Simulation disabled.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <label>
              Competitor
              <select
                className={`${control} block max-w-full`}
                value={id}
                onChange={(e) => setId(e.target.value)}
              >
                <option value="">Choose</option>
                {baseline.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Round
              <select
                className={`${control} block`}
                value={round}
                onChange={(e) => setRound(Number(e.target.value))}
              >
                {rounds.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <label>
              Points adjustment
              <input
                className={`${control} block w-32`}
                type="number"
                step="0.5"
                min="-1000"
                max="1000"
                value={delta}
                onChange={(e) => setDelta(Number(e.target.value))}
              />
            </label>
            <label>
              Reason
              <input
                className={`${control} block`}
                maxLength={120}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <button
              disabled={!id || !Number.isFinite(delta) || Math.abs(delta) > 1000 || !rounds.length}
              className={control}
              onClick={() => setChanges([...changes.slice(-99), { id, round, delta, note }])}
            >
              Apply adjustment
            </button>
          </div>
          <div className="flex flex-wrap gap-3 my-5">
            <button
              disabled={!changes.length}
              className={control}
              onClick={() => setChanges(changes.slice(0, -1))}
            >
              Undo
            </button>
            <button className={control} onClick={() => setChanges([])}>
              Restore baseline
            </button>
            <label>
              Scenario name
              <input
                className={`${control} ml-2`}
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <button
              className={control}
              disabled={!name.trim()}
              onClick={() => {
                const next = [
                  ...saved.filter((s) => s.name !== name.trim()),
                  { name: name.trim(), changes },
                ].slice(-10);
                if (writeLocal(key, next)) {
                  setSaved(next);
                  setMessage("Scenario saved locally.");
                } else setMessage("Storage unavailable. Scenario remains in this visit.");
              }}
            >
              Save
            </button>
          </div>
          <ol className="text-sm my-4 list-decimal pl-5">
            {changes.map((c, i) => (
              <li key={i}>
                {baseline.find((b) => b.id === c.id)?.name ?? "Unknown competitor"} · Round{" "}
                {c.round} · {c.delta >= 0 ? "+" : ""}
                {c.delta} points · {c.note || "Manual adjustment"}
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-3">
            <label>
              Compare saved scenario
              <select
                className={`${control} ml-2`}
                value={compare}
                onChange={(e) => setCompare(e.target.value)}
              >
                <option value="">None</option>
                {saved.map((s) => (
                  <option key={s.name}>{s.name}</option>
                ))}
              </select>
            </label>
            <button
              className={control}
              disabled={!comparison}
              onClick={() => comparison && setChanges(comparison.changes)}
            >
              Load scenario
            </button>
            <button
              className={control}
              disabled={!comparison}
              onClick={() => {
                const next = saved.filter((s) => s.name !== compare);
                if (writeLocal(key, next)) {
                  setSaved(next);
                  setCompare("");
                }
              }}
            >
              Delete saved
            </button>
          </div>
          <p role="status">{message}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm my-6">
              <thead>
                <tr>
                  {[
                    "Hypothetical rank",
                    "Competitor",
                    "Official baseline",
                    "Change",
                    "Hypothetical points",
                    "Position change",
                    "Comparison points",
                  ].map((h) => (
                    <th key={h} className="p-3 text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="p-3">
                      {r.rank}
                      {r.tied ? " (tie)" : ""}
                    </td>
                    <th className="text-left">{r.name}</th>
                    <td>{r.baseline}</td>
                    <td>{r.delta}</td>
                    <td>{r.points}</td>
                    <td>{r.positionChange ?? "Unavailable"}</td>
                    <td>{compareRows.find((c) => c.id === r.id)?.points ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
function Museum({ year, carId }: { year: number; carId?: string }) {
  const [era, setEra] = useState("");
  const [team, setTeam] = useState("");
  const [seasonOnly, setSeasonOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [compare, setCompare] = useState<string[]>([]);
  const list = cars.filter(
    (c) =>
      (!era || c.era === era) &&
      (!team || c.constructor === team) &&
      (!seasonOnly || c.year === year) &&
      `${c.name} ${c.drivers.join(" ")}`.toLowerCase().includes(search.toLowerCase()),
  );
  const detail = cars.find((c) => c.id === carId);
  return (
    <>
      <h2 className="font-display text-3xl">History garage</h2>
      <p className="my-4 text-muted-foreground">
        A sourced starter catalogue. Era groupings are editorial. High-quality models have not been
        supplied; no authentic geometry or licensed imagery is implied.
      </p>
      <div className="flex flex-wrap gap-3">
        <label>
          Search car or driver
          <input
            className={`${control} block`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label>
          Era
          <select
            className={`${control} block`}
            value={era}
            onChange={(e) => setEra(e.target.value)}
          >
            <option value="">All eras</option>
            {[...new Set(cars.map((c) => c.era))].map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
        </label>
        <label>
          Constructor
          <select
            className={`${control} block`}
            value={team}
            onChange={(e) => setTeam(e.target.value)}
          >
            <option value="">All constructors</option>
            {[...new Set(cars.map((c) => c.constructor))].map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
        </label>
        <label className="self-end py-3">
          <input
            type="checkbox"
            checked={seasonOnly}
            onChange={(e) => setSeasonOnly(e.target.checked)}
          />{" "}
          Only {year}
        </label>
      </div>
      <div className="grid md:grid-cols-3 gap-4 my-6">
        {list.map((c) => (
          <article key={c.id} className="glass rounded-2xl p-6">
            <p className="text-sm text-muted-foreground">
              {c.era} · {c.year}
            </p>
            <Link
              to="/companion"
              search={{ view: "museum", year: c.year, car: c.id }}
              className="font-display text-4xl block my-4 underline"
            >
              {c.name}
            </Link>
            <p>{c.constructor}</p>
            <label className="block mt-3 py-2">
              <input
                type="checkbox"
                checked={compare.includes(c.id)}
                onChange={() =>
                  setCompare(
                    compare.includes(c.id)
                      ? compare.filter((id) => id !== c.id)
                      : [...compare.slice(-1), c.id],
                  )
                }
              />{" "}
              Compare
            </label>
          </article>
        ))}
      </div>
      {!list.length && (
        <p>
          No catalogued car matches this selection. Broaden the filters; specifications are not
          inferred from season standings.
        </p>
      )}
      {detail && (
        <section className="my-8">
          <h3 className="font-display text-4xl mb-5">
            {detail.year} · {detail.name}
          </h3>
          <Suspense fallback={<p>Loading viewer framework…</p>}>
            <CarViewer key={detail.id} car={detail} />
          </Suspense>
          <p className="my-5">{detail.notes}</p>
          <p>
            {detail.drivers.join(" · ") || "Driver associations unavailable"} ·{" "}
            {detail.engine ?? "Engine specification unavailable"}
          </p>
          <a
            href={detail.source}
            target="_blank"
            rel="noreferrer"
            className="inline-block underline py-3"
          >
            Primary source · constructor heritage
          </a>
          <Link to="/standings" search={{ year: detail.year }} className="underline ml-5">
            Season records
          </Link>
        </section>
      )}
      {compare.length > 0 && (
        <div className="overflow-x-auto my-6">
          <table className="w-full text-left text-sm">
            <caption className="text-left font-display text-2xl my-4">Car comparison</caption>
            <thead>
              <tr>
                <th className="p-3">Verified field</th>
                {compare.map((id) => (
                  <th key={id}>{cars.find((c) => c.id === id)?.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(["year", "constructor", "era", "engine", "wins", "notes"] as const).map((field) => (
                <tr key={field} className="border-t border-border">
                  <th className="p-3">{field}</th>
                  {compare.map((id) => (
                    <td className="p-3" key={id}>
                      {cars.find((c) => c.id === id)?.[field] ?? "Unavailable"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-muted-foreground">
            Wins are for the catalogued season. No dimensions or performance estimates are compared.
            Each detail page links its source.
          </p>
        </div>
      )}
    </>
  );
}

function Discovery({ year }: { year: number }) {
  const query = useSeason(year);
  const data = query.isError ? undefined : query.data;
  const [search, setSearch] = useState("");
  const [round, setRound] = useState<number | null>(null);
  const match = (text: string) => text.toLowerCase().includes(search.toLowerCase());
  return (
    <>
      <h2 className="font-display text-3xl my-5">Discover the {year} season</h2>
      <label>
        Search drivers, constructors, circuits and events
        <input
          className={`${control} w-full my-4`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <DataNotice
        pending={query.isPending}
        error={query.isError}
        refreshing={query.isFetching}
        data={data}
        retry={() => void query.refetch()}
      />
      <div className="grid md:grid-cols-3 gap-5">
        <section>
          <h3 className="font-display text-2xl">Drivers</h3>
          {Object.values(data?.drivers ?? {})
            .filter((d) => match(`${d.givenName} ${d.familyName}`))
            .map((d) => (
              <Link
                className="block underline py-3"
                key={d.driverId}
                to="/drivers/$driverId"
                params={{ driverId: d.driverId }}
                search={{ year }}
              >
                {d.givenName} {d.familyName}
              </Link>
            ))}
        </section>
        <section>
          <h3 className="font-display text-2xl">Constructors</h3>
          {Object.values(data?.constructors ?? {})
            .filter((c) => match(c.name))
            .map((c) => (
              <Link
                className="block underline py-3"
                key={c.constructorId}
                to="/teams/$constructorId"
                params={{ constructorId: c.constructorId }}
                search={{ year }}
              >
                {c.name}
              </Link>
            ))}
        </section>
        <section>
          <h3 className="font-display text-2xl">Circuits & events</h3>
          {data?.schedule
            .filter((r) =>
              match(`${r.raceName} ${r.Circuit.circuitName} ${r.Circuit.Location.country}`),
            )
            .map((r) => (
              <button
                className="block text-left underline py-3"
                key={r.round}
                onClick={() => setRound(r.round)}
              >
                {r.round} ·{" "}
                {r.has_conflict
                  ? "Venue unconfirmed — provider disagreement"
                  : r.Circuit.circuitName}{" "}
                · {r.raceName}
              </button>
            ))}
        </section>
      </div>
      {round !== null && (
        <section className="my-8">
          <h3 className="font-display text-2xl">Round {round} · verified classifications</h3>
          <p className="my-3 text-sm text-muted-foreground">
            Circuit length, lap records and geometry are not inferred from the race classification.
            Recorded circuit telemetry is available in Race Center where supported.
          </p>
          <Link className="underline inline-block py-3" to="/standings" search={{ year, round }}>
            Official standings and race records
          </Link>
          <ResultTable
            year={year}
            rows={data?.results.filter((r) => r.round === round && r.session === "Race") ?? []}
          />
        </section>
      )}
    </>
  );
}
