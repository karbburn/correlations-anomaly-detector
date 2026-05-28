"""
Circuit breaker for external API calls.
Tracks consecutive failures per source and skips after threshold.
"""

import time
import logging
from functools import wraps

logger = logging.getLogger(__name__)


class CircuitBreakerState:
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitBreakerError(Exception):
    pass


class CircuitBreaker:
    def __init__(self, max_failures: int = 3, cooldown_seconds: int = 3600):
        self.max_failures = max_failures
        self.cooldown_seconds = cooldown_seconds
        self._sources: dict[str, dict] = {}

    def _get_source(self, name: str) -> dict:
        if name not in self._sources:
            self._sources[name] = {
                "state": CircuitBreakerState.CLOSED,
                "failures": 0,
                "last_failure_time": 0.0,
            }
        return self._sources[name]

    def allow_request(self, name: str) -> bool:
        source = self._get_source(name)
        if source["state"] == CircuitBreakerState.OPEN:
            elapsed = time.time() - source["last_failure_time"]
            if elapsed >= self.cooldown_seconds:
                source["state"] = CircuitBreakerState.HALF_OPEN
                logger.info(f"Circuit {name}: OPEN -> HALF_OPEN after {elapsed:.0f}s cooldown")
                return True
            return False
        return True

    def record_success(self, name: str):
        source = self._get_source(name)
        if source["state"] == CircuitBreakerState.HALF_OPEN:
            logger.info(f"Circuit {name}: HALF_OPEN -> CLOSED (success)")
        source["state"] = CircuitBreakerState.CLOSED
        source["failures"] = 0

    def record_failure(self, name: str):
        source = self._get_source(name)
        source["failures"] += 1
        source["last_failure_time"] = time.time()
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
        return {k: self.get_status(k) for k in self._sources}


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
