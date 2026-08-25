"use client";
import { useQuery } from "@tanstack/react-query";
import { fetchHealth } from "@/lib/api";

/**
 * Periodic health poll used to surface degraded data sources
 * (stale cache or synthetic fallback) while the dashboard is open.
 */
export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
