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
  ReferenceArea,
  ResponsiveContainer,
} from "recharts";

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
  const chartData = data.dates.map((date, i) => ({
    date,
    correlation: data.correlations[i],
    zscore: data.zscores[i],
    isAnomaly: data.anomaly_flags[i],
  }));

  return (
    <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-5 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-white tracking-tight">
            {asset1} × {asset2}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Rolling correlation & z-score over time
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-slate-300 transition-colors p-1"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="date"
              tickFormatter={(d) => {
                const dt = new Date(d);
                return dt.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
              }}
              tick={{ fontSize: 10, fill: "#64748b" }}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="corr"
              domain={[-1, 1]}
              tick={{ fontSize: 10, fill: "#64748b" }}
              label={{
                value: "Correlation",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 10, fill: "#475569" },
              }}
            />
            <YAxis
              yAxisId="z"
              orientation="right"
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              label={{
                value: "Z-score",
                angle: 90,
                position: "insideRight",
                style: { fontSize: 10, fill: "#475569" },
              }}
            />
            <ReferenceLine yAxisId="corr" y={0} stroke="#334155" strokeWidth={1} />
            <ReferenceLine yAxisId="z" y={threshold} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.4} />
            <ReferenceLine yAxisId="z" y={-threshold} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.4} />
            <Tooltip
              contentStyle={{
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              labelFormatter={(d) => new Date(d).toLocaleDateString("en-US", {
                day: "numeric", month: "short", year: "numeric",
              })}
              formatter={(value: any, name: any) => [
                typeof value === "number" ? value.toFixed(4) : "—",
                name === "correlation" ? "Corr" : "Z-score",
              ]}
            />
            <Legend
              wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
            />
            <Line
              yAxisId="corr"
              dataKey="correlation"
              stroke="#60a5fa"
              strokeWidth={2}
              dot={false}
              name="Rolling Corr"
              connectNulls
            />
            <Line
              yAxisId="z"
              dataKey="zscore"
              stroke="#a78bfa"
              strokeWidth={1}
              strokeDasharray="4 2"
              dot={false}
              name="Z-score"
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
