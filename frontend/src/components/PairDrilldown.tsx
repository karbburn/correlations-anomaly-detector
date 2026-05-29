"use client";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { useAppStore } from "@/lib/store";

interface PairData {
  dates: string[];
  correlations: (number | null)[];
  zscores: (number | null)[];
  anomaly_flags: boolean[];
}

interface Props {
  asset1: string;
  asset2: string;
  data: PairData;
  threshold: number;
  onClose: () => void;
}

export function PairDrilldown({ asset1, asset2, data, threshold, onClose }: Props) {
  const theme = useAppStore((s) => s.theme);
  const isDark = theme === "dark";

  const chartData = data.dates.map((date, i) => ({
    date,
    correlation: data.correlations[i],
    zscore: data.zscores[i],
  }));

  const gridColor = isDark ? "#1a3a2e" : "#d4cfc6";
  const tickColor = isDark ? "#2dd4bf" : "#6b6b6b";
  const tooltipBg = isDark ? "#060d0a" : "#ffffff";
  const tooltipBorder = isDark ? "#1a3a2e" : "#d4cfc6";

  return (
    <div className="bg-card p-5 rounded-none font-mono">
      <div className="flex items-center justify-between mb-4 border-b border-border-muted pb-3">
        <div>
          <h3 className="text-sm font-bold text-foreground tracking-wider uppercase">
            [PLOT_DRILLDOWN] :: {asset1} × {asset2}
          </h3>
          <p className="text-[10px] text-dim mt-0.5">
            ROLLING_CORRELATION (GREEN) VS. ROLLING_Z-SCORE (AMBER)
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close pair drilldown"
          className="text-dim hover:text-accent-primary hover:border-accent-primary border border-transparent px-1.5 py-0.5 transition-all rounded-none uppercase text-[10px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background"
        >
          [CLOSE]
        </button>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis
              dataKey="date"
              tickFormatter={(d) => {
                const dt = new Date(d);
                return dt.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
              }}
              tick={{ fontSize: 9, fill: tickColor, fontFamily: "var(--font-mono), monospace" }}
              interval="preserveStartEnd"
              stroke={gridColor}
            />
            <YAxis
              yAxisId="corr"
              domain={[-1, 1]}
              tick={{ fontSize: 9, fill: tickColor, fontFamily: "var(--font-mono), monospace" }}
              stroke={gridColor}
              label={{
                value: "CORRELATION",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 8, fill: tickColor, fontFamily: "var(--font-mono), monospace" },
              }}
            />
            <YAxis
              yAxisId="z"
              orientation="right"
              tick={{ fontSize: 9, fill: tickColor, fontFamily: "var(--font-mono), monospace" }}
              stroke={gridColor}
              label={{
                value: "Z-SCORE",
                angle: 90,
                position: "insideRight",
                style: { fontSize: 8, fill: tickColor, fontFamily: "var(--font-mono), monospace" },
              }}
            />
            <ReferenceLine yAxisId="corr" y={0} stroke={gridColor} strokeWidth={1} />
            <ReferenceLine yAxisId="z" y={threshold} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.5} />
            <ReferenceLine yAxisId="z" y={-threshold} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.5} />

            <Tooltip
              contentStyle={{
                background: tooltipBg,
                border: `1px solid ${tooltipBorder}`,
                borderRadius: "0px",
                fontSize: "11px",
                fontFamily: "var(--font-mono), monospace",
              }}
              labelFormatter={(d) => new Date(d).toLocaleDateString("en-US", {
                day: "numeric", month: "short", year: "numeric",
              })}
              formatter={(value, name) => [
                typeof value === "number" ? value.toFixed(4) : "—",
                name === "correlation" ? "CORRELATION" : name === "zscore" ? "Z-SCORE" : "ANOMALY",
              ]}
            />
            <Legend
              wrapperStyle={{ fontSize: "10px", paddingTop: "8px", fontFamily: "var(--font-mono), monospace" }}
            />

            <Line
              yAxisId="corr"
              dataKey="correlation"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              name="correlation"
              connectNulls
            />
            <Line
              yAxisId="z"
              dataKey="zscore"
              stroke="#f59e0b"
              strokeWidth={1}
              strokeDasharray="3 3"
              dot={false}
              name="zscore"
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
