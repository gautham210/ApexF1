import { useEffect } from "react";
import { f1Api } from "@/lib/api/client";
import { useSettingsStore } from "@/lib/store";

export function GlobalContextInit() {
  const { selectedYear, bootstrapFromBackend, setScheduleCache } = useSettingsStore();

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const [ctxRes, schedRes] = await Promise.allSettled([
          f1Api.getDashboardContext(selectedYear),
          f1Api.getSchedule(selectedYear),
        ]);

        if (cancelled) return;

        if (ctxRes.status === "fulfilled") {
          const data = (ctxRes.value as any)?.data ?? ctxRes.value;
          const sc = data?.season_context;
          if (sc?.current_round) {
            bootstrapFromBackend(sc, selectedYear);
          }
        }

        if (schedRes.status === "fulfilled") {
          const data = (schedRes.value as any)?.data ?? schedRes.value;
          const events = Array.isArray(data) ? data : [];
          setScheduleCache(events, selectedYear);
        }
      } catch {
        // Fallback silently — premium UX degrades gracefully
      }
    }

    boot();

    return () => {
      cancelled = true;
    };
  }, [selectedYear, bootstrapFromBackend, setScheduleCache]);

  return null;
}
