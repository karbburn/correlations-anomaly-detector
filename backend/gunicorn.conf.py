"""
Gunicorn production configuration.

Bind address, port, and timeouts come from the same Settings object the app
uses, so HOST/PORT/GUNICORN_TIMEOUT in the environment or .env apply uniformly.
"""

from app.config import get_settings

settings = get_settings()

# Containers must bind 0.0.0.0 for platform port detection (Render).
bind = f"{settings.HOST}:{settings.PORT}"
workers = 1  # Must be 1 — in-memory _store, scheduler, and circuit breaker cannot be shared across processes
worker_class = "uvicorn.workers.UvicornWorker"
timeout = settings.GUNICORN_TIMEOUT
keepalive = 5
max_requests = 10000
max_requests_jitter = 1000
preload_app = False
accesslog = "-"
errorlog = "-"
loglevel = settings.LOG_LEVEL.lower()
