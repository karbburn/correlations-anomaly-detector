# Code Review Report

**Reviewed:** 2026-05-29T00:00:00Z
**Depth:** deep
**Files Reviewed:** 33
**Status:** issues_found

---

## Executive Summary

The Cross-Asset Correlations Anomaly Detector v2 is a well-structured full-stack application with a clean architecture separating data ingestion, computation, and API layers. The codebase demonstrates good engineering practices including vectorized computation, structured error handling, and a thoughtful caching strategy. However, several bugs, security issues, and quality concerns were identified across both backend and frontend that warrant attention before production deployment.

**Key Concerns:**
- Thread-safety issues in the cache layer and random state management
- Missing null checks in API routers that can cause 500 errors
- Security gaps in Docker configuration and input validation
- Frontend query client lifecycle management issues
- Unused Pydantic schemas creating a false sense of type safety

---

## Critical Issues

### CR-01: Thread-Unsafe Global Random State in Data Fetcher

**File:** `backend/app/services/data_fetcher.py:182,273`
**Issue:** `np.random.seed(42)` and `np.random.seed(100)` modify the global NumPy random state. In a multi-threaded async environment (FastAPI with APScheduler), concurrent requests can interfere with each other's random number generation, producing non-deterministic results or corrupting the random stream.
**Impact:** Synthetic fallback data becomes unpredictable; concurrent cache warming jobs may produce different "deterministic" data.
**Fix:**
```python
# Replace global seed with local RNG
rng = np.random.default_rng(42)
noise = rng.normal(0, 0.02, size=len(dates))

# In _fallback_fii:
rng = np.random.default_rng(100)
flows = rng.normal(loc=0.0, scale=1.0, size=len(dates))
```

### CR-02: Missing Null Check on get_returns() in Correlation Router

**File:** `backend/app/routers/correlation.py:56`
**Issue:** `get_returns()` can return `None` if the cache is cold, but the code accesses `.columns` without a null check. This will raise `AttributeError: 'NoneType' object has no attribute 'columns'`.
**Impact:** 500 Internal Server Error when cache is not warmed.
**Fix:**
```python
returns = get_returns()
if returns is None:
    raise HTTPException(503, "Returns data not available")
assets = [a for a in ASSETS if a in returns.columns]
```

### CR-03: QueryClient Created at Module Scope

**File:** `frontend/src/app/page.tsx:20`
**Issue:** `new QueryClient()` is instantiated at module scope, which means a single instance is shared across all requests in SSR contexts and all component tree mounts. This breaks React Query's isolation guarantees and can cause state leakage between users.
**Impact:** In SSR/Next.js App Router, different users may see each other's cached data; query cache pollution.
**Fix:**
```typescript
function Page() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  );
}
```

### CR-04: Unvalidated Asset Names in Pair Timeseries Endpoint

**File:** `backend/app/routers/correlation.py:96-97,114-119`
**Issue:** `asset1` and `asset2` query parameters are accepted without validation against the allowed asset list. An attacker can craft arbitrary pair names that get interpolated into column lookups. While not directly exploitable for injection (Pandas handles this), it allows probing of internal data structure and generates confusing 404 errors.
**Impact:** Information disclosure about internal column naming; potential for denial-of-service via excessive 404 generation.
**Fix:**
```python
from app.services.correlation_engine import ASSETS

@router.get("/timeseries")
async def correlation_timeseries(
    response: Response,
    asset1: str = Query(..., description="First asset name"),
    asset2: str = Query(..., description="Second asset name"),
    window: int = Query(default=60),
    start: str = Query(default=None, description="Start date YYYY-MM-DD"),
):
    valid_assets = set(ASSETS)
    if asset1 not in valid_assets or asset2 not in valid_assets:
        raise HTTPException(400, f"Invalid asset. Valid: {sorted(valid_assets)}")
    # ... rest of handler
```

---

## Warnings

### WR-01: Deprecated asyncio.get_event_loop() Usage

**File:** `backend/app/services/cache.py:41`
**Issue:** `asyncio.get_event_loop()` is deprecated since Python 3.10 and will raise a `DeprecationWarning` in 3.12+. In Python 3.12+, it may fail if no running loop exists.
**Impact:** Future Python upgrade will break cache warming.
**Fix:**
```python
async def warm_cache() -> None:
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, _warm_sync)
```

### WR-02: No Thread Safety on In-Memory Cache Store

**File:** `backend/app/services/cache.py:32`
**Issue:** The `_store` dictionary is accessed by multiple async handlers concurrently and written to by the background scheduler. While Python's GIL prevents corruption of the dict itself, there's no memory barrier ensuring that a reader sees a consistent snapshot during a write operation (partial updates visible).
**Impact:** Potential for stale or inconsistent data reads during cache refresh.
**Fix:**
```python
import threading

_store: dict = {}
_store_lock = threading.Lock()

def get_pair_corrs(window: int) -> Optional[pd.DataFrame]:
    with _store_lock:
        return _store.get(f"corr_{window}d")

# In _warm_sync, acquire lock when updating:
def _warm_sync() -> None:
    # ... compute data ...
    with _store_lock:
        _store["returns"] = returns
        _store[f"corr_{window}d"] = pair_corrs
        _store["_warm"] = True
```

### WR-03: Dockerfile Runs as Root

**File:** `backend/Dockerfile`
**Issue:** No `USER` directive means the container runs as root, violating the principle of least privilege.
**Impact:** If the application is compromised, the attacker has root access inside the container.
**Fix:**
```dockerfile
RUN adduser --disabled-password --no-create-home appuser
USER appuser
```

### WR-04: Date String Comparison Against Datetime Index

**File:** `backend/app/routers/correlation.py:46`
**Issue:** `pair_corrs.index.strftime("%Y-%m-%d") == target` creates a full boolean mask by formatting every index entry to string. This is O(n) string allocation on every request.
**Impact:** Performance degradation with large datasets; not a correctness issue.
**Fix:**
```python
if date_str:
    target = pd.Timestamp(date_str)
    if target not in pair_corrs.index:
        raise HTTPException(404, f"No data for date {date_str}")
    row = pair_corrs.loc[target]
    as_of = date_str
```

### WR-05: Redundant Computation in Anomaly Detection

**File:** `backend/app/services/anomaly_detector.py:56-57`
**Issue:** `mean` and `std` are recomputed inside `detect_anomalies()` even though `compute_zscore_series()` already calculates them. This doubles the computation for every pair.
**Impact:** Unnecessary CPU time during cache warming (15 pairs × 2 redundant rolling computations).
**Fix:**
```python
# Refactor compute_zscore_series to return mean/std as well:
def compute_zscore_series(corr_series, hist_window=252):
    mean = corr_series.rolling(window=hist_window, min_periods=60).mean()
    std = corr_series.rolling(window=hist_window, min_periods=60).std()
    std = std.where(std > 1e-6, np.nan)
    zscore = (corr_series - mean) / std
    return zscore.clip(-10, 10), mean, std
```

### WR-06: No CORS Credentials Support

**File:** `backend/app/main.py:68-73`
**Issue:** The CORS middleware does not set `allow_credentials=True`. If the frontend ever needs to send cookies or authorization headers, requests will be blocked.
**Impact:** Current GET-only API works fine, but future authenticated endpoints will fail.
**Fix:**
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_methods=["GET"],
    allow_headers=["*"],
    allow_credentials=True,
)
```

### WR-07: Unescaped CSV Export

**File:** `frontend/src/components/AnomalyFeed.tsx:15-30`
**Issue:** The CSV export joins values with commas without escaping. If any field contains a comma (e.g., asset names in future), the CSV will be malformed.
**Impact:** Corrupted CSV files when data contains special characters.
**Fix:**
```typescript
const escapeCsv = (val: string | number) => {
  const str = String(val);
  return str.includes(",") || str.includes('"') || str.includes("\n")
    ? `"${str.replace(/"/g, '""')}"`
    : str;
};

const rows = data.alerts.map((a) =>
  [a.date, a.asset1, a.asset2, a.correlation, a.zscore, a.regime]
    .map(escapeCsv)
    .join(",")
);
```

### WR-08: Stale Cache Fallback Without Freshness Indication

**File:** `backend/app/services/data_fetcher.py:172,264`
**Issue:** When FBIL or NSE fails, the system silently serves stale cached data without indicating to the API consumer that the data is not fresh. The health endpoint doesn't report this either.
**Impact:** Users may make decisions based on outdated data without knowing it.
**Fix:**
```python
# Add staleness metadata to cache entries
_store["gsec_stale"] = True  # Set when using fallback
_store["fii_stale"] = True

# Report in health endpoint
@router.get("/health")
async def health():
    return {
        "status": "ok",
        "startup_complete": is_cache_warm(),
        "data_freshness": {
            "gsec_stale": _store.get("gsec_stale", False),
            "fii_stale": _store.get("fii_stale", False),
        },
        # ...
    }
```

### WR-09: Pydantic Schemas Defined But Unused

**File:** `backend/app/models/schemas.py`
**Issue:** Pydantic response models (`CorrelationMatrix`, `AnomalyAlert`, etc.) are defined but never used by the routers. The routers return plain dicts, so FastAPI doesn't validate response shapes.
**Impact:** API responses may not match documented schemas; no automatic OpenAPI schema generation for response models.
**Fix:**
```python
from app.models.schemas import CorrelationMatrixResponse

@router.get("/matrix", response_model=CorrelationMatrixResponse)
async def correlation_matrix(...):
    # ... existing code ...
    return { ... }  # FastAPI will validate against response_model
```

### WR-10: Health Check Doesn't Verify Scheduler Status

**File:** `backend/app/routers/health.py`
**Issue:** The health endpoint checks if the cache is warm but doesn't verify if the background scheduler is running. A silently dead scheduler means data goes stale without detection.
**Impact:** Data freshness degrades without operational visibility.
**Fix:**
```python
from app.scheduler import scheduler

@router.get("/health")
async def health():
    return {
        "status": "ok",
        "startup_complete": is_cache_warm(),
        "scheduler_running": scheduler.running,
        # ...
    }
```

### WR-11: D3 Components Full Rebuild on Every Render

**File:** `frontend/src/components/CorrelationMatrix.tsx:36`, `RegimeTimeline.tsx:56`
**Issue:** Both D3 components call `svg.selectAll("*").remove()` and rebuild the entire SVG DOM on every render. This is inefficient and causes flicker on updates.
**Impact:** Visual flicker; unnecessary DOM manipulation; poor mobile performance.
**Fix:** Use D3's enter/update/exit pattern or memoize the SVG content. Consider using `React.memo` on parent components to prevent unnecessary re-renders.

### WR-12: Missing Frontend Dockerfile

**File:** `frontend/Dockerfile`
**Issue:** The `docker-compose.yml` references `build: ./frontend` but no Dockerfile exists in the frontend directory. Docker Compose will fail to build.
**Impact:** Deployment failure.
**Fix:** Create `frontend/Dockerfile`:
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
```

---

## Info

### IN-01: Unused Import in page.tsx

**File:** `frontend/src/app/page.tsx:3`
**Issue:** `useState` is imported but `ready` state is managed by a callback pattern, making the import redundant if `setReady` is the only usage (it is used, but `useCallback` could be simplified).
**Impact:** None (cosmetic).
**Fix:** No change needed; the import is actually used.

### IN-02: Magic Number for Polling Interval

**File:** `frontend/src/components/BackendStatus.tsx:22,37`
**Issue:** `maxAttempts = 20` and `setTimeout(r, 3000)` are magic numbers without explanation of the total timeout (60 seconds).
**Impact:** Difficult to tune without understanding the total wait time.
**Fix:** Add constants at the top of the file:
```typescript
const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 20;
const TOTAL_TIMEOUT_S = (POLL_INTERVAL_MS * MAX_POLL_ATTEMPTS) / 1000; // 60s
```

### IN-03: globals.css Dark Theme Conflict

**File:** `frontend/src/app/globals.css:3-6,15-20`
**Issue:** CSS variables define light/dark themes via `prefers-color-scheme`, but the layout forces `dark` class on `<html>`. The CSS variables are never actually used by the Tailwind classes in the components.
**Impact:** No functional impact, but confusing dead CSS.
**Fix:** Remove the unused CSS variables or align them with the actual theme system.

### IN-04: Inconsistent Error Logging Levels

**File:** `backend/app/services/data_fetcher.py:117,159,243`
**Issue:** FBIL failure logs as `warning` (line 159) but yfinance failure logs as `error` (line 117). Both are recoverable via fallbacks.
**Impact:** Operational noise; inconsistent alerting.
**Fix:** Use `warning` for all recoverable data source failures; `error` only for unrecoverable situations.

### IN-05: detect.py Uses sys.path Manipulation

**File:** `backend/detect.py:14`
**Issue:** `sys.path.insert(0, ...)` is a code smell. The CLI should be invoked as a module or with proper package configuration.
**Impact:** Fragile import path; breaks if file is moved.
**Fix:** Add a `[tool.poetry.scripts]` or `console_scripts` entry in `pyproject.toml`:
```toml
[tool.poetry.scripts]
detect = "app.cli:detect"
```

### IN-06: Hardcoded Asset List Duplication

**File:** `backend/app/services/correlation_engine.py:13`, `backend/app/services/data_fetcher.py:46`, `frontend/src/components/CorrelationMatrix.tsx:6`
**Issue:** The asset list `["NIFTY50", "USDINR", "GOLD", "CRUDE", "GSEC10Y", "FII_FLOW"]` is defined in three places. Changes require updating all three.
**Impact:** Risk of divergence; maintenance burden.
**Fix:** Define assets in a single source of truth (e.g., `config.py` or a shared constants file) and import everywhere.

### IN-07: No API Response Compression

**File:** `backend/app/main.py`
**Issue:** No gzip/brotli compression middleware. The regime-history endpoint returns large JSON payloads (15 pairs × 500+ dates).
**Impact:** Increased bandwidth usage; slower initial loads.
**Fix:**
```python
from fastapi.middleware.gzip import GZipMiddleware
app.add_middleware(GZipMiddleware, minimum_size=1000)
```

---

## Positive Observations

1. **Clean Architecture**: Excellent separation of concerns with distinct layers for data fetching, computation, caching, and API routing.

2. **Vectorized Computation**: The correlation engine uses pandas' native `rolling().corr()` which is C-optimized, avoiding slow Python loops.

3. **Graceful Degradation**: Multiple fallback mechanisms (FBIL → cache → synthetic, NSE → cache → synthetic) ensure the application never crashes on data source failures.

4. **Smart Caching Strategy**: Pre-computing all three correlation windows at startup eliminates cold-start latency for end users.

5. **Input Validation**: API endpoints validate window parameters and return clear error messages.

6. **Type Safety (Frontend)**: TypeScript types mirror backend Pydantic schemas, providing end-to-end type safety.

7. **Thoughtful UI/UX**: The loading states, error handling, and polling logic in `BackendStatus` provide a smooth user experience during backend warm-up.

8. **Rate Limiting**: Proper rate limiting with `slowapi` prevents abuse.

9. **Cache-Control Headers**: Appropriate HTTP caching headers reduce unnecessary API calls.

10. **Pagination**: The anomaly alerts endpoint supports offset-based pagination with `total_count`, enabling efficient frontend paging.

---

## Overall Assessment

The codebase is **production-ready with moderate risk**. The critical issues (CR-01 through CR-04) should be addressed before deployment:

1. **CR-01** (thread-unsafe random) can cause non-deterministic behavior in production.
2. **CR-02** (missing null check) will cause 500 errors during cache cold starts.
3. **CR-03** (QueryClient lifecycle) can cause state leakage in SSR.
4. **CR-04** (unvalidated asset names) is a security hygiene issue.

The warnings (WR-01 through WR-12) represent important improvements for reliability, security, and maintainability. Several (WR-03 Docker user, WR-09 Pydantic schemas, WR-12 frontend Dockerfile) are deployment blockers.

The code quality is generally high with good documentation, consistent patterns, and thoughtful error handling. The main areas for improvement are thread safety, input validation, and deployment configuration.

---

_Reviewed: 2026-05-29T00:00:00Z_
_Reviewer: gsd-code-reviewer_
_Depth: deep_
