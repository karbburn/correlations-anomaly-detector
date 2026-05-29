"use client";
import { useAppStore } from "@/lib/store";
import clsx from "clsx";

const WINDOWS = [30, 60, 252] as const;

export function WindowSelector() {
  const window = useAppStore((s) => s.window);
  const threshold = useAppStore((s) => s.threshold);
  const setWindow = useAppStore((s) => s.setWindow);
  const setThreshold = useAppStore((s) => s.setThreshold);

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 font-mono text-xs">
      {/* Window toggle */}
      <div className="flex items-center border border-border-muted bg-card p-0.5" role="radiogroup" aria-label="Rolling window selector">
        {WINDOWS.map((w) => (
          <button
            key={w}
            onClick={() => setWindow(w)}
            role="radio"
            aria-checked={w === window}
            aria-label={`${w} day rolling window`}
            className={clsx(
              "px-3 py-1 text-[10px] font-semibold transition-all duration-150 uppercase cursor-pointer rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background",
              w === window
                ? "bg-accent-primary text-black border-transparent"
                : "text-muted hover:text-foreground border-transparent hover:bg-elevated"
            )}
          >
            {w}D
          </button>
        ))}
      </div>

      {/* Threshold slider */}
      <div className="flex items-center gap-3 bg-card border border-border-muted px-3 py-1">
        <label htmlFor="z-threshold" className="text-[9px] text-dim uppercase tracking-wider">
          Z_THRESHOLD
        </label>
        <input
          id="z-threshold"
          type="range"
          min={1.0}
          max={3.5}
          step={0.1}
          value={threshold}
          onChange={(e) => setThreshold(parseFloat(e.target.value))}
          aria-valuemin={1.0}
          aria-valuemax={3.5}
          aria-valuenow={threshold}
          aria-label={`Z-score threshold: ${threshold.toFixed(1)} sigma`}
          className="w-20 h-1 bg-surface border border-border-muted appearance-none cursor-pointer
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5
                     [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-accent-primary
                     [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-none
                     [&::-webkit-slider-thumb]:rounded-none
                     [&::-moz-range-thumb]:w-2.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:bg-accent-primary
                     [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-none
                     [&::-moz-range-thumb]:rounded-none"
        />
        <span className="text-[10px] text-accent-primary font-bold tabular-nums w-8" aria-hidden="true">
          ±{threshold.toFixed(1)}σ
        </span>
      </div>
    </div>
  );
}
