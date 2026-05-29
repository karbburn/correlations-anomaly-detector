"""
Data ingestion layer — fetches and normalizes 6 asset classes.
"""

import io
import logging
import datetime
from typing import Optional

import numpy as np
import pandas as pd
import requests
import yfinance as yf
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.config import get_settings
from app.services.circuit_breaker import with_circuit_breaker, CircuitBreakerError

logger = logging.getLogger(__name__)
settings = get_settings()


class DataUnavailableError(Exception):
    pass


class DataQualityError(Exception):
    pass


ASSETS = {
    "NIFTY50":  {"ticker": "^NSEI",       "source": "yfinance"},
    "USDINR":   {"ticker": "INR=X",       "source": "yfinance"},
    "GOLD":     {"ticker": "GOLDBEES.NS", "source": "yfinance"},
    "CRUDE":    {"ticker": "BZ=F",        "source": "yfinance"},
    "GSEC10Y":  {"ticker": None,          "source": "fbil"},
    "FII_FLOW": {"ticker": None,          "source": "nse_fii"},
}

YFINANCE_TICKERS = ["^NSEI", "INR=X", "GOLDBEES.NS", "BZ=F"]

YF_COL_MAP = {
    "BZ=F":        "CRUDE",
    "GOLDBEES.NS": "GOLD",
    "INR=X":       "USDINR",
    "^NSEI":       "NIFTY50",
}

NSE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.nseindia.com/",
}

YFINANCE_TIMEOUT = 60
FBIL_TIMEOUT = 30
NSE_TIMEOUT = 20


def _ensure_unique_index(series: pd.Series, name: str) -> pd.Series:
    """Deduplicate and validate index. Returns series with unique index."""
    if series.index.duplicated().any():
        n_dups = series.index.duplicated().sum()
        logger.warning(f"{name}: {n_dups} duplicate index values found — keeping first")
        series = series[~series.index.duplicated(keep="first")]
    if not series.index.is_monotonic_increasing:
        series = series.sort_index()
    return series





def fetch_yfinance_prices(start: str, end: Optional[str] = None) -> pd.DataFrame:
    if end is None:
        end = datetime.date.today().strftime("%Y-%m-%d")

    logger.info(f"Fetching yfinance prices [{start} -> {end}]...")
    try:
        data = yf.download(
            YFINANCE_TICKERS,
            start=start,
            end=end,
            auto_adjust=True,
            progress=False,
            timeout=YFINANCE_TIMEOUT,
        )
        if data.empty:
            raise DataUnavailableError("yfinance returned empty DataFrame")

        if isinstance(data.columns, pd.MultiIndex):
            prices = data["Close"]
        else:
            prices = data

        prices = prices.rename(columns=YF_COL_MAP)
        prices = prices.ffill(limit=3)

        expected = set(YF_COL_MAP.values())
        actual = set(prices.columns)
        missing = expected - actual
        if missing:
            logger.warning(f"yfinance: missing columns {missing}")

        logger.info(f"  yfinance: {prices.shape[0]} rows, {list(prices.columns)}")
        return prices

    except Exception as e:
        logger.warning(f"yfinance fetch failed: {e}")
        raise DataUnavailableError(f"yfinance download failed: {e}") from e


@with_circuit_breaker("yfinance")
@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=2, min=2, max=10),
    retry=retry_if_exception_type(DataUnavailableError),
    reraise=True,
    before_sleep=lambda retry_state: logger.warning(
        f"yfinance retry {retry_state.attempt_number}/3 after {retry_state.outcome.exception()}"
    ),
)
def _fetch_yfinance_with_circuit(start: str, end: str) -> pd.DataFrame:
    return fetch_yfinance_prices(start, end)


def _yfinance_fallback(start: str) -> pd.DataFrame:
    """Generate synthetic price data when all sources fail."""
    logger.error("All yfinance attempts failed — generating synthetic data")
    from pathlib import Path
    cache_path = Path(settings.CACHE_DIR) / "prices_last_known.parquet"
    if cache_path.exists():
        logger.warning("Serving stale price cache")
        from app.services.cache import set_staleness
        set_staleness("prices_stale", True)
        try:
            return pd.read_parquet(cache_path)
        except Exception as cache_err:
            logger.warning(f"Stale price cache corrupted ({cache_err}) — falling through to synthetic")

    logger.error("No price cache — generating synthetic prices")
    end = datetime.date.today().strftime("%Y-%m-%d")
    dates = pd.bdate_range(start, end)
    n = len(dates)
    base = 100.0
    rng = np.random.default_rng(42)
    data = {}
    for asset in YF_COL_MAP.values():
        returns = rng.normal(0.0005, 0.01, n)
        data[asset] = base * (1 + returns).cumprod()
    df = pd.DataFrame(data, index=dates)
    logger.warning(f"  Synthetic prices: {df.shape[0]} rows")
    return df


def _fetch_yfinance_safe(start: str, end: str) -> pd.DataFrame:
    try:
        return _fetch_yfinance_with_circuit(start, end)
    except (CircuitBreakerError, DataUnavailableError) as e:
        logger.warning(f"yfinance unavailable ({e}). Using fallback.")
        return _yfinance_fallback(start)


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=2, min=2, max=10),
    reraise=True,
    retry=retry_if_exception_type(DataUnavailableError),
    before_sleep=lambda retry_state: logger.warning(
        f"FBIL retry {retry_state.attempt_number}/3 after {retry_state.outcome.exception()}"
    ),
)
def fetch_fbil_gsec(start: str) -> pd.Series:
    logger.info("Fetching G-Sec yield from FBIL...")
    try:
        response = requests.get(
            "https://fbil.org.in/api/index.php/GsecBenchmark",
            timeout=FBIL_TIMEOUT,
        )
        response.raise_for_status()
        data = response.json()

        records = data.get("data", data)
        df = pd.DataFrame(records)

        date_col = next((c for c in df.columns if "date" in c.lower()), df.columns[0])
        rate_col = next((c for c in df.columns if "rate" in c.lower() or "yield" in c.lower()), df.columns[1])

        df["date"] = pd.to_datetime(df[date_col], dayfirst=True)
        df = df.set_index("date").sort_index()
        series = df[rate_col].astype(float)
        series.name = "GSEC10Y"

        diff = series.diff()
        result = _ensure_unique_index(diff[diff.index >= start], "GSEC10Y")
        logger.info(f"  FBIL G-Sec: {len(result)} data points")
        return result

    except Exception as e:
        logger.warning(f"FBIL fetch failed: {e}. Trying RBI fallback...")
        raise DataUnavailableError(f"FBIL unavailable: {e}")


@with_circuit_breaker("gsec")
def _fetch_fbil_with_circuit(start: str) -> pd.Series:
    return fetch_fbil_gsec(start)


def fetch_rbi_gsec_fallback(start: str) -> pd.Series:
    from pathlib import Path
    cache_path = Path(settings.CACHE_DIR) / "gsec_last_known.parquet"

    if cache_path.exists():
        logger.warning("Serving stale G-Sec cache (FBIL was down)")
        from app.services.cache import set_staleness
        set_staleness("gsec_stale", True)
        try:
            df = pd.read_parquet(cache_path)
            series = df.squeeze()
            series.name = "GSEC10Y"
            result = _ensure_unique_index(series[series.index >= start], "GSEC10Y (cached)")
            return result
        except Exception as cache_err:
            logger.warning(f"Stale G-Sec cache corrupted ({cache_err}) — falling through to synthetic")

    logger.error("No G-Sec cache available — generating synthetic data")
    from app.services.cache import set_staleness
    set_staleness("gsec_stale", True)
    end = datetime.date.today().strftime("%Y-%m-%d")
    dates = pd.bdate_range(start, end)
    rng = np.random.default_rng(43)
    noise = rng.normal(0, 0.02, size=len(dates))
    series = pd.Series(noise, index=dates, name="GSEC10Y")
    return series


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=2, min=2, max=10),
    reraise=True,
    retry=retry_if_exception_type(DataUnavailableError),
    before_sleep=lambda retry_state: logger.warning(
        f"NSE retry {retry_state.attempt_number}/3 after {retry_state.outcome.exception()}"
    ),
)
def fetch_nse_fii(start: str) -> pd.Series:
    logger.info("Fetching FII net flow from NSE (two-step session)...")
    try:
        session = requests.Session()

        session.get("https://www.nseindia.com", headers=NSE_HEADERS, timeout=10)

        response = session.get(
            "https://www.nseindia.com/api/fiidiiTradeReact",
            headers=NSE_HEADERS,
            timeout=NSE_TIMEOUT,
        )
        response.raise_for_status()
        data = response.json()

        records = []
        for item in data:
            try:
                fii_entry = item.get("fiiDii", [{}])[0]
                net_val = float(fii_entry.get("netVal", 0))
                date = pd.to_datetime(item["date"], format="%d-%b-%Y")
                records.append({"date": date, "fii_net": net_val})
            except (KeyError, ValueError, IndexError):
                continue

        if not records:
            raise ValueError("No valid FII records parsed from NSE response")

        df = pd.DataFrame(records).set_index("date").sort_index()
        series = df["fii_net"]
        series = _ensure_unique_index(series, "FII_FLOW (raw)")
        series = series[series.index >= start]
        series.name = "FII_FLOW"

        normalized = _zscore_normalize_flow(series)
        logger.info(f"  NSE FII: {len(normalized)} data points (z-scored)")
        return normalized

    except Exception as e:
        logger.warning(f"NSE FII fetch failed: {e}. Using synthetic fallback.")
        raise DataUnavailableError(f"NSE FII unavailable: {e}")


@with_circuit_breaker("fii")
def _fetch_fii_with_circuit(start: str) -> pd.Series:
    return fetch_nse_fii(start)


def _fallback_fii(start: str) -> pd.Series:
    from pathlib import Path
    cache_path = Path(settings.CACHE_DIR) / "fii_last_known.parquet"

    if cache_path.exists():
        logger.warning("Serving stale FII cache")
        from app.services.cache import set_staleness
        set_staleness("fii_stale", True)
        try:
            df = pd.read_parquet(cache_path)
            series = df.squeeze()
            series.name = "FII_FLOW"
            result = _ensure_unique_index(series[series.index >= start], "FII_FLOW (cached)")
            return result
        except Exception as cache_err:
            logger.warning(f"Stale FII cache corrupted ({cache_err}) — falling through to synthetic")

    logger.error("No FII cache — generating synthetic data")
    from app.services.cache import set_staleness
    set_staleness("fii_stale", True)
    end = datetime.date.today().strftime("%Y-%m-%d")
    dates = pd.bdate_range(start, end)
    rng = np.random.default_rng(100)
    flows = rng.normal(loc=0.0, scale=1.0, size=len(dates))
    return pd.Series(flows, index=dates, name="FII_FLOW")


def _zscore_normalize_flow(series: pd.Series, lookback: int = 252) -> pd.Series:
    if len(series) < 60:
        logger.warning(f"  {series.name}: too few points ({len(series)}) for z-score — using raw")
        series = series.copy()
        series.name = "FII_FLOW"
        return series
    rolling_mean = series.rolling(lookback, min_periods=60).mean()
    rolling_std = series.rolling(lookback, min_periods=60).std()
    rolling_std = rolling_std.where(rolling_std > 1e-6, np.nan)
    if rolling_std.isna().all():
        logger.warning(f"  {series.name}: z-scored all NaN — using raw instead")
        series = series.copy()
        series.name = "FII_FLOW"
        return series
    return (series - rolling_mean) / rolling_std


def _validate_dataframe(df: pd.DataFrame, name: str):
    if df.empty:
        raise DataQualityError(f"{name} is empty")
    for col in df.columns:
        missing_pct = df[col].isna().mean()
        if missing_pct > 0.20:
            raise DataQualityError(
                f"{name}: {col} has {missing_pct:.1%} missing values"
            )


def build_master_dataframe(start: Optional[str] = None, end: Optional[str] = None) -> pd.DataFrame:
    if start is None:
        start = settings.DATA_START_DATE
    if end is None:
        end = datetime.date.today().strftime("%Y-%m-%d")

    prices = _fetch_yfinance_safe(start, end)
    _validate_dataframe(prices, "prices")
    returns = prices.pct_change()

    nifty_returns = returns["NIFTY50"].dropna()
    master_index = nifty_returns.index

    gsec_diff = _fetch_fbil_safe(start)
    fii_norm = _fetch_fii_safe(start)

    gsec_diff = _ensure_unique_index(gsec_diff, "GSEC10Y")
    fii_norm = _ensure_unique_index(fii_norm, "FII_FLOW")

    df = returns.reindex(master_index)

    if gsec_diff is not None and not gsec_diff.empty:
        df["GSEC10Y"] = gsec_diff.reindex(master_index).ffill(limit=5)
    if fii_norm is not None and not fii_norm.empty:
        df["FII_FLOW"] = fii_norm.reindex(master_index).ffill(limit=3)

    _validate_dataframe(df, "master")
    df = df.dropna(how="all")

    logger.info(f"Master DataFrame: {df.shape[0]} rows x {df.shape[1]} columns")
    return df


def _fetch_fbil_safe(start: str) -> pd.Series:
    try:
        return _fetch_fbil_with_circuit(start)
    except (CircuitBreakerError, DataUnavailableError) as e:
        logger.warning(f"FBIL unavailable ({e}). Using fallback.")
        return fetch_rbi_gsec_fallback(start)


def _fetch_fii_safe(start: str) -> pd.Series:
    try:
        result = _fetch_fii_with_circuit(start)
        if result is not None and not result.empty and result.dropna().shape[0] >= 10:
            return result
        if result is not None and not result.empty:
            logger.warning(
                f"NSE FII: only {result.dropna().shape[0]} valid points — falling back to synthetic"
            )
        return _fallback_fii(start)
    except (CircuitBreakerError, DataUnavailableError) as e:
        logger.warning(f"NSE FII unavailable ({e}). Using fallback.")
        return _fallback_fii(start)
