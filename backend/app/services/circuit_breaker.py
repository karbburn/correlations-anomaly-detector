"""
Circuit breaker for external API calls.
Tracks consecutive failures per source and skips after threshold.
"""

import time
import logging
import threading
from functools import wraps

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class CircuitBreakerState:
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitBreakerError(Exception):
    pass


class CircuitBreaker:
    def __init__(self, max_failures: int | None = None, cooldown_seconds: int | None = None):
        self.max_failures = max_failures if max_failures is not None else settings.CIRCUIT_BREAKER_FAILURES
        self.cooldown_seconds = cooldown_seconds if cooldown_seconds is not None else settings.CIRCUIT_BREAKER_COOLDOWN
        self._sources: dict[str, dict] = {}
        self._lock = threading.Lock()

    def _get_source(self, name: str) -> dict:
        # Caller must hold self._lock.
        if name not in self._sources:
            self._sources[name] = {
                "state": CircuitBreakerState.CLOSED,
                "failures": 0,
                "last_failure_time": 0.0,
                "half_open_probes": 0,
            }
        return self._sources[name]

    def allow_request(self, name: str) -> bool:
        with self._lock:
            source = self._get_source(name)
            if source["state"] == CircuitBreakerState.OPEN:
                elapsed = time.time() - source["last_failure_time"]
                if elapsed >= self.cooldown_seconds:
                    source["state"] = CircuitBreakerState.HALF_OPEN
                    source["half_open_probes"] = 0
                    logger.info(f"Circuit {name}: OPEN -> HALF_OPEN after {elapsed:.0f}s cooldown")
                else:
                    return False
            if source["state"] == CircuitBreakerState.HALF_OPEN:
                if source["half_open_probes"] >= 1:
                    return False
                source["half_open_probes"] += 1
            return True

    def record_success(self, name: str):
        with self._lock:
            source = self._get_source(name)
            if source["state"] == CircuitBreakerState.HALF_OPEN:
                logger.info(f"Circuit {name}: HALF_OPEN -> CLOSED (success)")
            source["state"] = CircuitBreakerState.CLOSED
            source["failures"] = 0
            source["half_open_probes"] = 0

    def record_failure(self, name: str):
        with self._lock:
            source = self._get_source(name)
            source["failures"] += 1
            source["last_failure_time"] = time.time()
            source["half_open_probes"] = 0
            if source["failures"] >= self.max_failures:
                was = source["state"]
                source["state"] = CircuitBreakerState.OPEN
                if was != CircuitBreakerState.OPEN:
                    logger.warning(
                        f"Circuit {name}: CLOSED -> OPEN "
                        f"({source['failures']} consecutive failures, "
                        f"cooldown={self.cooldown_seconds}s)"
                    )

    def get_status(self, name: str) -> dict:
        with self._lock:
            source = self._get_source(name)
            return {
                "state": source["state"],
                "failures": source["failures"],
                "last_failure_age": (
                    time.time() - source["last_failure_time"]
                    if source["last_failure_time"] > 0
                    else None
                ),
            }

    def all_statuses(self) -> dict[str, dict]:
        with self._lock:
            names = list(self._sources)
        return {name: self.get_status(name) for name in names}


circuit_breaker = CircuitBreaker()


def with_circuit_breaker(source_name: str):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            if not circuit_breaker.allow_request(source_name):
                raise CircuitBreakerError(
                    f"Circuit breaker OPEN for {source_name} "
                    f"({circuit_breaker.get_status(source_name)['failures']} failures)"
                )
            try:
                result = func(*args, **kwargs)
                circuit_breaker.record_success(source_name)
                return result
            except Exception:
                circuit_breaker.record_failure(source_name)
                raise
        return wrapper
    return decorator
