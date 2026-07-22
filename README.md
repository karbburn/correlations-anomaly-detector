# [CORRSHIFT](https://corrshift.vercel.app)

Real-time monitoring of rolling correlations across 6 Indian and global asset classes. Detects anomalous regime shifts using z-score analysis with an interactive D3-powered dashboard.

---

## Features

- **6 Asset Classes** — NIFTY 50, USD/INR, Gold (GOLDBEES), Brent Crude, 10Y G-Sec Yield, and FII Net Flow in a unified correlation framework.
- **Vectorized Correlation Engine** — Rolling Pearson correlations across all 15 asset pairs computed with pandas `rolling().corr()`.
- **3 Time Windows** — 30-day, 60-day, and 252-day rolling windows with a single-click toggle.
- **Z-Score Anomaly Detection** — Configurable threshold (default: ±2σ) with regime classification (breakdown / surge / neutral).
- **Interactive Dashboard** — D3 heatmaps, Recharts dual-axis drilldowns, and a D3 heat calendar for regime timelines.
- **Background Cache Warming** — APScheduler hourly refresh; FastAPI lifespan pre-computes all windows on startup.
- **Multi-Source Data Ingestion** — yfinance, FBIL API, and NSE session parsing with automatic fallback to cached/synthetic data.
- **CLI Tool** — Run anomaly detection, print correlation matrices, or export alerts from the command line.
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

| Layer       | Technology                                                              |
|-------------|-------------------------------------------------------------------------|
| Runtime     | Python 3.11                                                             |
| Web         | FastAPI 0.111.0, Gunicorn 22.0.0                                       |
| Data        | Pandas 2.2.2, NumPy 1.26.4, SciPy 1.13.0                              |
| Ingestion   | yfinance 0.2.40, Requests, BeautifulSoup4                             |
| Caching     | In-memory + Parquet (PyArrow 16.1.0)                                   |
| Frontend    | Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4       |
| State       | Zustand 5.x, TanStack React Query 5.x                                  |
| Viz         | D3.js 7.x, Recharts 3.x                                               |
| Infra       | Docker, GitHub Actions, Render (backend), Vercel (frontend)            |

---

## Getting Started

### Prerequisites

- Python >= 3.11
- Node.js >= 20
- npm (or yarn/pnpm)
- Docker & Docker Compose (optional)

### Quick Start (Docker)

```bash
git clone <repository-url>
cd correlation-anomaly-detector
cp backend/.env.example backend/.env
docker-compose up --build
```

| Service  | URL                     |
|----------|-------------------------|
| Frontend | `http://localhost:3000`  |
| Backend  | `http://localhost:8000`  |
| Swagger  | `http://localhost:8000/docs` |

### Manual Setup

**Backend:**

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

> The server pre-fetches data and pre-computes all correlation windows on startup. The first load takes ~30-60s; subsequent requests are under 100ms.

---

## API Reference

All endpoints are prefixed with `/api` and return JSON.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Server status, cache freshness, circuit breaker states |
| `/api/correlation/matrix?window=60&date=YYYY-MM-DD` | GET | 6x6 correlation matrix + z-scores + anomaly flags |
| `/api/correlation/timeseries?asset1=NIFTY50&asset2=GOLD&window=60` | GET | Rolling correlation and z-score for one pair |
| `/api/anomaly/alerts?window=60&threshold=2.0&limit=50&offset=0` | GET | Paginated anomaly alerts (date descending) |
| `/api/anomaly/regime-history?window=60` | GET | Raw z-scores per date per pair for client-side classification |
| `/api/summary` | GET | Dashboard overview: anomaly count, top movers, regime breakdown |

**Valid asset names:** `NIFTY50`, `USDINR`, `GOLD`, `CRUDE`, `GSEC10Y`, `FII_FLOW`

---

## CLI Usage

Run anomaly detection without starting the server:

```bash
cd backend

# Correlation matrix for today
python detect.py --matrix --window 60

# Drilldown on a specific pair
python detect.py --pair NIFTY50 GOLD --window 30

# Full anomaly detection with CSV export
python detect.py --window 252 --threshold 2.5 --output alerts.csv
```

| Option | Default | Description |
|--------|---------|-------------|
| `--window` | 60 | Rolling window days (`30`, `60`, `252`) |
| `--threshold` | 2.0 | Z-score threshold |
| `--start` | 2022-01-01 | Start date (`YYYY-MM-DD`) |
| `--output` | alerts.csv | Output CSV path |
| `--matrix` | flag | Print today's correlation matrix |
| `--pair` | two values | Drilldown: two asset names |

---

## Deployment

### Backend (Render)

1. Create a new **Web Service** on [Render](https://render.com) with **Docker** environment.
2. Set **Root Directory** to `backend`.
3. Set **Health Check Path** to `/api/health`.
4. Add environment variables from `backend/.env` — set `ALLOWED_ORIGINS` to your Vercel URL.
5. Deploy. The server pre-warms on startup (~60-90s).

### Frontend (Vercel)

1. Import the repository in [Vercel](https://vercel.com).
2. Set **Root Directory** to `frontend`.
3. Deploy.

> After deployment, update the backend `ALLOWED_ORIGINS` on Render to include the Vercel URL.

---

## Environment Variables

**Backend** (`backend/.env`):

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Server bind address |
| `PORT` | `8000` | Server port |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | Comma-separated CORS origins |
| `DATA_START_DATE` | `2020-01-01` | Historical data start date |
| `CACHE_DIR` | `data/cache` | Parquet cache directory |
| `DEFAULT_WINDOW` | `60` | Default rolling window (days) |
| `DEFAULT_THRESHOLD` | `2.0` | Default z-score threshold |
| `HIST_WINDOW` | `252` | Z-score lookback window |

**Frontend:**

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL override for local dev |

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
│   ├── detect.py                # CLI tool
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── app/                 # Next.js App Router pages
│   │   ├── components/          # React components (D3, Recharts)
│   │   ├── hooks/               # Custom React hooks
│   │   └── lib/                 # API client + utilities
│   ├── package.json
│   ├── Dockerfile
│   └── next.config.ts
├── .github/workflows/ci.yml
├── docker-compose.yml
└── README.md
```

---

## Contributing

1. Fork the repository and create a feature branch from `main`.
2. Set up the development environment (see [Getting Started](#getting-started)).
3. Run linters and tests before pushing:
   ```bash
   # Backend
   cd backend && ruff check app/ && pytest tests/ -v

   # Frontend
   cd frontend && npm run lint
   ```
4. Open a pull request against `main`.


