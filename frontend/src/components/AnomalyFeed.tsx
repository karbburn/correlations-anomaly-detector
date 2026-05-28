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
    <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-5 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-white tracking-tight">
            Anomaly Alerts
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {data?.total_count ?? 0} alerts · {window}D window · |z| &gt; {threshold}σ
          </p>
        </div>
        <button
          onClick={exportCsv}
          disabled={!data?.alerts.length}
          className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors disabled:text-slate-600 disabled:cursor-not-allowed flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export CSV
        </button>
      </div>

      {isLoading ? (
        <div className="h-48 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="overflow-y-auto max-h-80 rounded-lg border border-slate-800/50">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-900/95 backdrop-blur-sm">
                <tr>
                  {["Date", "Pair", "Corr", "Z-score", "Regime"].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider text-slate-500 font-medium"
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
                    className="border-t border-slate-800/30 hover:bg-slate-800/20 transition-colors"
                  >
                    <td className="px-3 py-2 text-slate-400 tabular-nums text-xs">
                      {alert.date}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-300">
                      {alert.asset1} × {alert.asset2}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-xs text-slate-300">
                      {alert.correlation.toFixed(3)}
                    </td>
                    <td
                      className={clsx(
                        "px-3 py-2 font-semibold tabular-nums text-xs",
                        alert.zscore < 0 ? "text-red-400" : "text-emerald-400"
                      )}
                    >
                      {alert.zscore > 0 ? "+" : ""}
                      {alert.zscore.toFixed(2)}σ
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={clsx(
                          "px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider",
                          alert.regime === "breakdown"
                            ? "bg-red-500/15 text-red-300 ring-1 ring-red-500/20"
                            : "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/20"
                        )}
                      >
                        {alert.regime}
                      </span>
                    </td>
                  </tr>
                ))}
                {(!data?.alerts || data.alerts.length === 0) && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-slate-600 text-sm">
                      No anomalies detected
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && data.total_count > PAGE_SIZE && (
            <div className="flex items-center justify-end gap-2 mt-3">
              <button
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                disabled={offset === 0}
                className="px-2.5 py-1 rounded-md bg-slate-800/60 text-xs text-slate-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed border border-slate-700/50"
              >
                ← Prev
              </button>
              <span className="text-slate-500 text-xs tabular-nums">
                {Math.floor(offset / PAGE_SIZE) + 1} /{" "}
                {Math.ceil(data.total_count / PAGE_SIZE)}
              </span>
              <button
                onClick={() => setOffset(offset + PAGE_SIZE)}
                disabled={!data.has_more}
                className="px-2.5 py-1 rounded-md bg-slate-800/60 text-xs text-slate-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed border border-slate-700/50"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
