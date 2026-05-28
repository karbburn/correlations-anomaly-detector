"""
Cache layer — in-memory store + parquet persistence.
"""

import asyncio
import logging
import threading
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
_store_lock = threading.Lock()


async def warm_cache() -> None:
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, _warm_sync)


def _warm_sync() -> None:
    cache_dir = Path(settings.CACHE_DIR)
    cache_dir.mkdir(parents=True, exist_ok=True)

    logger.info("Fetching master returns...")
    returns = build_master_dataframe(start=settings.DATA_START_DATE)
    returns.to_parquet(cache_dir / "master_returns.parquet")

    corr_data = {}
    for window in [30, 60, 252]:
        logger.info(f"Computing window={window}d correlations...")
        pair_corrs = compute_all_pair_correlations(returns, window=window)
        pair_corrs.to_parquet(cache_dir / f"corr_{window}d.parquet")
        corr_data[f"corr_{window}d"] = pair_corrs
        logger.info(f"  corr_{window}d: {pair_corrs.shape}")

    logger.info("Computing default anomaly alerts...")
    default_corrs = corr_data["corr_60d"]
    alerts = detect_anomalies(default_corrs, threshold=settings.DEFAULT_THRESHOLD)
    alerts.to_parquet(cache_dir / f"alerts_60d_{settings.DEFAULT_THRESHOLD}.parquet")

    with _store_lock:
        _store["returns"] = returns
        _store.update(corr_data)
        _store["alerts_default"] = alerts
        _store["_warm"] = True
    logger.info(f"  Returns: {returns.shape[0]} rows × {returns.shape[1]} assets")
    logger.info(f"  Alerts: {len(alerts)} rows")
    logger.info("Cache warm complete")


# ---------------------------------------------------------------------------
# Accessors — used by API routers
# ---------------------------------------------------------------------------

def get_pair_corrs(window: int) -> Optional[pd.DataFrame]:
    with _store_lock:
        return _store.get(f"corr_{window}d")


def get_returns() -> Optional[pd.DataFrame]:
    with _store_lock:
        return _store.get("returns")


def get_default_alerts() -> Optional[pd.DataFrame]:
    with _store_lock:
        return _store.get("alerts_default")


def is_cache_warm() -> bool:
    with _store_lock:
        return _store.get("_warm", False)


def set_staleness(key: str, value: bool) -> None:
    with _store_lock:
        _store[key] = value


def get_staleness(key: str) -> bool:
    with _store_lock:
        return _store.get(key, False)
