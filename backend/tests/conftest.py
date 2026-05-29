"""
Shared test fixtures.
"""

import pytest
import numpy as np
import pandas as pd


@pytest.fixture
def synthetic_returns():
    """
    Generate 500 business days of random returns for 6 assets.
    Uses a fixed seed for reproducibility.
    """
    np.random.seed(42)
    n = 500
    dates = pd.bdate_range("2022-01-03", periods=n)
    columns = ["NIFTY50", "USDINR", "GOLD", "CRUDE", "GSEC10Y", "FII_FLOW"]
    data = np.random.randn(n, 6) * 0.01  # ~1% daily volatility
    return pd.DataFrame(data, index=dates, columns=columns)


@pytest.fixture
def correlated_returns():
    """
    Two assets with known positive correlation (ρ ≈ 0.8).
    Used to verify the correlation engine produces correct values.
    """
    np.random.seed(99)
    n = 300
    dates = pd.bdate_range("2023-01-02", periods=n)

    base = np.random.randn(n) * 0.01
    noise = np.random.randn(n) * 0.005

    return pd.DataFrame({
        "NIFTY50": base,
        "USDINR": base * 0.8 + noise,
    }, index=dates)
