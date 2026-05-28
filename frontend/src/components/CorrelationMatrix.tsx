"use client";
import { useEffect, useRef, useCallback, memo } from "react";
import * as d3 from "d3";
import { interpolateRdYlGn } from "d3-scale-chromatic";

const ASSETS = ["NIFTY50", "USDINR", "GOLD", "CRUDE", "GSEC10Y", "FII_FLOW"];
const LABELS = ["Nifty 50", "USD/INR", "Gold", "Crude", "10Y G-Sec", "FII Flow"];

interface Props {
  matrix: number[][];
  zscoreMatrix: number[][];
  anomalyFlags: boolean[][];
  threshold: number;
  onPairSelect: (a1: string, a2: string) => void;
}

export const CorrelationMatrix = memo(function CorrelationMatrix({
  matrix,
  zscoreMatrix,
  anomalyFlags,
  threshold,
  onPairSelect,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  const render = useCallback(() => {
    if (!svgRef.current || !matrix.length) return;

    const n = ASSETS.length;
    const cellSize = 76;
    const margin = { top: 70, right: 20, bottom: 20, left: 90 };
    const width = n * cellSize + margin.left + margin.right;
    const height = n * cellSize + margin.top + margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const colorScale = (v: number) => interpolateRdYlGn((v + 1) / 2);

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Row labels
    LABELS.forEach((label, i) => {
      g.append("text")
        .attr("x", -12)
        .attr("y", i * cellSize + cellSize / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "end")
        .attr("font-size", 11)
        .attr("font-family", "'JetBrains Mono', monospace")
        .attr("fill", "#94a3b8")
        .text(label);
    });

    // Column labels (rotated)
    LABELS.forEach((label, i) => {
      g.append("text")
        .attr("x", i * cellSize + cellSize / 2)
        .attr("y", -14)
        .attr("text-anchor", "middle")
        .attr("font-size", 11)
        .attr("font-family", "'JetBrains Mono', monospace")
        .attr("fill", "#94a3b8")
        .text(label);
    });

    // Cells
    ASSETS.forEach((a1, i) => {
      ASSETS.forEach((a2, j) => {
        const val = matrix[i][j];
        const z = zscoreMatrix[i][j];
        const isAnomaly = anomalyFlags[i][j];
        const isDiag = i === j;

        const cell = g
          .append("g")
          .attr("transform", `translate(${j * cellSize},${i * cellSize})`)
          .style("cursor", isDiag ? "default" : "pointer");

        if (!isDiag) {
          cell.on("click", () => onPairSelect(a1, a2));
        }

        // Background rect
        cell
          .append("rect")
          .attr("width", cellSize - 3)
          .attr("height", cellSize - 3)
          .attr("rx", 6)
          .attr("fill", isDiag ? "#0f172a" : colorScale(val))
          .attr("opacity", isDiag ? 0.6 : 0.88)
          .attr("stroke", isDiag ? "#1e293b" : "none")
          .attr("stroke-width", isDiag ? 1 : 0);

        // Hover effect for non-diagonal
        if (!isDiag) {
          cell
            .on("mouseenter", function () {
              d3.select(this)
                .select("rect")
                .transition()
                .duration(150)
                .attr("opacity", 1)
                .attr("stroke", "#e2e8f0")
                .attr("stroke-width", 1.5);
            })
            .on("mouseleave", function () {
              d3.select(this)
                .select("rect")
                .transition()
                .duration(150)
                .attr("opacity", 0.88)
                .attr("stroke", isAnomaly ? (z > 0 ? "#22c55e" : "#ef4444") : "none")
                .attr("stroke-width", isAnomaly ? 2.5 : 0);
            });
        }

        // Anomaly pulsing border
        if (isAnomaly && !isDiag) {
          cell
            .append("rect")
            .attr("width", cellSize - 3)
            .attr("height", cellSize - 3)
            .attr("rx", 6)
            .attr("fill", "none")
            .attr("stroke", z > 0 ? "#22c55e" : "#ef4444")
            .attr("stroke-width", 2.5)
            .append("animate")
            .attr("attributeName", "opacity")
            .attr("values", "1;0.15;1")
            .attr("dur", "2.5s")
            .attr("repeatCount", "indefinite");
        }

        // Correlation value
        if (!isDiag) {
          const textColor =
            Math.abs(val) > 0.5 ? "rgba(255,255,255,0.95)" : "#1e293b";

          cell
            .append("text")
            .attr("x", (cellSize - 3) / 2)
            .attr("y", (cellSize - 3) / 2 - 4)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .attr("font-size", 13)
            .attr("font-weight", "700")
            .attr("font-family", "'JetBrains Mono', monospace")
            .attr("fill", textColor)
            .text(val.toFixed(2));

          // Z-score label
          cell
            .append("text")
            .attr("x", (cellSize - 3) / 2)
            .attr("y", (cellSize - 3) / 2 + 14)
            .attr("text-anchor", "middle")
            .attr("font-size", 9)
            .attr("font-family", "'JetBrains Mono', monospace")
            .attr(
              "fill",
              isAnomaly
                ? z > 0
                  ? "#4ade80"
                  : "#f87171"
                : Math.abs(val) > 0.5
                  ? "rgba(255,255,255,0.5)"
                  : "#64748b"
            )
            .text(`z=${z.toFixed(1)}`);
        } else {
          // Diagonal — show "1.00" dimly
          cell
            .append("text")
            .attr("x", (cellSize - 3) / 2)
            .attr("y", (cellSize - 3) / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .attr("font-size", 11)
            .attr("font-family", "'JetBrains Mono', monospace")
            .attr("fill", "#334155")
            .text("1.00");
        }
      });
    });
  }, [matrix, zscoreMatrix, anomalyFlags, threshold, onPairSelect]);

  useEffect(() => {
    render();
  }, [render]);

  return <svg ref={svgRef} className="w-full h-auto max-w-2xl mx-auto" />;
})
