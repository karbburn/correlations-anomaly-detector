"""
Anomaly endpoints — paginated alerts and regime history.

Alerts support offset-based pagination with total_count.
"""

import numpy as np
import pandas as pd
from fastapi import APIRouter, Query, Response, HTTPException

from app.services.cache import get_pair_corrs, get_pair_zscores, get_default_alerts
from app.services.anomaly_detector import detect_anomalies
from app.services.interpretation import interpret_anomaly
from app.models.schemas import AlertsResponse
from app.config import get_settings

router = APIRouter()
settings = get_settings()

CACHE_HEADER = "public, max-age=300, stale-while-revalidate=60"


def _alerts_from_cached_zscores(pair_corrs, zscore_df, threshold):
    """Build alerts from pre-computed z-scores — fast re-filter on threshold change."""
    alerts = []
    for col in pair_corrs.columns:
        parts = col.split("__", 1)
        if len(parts) != 2:
            continue
        asset1, asset2 = parts

        z_col = f"{col}__zscore"
        mean_col = f"{col}__mean"
        std_col = f"{col}__std"

        if z_col not in zscore_df.columns:
            continue

        z_series = zscore_df[z_col].dropna()
        flagged = z_series[z_series.abs() > threshold]

        for date, z_val in flagged.items():
            if np.isnan(z_val) or np.isinf(z_val):
                continue
            if date not in pair_corrs.index:
                continue
            corr_val = pair_corrs[col].loc[date]
            mean_val = zscore_df[mean_col].loc[date]
            std_val = zscore_df[std_col].loc[date]

            alerts.append({
                "date": str(date.date()) if hasattr(date, "date") else str(date),
                "asset1": asset1,
                "asset2": asset2,
                "correlation": round(float(corr_val), 4),
                "zscore": round(float(z_val), 4),
                "historical_mean": round(float(mean_val), 4),
                "historical_std": round(float(std_val), 4) if not np.isnan(std_val) else None,
                "regime": "breakdown" if z_val < 0 else "surge",
            })

    if not alerts:
        return pd.DataFrame(columns=[
            "date", "asset1", "asset2", "correlation",
            "zscore", "historical_mean", "historical_std", "regime",
        ])

    return (
        pd.DataFrame(alerts)
        .sort_values("date", ascending=False)
        .reset_index(drop=True)
    )


@router.get("/alerts", response_model=AlertsResponse)
async def anomaly_alerts(
    response: Response,
    window: int = Query(default=60),
    threshold: float = Query(default=2.0),
    start: str = Query(default=None, description="Filter alerts from this date"),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    interpret: bool = Query(default=False, description="Include rule-based interpretations"),
):
    """
    Return paginated anomaly alerts sorted by date descending.
    Uses cached alerts when params match defaults to avoid recomputation.
    Uses cached z-scores for fast threshold re-filtering.
    """
    if window not in (30, 60, 252):
        raise HTTPException(400, "window must be 30, 60, or 252")

    # Use cached alerts for default params
    if window == settings.DEFAULT_WINDOW and abs(threshold - settings.DEFAULT_THRESHOLD) < 1e-6:
        alerts = get_default_alerts()
        if alerts is None:
            alerts = pd.DataFrame()
    else:
        # Try fast path: use cached z-scores for re-filtering
        pair_corrs = get_pair_corrs(window)
        if pair_corrs is None:
            alerts = pd.DataFrame()
        else:
            zscore_df = get_pair_zscores(window)
            if zscore_df is not None:
                alerts = _alerts_from_cached_zscores(pair_corrs, zscore_df, threshold)
            else:
                # Fallback: full recomputation
                alerts = detect_anomalies(pair_corrs, threshold=threshold, hist_window=settings.HIST_WINDOW)

    if start and not alerts.empty:
        alerts = alerts[alerts["date"] >= start]

    if not alerts.empty:
        alerts = alerts.copy()
        alerts["window"] = window

    total_count = len(alerts)

    page = alerts.iloc[offset:offset + limit] if not alerts.empty else alerts

    alert_dicts = page.to_dict(orient="records")

    # Enrich with interpretations if requested
    if interpret and alert_dicts:
        from app.services.anomaly_detector import compute_zscore_series

        pair_corrs_data = get_pair_corrs(window)
        _zscore_cache: dict[str, pd.Series] = {}
        for alert_dict in alert_dicts:
            a1, a2 = alert_dict["asset1"], alert_dict["asset2"]
            # Get pair correlation series for historical context
            pair_series = None
            zscore_series = None
            if pair_corrs_data is not None:
                col = f"{a1}__{a2}"
                if col not in pair_corrs_data.columns:
                    col = f"{a2}__{a1}"
                if col in pair_corrs_data.columns:
                    pair_series = pair_corrs_data[col].dropna()
                    if col not in _zscore_cache:
                        z, _, _ = compute_zscore_series(pair_series, settings.HIST_WINDOW)
                        _zscore_cache[col] = z
                    zscore_series = _zscore_cache[col]

            result = interpret_anomaly(
                asset1=a1,
                asset2=a2,
                zscore=alert_dict["zscore"],
                correlation=alert_dict["correlation"],
                regime=alert_dict["regime"],
                pair_corr_series=pair_series,
                zscore_series=zscore_series,
                threshold=threshold,
            )
            alert_dict["interpretation"] = {
                "headline": result.headline,
                "explanation": result.explanation,
                "confidence": result.confidence,
                "historical_context": result.historical_context,
            }

    response.headers["Cache-Control"] = CACHE_HEADER

    return {
        "threshold": threshold,
        "total_count": total_count,
        "offset": offset,
        "limit": limit,
        "has_more": (offset + limit) < total_count,
        "alerts": alert_dicts,
    }


@router.get("/regime-history")
async def regime_history(
    response: Response,
    window: int = Query(default=60),
):
    """
    Return raw correlation and z-score data per date per pair.
    The frontend classifies regimes client-side using its threshold,
    so this endpoint is threshold-independent and only refetches on window change.
    """
    pair_corrs = get_pair_corrs(window)
    if pair_corrs is None:
        response.headers["Cache-Control"] = CACHE_HEADER
        return {"pairs": [], "dates": [], "correlations": {}, "zscores": {}}

    pair_names = list(pair_corrs.columns)
    clean = pair_corrs.dropna(how="all")
    dates = [str(d.date()) if hasattr(d, "date") else str(d) for d in clean.index]

    zscore_df = get_pair_zscores(window)
    if zscore_df is None:
        response.headers["Cache-Control"] = CACHE_HEADER
        return {"pairs": list(pair_corrs.columns), "dates": [], "correlations": {}, "zscores": {}}

    correlations = {}
    zscores = {}
    for col in pair_names:
        z_col = f"{col}__zscore"
        correlations[col] = [
            round(float(clean[col].iloc[i]), 4) if not np.isnan(clean[col].iloc[i]) else None
            for i in range(len(clean))
        ]
        if z_col in zscore_df.columns:
            z_series = zscore_df[z_col].reindex(clean.index)
            zscores[col] = [
                round(float(z_series.iloc[i]), 4) if not np.isnan(z_series.iloc[i]) else None
                for i in range(len(clean))
            ]
        else:
            zscores[col] = [None] * len(clean)

    response.headers["Cache-Control"] = CACHE_HEADER

    return {
        "pairs": pair_names,
        "dates": dates,
        "correlations": correlations,
        "zscores": zscores,
    }
