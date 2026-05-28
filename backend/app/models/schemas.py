"""
Pydantic response models — updated with pagination for alerts.
"""

from pydantic import BaseModel
from typing import List, Optional
from datetime import date


class CorrelationMatrix(BaseModel):
    window: int
    as_of_date: date
    assets: List[str]
    matrix: List[List[float]]
    zscore_matrix: List[List[float]]
    anomaly_flags: List[List[bool]]


class PairTimeseries(BaseModel):
    pair: List[str]
    window: int
    dates: List[date]
    correlations: List[float]
    zscores: List[float]
    anomaly_flags: List[bool]


class AnomalyAlert(BaseModel):
    date: date
    asset1: str
    asset2: str
    window: int
    correlation: float
    zscore: float
    historical_mean: float
    historical_std: float
    regime: str  # "breakdown" | "surge"


class AlertsResponse(BaseModel):
    threshold: float
    total_count: int
    offset: int
    limit: int
    has_more: bool
    alerts: List[AnomalyAlert]


class CacheStatus(BaseModel):
    fresh: bool
    as_of: Optional[str] = None
    rows: Optional[int] = None


class HealthResponse(BaseModel):
    status: str
    startup_complete: bool
    cache_status: dict


class RegimeHistoryResponse(BaseModel):
    pairs: List[str]
    dates: List[str]
    regimes: dict  # pair_name -> list of regime strings
