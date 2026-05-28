"""
Tests for the correlation engine.
"""

import numpy as np
import pandas as pd
import pytest
from app.services.correlation_engine import (
    compute_all_pair_correlations,
    pair_corr_to_matrix,
    ASSETS,
)


def test_pair_count(synthetic_returns):
    """15 unique pairs from 6 assets: C(6,2) = 15."""
    result = compute_all_pair_correlations(synthetic_returns, window=30)
    assert result.shape[1] == 15


def test_correlation_bounds(synthetic_returns):
    """All correlations should be in [-1, 1]."""
    result = compute_all_pair_correlations(synthetic_returns, window=60)
    clean = result.dropna()
    assert (clean >= -1.0).all().all()
    assert (clean <= 1.0).all().all()


def test_known_correlation(correlated_returns):
    """
    Assets with known ρ ≈ 0.8 should produce a rolling correlation
    near 0.8 once the window has enough data.
    """
    result = compute_all_pair_correlations(correlated_returns, window=60)
    col = result.columns[0]  # only one pair: A__B
    last_30 = result[col].dropna().tail(30)
    mean_corr = last_30.mean()
    assert 0.5 < mean_corr < 1.0, f"Expected ~0.8, got {mean_corr:.3f}"


def test_matrix_symmetry(synthetic_returns):
    """Reconstructed matrix should be symmetric with 1s on diagonal."""
    corrs = compute_all_pair_correlations(synthetic_returns, window=60)
    last_row = corrs.dropna(how="all").iloc[-1]
    assets = [a for a in ASSETS if a in synthetic_returns.columns]
    matrix = pair_corr_to_matrix(last_row, assets)

    # Check symmetry
    np.testing.assert_array_almost_equal(matrix.values, matrix.values.T)

    # Check diagonal is 1.0
    for i in range(len(assets)):
        assert matrix.iloc[i, i] == 1.0


def test_matrix_shape(synthetic_returns):
    """Matrix should be 6×6 for 6 assets."""
    corrs = compute_all_pair_correlations(synthetic_returns, window=30)
    last_row = corrs.dropna(how="all").iloc[-1]
    assets = [a for a in ASSETS if a in synthetic_returns.columns]
    matrix = pair_corr_to_matrix(last_row, assets)
    assert matrix.shape == (6, 6)
