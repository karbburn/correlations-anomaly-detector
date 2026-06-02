"""
Gunicorn production configuration.
"""

import multiprocessing
import os

# Default to loopback to match the uvicorn dev default in app.config.Settings.HOST
# and avoid binding to all network interfaces in production by accident.
bind = f"{os.getenv('HOST', '127.0.0.1')}:{os.getenv('PORT', '8000')}"
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
