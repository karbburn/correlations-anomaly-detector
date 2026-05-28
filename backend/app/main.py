"""
FastAPI application entry point with lifespan startup precomputation.

v2: uses async lifespan context manager to pre-fetch data and pre-compute
all 3 correlation windows before the first request arrives. This eliminates
the 30-60 second cold-start delay that would hit the first user.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.config import get_settings
from app.scheduler import start_scheduler
from app.services.cache import warm_cache
from app.routers import health, correlation, anomaly

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)
settings = get_settings()

limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Runs on startup: fetch data + pre-compute correlations for all 3 windows.
    This means the first real request from the frontend is fast (~100ms)
    rather than triggering a 30–60 second cold computation.
    """
    logger.info("🚀 Warming cache on startup...")
    try:
        await warm_cache()
        logger.info("✅ Cache warm. Server ready.")
    except Exception as e:
        logger.error(f"⚠️ Cache warm failed: {e}. Server starting anyway.")
        # Don't crash on startup — endpoints will return 503 with clear message

    start_scheduler()  # background refresh every hour

    yield  # server runs here

    # Shutdown — nothing persistent to clean up
    logger.info("Shutting down...")


app = FastAPI(
    title="Cross-Asset Correlations Anomaly Detector API",
    version="2.0.0",
    docs_url="/docs",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=1000)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_methods=["GET"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(health.router,       prefix="/api")
app.include_router(correlation.router,  prefix="/api/correlation")
app.include_router(anomaly.router,      prefix="/api/anomaly")
