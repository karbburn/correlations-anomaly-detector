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
    anomalyRegion: data.anomaly_flags[i] ? 1 : -1, // Map to full scale for background shading
  }));

  return (
    <div className="bg-[#0a0a0b] border border-border-muted p-5 rounded-none font-mono">
      <div className="flex items-center justify-between mb-4 border-b border-border-muted pb-3">
        <div>
          <h3 className="text-sm font-bold text-white tracking-wider uppercase">
            [PLOT_DRILLDOWN] :: {asset1} × {asset2}
          </h3>
          <p className="text-[10px] text-slate-500 mt-0.5">
            ROLLING_CORRELATION (BLUE) VS. ROLLING_Z-SCORE (AMBER)
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-accent-blue hover:border-accent-blue border border-transparent px-1.5 py-0.5 transition-all rounded-none uppercase text-[10px] cursor-pointer"
        >
          [CLOSE]
        </button>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <defs>
              {/* Custom linear gradient for anomaly area background shading */}
              <linearGradient id="anomalyShade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15}/>
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2d2d2d" />
            <XAxis
              dataKey="date"
              tickFormatter={(d) => {
                const dt = new Date(d);
                return dt.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
              }}
              tick={{ fontSize: 9, fill: "#8c909f", fontFamily: "var(--font-mono), monospace" }}
              interval="preserveStartEnd"
              stroke="#2d2d2d"
            />
            <YAxis
              yAxisId="corr"
              domain={[-1, 1]}
              tick={{ fontSize: 9, fill: "#8c909f", fontFamily: "var(--font-mono), monospace" }}
              stroke="#2d2d2d"
              label={{
                value: "CORRELATION",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 8, fill: "#8c909f", fontFamily: "var(--font-mono), monospace" },
              }}
            />
            <YAxis
              yAxisId="z"
              orientation="right"
              tick={{ fontSize: 9, fill: "#8c909f", fontFamily: "var(--font-mono), monospace" }}
              stroke="#2d2d2d"
              label={{
                value: "Z-SCORE",
                angle: 90,
                position: "insideRight",
                style: { fontSize: 8, fill: "#8c909f", fontFamily: "var(--font-mono), monospace" },
              }}
            />
            <ReferenceLine yAxisId="corr" y={0} stroke="#2d2d2d" strokeWidth={1} />
            <ReferenceLine yAxisId="z" y={threshold} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.5} />
            <ReferenceLine yAxisId="z" y={-threshold} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.5} />
            
            {/* Shaded Area for Anomaly Periods */}
            <ReferenceLine yAxisId="corr" y={-1} stroke="none" />
            
            <Tooltip
              contentStyle={{
                background: "#0a0a0b",
                border: "1px solid #f59e0b",
                borderRadius: "0px",
                fontSize: "11px",
                fontFamily: "var(--font-mono), monospace",
              }}
              labelFormatter={(d) => new Date(d).toLocaleDateString("en-US", {
                day: "numeric", month: "short", year: "numeric",
              })}
              formatter={(value: any, name: any) => [
                typeof value === "number" ? value.toFixed(4) : "—",
                name === "correlation" ? "CORRELATION" : name === "zscore" ? "Z-SCORE" : "ANOMALY",
              ]}
            />
            <Legend
              wrapperStyle={{ fontSize: "10px", paddingTop: "8px", fontFamily: "var(--font-mono), monospace" }}
            />
            
            {/* Translucent background bands for active anomalies */}
            <Line
              yAxisId="corr"
              dataKey="correlation"
              stroke="#3b82f6"
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
