"""
Correlation endpoints — matrix snapshot and pair timeseries.

Responses include Cache-Control: public, max-age=300, stale-while-revalidate=60
because correlation data only changes when the cache refreshes (hourly).
"""

import datetime

import numpy as np
import pandas as pd
from fastapi import APIRouter, Query, Response, HTTPException

from app.services.cache import get_pair_corrs, get_returns
from app.services.correlation_engine import pair_corr_to_matrix, ASSETS
from app.services.anomaly_detector import compute_zscore_series
from app.models.schemas import CorrelationMatrix
from app.config import get_settings

router = APIRouter()
settings = get_settings()

CACHE_HEADER = "public, max-age=300, stale-while-revalidate=60"


@router.get("/matrix", response_model=CorrelationMatrix)
async def correlation_matrix(
    response: Response,
    window: int = Query(default=60, description="Rolling window: 30, 60, or 252"),
    date_str: str = Query(default=None, alias="date", description="Snapshot date YYYY-MM-DD"),
):
    """
    Return the 6×6 correlation matrix for a given window and date.
    Also returns the z-score matrix and anomaly flags.
    """
    if window not in (30, 60, 252):
        raise HTTPException(400, "window must be 30, 60, or 252")

    pair_corrs = get_pair_corrs(window)
    if pair_corrs is None:
        response.headers["Cache-Control"] = CACHE_HEADER
        return {
            "window": window,
            "as_of_date": str(datetime.date.today()),
            "assets": [],
            "matrix": [],
            "zscore_matrix": [],
            "anomaly_flags": [],
        }

    if date_str:
        try:
            target = pd.Timestamp(date_str)
        except (ValueError, TypeError):
            raise HTTPException(400, f"Invalid date format: {date_str}. Use YYYY-MM-DD.")
        if target not in pair_corrs.index:
            raise HTTPException(404, f"No data for date {date_str}")
        row = pair_corrs.loc[target]
        as_of = pd.Timestamp(date_str).date()
    else:
        row = pair_corrs.dropna(how="all").iloc[-1]
        as_of = row.name.date() if hasattr(row.name, "date") else row.name

    returns = get_returns()
    assets = [a for a in ASSETS if returns is not None and a in returns.columns]
    corr_matrix = pair_corr_to_matrix(row, assets)

    zscore_matrix_df = corr_matrix.copy()
    zscore_matrix_df[:] = 0.0
    anomaly_flags_df = corr_matrix.copy().astype(bool)
    anomaly_flags_df[:] = False

    for col in pair_corrs.columns:
        parts = col.split("__")
        if len(parts) != 2:
            continue
        a1, a2 = parts
        series = pair_corrs[col].dropna()
        z_series, _, _ = compute_zscore_series(series, settings.HIST_WINDOW)
        if row.name in z_series.index:
            z_val = float(z_series.loc[row.name])
            if not np.isnan(z_val):
                zscore_matrix_df.loc[a1, a2] = z_val
                zscore_matrix_df.loc[a2, a1] = z_val
                is_anomaly = abs(z_val) > settings.DEFAULT_THRESHOLD
                anomaly_flags_df.loc[a1, a2] = is_anomaly
                anomaly_flags_df.loc[a2, a1] = is_anomaly

    response.headers["Cache-Control"] = CACHE_HEADER

    return {
        "window": window,
        "as_of_date": as_of,
        "assets": assets,
        "matrix": corr_matrix.values.tolist(),
        "zscore_matrix": zscore_matrix_df.values.tolist(),
        "anomaly_flags": anomaly_flags_df.values.tolist(),
    }


@router.get("/timeseries")
async def correlation_timeseries(
    response: Response,
    asset1: str = Query(..., description="First asset name"),
    asset2: str = Query(..., description="Second asset name"),
    window: int = Query(default=60),
    start: str = Query(default=None, description="Start date YYYY-MM-DD"),
):
    """
    Return rolling correlation + z-score timeseries for one asset pair.
    """
    if window not in (30, 60, 252):
        raise HTTPException(400, "window must be 30, 60, or 252")

    valid_assets = set(ASSETS)
    if asset1 not in valid_assets or asset2 not in valid_assets:
        raise HTTPException(400, f"Invalid asset. Valid: {sorted(valid_assets)}")

    pair_corrs = get_pair_corrs(window)
    if pair_corrs is None:
        response.headers["Cache-Control"] = CACHE_HEADER
        return {
            "pair": [asset1, asset2],
            "window": window,
            "dates": [],
            "correlations": [],
            "zscores": [],
            "anomaly_flags": [],
        }

    col = f"{asset1}__{asset2}"
    if col not in pair_corrs.columns:
        col = f"{asset2}__{asset1}"
        if col not in pair_corrs.columns:
            raise HTTPException(404, f"Pair {asset1}/{asset2} not found")

    series = pair_corrs[col].dropna()

    if start:
        series = series[series.index >= start]

    z_series, _, _ = compute_zscore_series(series, settings.HIST_WINDOW)

    dates = [str(d.date()) if hasattr(d, "date") else str(d) for d in series.index]
    correlations = [round(float(v), 4) if not np.isnan(v) else None for v in series.values]
    zscores = [round(float(v), 4) if not np.isnan(v) else None for v in z_series.reindex(series.index).values]
    anomaly_flags = [bool(abs(z) > settings.DEFAULT_THRESHOLD) if z is not None and not np.isnan(z) else False
                     for z in z_series.reindex(series.index).values]

    response.headers["Cache-Control"] = CACHE_HEADER

    return {
        "pair": [asset1, asset2],
        "window": window,
        "dates": dates,
        "correlations": correlations,
        "zscores": zscores,
        "anomaly_flags": anomaly_flags,
    }
