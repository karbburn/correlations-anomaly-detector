"use client";

import { ASSETS, ASSET_LABELS } from "@/lib/types";

export function AssetLegend() {
  return (
    <div className="flex flex-wrap items-center gap-2 font-mono">
      <span className="text-[9px] text-dim uppercase tracking-wider mr-1">Assets:</span>
      {ASSETS.map((asset) => (
        <div
          key={asset}
          className="flex items-center px-2.5 py-1 bg-card border border-border-muted rounded-none"
        >
          <span className="text-[10px] text-secondary font-bold uppercase">
            {ASSET_LABELS[asset]}
          </span>
        </div>
      ))}
    </div>
  );
}
