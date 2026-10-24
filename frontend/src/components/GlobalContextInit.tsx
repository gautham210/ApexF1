import { useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getScheduleForYear } from "@/lib/api/history";
import { f1Api } from "@/lib/api/client";
import { useSettingsStore, useCanonicalStore, type LeaderboardEntry } from "@/lib/store";

export function GlobalContextInit() {
  const home = useRouterState({ select: (s) => s.location.pathname === "/" });
  const { selectedYear, bootstrapFromBackend, setScheduleCache } = useSettingsStore();
  const schedule = useQuery({
    queryKey: ["schedule", selectedYear],
    queryFn: ({ signal }) => getScheduleForYear(selectedYear, signal),
    staleTime: 60000,
    refetchInterval: home ? 60000 : false,
  });
  const context = useQuery({
    enabled: home,
    queryKey: ["dashboard", selectedYear],
    queryFn: ({ signal }) => f1Api.getDashboardContext(selectedYear, signal),
    staleTime: 60000,
    refetchInterval: home ? 60000 : false,
  });
  const results = useQuery({
    enabled: home,
    queryKey: ["results", selectedYear],
    queryFn: ({ signal }) => f1Api.getSeasonResults(selectedYear, signal),
    staleTime: 300000,
  });
  useEffect(() => {
    const events = schedule.data?.data;
    if (Array.isArray(events)) setScheduleCache(events, selectedYear);
  }, [schedule.data, selectedYear, setScheduleCache]);
  useEffect(() => {
    const sc = context.data?.data?.season_context;
    if (sc?.current_round) bootstrapFromBackend(sc, selectedYear);
  }, [context.data, selectedYear, bootstrapFromBackend]);
  useEffect(() => {
    const payload = results.data?.data;
    if (payload?.year !== selectedYear) return;
    for (const [round, entries] of Object.entries(payload.results ?? {})) {
      useCanonicalStore
        .getState()
        .setSessionResults(`${selectedYear}-${round}-Race`, entries as LeaderboardEntry[]);
    }
  }, [results.data, selectedYear]);
  return null;
}
