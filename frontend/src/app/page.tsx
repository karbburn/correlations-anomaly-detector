"use client";

import { useState, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { BackendStatus } from "@/components/BackendStatus";
import { WindowSelector } from "@/components/WindowSelector";
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

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
        <div className="min-h-screen">
          {/* Header */}
          <header className="border-b border-slate-800/50 bg-[#060a14]/80 backdrop-blur-md sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-white">
                    Cross-Asset Correlations
                    <span className="ml-2 text-sm font-normal text-cyan-400/80">
                      Anomaly Detector
                    </span>
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {matrixData
                      ? `As of ${matrixData.as_of_date} · ${matrixData.window}D rolling window`
                      : "Loading..."}
                  </p>
                </div>
                <WindowSelector />
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
            {/* Asset Legend */}
            <AssetLegend />

            {/* Top Grid: Heatmap + Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Correlation Heatmap */}
              <div className="bg-slate-900/60 border border-slate-800/50 rounded-xl p-5 backdrop-blur-sm">
                <h2 className="text-sm font-medium text-slate-400 mb-4 uppercase tracking-wider">
                  Correlation Matrix
                </h2>
                {matrixLoading ? (
                  <div className="h-96 flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
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
                  <p className="text-slate-600 text-sm">No data available</p>
                )}
                <p className="text-[10px] text-slate-600 mt-3 text-center">
                  Click any cell to drill down into the pair history
                </p>
              </div>

              {/* Anomaly Feed */}
              <AnomalyFeed />
            </div>

            {/* Pair Drilldown (conditionally rendered) */}
            {selectedPair && (
              <div>
                {pairLoading ? (
                  <div className="h-48 flex items-center justify-center bg-slate-900/60 rounded-xl border border-slate-800/50">
                    <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
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
              <div className="bg-slate-900/60 border border-slate-800/50 rounded-xl p-5 backdrop-blur-sm">
                <h2 className="text-sm font-medium text-slate-400 mb-4 uppercase tracking-wider">
                  Regime Timeline
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
          <footer className="border-t border-slate-800/30 mt-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
              <p className="text-xs text-slate-700">
                Cross-Asset Correlations Anomaly Detector v2.0
              </p>
              <p className="text-xs text-slate-700">
                Data: yfinance · FBIL · NSE
              </p>
            </div>
          </footer>
        </div>
      )}
    </>
  );
}

export default function Page() {
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  );
}
