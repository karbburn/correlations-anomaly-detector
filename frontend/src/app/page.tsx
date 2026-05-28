"use client";

import { useState, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { BackendStatus } from "@/components/BackendStatus";
import { WindowSelector } from "@/components/WindowSelector";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CorrelationMatrix } from "@/components/CorrelationMatrix";
import { PairDrilldown } from "@/components/PairDrilldown";
import { AnomalyFeed } from "@/components/AnomalyFeed";
import { RegimeTimeline } from "@/components/RegimeTimeline";
import { AssetLegend } from "@/components/AssetLegend";

import { useCorrelationMatrix } from "@/hooks/useCorrelationMatrix";
import { usePairData } from "@/hooks/usePairData";
import { useAppStore } from "@/lib/store";
import { fetchRegimeHistory } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

function Dashboard() {
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);

  const selectedPair = useAppStore((s) => s.selectedPair);
  const selectPair = useAppStore((s) => s.selectPair);
  const clearPair = useAppStore((s) => s.clearPair);
  const window = useAppStore((s) => s.window);
  const threshold = useAppStore((s) => s.threshold);

  const { data: matrixData, isLoading: matrixLoading } = useCorrelationMatrix();

  const { data: pairData, isLoading: pairLoading } = usePairData(
    selectedPair?.[0] ?? "",
    selectedPair?.[1] ?? ""
  );

  const { data: regimeData } = useQuery({
    queryKey: ["regimeHistory", window, threshold],
    queryFn: () => fetchRegimeHistory(window, threshold),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: ready,
  });

  return (
    <>
      <BackendStatus onReady={onReady} />

      {ready && (
        <div className="min-h-screen bg-background text-foreground">
          {/* Header */}
          <header className="border-b border-border-muted bg-background sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-white">
                    Cross-Asset Correlations
                    <span className="ml-2 text-sm font-normal text-accent-primary">
                      Anomaly Detector
                    </span>
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {matrixData
                      ? `As of ${matrixData.as_of_date} · ${matrixData.window}D rolling window`
                      : "Loading..."}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <WindowSelector />
                  <ThemeToggle />
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            {/* Asset Legend */}
            <AssetLegend />

            {/* Top Grid: Heatmap + Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Correlation Heatmap */}
              <div className="bg-background border border-border-muted p-5 rounded-none">
                <h2 className="text-xs font-semibold text-slate-400 mb-4 uppercase tracking-wider font-mono">
                  [CORRELATION_MATRIX]
                </h2>
                {matrixLoading ? (
                  <div className="h-96 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-border-muted border-t-accent-primary rounded-none animate-spin" />
                  </div>
                ) : matrixData ? (
                  <CorrelationMatrix
                    matrix={matrixData.matrix}
                    zscoreMatrix={matrixData.zscore_matrix}
                    anomalyFlags={matrixData.anomaly_flags}
                    threshold={threshold}
                    onPairSelect={(a1, a2) => selectPair(a1, a2)}
                  />
                ) : (
                  <p className="text-slate-600 text-xs font-mono">No matrix data available</p>
                )}
                <p className="text-[9px] text-slate-600 mt-4 text-center font-mono">
                  &gt;&gt; SELECT CELL TO PLOT HISTORICAL DRILLDOWN &lt;&lt;
                </p>
              </div>

              {/* Anomaly Feed */}
              <AnomalyFeed />
            </div>

            {/* Pair Drilldown (conditionally rendered) */}
            {selectedPair && (
              <div>
                {pairLoading ? (
                  <div className="h-48 flex items-center justify-center bg-background border border-border-muted rounded-none">
                    <div className="w-6 h-6 border-2 border-border-muted border-t-accent-primary rounded-none animate-spin" />
                  </div>
                ) : pairData ? (
                  <PairDrilldown
                    asset1={selectedPair[0]}
                    asset2={selectedPair[1]}
                    data={pairData}
                    threshold={threshold}
                    onClose={clearPair}
                  />
                ) : null}
              </div>
            )}

            {/* Regime Timeline */}
            {regimeData && (
              <div className="bg-background border border-border-muted p-5 rounded-none">
                <h2 className="text-xs font-semibold text-slate-400 mb-4 uppercase tracking-wider font-mono">
                  [REGIME_TIMELINE]
                </h2>
                <RegimeTimeline
                  pairs={regimeData.pairs}
                  dates={regimeData.dates}
                  regimes={regimeData.regimes}
                />
              </div>
            )}
          </main>

          {/* Footer */}
          <footer className="border-t border-border-muted mt-12 bg-background">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between font-mono text-[10px] text-slate-600">
              <p>
                Cross-Asset Correlations Anomaly Detector v2.0
              </p>
              <p className="text-accent-primary font-semibold tracking-wider">
                Sourabh
              </p>
              <p>
                Data: yfinance &middot; FBIL &middot; NSE
              </p>
            </div>
          </footer>
        </div>
      )}
    </>
  );
}

export default function Page() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  );
}
