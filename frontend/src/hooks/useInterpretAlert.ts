"use client";
import { useQuery } from "@tanstack/react-query";
import { fetchAnomalyAlerts } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import type { AnomalyAlert } from "@/lib/types";

/**
 * Fetch the interpretation for a single anomaly alert.
 *
 * Used by AnomalyFeed to lazy-load interpretations only when the user
 * expands a row, instead of computing interpretations for all 25 rows
 * up-front (the rule engine runs a 252-day rolling z-score per pair).
 */
export function useInterpretAlert(
  alert: AnomalyAlert | null,
  offset: number,
  enabled: boolean,
) {
  const window = useAppStore((s) => s.window);
  const threshold = useAppStore((s) => s.threshold);

  return useQuery({
    queryKey: [
      "interpretAlert",
      alert?.date,
      alert?.asset1,
      alert?.asset2,
      window,
      threshold,
      offset,
    ],
    queryFn: async () => {
      const nearbyOffset = Math.max(0, offset - 2);
      const resp = await fetchAnomalyAlerts(window, threshold, nearbyOffset, 5, undefined, true);
      const match = resp.alerts.find(
        (a) => a.date === alert!.date && a.asset1 === alert!.asset1 && a.asset2 === alert!.asset2,
      );
      return match?.interpretation ?? null;
    },
    enabled: enabled && alert !== null,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
