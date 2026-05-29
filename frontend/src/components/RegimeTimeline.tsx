"use client";
import { useEffect, useRef, memo, useMemo } from "react";
import * as d3 from "d3";
import { useAppStore } from "@/lib/store";
import { getCssVar } from "@/lib/css";

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

function classifyRegime(corr: number | null, z: number | null, threshold: number): string {
  if (corr === null || z === null || isNaN(corr) || isNaN(z)) return "neutral";
  if (Math.abs(z) > threshold) return "anomaly";
  if (corr >= 0.7) return "strong_positive";
  if (corr >= 0.3) return "mild_positive";
  if (corr > -0.3) return "neutral";
  if (corr > -0.7) return "mild_negative";
  return "strong_negative";
}

interface Props {
  pairs: string[];
  dates: string[];
  correlations: Record<string, (number | null)[]>;
  zscores: Record<string, (number | null)[]>;
}

export const RegimeTimeline = memo(function RegimeTimeline({ pairs, dates, correlations, zscores }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const theme = useAppStore((s) => s.theme);
  const threshold = useAppStore((s) => s.threshold);

  const regimes = useMemo(() => {
    const result: Record<string, string[]> = {};
    for (const pair of pairs) {
      const corrs = correlations[pair] ?? [];
      const zs = zscores[pair] ?? [];
      result[pair] = corrs.map((c, i) => classifyRegime(c, zs[i] ?? null, threshold));
    }
    return result;
  }, [pairs, correlations, zscores, threshold]);

  useEffect(() => {
    if (!svgRef.current || !pairs.length || !dates.length) return;

    const accentPrimary = getCssVar("--accent-primary") || (theme === "light" ? "#047857" : "#10b981");
    const accentRed = getCssVar("--accent-red") || (theme === "light" ? "#dc2626" : "#ef4444");
    const accentAmber = getCssVar("--accent-amber") || (theme === "light" ? "#b45309" : "#f59e0b");
    const bgSurface = getCssVar("--bg-surface") || (theme === "light" ? "#e4dfd6" : "#112a20");
    const textMuted = getCssVar("--text-muted") || (theme === "light" ? "#6b6b6b" : "#5eead4");
    const textDim = getCssVar("--text-dim") || (theme === "light" ? "#999999" : "#2dd4bf");

    const activeColors: Record<string, string> = {
      strong_positive: accentPrimary,
      mild_positive: theme === "light" ? "#6ee7b7" : "rgba(16, 185, 129, 0.5)",
      neutral: bgSurface,
      mild_negative: theme === "light" ? "#fca5a5" : "rgba(239, 68, 68, 0.5)",
      strong_negative: accentRed,
      anomaly: accentAmber,
    };

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
    svg.attr("role", "img");
    svg.attr("aria-label", "Regime timeline heatmap showing correlation regime classifications over time for each asset pair.");

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
        .attr("fill", textMuted)
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
        .attr("fill", textDim)
        .attr("transform", `rotate(-45, ${i * cellW + cellW / 2}, ${pairs.length * cellH + 16})`)
        .text(new Date(date).toLocaleDateString("en-US", { month: "short", year: "2-digit" }));
    });

    pairs.forEach((pair, pi) => {
      const pairRegimes = regimes[pair];
      if (!pairRegimes) return;

      sampledIndices.forEach((origIdx, si) => {
        const regime = pairRegimes[origIdx] ?? "neutral";
        const color = activeColors[regime] ?? activeColors.neutral;
        const isAnomaly = regime === "anomaly";

        g.append("rect")
          .attr("x", si * cellW)
          .attr("y", pi * cellH)
          .attr("width", cellW)
          .attr("height", cellH - 1)
          .attr("rx", 0)
          .attr("fill", color)
          .attr("opacity", isAnomaly ? 1.0 : 0.9)
          .attr("stroke", isAnomaly ? color : "none")
          .attr("stroke-width", isAnomaly ? 0.5 : 0);
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
        .attr("fill", textMuted)
        .text(d.label);
    });
  }, [pairs, dates, regimes, theme]);

  return (
    <div className="overflow-x-auto">
      <svg ref={svgRef} className="w-full h-auto min-w-[600px]" />
    </div>
  );
})
