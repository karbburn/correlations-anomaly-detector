"use client";
import { useEffect, useRef, memo } from "react";
import * as d3 from "d3";

const REGIME_COLORS: Record<string, string> = {
  strong_positive: "#3b82f6",
  mild_positive: "rgba(59, 130, 246, 0.5)",
  neutral: "#1f2937",
  mild_negative: "rgba(239, 68, 68, 0.5)",
  strong_negative: "#ef4444",
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

import { useAppStore } from "@/lib/store";

export const RegimeTimeline = memo(function RegimeTimeline({ pairs, dates, regimes }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const theme = useAppStore((s) => s.theme);

  useEffect(() => {
    if (!svgRef.current || !pairs.length || !dates.length) return;

    const activeColors: Record<string, string> = {
      strong_positive: theme === "light" ? "#1e40af" : "#3b82f6",
      mild_positive: theme === "light" ? "rgba(30, 64, 175, 0.4)" : "rgba(59, 130, 246, 0.4)",
      neutral: theme === "light" ? "#cbd5e1" : "#1f2937",
      mild_negative: theme === "light" ? "rgba(220, 38, 38, 0.4)" : "rgba(239, 68, 68, 0.4)",
      strong_negative: theme === "light" ? "#dc2626" : "#ef4444",
      anomaly: theme === "light" ? "#b45309" : "#f59e0b",
    };

    const labelColor = theme === "light" ? "#475569" : "#8c909f";

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

    pairs.forEach((pair, i) => {
      g.append("text")
        .attr("x", -8)
        .attr("y", i * cellH + cellH / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "end")
        .attr("font-size", 9)
        .attr("font-family", "var(--font-mono), monospace")
        .attr("fill", labelColor)
        .text(PAIR_LABELS[pair] ?? pair.replace("__", "×"));
    });

    const labelStep = Math.max(1, Math.floor(sampledDates.length / 8));
    sampledDates.forEach((date, i) => {
      if (i % labelStep !== 0) return;
      g.append("text")
        .attr("x", i * cellW + cellW / 2)
        .attr("y", pairs.length * cellH + 16)
        .attr("text-anchor", "middle")
        .attr("font-size", 8)
        .attr("font-family", "var(--font-mono), monospace")
        .attr("fill", "#64748b")
        .attr("transform", `rotate(-45, ${i * cellW + cellW / 2}, ${pairs.length * cellH + 16})`)
        .text(new Date(date).toLocaleDateString("en-US", { month: "short", year: "2-digit" }));
    });

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
          .attr("rx", 0)
          .attr("fill", activeColors[regime] ?? activeColors.neutral)
          .attr("opacity", 0.9);
      });
    });

    const legendData = [
      { label: "Strong +", color: activeColors.strong_positive },
      { label: "Mild +", color: activeColors.mild_positive },
      { label: "Neutral", color: activeColors.neutral },
      { label: "Mild −", color: activeColors.mild_negative },
      { label: "Strong −", color: activeColors.strong_negative },
      { label: "Anomaly", color: activeColors.anomaly },
    ];

    const legend = svg
      .append("g")
      .attr("transform", `translate(${margin.left}, 8)`);

    legendData.forEach((d, i) => {
      const x = i * 75;
      legend
        .append("rect")
        .attr("x", x)
        .attr("y", 0)
        .attr("width", 10)
        .attr("height", 10)
        .attr("rx", 0)
        .attr("fill", d.color);
      legend
        .append("text")
        .attr("x", x + 14)
        .attr("y", 9)
        .attr("font-size", 8)
        .attr("font-family", "var(--font-mono), monospace")
        .attr("fill", labelColor)
        .text(d.label);
    });
  }, [pairs, dates, regimes, theme]);

  return (
    <div className="overflow-x-auto">
      <svg ref={svgRef} className="w-full h-auto min-w-[600px]" />
    </div>
  );
})
