# Cross-Asset Correlations Anomaly Detector (v2)

Real-time monitoring of rolling correlations across Indian and global asset classes. Detects anomalous regime shifts using z-score analysis. 

## Features

- **6 Core Assets Tracking:** Nifty 50, USD/INR, Gold, Brent Crude, 10Y G-Sec Yield, FII Net Flow.
- **Fast Correlation Engine:** Vectorized Pearson correlation matrices across 30, 60, and 252-day windows.
- **Z-Score Anomaly Detection:** Real-time regime shifts based on historical correlation variance.
- **Interactive Dashboard:** D3 heatmaps, regime timelines, and detailed pair drilldowns with Next.js & React Query.
- **Robust Ingestion:** Resilient data fetching with FBIL API (G-Sec) and two-step session parsing (NSE FII).
- **Background Warming:** APScheduler-driven cache pre-warming to completely eliminate cold-starts.

## Architecture Stack

**Backend:**
- Python 3.11, FastAPI
- Pandas, NumPy, SciPy, yfinance
- APScheduler, SlowAPI
- Pytest

**Frontend:**
- Next.js 16 (App Router), React 19
- TypeScript, Tailwind CSS
- Zustand (Global State)
- TanStack React Query
- D3.js, Recharts

## Local Development

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`. You can also view the Swagger UI at `http://localhost:8000/docs`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The dashboard will be running at `http://localhost:3000`.

### 3. Docker Compose (Full Stack)

To run both services using Docker:
```bash
docker-compose up --build
```

## Deployment Guide

### Backend (Render)
1. Push to GitHub.
2. Create a new Web Service on Render.
3. Choose Docker as the environment.
4. Set the Root Directory to `backend`.
5. Set Health Check Path to `/api/health`.
6. Add `.env` vars (`ALLOWED_ORIGINS`).

### Frontend (Vercel)
1. Import the repository in Vercel.
2. Set the Root Directory to `frontend`.
3. Add Environment Variable: `NEXT_PUBLIC_API_URL` -> Your Render backend URL.
4. Deploy.

Once the frontend is deployed, update the backend `ALLOWED_ORIGINS` on Render to include the Vercel URL!

## Scripts

### CLI Analysis Tool
Run anomaly detection directly from the command line:

```bash
cd backend
python detect.py --matrix --window 60
python detect.py --pair NIFTY50 GOLD --window 30
python detect.py --window 252 --threshold 2.5 --output alerts.csv
```

## License
MIT
