"""
APScheduler background refresh — keeps cached data fresh without
waiting for a request to trigger re-computation.

Also runs optional weekly anomaly digest emails if Resend is configured.
"""

import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from app.services.cache import warm_cache
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

scheduler = AsyncIOScheduler()


def start_scheduler() -> None:
    # Hourly cache refresh
    scheduler.add_job(
        _refresh,
        "interval",
        hours=1,
        id="cache_refresh",
        replace_existing=True,
        max_instances=1,
    )

    # Weekly anomaly digest — only if Resend API key is configured
    if settings.RESEND_API_KEY and settings.alert_recipients_list:
        try:
            trigger = CronTrigger.from_crontab(settings.ALERT_SCHEDULE_CRON)
            scheduler.add_job(
                _send_digest,
                trigger,
                id="weekly_digest",
                replace_existing=True,
                max_instances=1,
            )
            logger.info(
                f"Weekly digest scheduled: cron='{settings.ALERT_SCHEDULE_CRON}' "
                f"to {len(settings.alert_recipients_list)} recipient(s)"
            )
        except Exception as e:
            logger.error(f"Failed to schedule digest: {e}")
    else:
        logger.info("Resend not configured — weekly digest disabled")

    scheduler.start()
    logger.info("Background scheduler started (1h refresh)")


async def _refresh() -> None:
    try:
        logger.info("Scheduled cache refresh starting...")
        await warm_cache()
        logger.info("Scheduled cache refresh complete")
    except Exception as e:
        logger.error(f"Scheduled refresh failed: {e}")


async def _send_digest() -> None:
    try:
        import asyncio
        from app.services.email_service import send_anomaly_digest
        logger.info("Sending weekly anomaly digest...")
        loop = asyncio.get_running_loop()
        success = await loop.run_in_executor(None, send_anomaly_digest)
        if success:
            logger.info("Weekly digest sent successfully")
        else:
            logger.warning("Weekly digest send returned False")
    except Exception as e:
        logger.error(f"Failed to send weekly digest: {e}")
