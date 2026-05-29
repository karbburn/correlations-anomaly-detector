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

export interface InterpretationResult {
  headline: string;
  explanation: string;
  confidence: string;
  historical_context: string;
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
  interpretation?: InterpretationResult;
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
  warming_stage?: string;
  cache_status: Record<string, { fresh: boolean; rows?: number }>;
}

export interface RegimeHistoryResponse {
  pairs: string[];
  dates: string[];
  correlations: Record<string, (number | null)[]>;
  zscores: Record<string, (number | null)[]>;
}

export interface SummaryTopMover {
  pair: string;
  zscore: number;
  direction: string;
  date: string;
}

export interface SummaryResponse {
  as_of_date: string;
  total_anomalies_today: number;
  total_anomalies_week: number;
  top_movers: SummaryTopMover[];
  regime_summary: Record<string, number>;
}
