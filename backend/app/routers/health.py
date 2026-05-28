"""
Health check endpoint — no Cache-Control (always fresh).
"""

from fastapi import APIRouter
from app.services.cache import is_cache_warm, get_pair_corrs, get_returns, get_staleness
from app.services.circuit_breaker import circuit_breaker
from app.scheduler import scheduler

router = APIRouter()


@router.get("/health")
async def health():
    returns = get_returns()
    cache_status = {}
    data_quality = {}

    if returns is not None:
        cache_status["master_returns"] = {
            "fresh": True,
            "rows": returns.shape[0],
            "columns": list(returns.columns),
        }
        for col in returns.columns:
            missing_pct = round(float(returns[col].isna().mean() * 100), 1)
            data_quality[col] = {
                "missing_pct": missing_pct,
                "healthy": missing_pct < 20.0,
            }

    for w in [30, 60, 252]:
        corrs = get_pair_corrs(w)
        cache_status[f"corr_{w}d"] = {
            "fresh": corrs is not None,
            "rows": len(corrs) if corrs is not None else 0,
        }

    circuit_statuses = circuit_breaker.all_statuses()

    return {
        "status": "ok",
        "startup_complete": is_cache_warm(),
        "scheduler_running": scheduler.running,
        "data_freshness": {
            "gsec_stale": get_staleness("gsec_stale"),
            "fii_stale": get_staleness("fii_stale"),
            "prices_stale": get_staleness("prices_stale"),
        },
        "data_quality": data_quality,
        "circuit_breakers": circuit_statuses,
        "cache_status": cache_status,
    }
