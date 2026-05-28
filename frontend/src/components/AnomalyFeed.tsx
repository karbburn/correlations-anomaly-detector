"use client";
import { useState } from "react";
import { useAnomalyFeed } from "@/hooks/useAnomalyFeed";
import { useAppStore } from "@/lib/store";
import clsx from "clsx";

const PAGE_SIZE = 25;

export function AnomalyFeed() {
  const window = useAppStore((s) => s.window);
  const threshold = useAppStore((s) => s.threshold);
  const [offset, setOffset] = useState(0);
  const { data, isLoading } = useAnomalyFeed({ offset, limit: PAGE_SIZE });

  const exportCsv = () => {
    if (!data?.alerts.length) return;
    const escapeCsv = (val: string | number) => {
      const str = String(val);
      return str.includes(",") || str.includes('"') || str.includes("\n")
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    };
    const headers = ["date", "asset1", "asset2", "correlation", "zscore", "regime"];
    const rows = data.alerts.map((a) =>
      [a.date, a.asset1, a.asset2, a.correlation, a.zscore, a.regime]
        .map(escapeCsv)
        .join(",")
    );
    const blob = new Blob([headers.join(",") + "\n" + rows.join("\n")], {
      type: "text/csv",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `alerts_${window}d_z${threshold}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-background border border-border-muted p-5 rounded-none font-mono">
      <div className="flex items-center justify-between mb-4 border-b border-border-muted pb-3">
        <div>
          <h3 className="text-sm font-bold text-white tracking-wider uppercase">
            [ANOMALY_ALERTS]
          </h3>
          <p className="text-[10px] text-slate-500 mt-0.5">
            LOGS: {data?.total_count ?? 0} ALERTS · {window}D_WINDOW · |z| &gt; {threshold}σ
          </p>
        </div>
        <button
          onClick={exportCsv}
          disabled={!data?.alerts.length}
          className="px-2 py-1 text-[10px] font-semibold text-accent-primary hover:bg-accent-teal hover:text-white border border-accent-primary transition-all disabled:border-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed cursor-pointer uppercase rounded-none"
        >
          EXPORT_CSV
        </button>
      </div>

      {isLoading ? (
        <div className="h-48 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-border-muted border-t-accent-primary rounded-none animate-spin" />
        </div>
      ) : (
        <>
          <div className="overflow-y-auto max-h-80 border border-border-muted rounded-none">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="sticky top-0 bg-background z-10 border-b border-border-muted">
                <tr>
                  {["Date", "Pair", "Corr", "Z-score", "Regime"].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-[10px] uppercase font-bold text-slate-400 border-r border-border-muted last:border-r-0"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.alerts.map((alert, i) => (
                  <tr
                    key={i}
                    className="border-b border-border-muted last:border-b-0 hover:bg-[#1a1a1c] transition-colors"
                  >
                    <td className="px-3 py-2 text-slate-400 border-r border-border-muted tabular-nums">
                      {alert.date}
                    </td>
                    <td className="px-3 py-2 text-slate-300 font-semibold border-r border-border-muted">
                      {alert.asset1}×{alert.asset2}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-slate-300 border-r border-border-muted">
                      {alert.correlation.toFixed(3)}
                    </td>
                    <td
                      className={clsx(
                        "px-3 py-2 font-bold tabular-nums border-r border-border-muted",
                        "text-accent-amber"
                      )}
                    >
                      {alert.zscore > 0 ? "+" : ""}
                      {alert.zscore.toFixed(2)}σ
                    </td>
                    <td className="px-3 py-2 font-bold">
                      <span
                        className={clsx(
                          "px-2 py-0.5 text-[9px] uppercase tracking-wider",
                          alert.regime === "breakdown"
                            ? "bg-red-500/10 text-accent-red border border-accent-red/20"
                            : "bg-accent-primary/10 text-accent-primary border border-accent-primary/20"
                        )}
                      >
                        {alert.regime}
                      </span>
                    </td>
                  </tr>
                ))}
                {(!data?.alerts || data.alerts.length === 0) && (
                  <tr>
                    <td colSpan={5} className="px-3 py-12 text-center text-slate-600 text-xs font-mono">
                      // NO_ANOMALIES_DETECTED
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && data.total_count > PAGE_SIZE && (
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                disabled={offset === 0}
                className="px-3 py-1 border border-border-muted text-[10px] text-slate-400 hover:text-white hover:border-accent-primary disabled:opacity-20 disabled:border-border-muted disabled:text-slate-600 disabled:cursor-not-allowed cursor-pointer transition-all rounded-none uppercase"
              >
                PREV
              </button>
              <span className="text-slate-500 text-[10px] tabular-nums font-mono px-1">
                {Math.floor(offset / PAGE_SIZE) + 1} / {Math.ceil(data.total_count / PAGE_SIZE)}
              </span>
              <button
                onClick={() => setOffset(offset + PAGE_SIZE)}
                disabled={!data.has_more}
                className="px-3 py-1 border border-border-muted text-[10px] text-slate-400 hover:text-white hover:border-accent-primary disabled:opacity-20 disabled:border-border-muted disabled:text-slate-600 disabled:cursor-not-allowed cursor-pointer transition-all rounded-none uppercase"
              >
                NEXT
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
