# Cross-Asset Correlations Anomaly Detector

**Product Documentation — Version 1.0**
**Classification: Internal**

---

## 1. Purpose and Scope

This document describes the Cross-Asset Correlations Anomaly Detector, a monitoring tool designed to identify statistically significant breakdowns in historical correlation relationships across Indian and global asset classes. It is intended for portfolio managers, risk analysts, and quantitative researchers who use cross-asset correlations in their investment process.

This tool does **not** generate trading signals, predict returns, or replace existing risk models. It is an anomaly detection layer — it answers one question: *"Which cross-asset relationships have deviated from their historical norms, and by how much?"*

---

## 2. Business Context

Cross-asset correlations are a critical input to portfolio construction, hedging, and risk budgeting. However, correlations are inherently unstable. Regime shifts — triggered by monetary policy changes, commodity shocks, capital flow reversals, or geopolitical events — can invalidate correlation assumptions embedded in portfolio models within weeks.

The cost of delayed detection is asymmetric. A portfolio manager who identifies a correlation breakdown early can reassess factor exposures before drawdowns materialise. A manager who discovers the breakdown in a monthly risk report may already be three weeks into a regime that has eroded portfolio value.

This tool addresses four operational gaps:

| Gap | Current State | This Tool |
|-----|---------------|-----------|
| Detection latency | Correlation shifts surface in monthly risk reports, often 2–3 weeks after onset | Anomalies detected within hours of data availability |
| Multi-window context | Analysts view single timeframes in isolation | 30-day, 60-day, and 252-day windows presented simultaneously |
| Signal validation | No standardised framework for distinguishing noise from regime change | Z-score framework provides statistical confidence levels |
| Data fragility | Indian market data sources (FBIL, NSE) are unreliable; dashboards fail silently | Circuit breakers, cached fallbacks, and degraded-state indicators |

---

## 3. Asset Universe

The system monitors six asset classes chosen for their relevance to Indian macro portfolios:

| Asset | Identifier | Source | Rationale |
|-------|-----------|--------|-----------|
| NIFTY 50 | `^NSEI` | yfinance | Benchmark Indian equity |
| USD/INR | `INR=X` | yfinance | Currency risk proxy |
| Gold (GOLDBEES) | `GOLDBEES.NS` | yfinance | Safe-haven / inflation hedge |
| Brent Crude | `BZ=F` | yfinance | Energy cost driver for Indian corporates |
| 10Y G-Sec Yield | FBIL API | fbil.org.in | Domestic interest rate benchmark |
| FII Net Flow | NSE | nseindia.com | Foreign institutional positioning |

These six assets produce 15 unique pairwise correlations. The universe is intentionally constrained — expanding it requires adding a data fetcher, circuit breaker, interpretation rules for each new pair, and frontend updates. The current set covers the primary macro risk factors for Indian equity portfolios.

### Known Data Limitations

- **FBIL G-Sec yields** are published with a lag and have no SLA. API format changes have historically broken ingestion without warning.
- **NSE FII flows** require a two-step session-based scrape. The endpoint is not publicly documented and may change.
- **yfinance** is a third-party wrapper around Yahoo Finance. Rate limits are undocumented and enforced at the proxy level.
- **Weekend and holiday gaps** are handled by forward-filling, which can mask stale data during extended market closures.

---

## 4. Statistical Methodology

### 4.1 Rolling Pearson Correlation

For each of the 15 asset pairs, a rolling Pearson correlation coefficient is computed:

```
ρ_t = corr(X[t−w+1 … t], Y[t−w+1 … t])
```

Where `w` is the window size (30, 60, or 252 trading days). The minimum number of observations required before a correlation is reported is `max(int(w × 0.8), 10)`. This prevents spurious correlations during periods with sparse trading data.

**Important caveats:**

- Pearson correlation captures linear relationships only. Non-linear dependencies (e.g., tail dependence during crises) are not reflected.
- Rolling windows introduce lag. A genuine regime shift will not appear as anomalous until sufficient observations accumulate within the window.
- The 30-day window is the most responsive but also the most volatile. Analysts should cross-reference against the 60-day and 252-day views before drawing conclusions.

### 4.2 Z-Score Anomaly Detection

Each pair's correlation time series is converted to a rolling z-score:

```
z_t = (ρ_t − μ₂₅₂) / σ₂₅₂
```

Where `μ₂₅₂` and `σ₂₅₂` are the rolling 252-day mean and standard deviation of the correlation. A z-score measures how many standard deviations the current correlation has deviated from its one-year average.

| Parameter | Value | Notes |
|-----------|-------|-------|
| Historical window | 252 trading days | ~1 calendar year |
| Minimum periods | 60 observations | Prevents division on sparse data |
| Z-score clipping | [−10, +10] | Prevents division-by-near-zero outliers |
| Std-dev floor | 1e⁻⁶ | Values below this set to NaN |

An anomaly is flagged when `|z_t| > threshold`. The default threshold is 2.0 (configurable from 1.0 to 3.5 via the dashboard slider).

**Interpreting z-scores:**

| Z-score | Confidence | Interpretation |
|---------|------------|----------------|
| `|z| ≥ 3.0` | High | Strong statistical evidence of regime shift |
| `2.5 ≤ |z| < 3.0` | Medium | Likely meaningful; warrants monitoring |
| `|z| < 2.5` | Low | May be noise; cross-reference with other windows |

**Critical distinction:** An anomaly can occur at any correlation magnitude. A pair with `ρ = 0.2` (neutral zone) can be anomalous if its z-score exceeds the threshold — meaning the current correlation is statistically unusual *relative to its own history*, even though it falls in the neutral band. The anomaly flag and the regime classification are independent.

### 4.3 Regime Classification

Once anomaly detection is performed, each pair is classified into one of six regimes:

| Regime | Condition | Colour | Use Case |
|--------|-----------|--------|----------|
| Anomaly | `|z| > threshold` | Red | Requires investigation |
| Strong Positive | `ρ ≥ 0.7` | Dark green | Persistent co-movement |
| Mild Positive | `0.3 ≤ ρ < 0.7` | Light green | Moderate co-movement |
| Neutral | `−0.3 < ρ < 0.3` | Grey | No meaningful relationship |
| Mild Negative | `−0.7 < ρ ≤ −0.3` | Light red | Moderate inverse relationship |
| Strong Negative | `ρ ≤ −0.7` | Dark red | Persistent inverse relationship |

Regime classification is threshold-independent. The dashboard reclassifies all pairs client-side when the user adjusts the threshold slider, enabling real-time exploration without server round-trips.

### 4.4 Interpretation Engine

A deterministic rule-based system (no machine learning) generates plain-English explanations for each anomaly. Every one of the 15 asset pairs has hand-written rules for both positive-z ("surge") and negative-z ("breakdown") scenarios, grounded in known macro drivers.

**Examples:**

> **NIFTY50–CRUDE breakdown:** "India is a net oil importer, so NIFTY-CRUDE decoupling often signals domestic growth resilience despite oil price moves, or supply-driven oil shocks that haven't yet transmitted to corporate earnings."

> **USDINR–GSEC10Y surge:** "Rising yields attracting carry trade flows that strengthen INR — the classic interest rate parity channel."

The engine also scans historical data for precedents — the last time the same pair exceeded the current threshold in the same direction — and reports the date and magnitude.

**Limitations of the interpretation engine:**

- Explanations are templated, not causal. They describe plausible macro narratives, not confirmed drivers.
- The engine does not incorporate real-time macroeconomic data (e.g., RBI policy announcements, OPEC meetings).
- Historical precedent matching is purely statistical; it does not account for structural changes in market microstructure.

---

## 5. Dashboard and User Interface

### 5.1 Visualisation Zones

**Correlation Matrix** — A 6×6 heatmap encoding Pearson coefficients via a red-to-green colour scale. Cells where the z-score exceeds the user's threshold pulse with an amber border. Clicking any cell populates the pair drilldown. On mobile screens (< 768px), replaced by a ranked list sorted by absolute z-score.

**Anomaly Feed** — A chronological log of all anomaly events (25 per page) with date, pair, correlation, z-score, historical mean, historical standard deviation, and regime classification. Each row expands to reveal an interpretation card. Exportable to CSV and XLSX.

**Pair Drilldown** — A dual-axis chart showing the historical rolling correlation (green, left axis) against the z-score (amber dashed, right axis). Red horizontal reference lines mark the user's threshold boundaries.

**Regime Timeline** — A heat calendar with 15 rows (one per pair) and one column per trading day. Colour-coded by regime. Threshold-independent: classification updates client-side when the threshold slider changes.

**Summary Overlay** — Dashboard header displays today's anomaly count, top-5 movers by absolute z-score, and regime distribution across all 15 pairs.

### 5.2 Configuration Controls

| Control | Range | Default | Behaviour |
|---------|-------|---------|-----------|
| Window selector | 30 / 60 / 252 | 60 | Triggers full data refetch from cache |
| Threshold slider | 1.0 – 3.5 | 2.0 | Debounced at 300ms; reclassifies regimes client-side |
| Theme toggle | Dark / Light | Dark | Respects system `prefers-color-scheme` |

### 5.3 Shareable State

All dashboard parameters are serialised to URL query parameters. A user can copy the URL to share an exact view with a colleague. Parameters: `w` (window), `z` (threshold), `pair` (selected pair), `range` (timeline date range).

---

## 6. Data Pipeline and Reliability

### 6.1 Ingestion Architecture

All six assets are fetched concurrently using a thread pool (3 workers): one batched yfinance call, one FBIL request, one NSE session. Total fetch time is approximately 35 seconds (vs. ~90 seconds serial).

### 6.2 Fallback Hierarchy

Every data source implements a four-tier fallback chain:

1. **Primary fetch** — Source API with tenacity retry (3 attempts, exponential backoff).
2. **Circuit breaker** — After 3 consecutive failures, the source is skipped for a 1-hour cooldown period.
3. **Stale Parquet cache** — The last known-good dataset is served from disk. A staleness flag is set in the health endpoint.
4. **Synthetic data** — A seeded random number generator produces statistically plausible data. The health endpoint reflects the degraded state.

This ensures the dashboard remains operational through upstream outages. However, **synthetic data is not real data** — operators should monitor the health endpoint and investigate when synthetic fallback is active.

### 6.3 Data Quality Validation

Any asset column where more than 20% of values are missing is rejected. This prevents the correlation engine from operating on sparse data that would produce misleading results.

### 6.4 Cache Strategy

| Layer | Store | Validity | Eviction |
|-------|-------|----------|----------|
| L1 | Python dict (in-memory) | Until next refresh | Cleared on restart |
| L2 | Parquet files on disk | 2 hours from mtime | Overwritten on refresh |
| API | HTTP Cache-Control | 5 min + 1 min stale-while-revalidate | Browser/proxy cache |

The server pre-warms on startup. If Parquet cache is less than 2 hours old, data is served immediately and refreshed asynchronously. Otherwise, a full fetch-and-recompute cycle runs before the dashboard becomes available (~30–60 seconds).

---

## 7. Production Operations

### 7.1 Deployment Architecture

| Component | Platform | Configuration |
|-----------|----------|---------------|
| Backend | Render (Docker) | Single worker (`workers=1`), health check at `/api/health` |
| Frontend | Vercel | API proxy via `next.config.ts` rewrite |
| CI/CD | GitHub Actions | Lint + test on push to `main` |

The backend runs as a single process because the in-memory cache, APScheduler, and circuit-breaker state are process-local. Multiple replicas behind a load balancer each independently warm their cache.

### 7.2 Monitoring

The `GET /api/health` endpoint exposes:

- Cache freshness (row counts per window, staleness flags for G-Sec, FII, and prices)
- Data quality (missing percentage per asset, healthy flag at < 20%)
- Circuit breaker states (current state, failure count, time since last failure)
- Warming stage (`idle` → `loading_cache` → `fetching` → `computing` → `ready`)
- Scheduler runtime state

**Operators should monitor:**

| Metric | Threshold | Action |
|--------|-----------|--------|
| `gsec_stale` = true | Any duration | Check FBIL API availability; fallback to Parquet is automatic |
| `fii_stale` = true | Any duration | Check NSE endpoint; fallback to Parquet is automatic |
| Circuit breaker state = OPEN | > 1 hour | Investigate upstream source; consider manual data refresh |
| Synthetic data active | Any duration | Investigate all upstream sources; dashboard is showing synthetic data |
| `warming_stage` ≠ `ready` | > 5 minutes | Backend may be stuck; check logs for data fetch errors |

### 7.3 Email Digests

When configured, a weekly HTML digest is sent every Monday at 08:00 (configurable via `ALERT_SCHEDULE_CRON`). Contains the top-5 movers by absolute z-score with a link to the dashboard. Degrades gracefully if the email provider is unavailable.

### 7.4 Rate Limiting

100 requests per minute per client IP. Exceeded requests receive a `429` response with a `Retry-After` header.

---

## 8. Known Limitations and Risk Considerations

### 8.1 Statistical Limitations

| Limitation | Impact | Mitigation |
|-----------|--------|------------|
| Pearson correlation captures linear relationships only | Non-linear dependencies (tail dependence) are invisible | Use alongside copula-based or rank correlation methods |
| Rolling window introduces lag | Regime shifts are not detected until sufficient observations accumulate | Cross-reference across 30/60/252-day windows |
| Z-score assumes approximately normal distribution | Fat-tailed correlation distributions may produce false positives | Z-score clipping at ±10; threshold is user-adjustable |
| 252-day historical window | May include data from a different regime, diluting the z-score | Consider shorter historical windows for highly regime-dependent pairs |

### 8.2 Data Limitations

| Limitation | Impact | Mitigation |
|-----------|--------|------------|
| FBIL and NSE sources have no SLA | Ingestion may fail without warning | Circuit breakers + Parquet fallback + synthetic data |
| yfinance rate limits are undocumented | Batch fetch may be throttled during high-volume periods | Tenacity retry with exponential backoff |
| Weekend/holiday gaps are forward-filled | Stale data may persist during extended market closures | Health endpoint exposes staleness flags |
| Data starts from 2020-01-01 by default | Correlation statistics for 252-day windows are based on ~5 years of data | Configurable via `DATA_START_DATE` |

### 8.3 Operational Limitations

| Limitation | Impact | Mitigation |
|-----------|--------|------------|
| Single-process deployment (`workers=1`) | Cannot scale horizontally without external cache | Multiple replicas each warm independently |
| No authentication | Dashboard is publicly accessible if exposed | Deploy behind reverse proxy or Vercel auth middleware |
| In-memory cache cleared on restart | 30–60 second cold-start penalty | Parquet persistence reduces warm-up time |
| Interpretation engine is rule-based, not ML | Cannot adapt to novel correlation patterns | Planned: ML-based regime clustering (see Section 9) |

### 8.4 What This Tool Is NOT

- **Not a trading signal generator.** Anomalies indicate statistical deviations, not direction or magnitude of future returns.
- **Not a risk model.** It does not compute VaR, expected shortfall, or factor exposures.
- **Not a substitute for judgement.** The interpretation engine provides plausible macro narratives, not confirmed causal explanations.
- **Not real-time.** Data is updated daily; intraday correlation monitoring is not supported.

---

## 9. Extensibility Roadmap

| Initiative | Description | Dependencies |
|-----------|-------------|-------------|
| Additional asset classes | Add fetchers for fixed income spreads, sector indices, or commodities | New data source validation, interpretation rules |
| Webhook alerts | Push anomaly notifications to Slack, PagerDuty, or email | Notification service, scheduler integration |
| ML-based regime clustering | HMM or Gaussian mixture model to identify non-linear regime states | Raw z-score dataframe is already persisted; model training infrastructure |
| Historical backtesting | Evaluate hypothetical thresholds against cached correlation history | `/api/backtest` endpoint; measure false positives, detection lag |
| Multi-user authentication | Enable saved views, per-user thresholds, and access control | Auth proxy or Vercel Middleware |
| Intraday monitoring | Extend to intraday data for real-time regime detection | Higher-frequency data sources, increased compute requirements |

---

## 10. Appendix: Configuration Reference

### Backend Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `HOST` | No | `0.0.0.0` | Server bind address |
| `PORT` | No | `8000` | Server port |
| `ALLOWED_ORIGINS` | Yes | `http://localhost:3000` | Comma-separated CORS origins |
| `DATA_START_DATE` | No | `2020-01-01` | Historical data start date |
| `CACHE_DIR` | No | `data/cache` | Parquet cache directory |
| `DEFAULT_WINDOW` | No | `60` | Default rolling window (days) |
| `DEFAULT_THRESHOLD` | No | `2.0` | Default z-score threshold |
| `HIST_WINDOW` | No | `252` | Historical window for z-score statistics |
| `LOG_FORMAT` | No | `text` | `text` or `json` |
| `LOG_LEVEL` | No | `INFO` | Logging level |
| `RETRY_MAX_ATTEMPTS` | No | `3` | Retry attempts per source |
| `CIRCUIT_BREAKER_FAILURES` | No | `3` | Consecutive failures to open circuit |
| `CIRCUIT_BREAKER_COOLDOWN` | No | `3600` | Cooldown before half-open (seconds) |
| `RESEND_API_KEY` | No | — | Resend API key (weekly digest) |
| `ALERT_RECIPIENTS` | No | — | Comma-separated email recipients |
| `ALERT_SCHEDULE_CRON` | No | `0 8 * * 1` | Cron expression for digest schedule |
| `DASHBOARD_URL` | No | `http://localhost:3000` | Link in digest emails |

### Frontend Environment Variable

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | No | Render backend URL | API base URL override |

---

*Document maintained by the Quantitative Strategy team. For questions, contact the team lead.*
