"""
FastAPI application entry point with lifespan startup precomputation.
"""

import asyncio
import json
import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.config import get_settings
from app.scheduler import start_scheduler, scheduler
from app.services.cache import warm_cache
from app.routers import health, correlation, anomaly, summary

settings = get_settings()


class StructuredFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": self.formatTime(record),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info and record.exc_info[0]:
            log_entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_entry)


if settings.LOG_FORMAT == "json":
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(StructuredFormatter())
    logging.basicConfig(level=settings.LOG_LEVEL.upper(), handlers=[handler])
else:
    logging.basicConfig(
        level=settings.LOG_LEVEL.upper(),
        format="%(asctime)s %(levelname)s %(name)s — %(message)s",
    )

logger = logging.getLogger(__name__)


def get_client_ip(request: Request) -> str:
    # Rightmost X-Forwarded-For hop is added by our own proxy (Render/Vercel),
    # so it is the trustworthy client address; fall back to the socket peer.
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[-1].strip()
    return get_remote_address(request)


limiter = Limiter(key_func=get_client_ip, default_limits=["100/minute"])


@asynccontextmanager
async def lifespan(app: FastAPI):
    # DO NOT mark started here — let the warm task set _warm only once cache
    # load is complete, so the frontend's BackendStatus waits for real readiness.
    warm_task = asyncio.create_task(_warm_background())
    start_scheduler()
    yield
    logger.info("Shutting down...")
    warm_task.cancel()
    scheduler.shutdown(wait=False)


async def _warm_background():
    logger.info("Warming cache in background...")
    try:
        await warm_cache()
        logger.info("Cache warm. Server ready.")
    except Exception as e:
        logger.error(f"Cache warm failed: {e}. Server starting anyway.")


app = FastAPI(
    title="Cross-Asset Correlations Anomaly Detector API",
    docs_url="/docs" if settings.APP_ENV != "production" else None,
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=1000)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_methods=["GET", "OPTIONS", "HEAD"],
    allow_headers=["*"],
)

app.include_router(health.router,       prefix="/api")
app.include_router(correlation.router,  prefix="/api/correlation")
app.include_router(anomaly.router,      prefix="/api/anomaly")
app.include_router(summary.router,      prefix="/api")
