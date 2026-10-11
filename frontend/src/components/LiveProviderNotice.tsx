import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { api } from "@/lib/api/client";
export function LiveProviderNotice() {
  const query = useQuery({
    queryKey: ["live-provider-health"],
    queryFn: async () =>
      z
        .object({
          success: z.literal(true),
          data: z.object({ status: z.string(), configured: z.boolean(), transport: z.string() }),
        })
        .parse(await api.get<never, unknown>("/api/live/health")).data,
    staleTime: 30000,
    refetchInterval: 30000,
  });
  return (
    <p role="status" className="text-xs text-muted-foreground glass rounded-xl p-4">
      {query.isPending
        ? "Checking live provider…"
        : query.isError
          ? "Live provider status unavailable. Archive requests remain independent."
          : query.data?.status === "available"
            ? "Provider reachable. LIVE is shown only for a matched session with recent race-control evidence."
            : `Live timing unavailable (${query.data?.status.replaceAll("_", " ")}). Historical classifications and recorded telemetry remain available where supported.`}
    </p>
  );
}
