"use client";
import { useEffect, useRef, useCallback, memo, useMemo } from "react";
import { select } from "d3-selection";
import { scaleLinear } from "d3-scale";
import { ASSET_LABELS } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { getCssVarCached } from "@/lib/css";

function relativeLuminance(hex: string): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = toLinear(parseInt(hex.slice(1, 3), 16));
  const g = toLinear(parseInt(hex.slice(3, 5), 16));
  const b = toLinear(parseInt(hex.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrastRatio(l1: number, l2: number): number {
  const [a, b] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (a + 0.05) / (b + 0.05);
}
function getAccessibleTextColor(bgHex: string): string {
  const lumBg = relativeLuminance(bgHex);
  const lumDark = relativeLuminance("#1a1a1a");
  const lumLight = relativeLuminance("#ffffff");
  const cDark = contrastRatio(lumBg, lumDark);
  const cLight = contrastRatio(lumBg, lumLight);
  if (cDark >= 4.5 && cDark >= cLight) return "#1a1a1a";
  if (cLight >= 4.5) return "#ffffff";
  return cDark > cLight ? "#1a1a1a" : "#ffffff";
}

interface Props {
  assets: string[];
  matrix: (number | null)[][];
  zscoreMatrix: (number | null)[][];
  threshold: number;
  onPairSelect: (a1: string, a2: string) => void;
}

export const CorrelationMatrix = memo(function CorrelationMatrix({
  assets,
  matrix,
  zscoreMatrix,
  threshold,
  onPairSelect,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const theme = useAppStore((s) => s.theme);

  const themeVars = useMemo(() => ({
    accentPrimary: getCssVarCached("--accent-primary", theme, theme === "light" ? "#047857" : "#10b981"),
    accentAmber: getCssVarCached("--accent-amber", theme, theme === "light" ? "#b45309" : "#f59e0b"),
    bgElevated: getCssVarCached("--bg-elevated", theme, theme === "light" ? "#ede8df" : "#0d1f18"),
    borderDefault: getCssVarCached("--border-default", theme, theme === "light" ? "#d4cfc6" : "#1a3a2e"),
    textMuted: getCssVarCached("--text-muted", theme, theme === "light" ? "#6b6b6b" : "#5eead4"),
    textDim: getCssVarCached("--text-dim", theme, theme === "light" ? "#999999" : "#2dd4bf"),
    corrNegative: getCssVarCached("--corr-negative", theme, theme === "light" ? "#9a3412" : "#c2410c"),
    corrPositive: getCssVarCached("--corr-positive", theme, theme === "light" ? "#2563eb" : "#60a5fa"),
  }), [theme]);
  const { accentPrimary, accentAmber, bgElevated, borderDefault, textMuted, textDim, corrNegative, corrPositive } = themeVars;

  const prevThresholdRef = useRef(threshold);
  const render = useCallback(() => {
    if (!svgRef.current || !matrix.length || !assets.length) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const svgEl = svgRef.current as SVGSVGElement & { __thresholdOnly?: boolean };
    const thresholdOnly = svgEl.children.length > 0 && prevThresholdRef.current !== threshold;
    if (thresholdOnly) {
      const root = select(svgEl);
      assets.forEach((a1, i) => {
        assets.forEach((a2, j) => {
          if (i === j) return;
          const z = zscoreMatrix[i]?.[j];
          const hasData = matrix[i]?.[j] != null && z != null;
          const isAnomaly = hasData && Math.abs(z as number) > threshold;
          const idx = i * assets.length + j;
          const cell = root.selectAll<SVGGElement, unknown>(`g.cell-${idx}`);
          if (cell.empty()) return;
          cell.select("rect.anomaly-frame").attr("stroke", isAnomaly ? accentAmber : "none").attr("stroke-width", isAnomaly ? 2 : 0).style("display", isAnomaly ? null : "none");
          cell.selectAll("polygon.anomaly-corner").style("display", isAnomaly ? null : "none");
          cell.select("text.z-label").attr("fill", isAnomaly ? accentAmber : textMuted);
          if (isAnomaly) {
            cell.select("rect.anomaly-frame").selectAll("animate").empty() || (() => {})();
          }
        });
      });
      prevThresholdRef.current = threshold;
      return;
    }

    const n = assets.length;
    const cellSize = 76;
    const margin = { top: 70, right: 20, bottom: 20, left: 90 };
    const width = n * cellSize + margin.left + margin.right;
    const height = n * cellSize + margin.top + margin.bottom;

    const svg = select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`);
    svg.attr("role", "group");
    svg.attr("aria-label", "Correlation matrix heatmap. Press Tab to navigate cells, Enter to select a pair.");



    const colorScale = scaleLinear<string>()
      .domain([-1, 0, 1])
      .range([corrNegative, bgElevated, corrPositive]);

    const highlightCell = function (this: SVGGElement) {
      select(this)
        .select("rect")
        .transition()
        .duration(150)
        .attr("opacity", 1)
        .attr("stroke", accentPrimary)
        .attr("stroke-width", 1.5);
    };
    const focusCell = function (this: SVGGElement) {
      select(this)
        .select("rect")
        .transition()
        .duration(150)
        .attr("opacity", 1)
        .attr("stroke", accentPrimary)
        .attr("stroke-width", 2);
    };
    const restCell =
      (isAnomaly: boolean) =>
      function (this: SVGGElement) {
        select(this)
          .select("rect")
          .transition()
          .duration(150)
          .attr("opacity", 0.9)
          .attr("stroke", isAnomaly ? accentAmber : "none")
          .attr("stroke-width", isAnomaly ? 2 : 0);
      };

    const label = (asset: string) => ASSET_LABELS[asset] ?? asset;

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    assets.forEach((asset, i) => {
      g.append("text")
        .attr("x", -12)
        .attr("y", i * cellSize + cellSize / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "end")
        .attr("font-size", 10)
        .attr("font-family", "var(--font-mono), monospace")
        .attr("fill", textMuted)
        .text(label(asset));
    });

    assets.forEach((asset, i) => {
      g.append("text")
        .attr("x", i * cellSize + cellSize / 2)
        .attr("y", -14)
        .attr("text-anchor", "middle")
        .attr("font-size", 10)
        .attr("font-family", "var(--font-mono), monospace")
        .attr("fill", textMuted)
        .text(label(asset));
    });

    assets.forEach((a1, i) => {
      assets.forEach((a2, j) => {
        const val = i < matrix.length ? matrix[i]?.[j] : undefined;
        const z = i < zscoreMatrix.length ? zscoreMatrix[i]?.[j] : undefined;
        const hasData = val != null && z != null;
        const isAnomaly = hasData && Math.abs(z) > threshold;
        const isDiag = i === j;

        const cell = g
          .append("g")
          .attr("class", `cell-${i * assets.length + j}`)
          .attr("transform", `translate(${j * cellSize},${i * cellSize})`)
          .style("cursor", isDiag || !hasData ? "default" : "pointer");

        if (!isDiag && hasData) {
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
          .attr("fill", isDiag ? bgElevated : hasData ? colorScale(val) : bgElevated)
          .attr("opacity", isDiag ? 0.7 : 0.9)
          .attr("stroke", isDiag ? borderDefault : "none")
          .attr("stroke-width", isDiag ? 1 : 0);

        if (!isDiag && hasData) {
          cell
            .on("mouseenter", highlightCell)
            .on("mouseleave", restCell(isAnomaly))
            .on("focus", focusCell)
            .on("blur", restCell(isAnomaly));
        }

        if (!isDiag) {
          const anomalyRect = cell
            .append("rect")
            .attr("class", "anomaly-frame")
            .attr("width", cellSize - 2)
            .attr("height", cellSize - 2)
            .attr("rx", 0)
            .attr("fill", "none")
            .attr("stroke", isAnomaly ? accentAmber : "none")
            .attr("stroke-width", isAnomaly ? 2 : 0)
            .style("display", isAnomaly ? null : "none");

          if (!prefersReducedMotion && isAnomaly) {
            anomalyRect
              .append("animate")
              .attr("attributeName", "opacity")
              .attr("values", "1;0.2;1")
              .attr("dur", "2s")
              .attr("repeatCount", "indefinite");
          }

          cell
            .append("polygon")
            .attr("class", "anomaly-corner")
            .attr("points", `${cellSize - 15},0 ${cellSize - 2},0 ${cellSize - 2},13`)
            .attr("fill", accentAmber)
            .style("display", isAnomaly ? null : "none");
        }

        if (!isDiag) {
          if (!hasData) {
            cell
              .append("text")
              .attr("x", (cellSize - 2) / 2)
              .attr("y", (cellSize - 2) / 2)
              .attr("dy", "0.35em")
              .attr("text-anchor", "middle")
              .attr("font-size", 11)
              .attr("font-family", "var(--font-mono), monospace")
              .attr("fill", textDim)
              .text("—");
          } else {
            const bgColor = colorScale(val);
            const textColor = getAccessibleTextColor(bgColor);

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
              .attr("class", "z-label")
              .attr("x", (cellSize - 2) / 2)
              .attr("y", (cellSize - 2) / 2 + 14)
              .attr("text-anchor", "middle")
              .attr("font-size", 9)
              .attr("font-family", "var(--font-mono), monospace")
              .attr("fill", isAnomaly ? accentAmber : textMuted)
              .text(`z=${z.toFixed(1)}`);
          }
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
    prevThresholdRef.current = threshold;
  }, [assets, matrix, zscoreMatrix, threshold, onPairSelect, theme, themeVars]);

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
