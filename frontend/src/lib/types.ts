/* ── Shared TypeScript types mirroring backend Pydantic schemas ── */

/** Single source of truth for asset names (must match backend config.py ASSETS) */
export const ASSETS = ["NIFTY50", "USDINR", "GOLD", "CRUDE", "GSEC10Y", "FII_FLOW"] as const;

export interface CorrelationMatrixResponse {
  window: number;
  as_of_date: string;
  assets: string[];
  matrix: number[][];
  zscore_matrix: number[][];
  anomaly_flags: boolean[][];
}

export interface PairTimeseriesResponse {
  pair: [string, string];
  window: number;
  dates: string[];
  correlations: number[];
  zscores: number[];
  anomaly_flags: boolean[];
}

export interface AnomalyAlert {
  date: string;
  asset1: string;
  asset2: string;
  window: number;
  correlation: number;
  zscore: number;
  historical_mean: number;
  historical_std: number;
  regime: "breakdown" | "surge";
}

export interface AlertsResponse {
  threshold: number;
  total_count: number;
  offset: number;
  limit: number;
  has_more: boolean;
  alerts: AnomalyAlert[];
}

export interface HealthResponse {
  status: string;
  startup_complete: boolean;
  cache_status: Record<string, { fresh: boolean; rows?: number }>;
}

export interface RegimeHistoryResponse {
  pairs: string[];
  dates: string[];
  regimes: Record<string, string[]>;
}
