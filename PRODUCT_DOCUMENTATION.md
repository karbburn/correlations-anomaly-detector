# Cross-Asset Correlations Anomaly Detector

**Product Documentation**

A real-time monitoring system that tracks rolling Pearson correlations across six Indian and global asset classes and detects anomalous regime shifts using statistical z-score analysis. Purpose-built for macro traders, quantitative analysts, portfolio managers, and investment researchers who need to identify when long-standing cross-asset relationships break down.

---

## Executive Summary

The Cross-Asset Correlations Anomaly Detector is a full-stack, production-grade application that continuously computes pairwise correlations across six major asset classes – NIFTY50, USD/INR, Gold, Brent Crude, 10-Year Indian Government Security yields, and FII net flows – across three rolling time windows (30, 60, and 252 days). It surfaces statistically significant deviations from historical norms using a rolling z-score framework and visualises the results through an interactive, accessibility-compliant dashboard built with D3 and Recharts.

The system is designed for graceful degradation: every data source has at least two fallback layers, from circuit-breaker isolation to stale cache serving to synthetic data generation with seeded random number generators. This ensures the dashboard remains operational even when upstream data providers experience outages.

---

## Problem Statement

Cross-asset correlations are not stationary. Relationships that hold for years can break down in weeks during regime shifts – sudden policy changes, commodity price shocks, capital flow reversals, or geopolitical events. Traditional portfolio risk models that assume stable correlations systematically underestimate tail risk.

The core challenges this product addresses:

- **Detection latency:** By the time a correlation breakdown appears in standard risk reports, the regime shift may already be weeks old.
- **Signal-to-noise ratio:** Short-term correlation noise makes it difficult to distinguish genuine regime shifts from statistical sampling variation.
- **Multi-window context:** A breakdown visible in a 30-day window may be normal in a 252-day context. Analysts need all three views simultaneously.
- **Operational fragility:** Data sources for Indian markets (FBIL for G-Sec yields, NSE for FII flows) have no SLA guarantees and frequently change API formats. The system must absorb these failures transparently.

---

## Solution Overview

The system ingests daily data from three independent sources (yfinance, FBIL API, NSE two-step session), normalises them into a unified returns dataframe, computes all 15 pairwise rolling correlations across three window sizes, and flags any pair whose current z-score exceeds a configurable threshold. Anomalies are enriched with a rule-based interpretation engine that generates plain-English explanations grounded in known macro drivers for each asset pair.

Three key design decisions distinguish the approach:

**Pre-computation on startup.** All three correlation windows and their corresponding z-score distributions are computed once during the startup lifecycle, then served from an in-memory cache backed by Parquet persistence. The first request is slow (~30-60s), but all subsequent requests complete in under 100ms.

**Threshold-independence.** The regime-history endpoint returns raw z-scores and correlations, not pre-classified regimes. The frontend re-classifies client-side when the user adjusts the threshold slider, enabling real-time exploration without server round-trips.

**Graceful degradation-first.** Every external data source is wrapped in a circuit breaker with configurable failure thresholds. When a source is unavailable, the system falls back first to stale Parquet cache, then to synthetic data with a seeded PRNG. The health endpoint exposes the degradation state so operators can act without user complaints.

---

## Architecture

```
                          Frontend (Next.js 16 + React 19 + TypeScript)
    ┌──────────────────────────────────────────────────────────────────────────┐
    │                                                                          │
    │  Correlation    Anomaly Feed     Pair Drilldown    Regime Timeline       │
    │  Matrix (D3)    (Table + CSV/    (Recharts Dual-   (D3 Heat Calendar)    │
    │                 XLSX Export)      Axis Chart)                            │
    │                                                                          │
    │  ┌────────────────────────────────────────────────────────────────────┐  │
    │  │  TanStack React Query (5min staleTime) + Zustand (local state)     │  │
    │  │  nuqs URL params (w, z, pair, range – shareable dashboard state)   │  │
    │  └────────────────────────────────────────────────────────────────────┘  │
    └────────────────────────────────┬─────────────────────────────────────────┘
                                     │ REST (JSON) over HTTP
    ┌────────────────────────────────┼─────────────────────────────────────────┐
    │                     Backend (FastAPI / Python 3.11)                       │
    │                                                                          │
    │  ┌────────────────────────────┴──────────────────────────────────────┐   │
    │  │                    API Routers                                     │   │
    │  │  GET /api/health                          – health + cache status  │   │
    │  │  GET /api/correlation/matrix              – 6x6 snapshot w/ z-    │   │
    │  │  GET /api/correlation/timeseries          – pair drilldown        │   │
    │  │  GET /api/anomaly/alerts                  – paginated alerts      │   │
    │  │  GET /api/anomaly/regime-history          – threshold-independent │   │
    │  │  GET /api/summary                         – dashboard overview    │   │
    │  └───────────┬──────────────────┬────────────────────────────────────┘   │
    │              │                  │                                        │
    │  ┌───────────┴──────┐  ┌───────┴────────────────────────────────────┐   │
    │  │   Cache Layer    │  │          Service Layer                      │   │
    │  │  - In-memory dict│  │  correlation_engine.py (vectorised pandas)  │   │
    │  │  - Parquet files │  │  anomaly_detector.py (rolling z-score,      │   │
    │  │  - Thread-safe   │  │    min_periods=60, clip to +/-10)           │   │
    │  │    locks         │  │  interpretation.py (rule-based, 15 pairs ×  │   │
    │  └──────────────────┘  │    2 regimes, confidence scoring)           │   │
    │                        │  email_service.py (Resend weekly digest)    │   │
    │                        └───────┬────────────────────────────────────┘   │
    │                                │                                        │
    │  ┌─────────────────────────────┴────────────────────────────────────┐   │
    │  │                 Data Ingestion Layer                              │   │
    │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                         │   │
    │  │  │ yfinance │  │ FBIL API │  │  NSE FII  │                         │   │
    │  │  │ 4 assets │  │ G-Sec    │  │ 2-step    │                         │   │
    │  │  │          │  │ yields   │  │ session   │                         │   │
    │  │  └────┬─────┘  └────┬─────┘  └────┬─────┘                         │   │
    │  │       │              │             │                                │   │
    │  │  ┌────┴─────┐  ┌────┴─────┐  ┌────┴─────┐                          │   │
    │  │  │ Circuit  │  │ Circuit  │  │ Circuit  │                          │   │
    │  │  │ Breaker  │  │ Breaker  │  │ Breaker  │                          │   │
    │  │  │ yfinance │  │ gsec     │  │ fii      │                          │   │
    │  │  └──────────┘  └──────────┘  └──────────┘                          │   │
    │  │     3 failures → OPEN → 1h HALF_OPEN cooldown                      │   │
    │  └────────────────────────────────────────────────────────────────────┘   │
    │                                                                          │
    │  ┌────────────────────────────────────────────────────────────────────┐   │
    │  │  APScheduler – hourly refresh, weekly Monday 8AM email digest      │   │
    │  └────────────────────────────────────────────────────────────────────┘   │
    │                                                                          │
    │  ┌────────────────────────────────────────────────────────────────────┐   │
    │  │  Middleware: SlowAPI (100 req/min rate limit), GZip (>1KB),        │   │
    │  │              CORS (comma-separated origins), Structured JSON logs  │   │
    │  └────────────────────────────────────────────────────────────────────┘   │
    └──────────────────────────────────────────────────────────────────────────┘
```

### Architectural Rationale

The in-memory cache architecture (a single Python dict with threading locks) is deliberately non-distributed: correlation computations are idempotent and periodic (hourly recomputation), so horizontal scaling through a shared-nothing pattern with identical compute per pod is trivial. The Gunicorn configuration enforces `workers=1` because the in-memory store, APScheduler instance, and circuit breaker state cannot be shared across processes. Multiple replicas behind a load balancer each independently warm their cache.

---

## Dashboard Walkthrough

### Loading and Warmup

A user navigating to the dashboard URL first sees a BackendStatus loading screen. During this 30- to 60-second period, the backend is executing its startup lifecycle: loading the last-known-good correlation cache from Parquet files on disk, fetching fresh data from all six upstream sources (yfinance, FBIL, and NSE) in parallel, recomputing all 15 pairwise rolling correlations across three windows, and running the z-score anomaly detection pipeline. The health endpoint (`GET /api/health`) exposes the current `warming_stage`, which transitions through `loading_cache`, `fetching`, `computing`, and finally `ready`. Once the backend signals ready, the frontend fetches all data and the dashboard materialises.

### Dashboard Layout

The full dashboard is organised into three vertical zones. A fixed header bar at the top contains the application title, a summary overlay displaying today's anomaly count, the top-5 movers by absolute z-score, a breakdown of how the 15 pairs are distributed across the six regime labels, and the configuration controls. The main content area occupies the centre, with the correlation matrix positioned front and centre and the anomaly feed to its right. Below both, the regime timeline heat calendar spans the full width of the page.

### Correlation Matrix

The correlation matrix is a 6x6 D3 SVG heatmap where each cell encodes the Pearson correlation coefficient for a pair of assets via a red-to-green colour scale: red represents −1 (perfect negative correlation) and green represents +1 (perfect positive correlation). Cells where the current z-score exceeds the user's configured threshold pulse with an amber border, immediately drawing the eye to statistically unusual relationships. The matrix is fully keyboard-navigable with ARIA grid roles, and on screens narrower than 768 px it collapses to a ranked list sorted by absolute z-score.

### Pair Drilldown

Clicking any cell in the correlation matrix selects that asset pair and populates the drilldown chart immediately below the matrix. The drilldown is a Recharts dual-axis ComposedChart: a green line against the left Y-axis tracks the historical rolling correlation, while an amber dashed line against the right Y-axis tracks the z-score. Red horizontal reference lines mark the user's threshold boundaries. Hovering reveals precise values. A close button dismisses the drilldown.

### Anomaly Feed

On the right side of the dashboard, a paginated table lists all anomaly events chronologically (25 per page). Each row displays the date, asset pair, correlation coefficient, z-score, historical mean and standard deviation, and regime classification. Rows can be expanded inline to reveal a rule-based interpretation card: plain-English explanations grounded in known macro drivers for the specific asset pair and direction (surge or breakdown), with a confidence level derived from the z-score magnitude. The feed supports CSV and XLSX export. Filtering by window or threshold resets pagination.

### Regime Timeline

At the bottom of the dashboard, a D3 heat calendar displays 15 rows (one per asset pair) and a column per trading day. Each cell is colour-coded by regime: anomaly (red), strong positive (dark green), mild positive (light green), neutral (grey), mild negative (light red), or strong negative (dark red). The timeline is threshold-independent: classification happens on the client side when the user adjusts the threshold slider, enabling real-time exploration without server round-trips.

### Configuration Controls

The header bar provides four controls:

| Control | Type | Default | Behaviour |
|---------|------|---------|-----------|
| Window selector | Radio group (30 / 60 / 252) | 60D | Triggers full data refetch from cache |
| Threshold slider | Continuous, 1.0 to 3.5 | 2.0 | Debounced at 300ms; reclassifies regimes client-side |
| Theme toggle | Dark/Light | Dark | CSS class toggle on `<html>`, respects `prefers-color-scheme` |
| Methodology modal | Button [?] | – | In-page modal explaining the math and data sources |

### Shareable State

All dashboard parameters (window, threshold, selected pair, date range) are serialised to URL query parameters via the `nuqs` library. A user can copy the URL to share an exact view. The parameters are:

- `w` – window (30, 60, 252)
- `z` – threshold (float, e.g., 2.5)
- `pair` – selected pair (e.g., `NIFTY50__GOLD`)
- `range` – visible date range for the timeline (e.g., `2Y`)

### CLI Tool

A Click-based CLI (`backend/detect.py`) enables offline analysis without starting the server. Three modes:

```bash
# Print correlation matrix for today
python detect.py --matrix --window 60

# Drilldown on a specific pair
python detect.py --pair NIFTY50 GOLD --window 30

# Full anomaly detection with CSV export
python detect.py --window 252 --threshold 2.5 --output alerts.csv
```

The CLI fetches fresh data from upstream sources on every invocation, so it can run independently in scheduled batch jobs.

---

## Data Pipeline

### Source Architecture

| Asset | Ticker / Source | Transformation | Data Type |
|-------|-----------------|----------------|-----------|
| NIFTY50 | `^NSEI` (yfinance) | `pct_change()` log return | Daily close |
| USD/INR | `INR=X` (yfinance) | `pct_change()` log return | Daily close |
| Gold | `GOLDBEES.NS` (yfinance) | `pct_change()` log return | Daily close |
| Brent Crude | `BZ=F` (yfinance) | `pct_change()` log return | Daily futures close |
| 10Y G-Sec Yield | FBIL API (`fbil.org.in`) | First-difference of yield level | Daily benchmark yield |
| FII Net Flow | NSE (`nseindia.com`/api/fiidiiTradeReact) | Z-score normalised over 252-day rolling window | Daily net FII value (INR Cr) |

The four price-based assets use daily log returns computed via `pandas.Series.pct_change()`. GSEC10Y uses first-differences because yields are already rates (not prices). FII_FLOW is z-scored over a rolling 252-day window to normalise the highly volatile rupee-denominated flow values into a unitless measure comparable with other asset returns.

### Parallel Fetching

All six assets are fetched concurrently using a `ThreadPoolExecutor` with three workers: one for all yfinance tickers (batched via `yf.download()`), one for the FBIL G-Sec yield, and one for the NSE FII session. This reduces total fetch time from approximately 90 seconds (serial) to under 35 seconds.

### Fallback Hierarchy

Each data source implements the following fallback chain, in order:

1. **Primary fetch** through the source's API with tenacity retry (3 attempts, exponential backoff).
2. **Circuit breaker check** – after 3 consecutive failures, the source is skipped for a 1-hour cooldown period.
3. **Stale Parquet cache** – the last known-good dataset is served from disk, and a staleness flag is set in the health endpoint.
4. **Synthetic data** – `numpy.random.default_rng` with a source-specific seed generates statistically plausible data. The health endpoint reflects the degraded state.

### Data Quality Validation

The `_validate_dataframe()` function rejects any asset column where more than 20% of values are missing. This prevents the correlation engine from operating on sparse data that would produce misleading results.

---

## Methodology

### Rolling Pearson Correlation

For each of the 15 unique asset pairs, the system computes a rolling Pearson correlation coefficient over the specified window using pandas `.rolling().corr()`:

```
rho_t = corr(X[t-window+1 ... t], Y[t-window+1 ... t])
```

The minimum number of observations required is 80% of the window size or 10, whichever is larger (`min_periods = max(int(window * 0.8), 10)`). This prevents correlated from being reported during periods with sparse trading data.

### Z-Score Anomaly Detection

The anomaly detector computes a rolling z-score for each pair's correlation time series:

```
z_t = (rho_t - mean_252d(rho)) / std_252d(rho)
```

- Historical window: 252 trading days (approximately one calendar year)
- Minimum periods: 60 observations
- Clipping: z-values are clamped to the range [-10, +10] to prevent division-by-near-zero outliers
- Std-dev floor: values below 1e-6 are set to NaN to avoid division errors

An anomaly is flagged when `|z_t| > threshold` (default threshold = 2.0, configurable from 1.0 to 3.5).

### Regime Classification

Once anomaly detection is performed, each pair is classified into one of six regimes based on the current correlation value and whether a z-score anomaly exists:

| Regime | Condition | Colour |
|--------|-----------|--------|
| Anomaly | `|z| > threshold` | Red |
| Strong Positive | `rho >= 0.7` | Dark green |
| Mild Positive | `0.3 <= rho < 0.7` | Light green |
| Neutral | `-0.3 < rho < 0.3` | Grey |
| Mild Negative | `-0.7 < rho <= -0.3` | Light red |
| Strong Negative | `rho <= -0.7` | Dark red |

Note: An anomaly can occur at any correlation magnitude. A pair with `rho = 0.2` (neutral zone) can be anomalous if its z-score exceeds the threshold, meaning the current correlation is statistically unusual relative to its own history even though it falls in the neutral band.

### Interpretation Engine

A deterministic rule-based system (no machine learning) maps each of the 15 asset pairs to plain-English explanations for both positive-z ("surge") and negative-z ("breakdown") regimes. Each explanation cites known macro drivers:

- **NIFTY50-CRUDE breakdown:** "India is a net oil importer, so NIFTY-CRUDE decoupling often signals domestic growth resilience despite oil price moves, or supply-driven oil shocks that haven't yet transmitted to corporate earnings."
- **USDINR-GSEC10Y surge:** "Rising yields attracting carry trade flows that strengthen INR – the classic interest rate parity channel."

Confidence is derived from the magnitude of the z-score:
- **High confidence:** `|z| >= 3.0`
- **Medium confidence:** `2.5 <= |z| < 3.0`
- **Low confidence:** `|z| < 2.5`

The engine also scans for historical precedents: it finds the last time the same pair experienced a z-score exceeding the current threshold in the same direction and reports the date and magnitude.

---

## Technical Stack

### Backend

| Component | Technology | Version |
|-----------|-----------|---------|
| Runtime | Python | 3.11 |
| Web framework | FastAPI | 0.111.0 |
| ASGI server | Uvicorn (dev) / Gunicorn + UvicornWorker (prod) | 0.29.0 / 22.0.0 |
| Data processing | pandas, NumPy, SciPy | 2.2.2, 1.26.4, 1.13.0 |
| Data ingestion | yfinance, requests, BeautifulSoup4 | 0.2.40, 2.31.0, 4.12.3 |
| Serialisation | PyArrow (Parquet) | 16.1.0 |
| Scheduling | APScheduler | 3.10.4 |
| Rate limiting | SlowAPI | 0.1.9 |
| CLI | Click | 8.1.7 |
| Testing | pytest, pytest-asyncio, HTTPX | 8.2.0, 0.23.6, 0.27.0 |
| Validation | Pydantic v2 + pydantic-settings | 2.7.1 / 2.2.1 |

### Frontend

| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | Next.js (App Router) | 16.2.6 |
| UI library | React | 19.2.4 |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 4.x |
| State management | Zustand | 5.0.14 |
| Server-state caching | TanStack React Query | 5.100.14 |
| Visualisation (heatmap, timeline) | D3 | 7.9.0 |
| Visualisation (drilldown chart) | Recharts | 3.8.1 |
| URL parameter sync | nuqs | 2.8.9 |
| Export | xlsx | 0.18.5 |
| Linting | ESLint | 9.x |

### Infrastructure

| Component | Technology |
|-----------|-----------|
| Containerisation | Docker + Docker Compose |
| CI/CD | GitHub Actions |
| Backend hosting | Render (Docker-based) |
| Frontend hosting | Vercel |
| Email | Resend (optional, weekly digest) |

---

## API Reference

All endpoints live under the `/api` prefix and return JSON. Responses include the cache-control header `public, max-age=300, stale-while-revalidate=60` unless otherwise specified.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | System health, cache freshness, data quality, circuit breaker states, warming stage |
| `/api/correlation/matrix?window=60&date=YYYY-MM-DD` | GET | 6x6 correlation matrix + z-score matrix + anomaly flags for a snapshot date |
| `/api/correlation/timeseries?asset1=NIFTY50&asset2=GOLD&window=60` | GET | Rolling correlation, z-score, and anomaly flags for one pair |
| `/api/anomaly/alerts?window=60&threshold=2.0&limit=50&offset=0` | GET | Paginated anomaly alerts, sorted by date descending |
| `/api/anomaly/regime-history?window=60` | GET | Threshold-independent raw z-scores per date per pair for client-side classification |
| `/api/summary` | GET | Dashboard overview: today's anomalies, top-5 movers, regime distribution |

### Authentication

The API does not implement authentication. It is designed to run behind a reverse proxy or Vercel rewrite that handles auth. CORS is configured via the `ALLOWED_ORIGINS` environment variable (comma-separated list, NOT a JSON array).

### Rate Limiting

SlowAPI middleware enforces a default limit of 100 requests per minute per client IP. Exceeded requests receive a `429 Too Many Requests` response with a `Retry-After` header.

---

## Deployment

### Containerised (Docker Compose)

```bash
git clone <repository-url>
cd correlation-anomaly-detector
docker-compose up --build
```

| Service | URL |
|---------|-----|
| Backend API | http://localhost:8000 |
| Swagger docs | http://localhost:8000/docs |
| Frontend dashboard | http://localhost:3000 |

The `docker-compose.yml` mounts `./backend/data` as a volume for persistent Parquet cache files and passes environment variables from `backend/.env`.

### Production (Render + Vercel)

**Backend (Render):**
- Use Docker as the environment
- Set root directory to `backend`
- Health check path: `/api/health`
- Add environment variables from `.env.example`
- The server pre-warms on startup (allow 60-90s)
- Gunicorn runs with `workers=1` (in-memory store limitation)
- Production uses the `APP_ENV=production` environment variable

**Frontend (Vercel):**
- Set root directory to `frontend`
- The `next.config.ts` rewrites `/api/*` to the backend origin
- `NEXT_PUBLIC_API_URL` overrides the backend target for local development
- After deployment, update `ALLOWED_ORIGINS` on Render to include the Vercel URL

### CI/CD Pipeline

The `.github/workflows/ci.yml` workflow runs on push/PR to `main`:

1. **Backend:** Python 3.11 setup with pip cache, install dependencies + ruff, lint with `ruff check app/`, run `pytest tests/ -v`.
2. **Frontend:** Node.js 20 setup with npm cache, `npm ci`, `npm run lint`.

No deployment steps are included in the CI workflow; deployment is handled externally by Render and Vercel's GitHub integrations.

---

## Operational Excellence

### Cache Strategy

| Layer | Store | Validity | Eviction |
|-------|-------|----------|----------|
| L1 | Python dict (in-memory) | Until next refresh | Cleared on restart |
| L2 | Parquet files on disk | 2 hours from mtime | Overwritten on refresh |
| API responses | HTTP Cache-Control | 5 minutes + 1 minute stale-while-revalidate | Browser/proxy cache |

The cache warming sequence on startup:
1. `_warm_sync()` attempts to load from Parquet files.
2. If Parquet cache is less than 2 hours old, loads instantly and refreshes asynchronously.
3. If Parquet is stale or missing, triggers a full fetch and recompute cycle.
4. The health endpoint reports `warming_stage` as `loading_cache`, `fetching`, `computing`, or `ready`.

### Circuit Breakers

Three independent circuit breakers protect against upstream source failures:

| Source | Max Failures | Cooldown | State Machine |
|--------|-------------|----------|---------------|
| yfinance | 3 | 3600s (1h) | CLOSED -> OPEN (3 failures) -> HALF_OPEN (after cooldown) |
| gsec (FBIL) | 3 | 3600s | Same |
| fii (NSE) | 3 | 3600s | Same |

The circuit breaker state is visible via `GET /api/health` under the `circuit_breakers` key, including the current state, failure count, and time since last failure.

### Monitoring

The health endpoint exposes:
- Cache freshness (rows per window, staleness flags for gsec, fii, and prices)
- Data quality (missing percentage per asset, healthy flag at <20%)
- Circuit breaker statuses
- Warming stage
- Scheduler runtime state

### Email Digests

When `RESEND_API_KEY` is configured, the APScheduler sends a weekly anomaly digest every Monday at 8 AM (configurable via `ALERT_SCHEDULE_CRON`). The HTML email contains the top-5 movers by absolute z-score with a link to the dashboard. The feature degrades gracefully: if Resend is unavailable, the error is logged and the scheduler continues.

### Logging

The backend supports two log formats:
- **text** (default): Human-readable format for development.
- **json**: Structured JSON log lines for production log aggregation systems.

Configurable via `LOG_FORMAT` and `LOG_LEVEL` environment variables.

### Accessibility

The frontend implements the following accessibility features:
- Skip-to-content link for keyboard users
- ARIA grid roles on the correlation matrix (`role="grid"`, `aria-label`)
- Keyboard navigation (Tab, Enter to select)
- Focus-visible rings on all interactive elements
- `prefers-reduced-motion` media query respected in D3 animations
- Trapped focus in modal dialogs
- Semantic heading hierarchy

---

## Quick Start for Developers

### Prerequisites

- Python >= 3.11
- Node.js >= 20
- npm or pnpm or yarn
- Docker and Docker Compose (optional, for containerised setup)
- Git

### One-Command Setup (Docker)

```bash
git clone <repository-url>
cd correlation-anomaly-detector
cp backend/.env.example backend/.env
docker-compose up --build
```

The dashboard is available at `http://localhost:3000`. The first load takes 30-60 seconds while the backend warms its cache.

### Manual Setup

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate     # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

API available at `http://localhost:8000`. Swagger docs at `http://localhost:8000/docs`.

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Dashboard available at `http://localhost:3000`.

### Testing

```bash
# Backend tests
cd backend && pytest tests/ -v

# Individual test files:
pytest tests/test_correlation_engine.py -v
pytest tests/test_anomaly_detector.py -v
pytest tests/test_data_fetcher.py -v
pytest tests/test_api.py -v
```

The test suite uses synthetic data with fixed random seeds, so results are deterministic.

---

## Configuration Reference

All backend configuration is managed through environment variables defined in `backend/.env`:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `HOST` | No | `0.0.0.0` | Server bind address |
| `PORT` | No | `8000` | Server port |
| `ALLOWED_ORIGINS` | Yes | `http://localhost:3000` | Comma-separated CORS origins (NOT JSON array) |
| `DATA_START_DATE` | No | `2020-01-01` | Historical data start date |
| `CACHE_DIR` | No | `data/cache` | Parquet cache directory |
| `DEFAULT_WINDOW` | No | `60` | Default rolling window (days) |
| `DEFAULT_THRESHOLD` | No | `2.0` | Default z-score threshold |
| `HIST_WINDOW` | No | `252` | Rolling window for z-score mean/std |
| `LOG_FORMAT` | No | `text` | Log format: `text` or `json` |
| `LOG_LEVEL` | No | `INFO` | Logging level |
| `RETRY_MAX_ATTEMPTS` | No | `3` | Tenacity retry attempts per source |
| `CIRCUIT_BREAKER_FAILURES` | No | `3` | Consecutive failures to open circuit |
| `CIRCUIT_BREAKER_COOLDOWN` | No | `3600` | Cooldown before half-open (seconds) |
| `RESEND_API_KEY` | No | `""` | Resend API key (weekly digest) |
| `ALERT_RECIPIENTS` | No | `""` | Comma-separated email recipients |
| `ALERT_SCHEDULE_CRON` | No | `0 8 * * 1` | Cron expression for digest schedule |
| `DASHBOARD_URL` | No | `http://localhost:3000` | Link in digest emails |
| `APP_ENV` | No | `""` (empty) | Set to `production` to use Gunicorn instead of Uvicorn dev server |

Frontend:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | No | Render backend URL | API base URL override |

---

## Project Structure

```
correlation-anomaly-detector/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI entry point, lifespan, middleware
│   │   ├── config.py               # Pydantic Settings from .env
│   │   ├── scheduler.py            # APScheduler hourly + weekly digest
│   │   ├── models/
│   │   │   └── schemas.py          # Pydantic response models
│   │   ├── routers/
│   │   │   ├── health.py           # GET /api/health
│   │   │   ├── correlation.py      # GET /api/correlation/matrix, /timeseries
│   │   │   ├── anomaly.py          # GET /api/anomaly/alerts, /regime-history
│   │   │   └── summary.py          # GET /api/summary
│   │   └── services/
│   │       ├── data_fetcher.py     # Multi-source data ingestion
│   │       ├── correlation_engine.py   # Vectorised rolling correlations
│   │       ├── anomaly_detector.py     # Z-score detection + regime labels
│   │       ├── interpretation.py       # Rule-based interpretation engine
│   │       ├── cache.py               # In-memory + Parquet cache layer
│   │       ├── circuit_breaker.py      # Per-source circuit breakers
│   │       └── email_service.py        # Weekly Resend digest
│   ├── tests/                      # 4 test files + conftest.py
│   ├── detect.py                   # CLI tool (Click)
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── gunicorn.conf.py
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── app/                    # Next.js App Router (layout.tsx, page.tsx)
│   │   ├── components/             # 12 React components
│   │   ├── hooks/                  # 3 custom React Query hooks
│   │   └── lib/                    # API client, types, store, params, CSS utils, export
│   ├── package.json
│   ├── Dockerfile
│   └── next.config.ts
├── docker-compose.yml
└── .github/workflows/ci.yml
```

---

## Roadmap and Future Directions

The following capabilities are informed by the existing architecture and its natural extension points:

**Additional asset classes.** The `ASSETS` list in `config.py` is the single source of truth. Adding a new asset requires implementing a data fetcher (with circuit breaker), adding interpretation rules for the 6 new pairs, and updating the frontend types and colour legend.

**Regime change alerts via webhook.** The anomaly detection pipeline already classifies all pairs on every refresh. Adding a webhook notification (Slack, PagerDuty) is a matter of a new service function and a scheduler trigger.

**Machine-learned regime clustering.** The current rule-based classification uses fixed thresholds. An unsupervised clustering approach (HMM or Gaussian mixture) could identify non-linear regime states beyond z-score excursions. The raw z-score dataframe is already persisted and available for model training.

**Historical backtesting framework.** The cache layer stores all pre-computed correlations. Adding a `/api/backtest` endpoint that evaluates a hypothetical threshold against historical data – measuring false positives, detection lag, and regime persistence – would allow data-driven threshold tuning.

**Multi-user authentication.** The API has no auth layer today. Adding a lightweight auth proxy (or Vercel Middleware for the frontend) would enable multi-user deployments with shareable saved views.

---

© 2026 Correlation Anomaly Detector. All rights reserved.
