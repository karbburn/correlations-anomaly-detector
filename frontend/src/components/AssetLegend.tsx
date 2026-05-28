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
    <div className="flex flex-wrap gap-2 font-mono">
      {ASSETS.map((a) => (
        <div
          key={a.key}
          className="flex items-center gap-2 px-2.5 py-1 bg-[#0a0a0b] border border-border-muted rounded-none"
        >
          <span
            className="w-2 h-2 shrink-0 rounded-none"
            style={{ backgroundColor: a.color }}
          />
          <span className="text-[10px] text-slate-300 font-bold uppercase">{a.label}</span>
          <span className="text-[9px] text-slate-600 hidden sm:inline uppercase">
            // {a.desc}
          </span>
        </div>
      ))}
    </div>
  );
}
