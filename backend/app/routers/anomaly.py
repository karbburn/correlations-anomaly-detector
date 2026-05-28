"""
Anomaly endpoints — paginated alerts and regime history.

Alerts support offset-based pagination with total_count.
"""

import numpy as np
from fastapi import APIRouter, Query, Response, HTTPException

from app.services.cache import get_pair_corrs, is_cache_warm
from app.services.anomaly_detector import detect_anomalies, classify_regime, compute_zscore_series
from app.services.correlation_engine import ASSETS
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
):
    """
    Return paginated anomaly alerts sorted by date descending.
    Supports offset-based pagination with total_count for frontend paging.
    """
    if not is_cache_warm():
        raise HTTPException(503, "Server is still warming up")

    if window not in (30, 60, 252):
        raise HTTPException(400, "window must be 30, 60, or 252")

    pair_corrs = get_pair_corrs(window)
    if pair_corrs is None:
        raise HTTPException(503, f"Correlation data for {window}d not available")

    # Compute alerts (or use cached if default params)
    alerts = detect_anomalies(pair_corrs, threshold=threshold, hist_window=settings.HIST_WINDOW)

    # Filter by start date
    if start and not alerts.empty:
        alerts = alerts[alerts["date"] >= start]

    # Add window to each alert
    if not alerts.empty:
        alerts = alerts.copy()
        alerts["window"] = window

    total_count = len(alerts)

    # Paginate
    page = alerts.iloc[offset:offset + limit] if not alerts.empty else alerts

    response.headers["Cache-Control"] = CACHE_HEADER

    return {
        "threshold": threshold,
        "total_count": total_count,
        "offset": offset,
        "limit": limit,
        "has_more": (offset + limit) < total_count,
        "alerts": page.to_dict(orient="records"),
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
