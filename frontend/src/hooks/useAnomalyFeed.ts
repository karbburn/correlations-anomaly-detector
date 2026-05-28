"use client";
import { useQuery } from "@tanstack/react-query";
import { fetchAnomalyAlerts } from "@/lib/api";
import { useAppStore } from "@/lib/store";

export function useAnomalyFeed({
  offset = 0,
  limit = 25,
}: {
  offset?: number;
  limit?: number;
} = {}) {
  const window = useAppStore((s) => s.window);
  const threshold = useAppStore((s) => s.threshold);

  return useQuery({
    queryKey: ["anomalyAlerts", window, threshold, offset, limit],
    queryFn: () => fetchAnomalyAlerts(window, threshold, offset, limit),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
