"use client";
import { useEffect, useRef, useCallback, memo } from "react";
import * as d3 from "d3";
import { ASSETS } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { getCssVar } from "@/lib/css";

const LABELS = ["Nifty 50", "USD/INR", "Gold", "Crude", "10Y G-Sec", "FII Flow"];

interface Props {
  matrix: number[][];
  zscoreMatrix: number[][];
  threshold: number;
  onPairSelect: (a1: string, a2: string) => void;
}

export const CorrelationMatrix = memo(function CorrelationMatrix({
  matrix,
  zscoreMatrix,
  threshold,
  onPairSelect,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const theme = useAppStore((s) => s.theme);

  const render = useCallback(() => {
    if (!svgRef.current || !matrix.length) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const n = ASSETS.length;
    const cellSize = 76;
    const margin = { top: 70, right: 20, bottom: 20, left: 90 };
    const width = n * cellSize + margin.left + margin.right;
    const height = n * cellSize + margin.top + margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`);
    svg.attr("role", "grid");
    svg.attr("aria-label", "Correlation matrix heatmap. Press Tab to navigate cells, Enter to select a pair.");

    const accentRed = getCssVar("--accent-red") || (theme === "light" ? "#dc2626" : "#ef4444");
    const accentPrimary = getCssVar("--accent-primary") || (theme === "light" ? "#047857" : "#10b981");
    const accentAmber = getCssVar("--accent-amber") || (theme === "light" ? "#b45309" : "#f59e0b");
    const bgElevated = getCssVar("--bg-elevated") || (theme === "light" ? "#ede8df" : "#0d1f18");
    const borderDefault = getCssVar("--border-default") || (theme === "light" ? "#d4cfc6" : "#1a3a2e");
    const textMuted = getCssVar("--text-muted") || (theme === "light" ? "#6b6b6b" : "#5eead4");
    const textPrimary = getCssVar("--text-primary") || (theme === "light" ? "#1a1a1a" : "#ffffff");
    const textDim = getCssVar("--text-dim") || (theme === "light" ? "#999999" : "#424754");

    const colorScale = d3.scaleLinear<string>()
      .domain([-1, 0, 1])
      .range([accentRed, bgElevated, accentPrimary]);

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    LABELS.forEach((label, i) => {
      g.append("text")
        .attr("x", -12)
        .attr("y", i * cellSize + cellSize / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "end")
        .attr("font-size", 10)
        .attr("font-family", "var(--font-mono), monospace")
        .attr("fill", textMuted)
        .text(label);
    });

    LABELS.forEach((label, i) => {
      g.append("text")
        .attr("x", i * cellSize + cellSize / 2)
        .attr("y", -14)
        .attr("text-anchor", "middle")
        .attr("font-size", 10)
        .attr("font-family", "var(--font-mono), monospace")
        .attr("fill", textMuted)
        .text(label);
    });

    ASSETS.forEach((a1, i) => {
      ASSETS.forEach((a2, j) => {
        const val = matrix[i][j];
        const z = zscoreMatrix[i][j];
        const isAnomaly = Math.abs(z) > threshold;
        const isDiag = i === j;

        const cell = g
          .append("g")
          .attr("transform", `translate(${j * cellSize},${i * cellSize})`)
          .style("cursor", isDiag ? "default" : "pointer");

        if (!isDiag) {
          cell
            .attr("tabindex", 0)
            .attr("role", "button")
            .attr("aria-label", `${a1} vs ${a2}: correlation ${val.toFixed(2)}, z-score ${z.toFixed(1)}${isAnomaly ? ", anomaly" : ""}`)
            .on("click", () => onPairSelect(a1, a2))
            .on("keydown", (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onPairSelect(a1, a2);
              }
            });
        }

        cell
          .append("rect")
          .attr("width", cellSize - 2)
          .attr("height", cellSize - 2)
          .attr("rx", 0)
          .attr("fill", isDiag ? bgElevated : colorScale(val))
          .attr("opacity", isDiag ? 0.7 : 0.9)
          .attr("stroke", isDiag ? borderDefault : "none")
          .attr("stroke-width", isDiag ? 1 : 0);

        if (!isDiag) {
          cell
            .on("mouseenter", function () {
              d3.select(this)
                .select("rect")
                .transition()
                .duration(150)
                .attr("opacity", 1)
                .attr("stroke", accentPrimary)
                .attr("stroke-width", 1.5);
            })
            .on("mouseleave", function () {
              d3.select(this)
                .select("rect")
                .transition()
                .duration(150)
                .attr("opacity", 0.9)
                .attr("stroke", isAnomaly ? accentAmber : "none")
                .attr("stroke-width", isAnomaly ? 2 : 0);
            })
            .on("focus", function () {
              d3.select(this)
                .select("rect")
                .transition()
                .duration(150)
                .attr("opacity", 1)
                .attr("stroke", accentPrimary)
                .attr("stroke-width", 2);
            })
            .on("blur", function () {
              d3.select(this)
                .select("rect")
                .transition()
                .duration(150)
                .attr("opacity", 0.9)
                .attr("stroke", isAnomaly ? accentAmber : "none")
                .attr("stroke-width", isAnomaly ? 2 : 0);
            });
        }

        if (isAnomaly && !isDiag) {
          const anomalyRect = cell
            .append("rect")
            .attr("width", cellSize - 2)
            .attr("height", cellSize - 2)
            .attr("rx", 0)
            .attr("fill", "none")
            .attr("stroke", accentAmber)
            .attr("stroke-width", 2);

          if (!prefersReducedMotion) {
            anomalyRect
              .append("animate")
              .attr("attributeName", "opacity")
              .attr("values", "1;0.2;1")
              .attr("dur", "2s")
              .attr("repeatCount", "indefinite");
          }

          cell
            .append("polygon")
            .attr("points", `${cellSize - 15},0 ${cellSize - 2},0 ${cellSize - 2},13`)
            .attr("fill", accentAmber);
        }

        if (!isDiag) {
          const textColor = Math.abs(val) > 0.6 ? textPrimary : textPrimary;

          cell
            .append("text")
            .attr("x", (cellSize - 2) / 2)
            .attr("y", (cellSize - 2) / 2 - 4)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .attr("font-size", 12)
            .attr("font-weight", "700")
            .attr("font-family", "var(--font-mono), monospace")
            .attr("fill", textColor)
            .text(val.toFixed(2));

          cell
            .append("text")
            .attr("x", (cellSize - 2) / 2)
            .attr("y", (cellSize - 2) / 2 + 14)
            .attr("text-anchor", "middle")
            .attr("font-size", 9)
            .attr("font-family", "var(--font-mono), monospace")
            .attr("fill", isAnomaly ? accentAmber : textMuted)
            .text(`z=${z.toFixed(1)}`);
        } else {
          cell
            .append("text")
            .attr("x", (cellSize - 2) / 2)
            .attr("y", (cellSize - 2) / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .attr("font-size", 11)
            .attr("font-family", "var(--font-mono), monospace")
            .attr("fill", textDim)
            .text("1.00");
        }
      });
    });
  }, [matrix, zscoreMatrix, threshold, onPairSelect, theme]);

  useEffect(() => {
    render();
  }, [render]);

  return (
    <div className="overflow-x-auto">
      <svg
        ref={svgRef}
        className="w-full h-auto max-w-2xl mx-auto focus-visible:outline-2 focus-visible:outline-accent-primary"
      />
    </div>
  );
})
