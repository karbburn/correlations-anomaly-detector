"use client";
import { useQuery } from "@tanstack/react-query";
import { fetchPairTimeseries } from "@/lib/api";
import { useAppStore } from "@/lib/store";

export function usePairData(asset1: string, asset2: string) {
  const window = useAppStore((s) => s.window);

  return useQuery({
    queryKey: ["pairTimeseries", asset1, asset2, window],
    queryFn: () => fetchPairTimeseries(asset1, asset2, window),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: !!asset1 && !!asset2,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && data.dates && data.dates.length > 0) return false;
      return 5000;
    },
  });
}
