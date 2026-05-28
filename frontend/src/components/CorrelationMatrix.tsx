"use client";
import { useEffect, useRef, useCallback, memo } from "react";
import * as d3 from "d3";
import { interpolateRdYlGn } from "d3-scale-chromatic";
import { ASSETS } from "@/lib/types";

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

    // Tri-tonal custom color scale: Red (-1) -> Charcoal (0) -> Cyber Blue (1)
    const colorScale = d3.scaleLinear<string>()
      .domain([-1, 0, 1])
      .range(["#ef4444", "#1f2937", "#3b82f6"]);

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
        .attr("font-size", 10)
        .attr("font-family", "var(--font-mono), monospace")
        .attr("fill", "#8c909f")
        .text(label);
    });

    // Column labels (rotated)
    LABELS.forEach((label, i) => {
      g.append("text")
        .attr("x", i * cellSize + cellSize / 2)
        .attr("y", -14)
        .attr("text-anchor", "middle")
        .attr("font-size", 10)
        .attr("font-family", "var(--font-mono), monospace")
        .attr("fill", "#8c909f")
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

        // Background rect - strictly rectilinear rx=0
        cell
          .append("rect")
          .attr("width", cellSize - 2)
          .attr("height", cellSize - 2)
          .attr("rx", 0)
          .attr("fill", isDiag ? "#10131a" : colorScale(val))
          .attr("opacity", isDiag ? 0.7 : 0.9)
          .attr("stroke", isDiag ? "#2d2d2d" : "none")
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
                .attr("stroke", "#3b82f6")
                .attr("stroke-width", 1.5);
            })
            .on("mouseleave", function () {
              d3.select(this)
                .select("rect")
                .transition()
                .duration(150)
                .attr("opacity", 0.9)
                .attr("stroke", isAnomaly ? "#f59e0b" : "none")
                .attr("stroke-width", isAnomaly ? 2 : 0);
            });
        }

        // Anomaly pulsing border - rect rx=0, Amber warning outline
        if (isAnomaly && !isDiag) {
          cell
            .append("rect")
            .attr("width", cellSize - 2)
            .attr("height", cellSize - 2)
            .attr("rx", 0)
            .attr("fill", "none")
            .attr("stroke", "#f59e0b")
            .attr("stroke-width", 2)
            .append("animate")
            .attr("attributeName", "opacity")
            .attr("values", "1;0.2;1")
            .attr("dur", "2s")
            .attr("repeatCount", "indefinite");

          // Custom 45-degree Amber corner-clip in the top-right of anomalous cell
          cell
            .append("polygon")
            .attr("points", `${cellSize - 15},0 ${cellSize - 2},0 ${cellSize - 2},13`)
            .attr("fill", "#f59e0b");
        }

        // Correlation value text
        if (!isDiag) {
          cell
            .append("text")
            .attr("x", (cellSize - 2) / 2)
            .attr("y", (cellSize - 2) / 2 - 4)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .attr("font-size", 12)
            .attr("font-weight", "700")
            .attr("font-family", "var(--font-mono), monospace")
            .attr("fill", "#ffffff")
            .text(val.toFixed(2));

          // Z-score label
          cell
            .append("text")
            .attr("x", (cellSize - 2) / 2)
            .attr("y", (cellSize - 2) / 2 + 14)
            .attr("text-anchor", "middle")
            .attr("font-size", 9)
            .attr("font-family", "var(--font-mono), monospace")
            .attr("fill", isAnomaly ? "#f59e0b" : "#8c909f")
            .text(`z=${z.toFixed(1)}`);
        } else {
          // Diagonal — show "1.00" dimly in monospace
          cell
            .append("text")
            .attr("x", (cellSize - 2) / 2)
            .attr("y", (cellSize - 2) / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .attr("font-size", 11)
            .attr("font-family", "var(--font-mono), monospace")
            .attr("fill", "#424754")
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
