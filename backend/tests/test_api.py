"""
API endpoint tests using FastAPI TestClient.
Tests the response schemas and HTTP headers.
"""

import pytest
from unittest.mock import patch
import numpy as np
import pandas as pd
from fastapi.testclient import TestClient


@pytest.fixture
def mock_warm_store():
    """Pre-populate the in-memory store with synthetic data."""
    from app.services import cache
    from app.services.correlation_engine import compute_all_pair_correlations

    np.random.seed(42)
    n = 400
    dates = pd.bdate_range("2022-01-03", periods=n)
    columns = ["NIFTY50", "USDINR", "GOLD", "CRUDE", "GSEC10Y", "FII_FLOW"]
    returns = pd.DataFrame(
        np.random.randn(n, 6) * 0.01,
        index=dates,
        columns=columns,
    )
    cache._store["returns"] = returns
    cache._store["_warm"] = True

    for w in [30, 60, 252]:
        cache._store[f"corr_{w}d"] = compute_all_pair_correlations(returns, window=w)


@pytest.fixture
def client(mock_warm_store):
    """Create a test client with mocked lifespan (no real data fetch)."""
    from app.main import app
    # Override lifespan to skip warm_cache
    return TestClient(app, raise_server_exceptions=False)


def test_health_endpoint(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["startup_complete"] is True


def test_correlation_matrix_default(client):
    resp = client.get("/api/correlation/matrix?window=60")
    assert resp.status_code == 200
    data = resp.json()
    assert data["window"] == 60
    assert len(data["assets"]) == 6
    assert len(data["matrix"]) == 6
    assert len(data["matrix"][0]) == 6
    # Check Cache-Control header
    assert "max-age=300" in resp.headers.get("cache-control", "")


def test_correlation_matrix_invalid_window(client):
    resp = client.get("/api/correlation/matrix?window=45")
    assert resp.status_code == 400


def test_correlation_timeseries(client):
    resp = client.get("/api/correlation/timeseries?asset1=NIFTY50&asset2=GOLD&window=60")
    assert resp.status_code == 200
    data = resp.json()
    assert data["pair"] == ["NIFTY50", "GOLD"]
    assert len(data["dates"]) > 0
    assert len(data["correlations"]) == len(data["dates"])


def test_anomaly_alerts_pagination(client):
    resp = client.get("/api/anomaly/alerts?window=60&threshold=1.5&limit=10&offset=0")
    assert resp.status_code == 200
    data = resp.json()
    assert "total_count" in data
    assert "offset" in data
    assert "limit" in data
    assert "has_more" in data
    assert data["limit"] == 10


def test_regime_history(client):
    resp = client.get("/api/anomaly/regime-history?window=60&threshold=2.0")
    assert resp.status_code == 200
    data = resp.json()
    assert "pairs" in data
    assert "dates" in data
    assert "regimes" in data
    assert len(data["pairs"]) == 15  # C(6,2)
