"use client";
import { useQuery } from "@tanstack/react-query";
import { fetchCorrelationMatrix } from "@/lib/api";
import { useAppStore } from "@/lib/store";

export function useCorrelationMatrix(date?: string) {
  const window = useAppStore((s) => s.window);

  return useQuery({
    queryKey: ["correlationMatrix", window, date],
    queryFn: () => fetchCorrelationMatrix(window, date),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && data.matrix && data.matrix.length > 0) return false;
      return 5000;
    },
  });
}
