"use client";
import { useEffect, useRef, memo } from "react";
import * as d3 from "d3";

const REGIME_COLORS: Record<string, string> = {
  strong_positive: "#166534",
  mild_positive: "#4ade80",
  neutral: "#475569",
  mild_negative: "#f87171",
  strong_negative: "#991b1b",
  anomaly: "#f59e0b",
};

const PAIR_LABELS: Record<string, string> = {
  NIFTY50__USDINR: "Nifty×USD",
  NIFTY50__GOLD: "Nifty×Gold",
  NIFTY50__CRUDE: "Nifty×Crude",
  NIFTY50__GSEC10Y: "Nifty×GSec",
  NIFTY50__FII_FLOW: "Nifty×FII",
  USDINR__GOLD: "USD×Gold",
  USDINR__CRUDE: "USD×Crude",
  USDINR__GSEC10Y: "USD×GSec",
  USDINR__FII_FLOW: "USD×FII",
  GOLD__CRUDE: "Gold×Crude",
  GOLD__GSEC10Y: "Gold×GSec",
  GOLD__FII_FLOW: "Gold×FII",
  CRUDE__GSEC10Y: "Crude×GSec",
  CRUDE__FII_FLOW: "Crude×FII",
  GSEC10Y__FII_FLOW: "GSec×FII",
};

interface Props {
  pairs: string[];
  dates: string[];
  regimes: Record<string, string[]>;
}

export const RegimeTimeline = memo(function RegimeTimeline({ pairs, dates, regimes }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !pairs.length || !dates.length) return;

    // Sample dates to keep rendering manageable (max ~200 columns)
    const step = Math.max(1, Math.floor(dates.length / 200));
    const sampledDates = dates.filter((_, i) => i % step === 0);
    const sampledIndices = dates.map((_, i) => i).filter((i) => i % step === 0);

    const cellW = 4;
    const cellH = 18;
    const margin = { top: 30, right: 20, bottom: 40, left: 100 };
    const width = sampledDates.length * cellW + margin.left + margin.right;
    const height = pairs.length * cellH + margin.top + margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Pair labels
    pairs.forEach((pair, i) => {
      g.append("text")
        .attr("x", -8)
        .attr("y", i * cellH + cellH / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "end")
        .attr("font-size", 9)
        .attr("font-family", "'JetBrains Mono', monospace")
        .attr("fill", "#94a3b8")
        .text(PAIR_LABELS[pair] ?? pair.replace("__", "×"));
    });

    // Date axis labels (every ~50th sampled date)
    const labelStep = Math.max(1, Math.floor(sampledDates.length / 8));
    sampledDates.forEach((date, i) => {
      if (i % labelStep !== 0) return;
      g.append("text")
        .attr("x", i * cellW + cellW / 2)
        .attr("y", pairs.length * cellH + 16)
        .attr("text-anchor", "middle")
        .attr("font-size", 8)
        .attr("fill", "#64748b")
        .attr("transform", `rotate(-45, ${i * cellW + cellW / 2}, ${pairs.length * cellH + 16})`)
        .text(new Date(date).toLocaleDateString("en-US", { month: "short", year: "2-digit" }));
    });

    // Heat cells
    pairs.forEach((pair, pi) => {
      const pairRegimes = regimes[pair];
      if (!pairRegimes) return;

      sampledIndices.forEach((origIdx, si) => {
        const regime = pairRegimes[origIdx] ?? "neutral";
        g.append("rect")
          .attr("x", si * cellW)
          .attr("y", pi * cellH)
          .attr("width", cellW)
          .attr("height", cellH - 1)
          .attr("fill", REGIME_COLORS[regime] ?? "#475569")
          .attr("opacity", 0.85);
      });
    });

    // Legend
    const legendData = [
      { label: "Strong +", color: REGIME_COLORS.strong_positive },
      { label: "Mild +", color: REGIME_COLORS.mild_positive },
      { label: "Neutral", color: REGIME_COLORS.neutral },
      { label: "Mild −", color: REGIME_COLORS.mild_negative },
      { label: "Strong −", color: REGIME_COLORS.strong_negative },
      { label: "Anomaly", color: REGIME_COLORS.anomaly },
    ];

    const legend = svg
      .append("g")
      .attr("transform", `translate(${margin.left}, 8)`);

    legendData.forEach((d, i) => {
      const x = i * 70;
      legend
        .append("rect")
        .attr("x", x)
        .attr("y", 0)
        .attr("width", 10)
        .attr("height", 10)
        .attr("rx", 2)
        .attr("fill", d.color);
      legend
        .append("text")
        .attr("x", x + 14)
        .attr("y", 9)
        .attr("font-size", 8)
        .attr("fill", "#94a3b8")
        .text(d.label);
    });
  }, [pairs, dates, regimes]);

  return (
    <div className="overflow-x-auto">
      <svg ref={svgRef} className="w-full h-auto min-w-[600px]" />
    </div>
  );
})
