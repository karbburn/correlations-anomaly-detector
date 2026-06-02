"use client";
import { useQuery } from "@tanstack/react-query";
import { fetchAnomalyAlerts } from "@/lib/api";
import { useAppStore } from "@/lib/store";

export function useAnomalyFeed({
  offset = 0,
  limit = 25,
  interpret = false,
}: {
  offset?: number;
  limit?: number;
  interpret?: boolean;
} = {}) {
  const window = useAppStore((s) => s.window);
  const threshold = useAppStore((s) => s.threshold);

  return useQuery({
    queryKey: ["anomalyAlerts", window, threshold, offset, limit, interpret],
    queryFn: () => fetchAnomalyAlerts(window, threshold, offset, limit, undefined, interpret),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && data.alerts && data.alerts.length > 0) return false;
      return 5000;
    },
  });
}
