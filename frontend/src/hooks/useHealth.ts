"use client";
import { useQuery } from "@tanstack/react-query";
import { fetchHealth } from "@/lib/api";

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    staleTime: 30 * 1000,
    refetchInterval: (query) =>
      query.state.data?.startup_complete ? 60 * 1000 : 3 * 1000,
    refetchOnWindowFocus: false,
    retry: 20,
    retryDelay: 3 * 1000,
  });
}
