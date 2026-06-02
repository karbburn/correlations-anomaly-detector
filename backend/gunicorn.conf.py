"""
Gunicorn production configuration.
"""

import multiprocessing
import os

# 0.0.0.0 required by container platforms (Render auto-detects the
# port by scanning for 0.0.0.0 binds). For non-containerized local
# use, set HOST=127.0.0.1 in the environment to override.
bind = f"{os.getenv('HOST', '0.0.0.0')}:{os.getenv('PORT', '8000')}"
workers = 1  # Must be 1 — in-memory _store, scheduler, and circuit breaker cannot be shared across processes
worker_class = "uvicorn.workers.UvicornWorker"
timeout = int(os.getenv("GUNICORN_TIMEOUT", "120"))
keepalive = 5
max_requests = 10000
max_requests_jitter = 1000
preload_app = False
accesslog = "-"
errorlog = "-"
loglevel = os.getenv("LOG_LEVEL", "info").lower()
