import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getNewsFeed } from "@/lib/api/news";
import { PageHeader } from "@/components/PageHeader";
import { ExternalLink, Search } from "lucide-react";

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
    <div className="apex-page pb-24 space-y-6">
      <PageHeader
        eyebrow="From the Paddock"
        title="F1 News"
        subtitle="Reporting from established publishers. Headlines link directly to original articles."
      />
      <div className="flex flex-wrap items-center gap-3">
        <select
          aria-label="Publisher"
          className="apex-control font-mono"
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

        <select
          aria-label="Topic"
          className="apex-control font-mono max-w-full sm:max-w-56"
          value={search.topic ?? ""}
          onChange={(e) =>
            void navigate({ search: { ...search, topic: e.target.value || undefined } })
          }
        >
          <option value="">All topics</option>
          {topics.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>

        <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            aria-label="Search stories"
            value={search.q ?? ""}
            onChange={(e) =>
              void navigate({
                search: { ...search, q: e.target.value || undefined },
                replace: true,
              })
            }
            placeholder="Search driver, team or GP…"
            className="apex-control pl-9 pr-4 w-full font-mono text-xs"
          />
        </div>
      </div>

      {query.isPending && (
        <p role="status" className="apex-card p-6 text-sm text-muted-foreground animate-pulse">
          Loading publisher feeds…
        </p>
      )}
      {query.isError && (
        <p role="alert" className="apex-card p-6 text-sm text-amber-300">
          News is unavailable.{" "}
          <button
            className="underline ml-2 font-medium text-foreground"
            onClick={() => void query.refetch()}
          >
            Retry
          </button>
        </p>
      )}
      {query.data && (
        <p className="text-xs font-mono text-muted-foreground">
          {query.data.status === "stale"
            ? "Cached stories: refresh failed. "
            : query.data.status === "partial"
              ? `Some feeds unavailable: ${Object.keys(query.data.errors).join(", ")}. `
              : ""}
          Retrieved {new Date(query.data.ingested_at).toLocaleString()} · {visible.length} stories
        </p>
      )}

      <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
        {visible.map((a) => (
          <article
            key={a.link}
            className="apex-card p-6 flex flex-col justify-between gap-4 hover:border-white/20 transition-colors"
          >
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-muted-foreground">
                <span className="text-primary font-semibold truncate">{a.source}</span>
                <span className="shrink-0">
                  {a.published ? (
                    <time dateTime={a.published}>{new Date(a.published).toLocaleDateString()}</time>
                  ) : (
                    "Date n/a"
                  )}
                  {a.published && Date.now() - Date.parse(a.published) > 7 * 86400000
                    ? " · Older"
                    : ""}
                </span>
              </div>
              <h2 className="font-display text-2xl leading-snug line-clamp-3">
                <a
                  href={a.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors"
                >
                  {a.title}
                </a>
              </h2>
              {a.summary && (
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                  {a.summary}
                </p>
              )}
            </div>
            <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5 min-w-0">
                {a.topics.slice(0, 2).map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-white/[0.05] border border-white/[0.08] px-2 py-0.5 text-[10px] font-mono text-muted-foreground truncate"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <a
                href={a.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-foreground hover:text-primary shrink-0 transition-colors"
              >
                Read at {a.source} <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </article>
        ))}
      </div>
      {query.data && !visible.length && (
        <p className="apex-card p-8 text-center text-muted-foreground">
          No stories match these filters.
        </p>
      )}
    </div>
  );
}
