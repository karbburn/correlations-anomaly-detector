"""
Cache layer — in-memory store + parquet persistence.

v2 strategy: one parquet per window, not per (window, date).
  - master_returns.parquet
  - corr_30d.parquet / corr_60d.parquet / corr_252d.parquet
  - alerts_60d_2.0.parquet (default params)
  - gsec_last_known.parquet / fii_last_known.parquet (fallback files)

warm_cache() is called at startup (lifespan) and hourly (scheduler).
"""

import asyncio
import logging
from pathlib import Path
from typing import Optional

import pandas as pd

from app.config import get_settings
from app.services.data_fetcher import build_master_dataframe
from app.services.correlation_engine import compute_all_pair_correlations
from app.services.anomaly_detector import detect_anomalies

logger = logging.getLogger(__name__)
settings = get_settings()

# ---------------------------------------------------------------------------
# In-memory store — populated at startup, refreshed hourly
# ---------------------------------------------------------------------------

_store: dict = {}


async def warm_cache() -> None:
    """
    Pre-fetch all data and pre-compute all correlation windows.
    Run at startup and on the hourly scheduler.
    Writes parquet files for persistence; updates in-memory store for speed.
    """
    loop = asyncio.get_running_loop()
    # Run CPU-bound work in thread pool so it doesn't block the event loop
    await loop.run_in_executor(None, _warm_sync)


def _warm_sync() -> None:
    """Synchronous cache warming — runs in thread pool."""
    cache_dir = Path(settings.CACHE_DIR)
    cache_dir.mkdir(parents=True, exist_ok=True)

    # 1. Fetch master returns
    logger.info("Fetching master returns...")
    returns = build_master_dataframe(start=settings.DATA_START_DATE)
    returns.to_parquet(cache_dir / "master_returns.parquet")
    _store["returns"] = returns
    logger.info(f"  Returns: {returns.shape[0]} rows × {returns.shape[1]} assets")

    # 2. Compute rolling correlations for all 3 windows
    for window in [30, 60, 252]:
        logger.info(f"Computing window={window}d correlations...")
        pair_corrs = compute_all_pair_correlations(returns, window=window)
        pair_corrs.to_parquet(cache_dir / f"corr_{window}d.parquet")
        _store[f"corr_{window}d"] = pair_corrs
        logger.info(f"  corr_{window}d: {pair_corrs.shape}")

    # 3. Pre-compute alerts for default params
    logger.info("Computing default anomaly alerts...")
    default_corrs = _store["corr_60d"]
    alerts = detect_anomalies(default_corrs, threshold=settings.DEFAULT_THRESHOLD)
    alerts.to_parquet(cache_dir / f"alerts_60d_{settings.DEFAULT_THRESHOLD}.parquet")
    _store["alerts_default"] = alerts
    logger.info(f"  Alerts: {len(alerts)} rows")

    _store["_warm"] = True
    logger.info("Cache warm complete ✅")


# ---------------------------------------------------------------------------
# Accessors — used by API routers
# ---------------------------------------------------------------------------

def get_pair_corrs(window: int) -> Optional[pd.DataFrame]:
    """Retrieve cached correlation DataFrame. Returns None if cache is cold."""
    return _store.get(f"corr_{window}d")


def get_returns() -> Optional[pd.DataFrame]:
    """Retrieve cached master returns DataFrame."""
    return _store.get("returns")


def get_default_alerts() -> Optional[pd.DataFrame]:
    """Retrieve pre-computed alerts for default params."""
    return _store.get("alerts_default")


def is_cache_warm() -> bool:
    """Check if cache has been warmed (startup complete)."""
    return _store.get("_warm", False)
