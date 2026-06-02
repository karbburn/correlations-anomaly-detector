"""
Tests for the /api/summary endpoint with an empty alerts cache.

The summary endpoint must not raise IndexError or 500 when the cache
is in its empty state (no alerts loaded yet). It should return 200 with
total_anomalies_today == 0.
"""

import pandas as pd
import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def empty_store():
    """Force the in-memory store into an empty-alerts state with no cache."""
    from app.services import cache

    # Snapshot the keys we touch so we can restore them after the test
    keys_to_clear = [
        "alerts_default",
        "returns",
        "corr_30d",
        "corr_60d",
        "corr_252d",
        "zscore_30d",
        "zscore_60d",
        "zscore_252d",
    ]
    saved = {k: cache._store.get(k) for k in keys_to_clear}
    saved_warm = cache._store.get("_warm")

    for k in keys_to_clear:
        cache._store.pop(k, None)
    cache._store["_warm"] = True  # server is "up" but cache is empty
    # Also reset the warming stage so BackendStatus fallback works
    cache._store.pop("warming_stage", None)

    try:
        yield cache
    finally:
        for k, v in saved.items():
            if v is None:
                cache._store.pop(k, None)
            else:
                cache._store[k] = v
        if saved_warm is None:
            cache._store.pop("_warm", None)
        else:
            cache._store["_warm"] = saved_warm


@pytest.fixture
def client_with_empty_cache(empty_store):
    from app.main import app
    return TestClient(app, raise_server_exceptions=False)


def test_summary_with_empty_alerts_returns_zero(client_with_empty_cache):
    """Summary should return 200 with total_anomalies_today == 0 when there
    are no alerts in the cache. Regression guard for the IndexError on
    all-NaN pair_corrs.dropna(how='all').iloc[-1] path."""
    resp = client_with_empty_cache.get("/api/summary")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_anomalies_today"] == 0
    assert data["total_anomalies_week"] == 0
    assert data["top_movers"] == []


def test_summary_with_all_nan_pair_corrs_does_not_500(empty_store):
    """If pair_corrs has rows but every row is all-NaN, the endpoint must
    still return 200 rather than raise IndexError on .iloc[-1]."""
    from app.main import app
    from fastapi.testclient import TestClient

    # 3 rows, every cell NaN — dropna(how="all") yields an empty frame
    nan_corrs = pd.DataFrame(
        [[float("nan")] * 2 for _ in range(3)],
        index=pd.bdate_range("2024-01-01", periods=3),
        columns=["NIFTY50__GOLD", "NIFTY50__USDINR"],
    )
    empty_store._store["corr_60d"] = nan_corrs
    empty_store._store["alerts_default"] = pd.DataFrame()  # no alerts

    client = TestClient(app, raise_server_exceptions=False)
    resp = client.get("/api/summary")
    assert resp.status_code == 200
    data = resp.json()
    # regime_summary must still be present and have all-zero counts
    assert "regime_summary" in data
    assert all(v == 0 for v in data["regime_summary"].values())
