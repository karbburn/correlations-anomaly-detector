"""
Tests for the anomaly detector.
"""

import numpy as np
import pandas as pd
import pytest
from app.services.anomaly_detector import (
    compute_zscore_series,
    detect_anomalies,
    classify_regime,
)
from app.services.correlation_engine import compute_all_pair_correlations


def test_zscore_clipping():
    """Z-scores should be clipped to [-10, 10]."""
    # Create a series with a sudden spike
    np.random.seed(42)
    n = 400
    series = pd.Series(
        np.concatenate([np.zeros(350), np.ones(50) * 0.99]),
        index=pd.bdate_range("2022-01-03", periods=n),
    )
    z = compute_zscore_series(series, hist_window=252)
    clean = z.dropna()
    assert clean.max() <= 10.0
    assert clean.min() >= -10.0


def test_zscore_range_random(synthetic_returns):
    """Z-scores on random noise shouldn't be extreme."""
    corrs = compute_all_pair_correlations(synthetic_returns, window=60)
    col = corrs.columns[0]
    z = compute_zscore_series(corrs[col].dropna(), hist_window=252)
    clean = z.dropna()
    assert clean.abs().max() < 10.0


def test_detect_anomalies_returns_dataframe(synthetic_returns):
    """detect_anomalies should return a DataFrame with expected columns."""
    corrs = compute_all_pair_correlations(synthetic_returns, window=60)
    alerts = detect_anomalies(corrs, threshold=2.0, hist_window=252)

    expected_cols = {
        "date", "asset1", "asset2", "correlation",
        "zscore", "historical_mean", "historical_std", "regime",
    }
    assert set(alerts.columns) == expected_cols


def test_detect_anomalies_regime_values(synthetic_returns):
    """All regime values should be 'breakdown' or 'surge'."""
    corrs = compute_all_pair_correlations(synthetic_returns, window=60)
    alerts = detect_anomalies(corrs, threshold=1.5, hist_window=252)

    if not alerts.empty:
        assert set(alerts["regime"].unique()).issubset({"breakdown", "surge"})


def test_classify_regime_anomaly():
    """Z-score above threshold should classify as 'anomaly'."""
    assert classify_regime(0.5, zscore=2.5, threshold=2.0) == "anomaly"
    assert classify_regime(-0.5, zscore=-2.5, threshold=2.0) == "anomaly"


def test_classify_regime_normal():
    """Normal z-scores should classify based on correlation value."""
    assert classify_regime(0.8, zscore=0.5, threshold=2.0) == "strong_positive"
    assert classify_regime(0.4, zscore=0.3, threshold=2.0) == "mild_positive"
    assert classify_regime(0.0, zscore=0.1, threshold=2.0) == "neutral"
    assert classify_regime(-0.5, zscore=-0.3, threshold=2.0) == "mild_negative"
    assert classify_regime(-0.8, zscore=-0.5, threshold=2.0) == "strong_negative"
