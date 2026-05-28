"""
Anomaly detector — z-score based detection with clipping and regime labels.

v2 fixes:
  - Z-score clipped to [-10, +10] to prevent display explosion when std ≈ 0
  - classify_regime() uses both correlation direction AND z-score
  - Long-format output with proper date stringification
"""

import numpy as np
import pandas as pd


def compute_zscore_series(
    corr_series: pd.Series,
    hist_window: int = 252,
) -> tuple:
    """
    Z-score each rolling correlation value against its trailing history.

    z = (corr_t - mean(corr_{t-252..t})) / std(corr_{t-252..t})

    Clips output to [-10, 10] to prevent display explosion when std is tiny
    (e.g. a pair locked at 0.99 for months will have near-zero std and
    any small move will produce extreme z-scores).

    Returns (zscore, mean, std) tuple to avoid redundant computation.
    """
    mean = corr_series.rolling(window=hist_window, min_periods=60).mean()
    std = corr_series.rolling(window=hist_window, min_periods=60).std()

    # Replace zero std with NaN — can't define z-score with no variance
    std = std.where(std > 1e-6, np.nan)

    zscore = (corr_series - mean) / std
    return zscore.clip(-10, 10), mean, std


def detect_anomalies(
    all_pair_corrs: pd.DataFrame,
    threshold: float = 2.0,
    hist_window: int = 252,
) -> pd.DataFrame:
    """
    For every pair, compute z-scores and flag |z| > threshold as anomalies.
    Returns a long-format DataFrame sorted by date descending.
    """
    alerts = []

    for col in all_pair_corrs.columns:
        asset1, asset2 = col.split("__")
        corr = all_pair_corrs[col].dropna()

        if len(corr) < hist_window:
            continue  # not enough history for meaningful z-scores

        z, mean, std = compute_zscore_series(corr, hist_window)

        flagged = z[z.abs() > threshold].dropna()

        for date, z_val in flagged.items():
            if np.isnan(z_val) or np.isinf(z_val):
                continue
            alerts.append({
                "date":            str(date.date()) if hasattr(date, "date") else str(date),
                "asset1":          asset1,
                "asset2":          asset2,
                "correlation":     round(float(corr.loc[date]), 4),
                "zscore":          round(float(z_val), 4),
                "historical_mean": round(float(mean.loc[date]), 4),
                "historical_std":  round(float(std.loc[date]), 4) if not np.isnan(std.loc[date]) else 0.0,
                "regime":          "breakdown" if z_val < 0 else "surge",
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


def classify_regime(corr_value: float, zscore: float = 0.0, threshold: float = 2.0) -> str:
    """
    Combined regime classifier using both current correlation and z-score.
    The z-score flag takes priority — an anomaly is always labelled as such
    regardless of the correlation direction.
    """
    if np.isnan(corr_value):
        return "neutral"
    if abs(zscore) > threshold:
        return "anomaly"
    if corr_value >= 0.7:
        return "strong_positive"
    if corr_value >= 0.3:
        return "mild_positive"
    if corr_value > -0.3:
        return "neutral"
    if corr_value > -0.7:
        return "mild_negative"
    return "strong_negative"
