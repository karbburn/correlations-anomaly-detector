"""
Cache layer — in-memory store + parquet persistence.
"""

import asyncio
import logging
import threading
import time
from pathlib import Path
from typing import Optional

import pandas as pd

from app.config import get_settings
from app.services.data_fetcher import build_master_dataframe
from app.services.correlation_engine import compute_all_pair_correlations
from app.services.anomaly_detector import detect_anomalies, compute_zscore_series

logger = logging.getLogger(__name__)
settings = get_settings()

_store: dict = {}
_store_lock = threading.Lock()

WARMING_STAGE_KEY = "warming_stage"


def _set_stage(stage: str) -> None:
    with _store_lock:
        _store[WARMING_STAGE_KEY] = stage


async def warm_cache() -> None:
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, _warm_sync)


def _warm_sync() -> None:
    cache_dir = Path(settings.CACHE_DIR)
    cache_dir.mkdir(parents=True, exist_ok=True)

    _set_stage("loading_cache")

    loaded_from_cache = _try_load_from_parquet(cache_dir)

    if loaded_from_cache:
        logger.info("Cache warm from parquet. Refreshing in background...")
        _set_stage("ready")
        with _store_lock:
            _store["_warm"] = True
        _refresh_cache(cache_dir)
    else:
        _fetch_and_compute(cache_dir)


def _try_load_from_parquet(cache_dir: Path) -> bool:
    try:
        returns_path = cache_dir / "master_returns.parquet"
        if not returns_path.exists():
            return False

        mtime = returns_path.stat().st_mtime
        age_hours = (time.time() - mtime) / 3600
        if age_hours > 2:
            logger.info(f"Parquet cache is {age_hours:.1f}h old — re-fetching")
            return False

        logger.info("Loading returns from parquet cache...")
        returns = pd.read_parquet(returns_path)

        corr_data = {}
        zscore_data = {}
        for window in [30, 60, 252]:
            corr_path = cache_dir / f"corr_{window}d.parquet"
            zscore_path = cache_dir / f"zscore_{window}d.parquet"

            if corr_path.exists():
                pair_corrs = pd.read_parquet(corr_path)
                corr_data[f"corr_{window}d"] = pair_corrs

                if zscore_path.exists():
                    zscore_df = pd.read_parquet(zscore_path)
                    zscore_data[f"zscore_{window}d"] = zscore_df
                else:
                    logger.info(f"Computing z-scores for window={window}d...")
                    zscore_df = pd.DataFrame(index=pair_corrs.index)
                    for col in pair_corrs.columns:
                        series = pair_corrs[col].dropna()
                        if len(series) >= settings.HIST_WINDOW:
                            z, mean, std = compute_zscore_series(series, settings.HIST_WINDOW)
                            zscore_df[f"{col}__zscore"] = z
                            zscore_df[f"{col}__mean"] = mean
                            zscore_df[f"{col}__std"] = std
                    zscore_data[f"zscore_{window}d"] = zscore_df

        alerts_path = cache_dir / f"alerts_60d_{settings.DEFAULT_THRESHOLD}.parquet"
        alerts = pd.read_parquet(alerts_path) if alerts_path.exists() else pd.DataFrame()

        with _store_lock:
            _store["returns"] = returns
            _store.update(corr_data)
            _store.update(zscore_data)
            _store["alerts_default"] = alerts

        logger.info(f"Loaded from cache: {returns.shape[0]} rows, {len(alerts)} alerts")
        return True

    except Exception as e:
        logger.warning(f"Failed to load from parquet cache: {e}")
        return False


def _refresh_cache(cache_dir: Path) -> None:
    try:
        _fetch_and_compute(cache_dir)
    except Exception as e:
        logger.error(f"Background refresh failed: {e}")


def _fetch_and_compute(cache_dir: Path) -> None:
    _set_stage("fetching")
    logger.info("Fetching master returns...")
    returns = build_master_dataframe(start=settings.DATA_START_DATE)
    returns.to_parquet(cache_dir / "master_returns.parquet")

    _set_stage("computing")
    corr_data = {}
    zscore_data = {}
    for window in [30, 60, 252]:
        logger.info(f"Computing window={window}d correlations...")
        pair_corrs = compute_all_pair_correlations(returns, window=window)
        pair_corrs.to_parquet(cache_dir / f"corr_{window}d.parquet")
        corr_data[f"corr_{window}d"] = pair_corrs
        logger.info(f"  corr_{window}d: {pair_corrs.shape}")

        logger.info(f"Pre-computing z-scores for window={window}d...")
        zscore_df = pd.DataFrame(index=pair_corrs.index)
        for col in pair_corrs.columns:
            series = pair_corrs[col].dropna()
            if len(series) >= settings.HIST_WINDOW:
                z, mean, std = compute_zscore_series(series, settings.HIST_WINDOW)
                zscore_df[f"{col}__zscore"] = z
                zscore_df[f"{col}__mean"] = mean
                zscore_df[f"{col}__std"] = std
        zscore_df.to_parquet(cache_dir / f"zscore_{window}d.parquet")
        zscore_data[f"zscore_{window}d"] = zscore_df
        logger.info(f"  zscore_{window}d: {zscore_df.shape}")

    logger.info("Computing default anomaly alerts...")
    default_corrs = corr_data["corr_60d"]
    alerts = detect_anomalies(default_corrs, threshold=settings.DEFAULT_THRESHOLD)
    alerts.to_parquet(cache_dir / f"alerts_60d_{settings.DEFAULT_THRESHOLD}.parquet")

    with _store_lock:
        _store["returns"] = returns
        _store.update(corr_data)
        _store.update(zscore_data)
        _store["alerts_default"] = alerts
        _store["_warm"] = True
    _set_stage("ready")
    logger.info(f"  Returns: {returns.shape[0]} rows × {returns.shape[1]} assets")
    logger.info(f"  Alerts: {len(alerts)} rows")
    logger.info("Cache warm complete")


# ---------------------------------------------------------------------------
# Accessors — used by API routers
# ---------------------------------------------------------------------------

def get_pair_corrs(window: int) -> Optional[pd.DataFrame]:
    with _store_lock:
        return _store.get(f"corr_{window}d")


def get_pair_zscores(window: int) -> Optional[pd.DataFrame]:
    with _store_lock:
        return _store.get(f"zscore_{window}d")


def get_returns() -> Optional[pd.DataFrame]:
    with _store_lock:
        return _store.get("returns")


def get_default_alerts() -> Optional[pd.DataFrame]:
    with _store_lock:
        return _store.get("alerts_default")


def is_cache_warm() -> bool:
    with _store_lock:
        return _store.get("_warm", False)


def get_warming_stage() -> str:
    with _store_lock:
        return _store.get(WARMING_STAGE_KEY, "idle")


def set_staleness(key: str, value: bool) -> None:
    with _store_lock:
        _store[key] = value


def get_staleness(key: str) -> bool:
    with _store_lock:
        return _store.get(key, False)
