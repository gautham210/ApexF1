import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { f1Api } from "@/lib/api/client";
import { useSettingsStore, useCanonicalStore, type LeaderboardEntry } from "@/lib/store";

export function GlobalContextInit() {
  const { selectedYear, bootstrapFromBackend, setScheduleCache } = useSettingsStore();
  const schedule = useQuery({
    queryKey: ["schedule", selectedYear],
    queryFn: ({ signal }) => f1Api.getSchedule(selectedYear, signal),
    staleTime: 60000,
    refetchInterval: 60000,
  });
  const context = useQuery({
    queryKey: ["dashboard", selectedYear],
    queryFn: ({ signal }) => f1Api.getDashboardContext(selectedYear, signal),
    staleTime: 60000,
    refetchInterval: 60000,
  });
  const results = useQuery({
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
