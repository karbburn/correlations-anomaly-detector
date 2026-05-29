"""
Anomaly endpoints — paginated alerts and regime history.

Alerts support offset-based pagination with total_count.
"""

import numpy as np
from fastapi import APIRouter, Query, Response, HTTPException

from app.services.cache import get_pair_corrs, get_default_alerts, is_cache_warm
from app.services.anomaly_detector import detect_anomalies, classify_regime, compute_zscore_series
from app.services.correlation_engine import ASSETS
from app.services.interpretation import interpret_anomaly
from app.models.schemas import AlertsResponse
from app.config import get_settings

router = APIRouter()
settings = get_settings()

CACHE_HEADER = "public, max-age=300, stale-while-revalidate=60"


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
    Supports offset-based pagination with total_count for frontend paging.
    Uses cached alerts when params match defaults to avoid recomputation.
    """
    if not is_cache_warm():
        raise HTTPException(503, "Server is still warming up")

    if window not in (30, 60, 252):
        raise HTTPException(400, "window must be 30, 60, or 252")

    # Use cached alerts for default params to avoid expensive recomputation
    if window == settings.DEFAULT_WINDOW and abs(threshold - settings.DEFAULT_THRESHOLD) < 1e-6:
        alerts = get_default_alerts()
        if alerts is None:
            raise HTTPException(503, "Cached alerts not available")
    else:
        pair_corrs = get_pair_corrs(window)
        if pair_corrs is None:
            raise HTTPException(503, f"Correlation data for {window}d not available")
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
        pair_corrs_data = get_pair_corrs(window)
        for alert_dict in alert_dicts:
            a1, a2 = alert_dict["asset1"], alert_dict["asset2"]
            # Get pair correlation series for historical context
            pair_series = None
            if pair_corrs_data is not None:
                col = f"{a1}__{a2}"
                if col not in pair_corrs_data.columns:
                    col = f"{a2}__{a1}"
                if col in pair_corrs_data.columns:
                    pair_series = pair_corrs_data[col].dropna()

            result = interpret_anomaly(
                asset1=a1,
                asset2=a2,
                zscore=alert_dict["zscore"],
                correlation=alert_dict["correlation"],
                regime=alert_dict["regime"],
                pair_corr_series=pair_series,
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
    threshold: float = Query(default=2.0),
):
    """
    Return correlation regime classification per date per pair.
    Flat structure optimized for the D3 heat calendar on the frontend.
    """
    if not is_cache_warm():
        raise HTTPException(503, "Server is still warming up")

    pair_corrs = get_pair_corrs(window)
    if pair_corrs is None:
        raise HTTPException(503, f"Correlation data for {window}d not available")

    # Get pairs and dates
    pair_names = list(pair_corrs.columns)
    clean = pair_corrs.dropna(how="all")
    dates = [str(d.date()) if hasattr(d, "date") else str(d) for d in clean.index]

    regimes = {}
    for col in pair_names:
        corr_series = clean[col]
        z_series, _, _ = compute_zscore_series(corr_series, settings.HIST_WINDOW)

        regimes[col] = [
            classify_regime(
                float(corr_series.iloc[i]) if not np.isnan(corr_series.iloc[i]) else 0.0,
                float(z_series.iloc[i]) if not np.isnan(z_series.iloc[i]) else 0.0,
                threshold,
            )
            for i in range(len(clean))
        ]

    response.headers["Cache-Control"] = CACHE_HEADER

    return {
        "pairs": pair_names,
        "dates": dates,
        "regimes": regimes,
    }
