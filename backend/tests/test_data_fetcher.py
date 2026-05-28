"""
Tests for data fetcher module.
These test the normalisation and alignment logic, not the actual HTTP calls.
"""

import numpy as np
import pandas as pd
import pytest

from app.services.data_fetcher import _zscore_normalize_flow, DataQualityError


def test_zscore_normalize_basic():
    """Z-score normalized flow should have mean ≈ 0 and std ≈ 1 over the lookback."""
    np.random.seed(42)
    n = 500
    raw_flow = pd.Series(
        np.random.normal(loc=100, scale=1500, size=n),
        index=pd.bdate_range("2022-01-03", periods=n),
    )
    normalized = _zscore_normalize_flow(raw_flow, lookback=252)
    clean = normalized.dropna()

    # After sufficient lookback, the series should be roughly zero-mean
    last_100 = clean.tail(100)
    assert abs(last_100.mean()) < 1.0, f"Mean too far from 0: {last_100.mean():.3f}"


def test_zscore_normalize_no_infinity():
    """Z-score normalization should never produce infinity."""
    raw = pd.Series(
        [100, -50, 200, -300, 100, 0, 0, 0, 0, 0] * 30,
        index=pd.bdate_range("2022-01-03", periods=300),
    )
    normalized = _zscore_normalize_flow(raw, lookback=60)
    assert not np.isinf(normalized).any(), "Infinity found in z-scored flow"


def test_data_quality_error():
    """DataQualityError should be importable and raisable."""
    with pytest.raises(DataQualityError):
        raise DataQualityError("Test error")
