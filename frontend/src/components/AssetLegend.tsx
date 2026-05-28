"use client";

const ASSETS = [
  { key: "NIFTY50", label: "Nifty 50", color: "#60a5fa", desc: "Indian equity index" },
  { key: "USDINR", label: "USD/INR", color: "#f472b6", desc: "Currency pair" },
  { key: "GOLD", label: "Gold (GOLDBEES)", color: "#fbbf24", desc: "Gold ETF proxy" },
  { key: "CRUDE", label: "Brent Crude", color: "#34d399", desc: "Commodity futures" },
  { key: "GSEC10Y", label: "10Y G-Sec Yield", color: "#a78bfa", desc: "Government bond rate" },
  { key: "FII_FLOW", label: "FII Net Flow", color: "#fb923c", desc: "Foreign institutional flow" },
];

export function AssetLegend() {
  return (
    <div className="flex flex-wrap gap-3">
      {ASSETS.map((a) => (
        <div
          key={a.key}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/40 rounded-lg border border-slate-700/30"
        >
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: a.color }}
          />
          <span className="text-xs text-slate-300 font-medium">{a.label}</span>
          <span className="text-[10px] text-slate-600 hidden sm:inline">
            {a.desc}
          </span>
        </div>
      ))}
    </div>
  );
}
