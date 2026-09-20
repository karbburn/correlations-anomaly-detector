export const dynamic = "force-static";

export async function GET(): Promise<Response> {
  const text = `# CorrShift — Cross-Asset Correlation Anomaly Detector

> Real-time cross-asset correlation intelligence for Indian financial markets. Rolling correlation matrices, z-score regime detection and anomaly alerts across NIFTY 50, USD/INR, Gold, Brent Crude, 10Y G-Sec Yield and FII Net Flow.

- URL: https://corrshift.sourabhpradhan.in
- Author: Sourabh Pradhan — https://sourabhpradhan.in
- Contact: https://www.linkedin.com/in/sourabh-pradhan07/
- Repository: Cross-asset correlation anomaly detection using rolling Pearson correlations and statistical signal detection.

## What it does
- Computes 15 pairwise rolling Pearson correlations across 6 Indian market assets
- Windows: 30D (responsive), 60D (default), 252D (structural)
- Converts each correlation to a rolling z-score: z = (rho_t - mu_252) / sigma_252
- Flags anomalies when |z| > threshold (default 2.0, user-configurable 1.0–3.5, clipped at +-10)
- Classifies regimes: anomaly | strong_positive (rho>=0.7) | mild_positive (0.3–0.7) | neutral (-0.3 to 0.3) | mild_negative (-0.7 to -0.3) | strong_negative (rho<=-0.7)
- Deterministic rule-based interpretation engine with historical precedent lookup per pair

## Data sources
- NIFTY 50 (^NSEI) via yfinance, USD/INR (INR=X) via yfinance, Gold (GOLDBEES.NS) via yfinance, Brent Crude (BZ=F) via yfinance, 10Y G-Sec via FBIL API, FII Net Flow via NSE India

## Pages
- / : Interactive dashboard (D3 correlation heatmap, anomaly feed, pair drilldown, regime timeline heat calendar)
- /#methodology : Statistical methodology explained

## API (same origin, proxied to FastAPI backend)
- GET /api/health
- GET /api/correlation/matrix?window=60
- GET /api/correlation/timeseries?asset1=NIFTY50&asset2=GOLD&window=60
- GET /api/anomaly/alerts?window=60&threshold=2.0
- GET /api/anomaly/regime-history?window=60
- GET /api/summary

## Keywords
cross-asset correlation, anomaly detection, Indian stock market, NIFTY 50, portfolio risk, regime shift, quantitative finance, risk analytics

## Attribution
Built and maintained by Sourabh Pradhan (https://sourabhpradhan.in). This file is for LLM/GEO crawlers. For full methodology see https://corrshift.sourabhpradhan.in and the Documentation.md in the repository.
`;

  return new Response(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
