"""
Correlation endpoints — matrix snapshot and pair timeseries.

Responses include Cache-Control: public, max-age=300, stale-while-revalidate=60
because correlation data only changes when the cache refreshes (hourly).
"""

import datetime

import numpy as np
import pandas as pd
from fastapi import APIRouter, Query, Response, HTTPException

from app.services.cache import get_pair_corrs, get_returns, get_pair_zscores
from app.services.correlation_engine import ASSETS
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
        clean = pair_corrs.dropna(how="all")
        if clean.empty:
            raise HTTPException(404, f"No correlation data available for window={window}")
        row = clean.iloc[-1]
        as_of = row.name.date() if hasattr(row.name, "date") else row.name

    returns = get_returns()
    assets = [a for a in ASSETS if returns is not None and a in returns.columns]

    zscore_df = get_pair_zscores(window)
    n = len(assets)
    index_of = {a: i for i, a in enumerate(assets)}
    corr_out = [[None] * n for _ in range(n)]
    zscore_out = [[None] * n for _ in range(n)]
    flags_out = [[False] * n for _ in range(n)]
    for i in range(n):
        corr_out[i][i] = 1.0

    for col in pair_corrs.columns:
        parts = col.split("__")
        if len(parts) != 2:
            continue
        a1, a2 = parts
        i, j = index_of.get(a1), index_of.get(a2)
        if i is None or j is None or i == j:
            continue

        corr_val = row.get(col)
        if corr_val is not None and not pd.isna(corr_val):
            v = round(float(corr_val), 4)
            corr_out[i][j] = v
            corr_out[j][i] = v

        z_col = f"{col}__zscore"
        if zscore_df is not None and z_col in zscore_df.columns and row.name in zscore_df.index:
            raw = zscore_df.loc[row.name, z_col]
            if not pd.isna(raw):
                z_val = round(float(raw), 4)
                zscore_out[i][j] = z_val
                zscore_out[j][i] = z_val
                is_anomaly = abs(z_val) > settings.DEFAULT_THRESHOLD
                flags_out[i][j] = is_anomaly
                flags_out[j][i] = is_anomaly

    response.headers["Cache-Control"] = CACHE_HEADER

    return {
        "window": window,
        "as_of_date": as_of,
        "assets": assets,
        "matrix": corr_out,
        "zscore_matrix": zscore_out,
        "anomaly_flags": flags_out,
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
        try:
            start_ts = pd.to_datetime(start)
        except (ValueError, TypeError):
            raise HTTPException(400, f"Invalid start format: {start}. Use YYYY-MM-DD.")
        series = series[series.index >= start_ts]

    zscore_df = get_pair_zscores(window)
    z_col = f"{col}__zscore"
    if zscore_df is not None and z_col in zscore_df.columns:
        z_series = zscore_df[z_col].reindex(series.index)
    else:
        z_series = pd.Series(0.0, index=series.index)

    dates = [str(d.date()) if hasattr(d, "date") else str(d) for d in series.index]
    correlations = [round(float(v), 4) if not np.isnan(v) else None for v in series.values]
    zscores = [round(float(v), 4) if not np.isnan(v) else None for v in z_series.values]
    anomaly_flags = [bool(abs(z) > settings.DEFAULT_THRESHOLD) if not np.isnan(z) else False
                     for z in z_series.values]

    response.headers["Cache-Control"] = CACHE_HEADER

    return {
        "pair": [asset1, asset2],
        "window": window,
        "dates": dates,
        "correlations": correlations,
        "zscores": zscores,
        "anomaly_flags": anomaly_flags,
    }
