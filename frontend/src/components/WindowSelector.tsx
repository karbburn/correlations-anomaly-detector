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
      <div className="flex items-center border border-border-muted bg-[#0a0a0b] p-0.5">
        {WINDOWS.map((w) => (
          <button
            key={w}
            onClick={() => setWindow(w)}
            className={clsx(
              "px-3 py-1 text-[10px] font-semibold transition-all duration-150 uppercase cursor-pointer rounded-none",
              w === window
                ? "bg-accent-blue text-black border-transparent"
                : "text-slate-400 hover:text-white border-transparent hover:bg-[#1a1b23]"
            )}
          >
            {w}D
          </button>
        ))}
      </div>

      {/* Threshold slider */}
      <div className="flex items-center gap-3 bg-[#0a0a0b] border border-border-muted px-3 py-1">
        <span className="text-[9px] text-slate-500 uppercase tracking-wider">Z_THRESHOLD</span>
        <input
          type="range"
          min={1.0}
          max={3.5}
          step={0.1}
          value={threshold}
          onChange={(e) => setThreshold(parseFloat(e.target.value))}
          className="w-20 h-1 bg-[#1a1b23] border border-border-muted appearance-none cursor-pointer
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5
                     [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-accent-blue
                     [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-none
                     [&::-webkit-slider-thumb]:rounded-none"
        />
        <span className="text-[10px] text-accent-blue font-bold tabular-nums w-8">
          ±{threshold.toFixed(1)}σ
        </span>
      </div>
    </div>
  );
}
