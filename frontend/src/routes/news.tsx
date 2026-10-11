import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getNewsFeed } from "@/lib/api/news";
export const Route = createFileRoute("/news")({
  validateSearch: (s: Record<string, unknown>) => ({
    source: typeof s.source === "string" ? s.source : undefined,
    topic: typeof s.topic === "string" ? s.topic : undefined,
    q: typeof s.q === "string" ? s.q : undefined,
  }),
  component: NewsPage,
});
function NewsPage() {
  const search = Route.useSearch(),
    navigate = Route.useNavigate();
  const query = useQuery({
    queryKey: ["news-feed"],
    queryFn: getNewsFeed,
    staleTime: 600000,
    retry: 1,
  });
  const articles = query.data?.articles ?? [],
    sources = [...new Set(articles.map((a) => a.source))],
    topics = [...new Set(articles.flatMap((a) => a.topics))].sort();
  const visible = articles.filter(
    (a) =>
      (!search.source || a.source === search.source) &&
      (!search.topic || a.topics.includes(search.topic)) &&
      (!search.q || `${a.title} ${a.summary}`.toLowerCase().includes(search.q.toLowerCase())),
  );
  return (
    <main className="max-w-[1300px] mx-auto px-5 lg:px-12 pt-12 pb-32">
      <header className="border-b border-border/40 pb-8">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">From the paddock</p>
        <h1 className="font-display text-6xl mt-4">F1 news</h1>
        <p className="text-muted-foreground mt-4">
          Reporting from established publishers. Read each story at its original source.
        </p>
      </header>
      <div className="flex flex-wrap gap-4 my-8">
        <label className="text-sm">
          Publisher
          <select
            className="ml-2 p-3 rounded-lg border border-border bg-background"
            value={search.source ?? ""}
            onChange={(e) =>
              void navigate({ search: { ...search, source: e.target.value || undefined } })
            }
          >
            <option value="">All publishers</option>
            {sources.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Topic
          <select
            className="ml-2 p-3 rounded-lg border border-border bg-background max-w-60"
            value={search.topic ?? ""}
            onChange={(e) =>
              void navigate({ search: { ...search, topic: e.target.value || undefined } })
            }
          >
            <option value="">All supplied topics</option>
            {topics.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Search
          <input
            value={search.q ?? ""}
            onChange={(e) =>
              void navigate({
                search: { ...search, q: e.target.value || undefined },
                replace: true,
              })
            }
            placeholder="Driver, team or race"
            className="ml-2 p-3 rounded-lg border border-border bg-background"
          />
        </label>
      </div>
      {query.isPending && (
        <p role="status" className="glass p-8 rounded-2xl animate-pulse">
          Loading publisher feeds…
        </p>
      )}
      {query.isError && (
        <p role="alert">
          News is unavailable.{" "}
          <button className="underline p-3" onClick={() => void query.refetch()}>
            Retry
          </button>
        </p>
      )}
      {query.data && (
        <p className="text-xs text-muted-foreground mb-6">
          {query.data.status === "stale"
            ? "Cached stories: refresh failed. "
            : query.data.status === "partial"
              ? `Some feeds unavailable: ${Object.keys(query.data.errors).join(", ")}. `
              : ""}
          Retrieved {new Date(query.data.ingested_at).toLocaleString()}. Article dates below are
          publication dates; search matches supplied text.
        </p>
      )}
      <div className="grid md:grid-cols-2 gap-5">
        {visible.map((a) => (
          <article key={a.link} className="glass rounded-2xl p-7 flex flex-col">
            <p className="text-xs text-muted-foreground mb-4">
              {a.source} ·{" "}
              {a.published ? (
                <time dateTime={a.published}>{new Date(a.published).toLocaleString()}</time>
              ) : (
                "Publication date unavailable"
              )}
              {a.published && Date.now() - Date.parse(a.published) > 7 * 86400000
                ? " · Older story"
                : ""}
            </p>
            <h2 className="font-display text-2xl">
              <a
                href={a.link}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {a.title}
              </a>
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mt-4">{a.summary}</p>
            <a
              href={a.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm mt-6 underline"
            >
              Read at {a.source} ↗
            </a>
          </article>
        ))}
      </div>
      {query.data && !visible.length && (
        <p className="p-8 text-muted-foreground">No stories match these filters.</p>
      )}
    </main>
  );
}
