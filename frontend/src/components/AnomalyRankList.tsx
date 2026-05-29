"use client";

import clsx from "clsx";
import { ASSETS } from "@/lib/types";

interface AnomalyRankListProps {
  matrix: number[][];
  zscoreMatrix: number[][];
  threshold: number;
  onPairSelect: (a1: string, a2: string) => void;
}

interface PairEntry {
  asset1: string;
  asset2: string;
  correlation: number;
  zscore: number;
  isAnomaly: boolean;
}

export function AnomalyRankList({
  matrix,
  zscoreMatrix,
  threshold,
  onPairSelect,
}: AnomalyRankListProps) {
  const assets = ASSETS;

  const pairs: PairEntry[] = [];
  for (let i = 0; i < assets.length; i++) {
    for (let j = i + 1; j < assets.length; j++) {
      const corr = matrix[i]?.[j] ?? 0;
      const zscore = zscoreMatrix[i]?.[j] ?? 0;
      pairs.push({
        asset1: assets[i],
        asset2: assets[j],
        correlation: corr,
        zscore,
        isAnomaly: Math.abs(zscore) > threshold,
      });
    }
  }

  pairs.sort((a, b) => Math.abs(b.zscore) - Math.abs(a.zscore));

  return (
    <div className="space-y-2">
      {pairs.map((pair) => (
        <button
          key={`${pair.asset1}__${pair.asset2}`}
          onClick={() => onPairSelect(pair.asset1, pair.asset2)}
          className={clsx(
            "w-full text-left font-mono border rounded-none px-3 py-2.5 transition-all cursor-pointer",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background",
            pair.isAnomaly
              ? "border-accent-amber/60 bg-accent-amber/5 hover:bg-accent-amber/10"
              : "border-border-muted bg-card hover:bg-elevated"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">
              {pair.asset1} <span className="text-dim">↔</span> {pair.asset2}
            </span>
            <span
              className={clsx(
                "text-xs font-bold tabular-nums",
                pair.isAnomaly
                  ? "text-accent-amber"
                  : Math.abs(pair.zscore) > 1.5
                    ? "text-secondary"
                    : "text-dim"
              )}
            >
              {pair.zscore > 0 ? "▲" : "▼"}
              {Math.abs(pair.zscore).toFixed(1)}σ
            </span>
          </div>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-[10px] text-secondary tabular-nums">
              Corr: {pair.correlation >= 0 ? "+" : ""}{pair.correlation.toFixed(3)}
            </span>
            {pair.isAnomaly && (
              <span
                className="text-[9px] font-bold uppercase tracking-wider text-accent-amber"
                aria-label={pair.zscore < 0 ? "Breakdown anomaly" : "Surge anomaly"}
              >
                {pair.zscore < 0 ? "BRK" : "SRG"}
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
