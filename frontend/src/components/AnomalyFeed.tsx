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
  const { data, isLoading, isError, error, refetch } = useAnomalyFeed({ offset, limit: PAGE_SIZE });

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
    <div className="bg-card p-5 rounded-none font-mono">
      <div className="flex items-center justify-between mb-4 border-b border-border-muted pb-3">
        <div>
          <h3 className="text-sm font-bold text-foreground tracking-wider uppercase">
            [ANOMALY_ALERTS]
          </h3>
          <p className="text-[10px] text-dim mt-0.5">
            LOGS: {data?.total_count ?? 0} ALERTS · {window}D_WINDOW · |z| &gt; {threshold}σ
          </p>
        </div>
        <button
          onClick={exportCsv}
          disabled={!data?.alerts.length}
          className="px-2 py-1 text-[10px] font-semibold text-accent-primary hover:bg-accent-teal hover:text-foreground transition-all disabled:text-dim disabled:cursor-not-allowed cursor-pointer uppercase rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background"
        >
          EXPORT_CSV
        </button>
      </div>

      {isLoading ? (
        <div className="h-48 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-border-muted border-t-accent-primary rounded-none animate-spin" />
        </div>
      ) : isError ? (
        <div className="h-48 flex flex-col items-center justify-center gap-3">
          <p className="text-xs text-accent-red">
            {error?.message || "Failed to load anomaly alerts."}
          </p>
          <button
            onClick={() => refetch()}
            className="px-3 py-1 text-[10px] font-semibold text-accent-primary border border-border-muted hover:bg-elevated transition-all cursor-pointer uppercase rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background"
          >
            RETRY
          </button>
        </div>
      ) : (
        <>
          <div className="overflow-y-auto max-h-80">
            <table className="w-full text-xs text-left">
              <thead className="sticky top-0 bg-card z-10 border-b border-border-muted">
                <tr>
                  {["Date", "Pair", "Corr", "Z-score", "Regime"].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-[10px] uppercase font-bold text-muted"
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
                    className="hover:bg-elevated transition-colors"
                  >
                    <td className="px-3 py-2 text-muted tabular-nums">
                      {alert.date}
                    </td>
                    <td className="px-3 py-2 text-secondary font-semibold">
                      {alert.asset1}×{alert.asset2}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-secondary">
                      {alert.correlation.toFixed(3)}
                    </td>
                    <td className="px-3 py-2 font-bold tabular-nums text-accent-amber">
                      {alert.zscore > 0 ? "+" : ""}
                      {alert.zscore.toFixed(2)}σ
                    </td>
                    <td className="px-3 py-2 font-bold">
                      <span
                        className={clsx(
                          "px-2 py-0.5 text-[9px] uppercase tracking-wider",
                          alert.regime === "breakdown"
                            ? "bg-accent-red/10 text-accent-red"
                            : "bg-accent-primary/10 text-accent-primary"
                        )}
                      >
                        {alert.regime}
                      </span>
                    </td>
                  </tr>
                ))}
                {(!data?.alerts || data.alerts.length === 0) && (
                  <tr>
                    <td colSpan={5} className="px-3 py-12 text-center text-dim text-xs font-mono">
                      {"// NO_ANOMALIES_DETECTED"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {data && data.total_count > PAGE_SIZE && (
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                disabled={offset === 0}
                className="px-3 py-1 border border-border-muted text-[10px] text-muted hover:text-foreground hover:border-accent-primary disabled:opacity-20 disabled:text-dim disabled:cursor-not-allowed cursor-pointer transition-all rounded-none uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background"
              >
                PREV
              </button>
              <span className="text-dim text-[10px] tabular-nums font-mono px-1">
                {Math.floor(offset / PAGE_SIZE) + 1} / {Math.ceil(data.total_count / PAGE_SIZE)}
              </span>
              <button
                onClick={() => setOffset(offset + PAGE_SIZE)}
                disabled={!data.has_more}
                className="px-3 py-1 border border-border-muted text-[10px] text-muted hover:text-foreground hover:border-accent-primary disabled:opacity-20 disabled:text-dim disabled:cursor-not-allowed cursor-pointer transition-all rounded-none uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background"
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
