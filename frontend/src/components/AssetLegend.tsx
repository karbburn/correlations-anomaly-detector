"use client";

const ASSETS = [
  { key: "NIFTY50", label: "Nifty 50", color: "#60a5fa" },
  { key: "USDINR", label: "USD/INR", color: "#f472b6" },
  { key: "GOLD", label: "Gold (GOLDBEES)", color: "#fbbf24" },
  { key: "CRUDE", label: "Brent Crude", color: "#34d399" },
  { key: "GSEC10Y", label: "10Y G-Sec Yield", color: "#a78bfa" },
  { key: "FII_FLOW", label: "FII Net Flow", color: "#fb923c" },
];

export function AssetLegend() {
  return (
    <div className="flex flex-wrap items-center gap-2 font-mono">
      <span className="text-[9px] text-dim uppercase tracking-wider mr-1">Assets:</span>
      {ASSETS.map((a) => (
        <div
          key={a.key}
          className="flex items-center gap-2 px-2.5 py-1 bg-card border border-border-muted rounded-none"
        >
          <span
            className="w-2 h-2 shrink-0 rounded-none"
            style={{ backgroundColor: a.color }}
          />
          <span className="text-[10px] text-secondary font-bold uppercase">{a.label}</span>
        </div>
      ))}
    </div>
  );
}
