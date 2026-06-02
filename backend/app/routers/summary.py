"""
Summary endpoint — lightweight dashboard overview from cached data.
"""

from datetime import date, timedelta

import numpy as np
import pandas as pd
from fastapi import APIRouter, Response

from app.services.cache import get_default_alerts, get_pair_corrs
from app.config import get_settings

router = APIRouter()
settings = get_settings()

CACHE_HEADER = "public, max-age=300, stale-while-revalidate=60"


@router.get("/summary")
async def dashboard_summary(response: Response):
    """
    Return a lightweight summary from cached data.
    Zero recomputation — reads directly from the in-memory store.
    """
    required_alert_cols = {"date", "asset1", "asset2", "zscore", "regime"}
    alerts_df = get_default_alerts()
    if alerts_df is None:
        alerts_df = pd.DataFrame(columns=sorted(required_alert_cols))
    else:
        for col in required_alert_cols:
            if col not in alerts_df.columns:
                alerts_df[col] = pd.Series(dtype="object")

    pair_corrs = get_pair_corrs(settings.DEFAULT_WINDOW)
    if pair_corrs is None:
        pair_corrs = pd.DataFrame()

    today = str(date.today())

    # Count today's anomalies
    today_alerts = alerts_df[alerts_df["date"] == today] if not alerts_df.empty else alerts_df
    total_today = len(today_alerts)

    # Top movers: highest |z-score| from recent alerts (last 7 days)
    week_ago = str(date.today() - timedelta(days=7))
    recent = alerts_df[alerts_df["date"] >= week_ago] if not alerts_df.empty else alerts_df
    top_movers = []
    if not recent.empty:
        recent_sorted = recent.reindex(
            recent["zscore"].abs().sort_values(ascending=False).index
        )
        for _, row in recent_sorted.head(5).iterrows():
            top_movers.append({
                "pair": f"{row['asset1']}__{row['asset2']}",
                "zscore": round(float(row["zscore"]), 2),
                "direction": row["regime"],
                "date": str(row["date"]),
            })

    # Regime summary from latest correlation snapshot
    regime_counts = {"anomaly": 0, "strong_positive": 0, "mild_positive": 0,
                     "neutral": 0, "mild_negative": 0, "strong_negative": 0}
    clean_corrs = pair_corrs.dropna(how="all")
    last_row = clean_corrs.iloc[-1] if not clean_corrs.empty else None
    if last_row is not None:
        for col, val in last_row.items():
            if np.isnan(val):
                regime_counts["neutral"] += 1
                continue
            fval = float(val)
            # Check if this pair has an anomaly today
            parts = col.split("__")
            is_anomaly = False
            if len(parts) == 2 and not today_alerts.empty:
                pair_alerts = today_alerts[
                    ((today_alerts["asset1"] == parts[0]) & (today_alerts["asset2"] == parts[1])) |
                    ((today_alerts["asset1"] == parts[1]) & (today_alerts["asset2"] == parts[0]))
                ]
                is_anomaly = len(pair_alerts) > 0

            if is_anomaly:
                regime_counts["anomaly"] += 1
            elif fval >= 0.7:
                regime_counts["strong_positive"] += 1
            elif fval >= 0.3:
                regime_counts["mild_positive"] += 1
            elif fval > -0.3:
                regime_counts["neutral"] += 1
            elif fval > -0.7:
                regime_counts["mild_negative"] += 1
            else:
                regime_counts["strong_negative"] += 1

    as_of = str(clean_corrs.index[-1].date()) if not clean_corrs.empty else today

    response.headers["Cache-Control"] = CACHE_HEADER

    return {
        "as_of_date": as_of,
        "total_anomalies_today": total_today,
        "total_anomalies_week": len(recent),
        "top_movers": top_movers,
        "regime_summary": regime_counts,
    }
