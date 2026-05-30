/**
 * Multi-sheet Excel export using SheetJS.
 * Client-side — no backend changes needed.
 */

import * as XLSX from "xlsx";
import type { AnomalyAlert, CorrelationMatrixResponse, PairTimeseriesResponse } from "./types";

function alertsToRows(alerts: AnomalyAlert[]) {
  return alerts.map((a) => ({
    Date: a.date,
    Asset1: a.asset1,
    Asset2: a.asset2,
    Correlation: a.correlation,
    "Z-Score": a.zscore,
    "Historical Mean": a.historical_mean,
    "Historical Std": a.historical_std,
    Regime: a.regime,
    Interpretation: a.interpretation?.headline ?? "",
  }));
}

/**
 * Export anomaly alerts to a single-sheet Excel file.
 */
export function exportAlertsToExcel(
  alerts: AnomalyAlert[],
  window: number,
  threshold: number,
) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Anomaly Alerts
  const alertRows = alertsToRows(alerts);
  const ws = XLSX.utils.json_to_sheet(alertRows);

  // Auto-size columns
  const colWidths = Object.keys(alertRows[0] ?? {}).map((key) => ({
    wch: Math.max(
      key.length,
      ...alertRows.map((r) => String(r[key as keyof typeof r] ?? "").length),
    ) + 2,
  }));
  ws["!cols"] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, "Anomaly Alerts");

  const dateStr = new Date().toISOString().split("T")[0];
  XLSX.writeFile(wb, `anomalies_${window}d_z${threshold}_${dateStr}.xlsx`);
}

/**
 * Full multi-sheet export: alerts + matrix + pair drilldown.
 */
export function exportFullWorkbook(
  alerts: AnomalyAlert[],
  matrixData: CorrelationMatrixResponse | null,
  pairData: PairTimeseriesResponse | null,
  window: number,
  threshold: number,
) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Anomaly Alerts
  const alertRows = alertsToRows(alerts);
  const wsAlerts = XLSX.utils.json_to_sheet(alertRows);
  XLSX.utils.book_append_sheet(wb, wsAlerts, "Anomaly Alerts");

  // Sheet 2: Correlation Matrix
  if (matrixData) {
    const matrixRows: Record<string, string | number>[] = [];
    const assets = matrixData.assets;
    for (let i = 0; i < assets.length; i++) {
      const row: Record<string, string | number> = { Asset: assets[i] };
      for (let j = 0; j < assets.length; j++) {
        row[assets[j]] = matrixData.matrix[i]?.[j] ?? 0;
      }
      matrixRows.push(row);
    }
    const wsMatrix = XLSX.utils.json_to_sheet(matrixRows);

    // Add metadata header
    XLSX.utils.sheet_add_aoa(wsMatrix, [[`As of: ${matrixData.as_of_date} · Window: ${matrixData.window}D`]], {
      origin: { r: 0, c: assets.length + 1 },
    });

    XLSX.utils.book_append_sheet(wb, wsMatrix, "Correlation Matrix");
  }

  // Sheet 3: Pair Drilldown (if selected)
  if (pairData && pairData.dates.length > 0) {
    const pairRows = pairData.dates.map((d, i) => ({
      Date: d,
      Correlation: pairData.correlations[i] ?? null,
      "Z-Score": pairData.zscores[i] ?? null,
      Anomaly: pairData.anomaly_flags[i] ? "YES" : "",
    }));
    const wsPair = XLSX.utils.json_to_sheet(pairRows);
    XLSX.utils.book_append_sheet(wb, wsPair, `${pairData.pair[0]}_${pairData.pair[1]}`);
  }

  const dateStr = new Date().toISOString().split("T")[0];
  XLSX.writeFile(wb, `correlations_${dateStr}.xlsx`);
}
