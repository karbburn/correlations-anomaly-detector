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
    <div className="flex items-center gap-6">
      {/* Window toggle */}
      <div className="flex items-center gap-1 bg-slate-800/60 rounded-lg p-1 border border-slate-700/50">
        {WINDOWS.map((w) => (
          <button
            key={w}
            onClick={() => setWindow(w)}
            className={clsx(
              "px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200",
              w === window
                ? "bg-cyan-500/20 text-cyan-300 shadow-sm shadow-cyan-500/10 border border-cyan-500/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 border border-transparent"
            )}
          >
            {w}D
          </button>
        ))}
      </div>

      {/* Threshold slider */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-500 uppercase tracking-wider">Z-Threshold</span>
        <input
          type="range"
          min={1.0}
          max={3.5}
          step={0.1}
          value={threshold}
          onChange={(e) => setThreshold(parseFloat(e.target.value))}
          className="w-24 h-1 bg-slate-700 rounded-full appearance-none cursor-pointer
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5
                     [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full
                     [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:shadow-lg
                     [&::-webkit-slider-thumb]:shadow-cyan-400/30 [&::-webkit-slider-thumb]:cursor-pointer"
        />
        <span className="text-sm text-cyan-300 tabular-nums font-mono w-8">
          ±{threshold.toFixed(1)}σ
        </span>
      </div>
    </div>
  );
}
