# Cross-Asset Correlations Anomaly Detector

Real-time monitoring of rolling correlations across 6 Indian and global asset classes. Detects anomalous regime shifts using z-score analysis with an interactive D3-powered dashboard.

---

## Features

- **6 Core Asset Classes** — NIFTY 50, USD/INR, Gold (GOLDBEES), Brent Crude, 10Y G-Sec Yield, and FII Net Flow tracked in a unified correlation framework.
- **Vectorized Correlation Engine** — Rolling Pearson correlations across all 15 asset pairs computed with pandas `rolling().corr()` (C-backed, no Python loops).
- **3 Time Windows** — 30-day, 60-day, and 252-day rolling windows with a single-click toggle.
- **Z-Score Anomaly Detection** — Real-time regime shift detection with configurable threshold (default: ±2σ) and regime classification (breakdown / surge / neutral).
- **Interactive Dashboard** — D3 heatmaps for correlation matrices, Recharts dual-axis timeseries for pair drilldowns, and a D3 heat calendar for regime timelines.
- **Background Cache Warming** — APScheduler refreshes all data hourly; FastAPI lifespan pre-computes all windows on startup to eliminate cold-start delays.
- **Multi-Source Data Ingestion** — yfinance for price assets, FBIL API for G-Sec yields, and two-step NSE session parsing for FII flows with automatic fallback to cached/synthetic data.
- **CLI Analysis Tool** — Run anomaly detection, print correlation matrices, or export alerts directly from the command line.
- **Rate Limiting** — SlowAPI middleware enforces 100 requests/minute with automatic retry-after headers.
- **Docker Compose Ready** — Full-stack local development with a single `docker-compose up --build`.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                       │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐ │
│  │Correlation   │ │ AnomalyFeed  │ │  PairDrilldown           │ │
│  │Matrix (D3)   │ │ (Table+CSV)  │ │  (Recharts dual-axis)    │ │
│  └──────┬───────┘ └──────┬───────┘ └──────────┬───────────────┘ │
│         │                │                     │                 │
│  ┌──────┴────────────────┴─────────────────────┴───────────────┐ │
│  │          React Query + Zustand (state + caching)            │ │
│  └─────────────────────────┬───────────────────────────────────┘ │
└────────────────────────────┼────────────────────────────────────┘
                             │ REST API (JSON)
┌────────────────────────────┼────────────────────────────────────┐
│                   Backend (FastAPI / Python 3.11)                │
│  ┌─────────────────────────┴───────────────────────────────────┐ │
│  │                    API Routers                              │ │
│  │  /api/health  /api/correlation/matrix                      │ │
│  │  /api/correlation/timeseries  /api/anomaly/alerts          │ │
│  │  /api/anomaly/regime-history                               │ │
│  └───────────┬──────────────────┬──────────────────────────────┘ │
│              │                  │                                │
│  ┌───────────┴──────┐  ┌───────┴──────────────────────────────┐ │
│  │   Cache Layer    │  │       Service Layer                  │ │
│  │  (in-memory +    │  │  correlation_engine.py (vectorized)  │ │
│  │   parquet)       │  │  anomaly_detector.py (z-score)       │ │
│  └──────────────────┘  └───────┬──────────────────────────────┘ │
│                                │                                │
│  ┌─────────────────────────────┴──────────────────────────────┐ │
│  │               Data Ingestion Layer                         │ │
│  │  yfinance (4 assets)  │  FBIL API (G-Sec)  │  NSE (FII)  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  APScheduler — hourly background cache refresh            │ │
│  └────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Backend

| Component       | Technology                          |
|-----------------|-------------------------------------|
| Runtime         | Python 3.11                         |
| Web Framework   | FastAPI 0.111.0                     |
| Data Processing | Pandas 2.2.2, NumPy 1.26.4, SciPy 1.13.0 |
| Data Ingestion  | yfinance 0.2.40, Requests, BeautifulSoup4 |
| Scheduling      | APScheduler 3.10.4 (AsyncIO)       |
| Rate Limiting   | SlowAPI 0.1.9                       |
| Caching         | In-memory + Parquet (PyArrow 16.1.0) |
| CLI             | Click 8.1.7                         |
| Testing         | Pytest 8.2.0, Pytest-AsyncIO 0.23.6, HTTPX 0.27.0 |

### Frontend

| Component       | Technology                          |
|-----------------|-------------------------------------|
| Framework       | Next.js 16 (App Router)             |
| UI Library      | React 19.2.4                        |
| Language        | TypeScript 5.x                      |
| Styling         | Tailwind CSS 4.x                    |
| State Management| Zustand 5.x                         |
| Data Fetching   | TanStack React Query 5.x            |
| Visualization   | D3.js 7.x, Recharts 3.x            |

---

## Prerequisites

- **Python** >= 3.11
- **Node.js** >= 20
- **npm** (or yarn/pnpm)
- **Docker** & **Docker Compose** (optional, for containerized setup)
- **Git**

---

## Local Development

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

The API starts at `http://localhost:8000`. Swagger docs available at `http://localhost:8000/docs`.

> **Note:** The server pre-fetches data and pre-computes all 3 correlation windows on startup. The first request will be slow (~30-60s) while the cache warms. Subsequent requests are fast (~100ms).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The dashboard runs at `http://localhost:3000`.

---

## Docker Compose

Run the full stack with a single command:

```bash
docker-compose up --build
```

| Service   | URL                     |
|-----------|-------------------------|
| Backend   | `http://localhost:8000`  |
| Frontend  | `http://localhost:3000`  |
| Swagger   | `http://localhost:8000/docs` |

The `docker-compose.yml` mounts `./backend/data` as a volume for persistent cache and passes environment variables from `backend/.env`.

---

## API Documentation

### Health Check

```
GET /api/health
```

Returns server status, cache freshness, and scheduler state. The frontend polls this endpoint until `startup_complete` is `true` before rendering the dashboard.

**Response:**
```json
{
  "status": "ok",
  "startup_complete": true,
  "scheduler_running": true,
  "data_freshness": {
    "gsec_stale": false,
    "fii_stale": false
  },
  "cache_status": {
    "master_returns": { "fresh": true, "rows": 1200 },
    "corr_30d": { "fresh": true },
    "corr_60d": { "fresh": true },
    "corr_252d": { "fresh": true }
  }
}
```

### Correlation Matrix

```
GET /api/correlation/matrix?window=60&date=2025-01-15
```

Returns the 6x6 correlation matrix, z-score matrix, and anomaly flags for a given window and date.

| Parameter | Type   | Default | Description                              |
|-----------|--------|---------|------------------------------------------|
| `window`  | int    | 60      | Rolling window: `30`, `60`, or `252`     |
| `date`    | string | latest  | Snapshot date as `YYYY-MM-DD`            |

**Response:**
```json
{
  "window": 60,
  "as_of_date": "2025-01-15",
  "assets": ["NIFTY50", "USDINR", "GOLD", "CRUDE", "GSEC10Y", "FII_FLOW"],
  "matrix": [[1.0, -0.12, 0.34, ...], ...],
  "zscore_matrix": [[0.0, -1.85, 0.42, ...], ...],
  "anomaly_flags": [[false, false, false, ...], ...]
}
```

### Pair Correlation Timeseries

```
GET /api/correlation/timeseries?asset1=NIFTY50&asset2=GOLD&window=60
```

Returns the rolling correlation, z-score, and anomaly flag timeseries for a specific asset pair.

| Parameter | Type   | Required | Description                              |
|-----------|--------|----------|------------------------------------------|
| `asset1`  | string | yes      | First asset name (e.g., `NIFTY50`)       |
| `asset2`  | string | yes      | Second asset name (e.g., `GOLD`)         |
| `window`  | int    | no       | Rolling window: `30`, `60`, or `252`     |
| `start`   | string | no       | Start date filter `YYYY-MM-DD`           |

**Valid asset names:** `NIFTY50`, `USDINR`, `GOLD`, `CRUDE`, `GSEC10Y`, `FII_FLOW`

### Anomaly Alerts

```
GET /api/anomaly/alerts?window=60&threshold=2.0&limit=50&offset=0
```

Returns paginated anomaly alerts sorted by date descending.

| Parameter   | Type   | Default | Description                              |
|-------------|--------|---------|------------------------------------------|
| `window`    | int    | 60      | Rolling window: `30`, `60`, or `252`     |
| `threshold` | float  | 2.0     | Z-score threshold for anomaly detection  |
| `start`     | string | none    | Filter alerts from this date             |
| `limit`     | int    | 50      | Results per page (1-500)                 |
| `offset`    | int    | 0       | Pagination offset                        |

**Response:**
```json
{
  "threshold": 2.0,
  "total_count": 142,
  "offset": 0,
  "limit": 50,
  "has_more": true,
  "alerts": [
    {
      "date": "2025-01-15",
      "asset1": "NIFTY50",
      "asset2": "CRUDE",
      "window": 60,
      "correlation": -0.45,
      "zscore": -2.31,
      "historical_mean": -0.12,
      "historical_std": 0.14,
      "regime": "breakdown"
    }
  ]
}
```

### Regime History

```
GET /api/anomaly/regime-history?window=60&threshold=2.0
```

Returns correlation regime classification per date per pair, optimized for the D3 heat calendar on the frontend.

**Response:**
```json
{
  "pairs": ["NIFTY50__USDINR", "NIFTY50__GOLD", ...],
  "dates": ["2024-01-02", "2024-01-03", ...],
  "regimes": {
    "NIFTY50__USDINR": ["neutral", "mild_positive", "anomaly", ...],
    ...
  }
}
```

**Regime labels:** `neutral`, `mild_positive`, `strong_positive`, `mild_negative`, `strong_negative`, `anomaly`

---

## CLI Usage

The `detect.py` tool runs anomaly detection directly from the command line without starting the server.

```bash
cd backend
```

**Print today's correlation matrix (60-day window):**
```bash
python detect.py --matrix --window 60
```

**Drilldown on a specific pair (30-day window):**
```bash
python detect.py --pair NIFTY50 GOLD --window 30
```

**Full anomaly detection with CSV export:**
```bash
python detect.py --window 252 --threshold 2.5 --output alerts.csv
```

**All options:**

| Option       | Default      | Description                                |
|--------------|--------------|--------------------------------------------|
| `--window`   | 60           | Rolling window days (`30`, `60`, `252`)    |
| `--threshold`| 2.0          | Z-score threshold for anomaly detection    |
| `--start`    | 2022-01-01   | Start date for data fetch (`YYYY-MM-DD`)  |
| `--output`   | alerts.csv   | Output CSV path for alerts                 |
| `--matrix`   | flag         | Print today's correlation matrix           |
| `--pair`     | two values   | Drilldown: two asset names                 |

---

## Deployment Guide

### Backend (Render)

1. Push the repository to GitHub.
2. Create a new **Web Service** on [Render](https://render.com).
3. Select **Docker** as the environment.
4. Set the **Root Directory** to `backend`.
5. Set the **Health Check Path** to `/api/health`.
6. Add environment variables from `backend/.env`:
   - `ALLOWED_ORIGINS` — your Vercel frontend URL (e.g., `https://your-app.vercel.app`)
   - `DATA_START_DATE` — historical data start date
   - `CACHE_DIR` — cache directory path
7. Deploy. The server will pre-warm the cache on startup (~60-90s).

### Frontend (Vercel)

1. Import the repository in [Vercel](https://vercel.com).
2. Set the **Root Directory** to `frontend`.
3. Deploy.

> The frontend proxies `/api/*` to the Render backend through `next.config.ts`. `NEXT_PUBLIC_API_URL` only overrides the proxy target for local development or a different backend host.

> **Important:** After the frontend is deployed, update the backend `ALLOWED_ORIGINS` on Render to include the Vercel URL.

---

## Environment Variables

Backend configuration is managed via `backend/.env` (copy from `.env.example`):

| Variable           | Required | Default              | Description                                              |
|--------------------|----------|----------------------|----------------------------------------------------------|
| `HOST`             | No       | `0.0.0.0`            | Server bind address                                      |
| `PORT`             | No       | `8000`               | Server port                                              |
| `ALLOWED_ORIGINS`  | Yes      | `http://localhost:3000` | Comma-separated CORS origins (NOT JSON array)          |
| `DATA_START_DATE`  | No       | `2020-01-01`         | Historical data start date for ingestion                 |
| `CACHE_DIR`        | No       | `data/cache`         | Directory for parquet cache files                        |
| `DEFAULT_WINDOW`   | No       | `60`                 | Default rolling correlation window (days)                |
| `DEFAULT_THRESHOLD`| No       | `2.0`                | Default z-score threshold for anomaly detection          |
| `HIST_WINDOW`      | No       | `252`                | Historical lookback window for z-score computation       |

Frontend environment variable:

| Variable              | Required | Description                                                         |
|-----------------------|----------|---------------------------------------------------------------------|
| `NEXT_PUBLIC_API_URL` | No       | Optional backend API base URL override for the Vercel rewrite proxy |

---

## Project Structure

```
correlation-anomaly-detector/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry point + lifespan
│   │   ├── config.py            # Pydantic settings from .env
│   │   ├── scheduler.py         # APScheduler hourly refresh
│   │   ├── models/
│   │   │   └── schemas.py       # Pydantic response models
│   │   ├── routers/
│   │   │   ├── health.py        # GET /api/health
│   │   │   ├── correlation.py   # GET /api/correlation/*
│   │   │   └── anomaly.py       # GET /api/anomaly/*
│   │   └── services/
│   │       ├── data_fetcher.py  # Multi-source data ingestion
│   │       ├── correlation_engine.py  # Vectorized rolling correlations
│   │       ├── anomaly_detector.py    # Z-score detection + regime labels
│   │       └── cache.py         # In-memory + parquet cache layer
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_api.py
│   │   ├── test_data_fetcher.py
│   │   ├── test_correlation_engine.py
│   │   └── test_anomaly_detector.py
│   ├── detect.py                # CLI anomaly detection tool
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── app/                 # Next.js App Router pages
│   │   ├── components/
│   │   │   ├── CorrelationMatrix.tsx   # D3 heatmap
│   │   │   ├── AnomalyFeed.tsx         # Paginated alerts table
│   │   │   ├── PairDrilldown.tsx       # Recharts dual-axis
│   │   │   ├── RegimeTimeline.tsx      # D3 heat calendar
│   │   │   ├── BackendStatus.tsx       # Loading screen
│   │   │   ├── WindowSelector.tsx      # 30D/60D/252D toggle
│   │   │   └── AssetLegend.tsx         # Asset color legend
│   │   ├── hooks/               # Custom React hooks
│   │   └── lib/                 # API client + utilities
│   ├── package.json
│   ├── Dockerfile
│   └── next.config.ts
├── .github/
│   └── workflows/
│       └── ci.yml               # GitHub Actions CI
├── docker-compose.yml
└── README.md
```

---

## Contributing

1. Fork the repository and create a feature branch from `main`.
2. Set up the development environment (see [Local Development](#local-development)).
3. Make your changes with clear, descriptive commits.
4. Run the linter and tests before pushing:
   ```bash
   # Backend
   cd backend && ruff check app/ && pytest tests/ -v

   # Frontend
   cd frontend && npm run lint
   ```
5. Open a pull request against `main` with a clear description of your changes.

---

## License

MIT
