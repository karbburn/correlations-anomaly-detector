"""
APScheduler background refresh — keeps cached data fresh without
waiting for a request to trigger re-computation.
"""

import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.services.cache import warm_cache

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


def start_scheduler() -> None:
    scheduler.add_job(
        _refresh,
        "interval",
        hours=1,
        id="cache_refresh",
        replace_existing=True,
        max_instances=1,
    )
    scheduler.start()
    logger.info("Background scheduler started (1h refresh)")


async def _refresh() -> None:
    try:
        logger.info("Scheduled cache refresh starting...")
        await warm_cache()
        logger.info("Scheduled cache refresh complete")
    except Exception as e:
        logger.error(f"Scheduled refresh failed: {e}")
