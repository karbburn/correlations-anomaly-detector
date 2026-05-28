"""
Health check endpoint — no Cache-Control (always fresh).
"""

from fastapi import APIRouter
from app.services.cache import is_cache_warm, get_pair_corrs, get_returns

router = APIRouter()


@router.get("/health")
async def health():
    """
    Returns server status and cache freshness.
    The frontend uses startup_complete to decide when to render the dashboard.
    """
    returns = get_returns()
    cache_status = {}

    if returns is not None:
        cache_status["master_returns"] = {
            "fresh": True,
            "rows": returns.shape[0],
        }

    for w in [30, 60, 252]:
        corrs = get_pair_corrs(w)
        cache_status[f"corr_{w}d"] = {
            "fresh": corrs is not None,
        }

    return {
        "status": "ok",
        "startup_complete": is_cache_warm(),
        "cache_status": cache_status,
    }
