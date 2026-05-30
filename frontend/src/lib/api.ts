import type {
  CorrelationMatrixResponse,
  PairTimeseriesResponse,
  AlertsResponse,
  HealthResponse,
  RegimeHistoryResponse,
  SummaryResponse,
} from "./types";

async function apiFetch<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  const url = new URL(path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) {
      const text = await res.text().catch(() => "Unknown error");
      throw new Error(`API ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/api/health");
}

export async function fetchCorrelationMatrix(
  window: number,
  date?: string,
): Promise<CorrelationMatrixResponse> {
  const params: Record<string, string | number> = { window };
  if (date) params.date = date;
  return apiFetch<CorrelationMatrixResponse>("/api/correlation/matrix", params);
}

export async function fetchPairTimeseries(
  asset1: string,
  asset2: string,
  window: number,
  start?: string,
): Promise<PairTimeseriesResponse> {
  const params: Record<string, string | number> = { asset1, asset2, window };
  if (start) params.start = start;
  return apiFetch<PairTimeseriesResponse>("/api/correlation/timeseries", params);
}

export async function fetchAnomalyAlerts(
  window: number,
  threshold: number,
  offset: number = 0,
  limit: number = 50,
  start?: string,
  interpret: boolean = false,
): Promise<AlertsResponse> {
  const params: Record<string, string | number> = { window, threshold, offset, limit };
  if (start) params.start = start;
  if (interpret) params.interpret = "true";
  return apiFetch<AlertsResponse>("/api/anomaly/alerts", params);
}

export async function fetchRegimeHistory(
  window: number,
): Promise<RegimeHistoryResponse> {
  return apiFetch<RegimeHistoryResponse>("/api/anomaly/regime-history", { window });
}

export async function fetchSummary(): Promise<SummaryResponse> {
  return apiFetch<SummaryResponse>("/api/summary");
}
