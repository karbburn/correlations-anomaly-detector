"use client";
import { useQuery } from "@tanstack/react-query";
import { fetchCorrelationMatrix } from "@/lib/api";
import { useAppStore } from "@/lib/store";

export function useCorrelationMatrix(ready: boolean, date?: string) {
  const window = useAppStore((s) => s.window);

  return useQuery({
    queryKey: ["correlationMatrix", window, date],
    queryFn: () => fetchCorrelationMatrix(window, date),
    enabled: ready,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchInterval: (query) =>
      query.state.data !== undefined ? 5 * 60 * 1000 : 5000,
  });
}
