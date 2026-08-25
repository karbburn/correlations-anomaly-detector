"""
Circuit breaker state machine and configuration wiring tests.
"""

from app.config import get_settings
from app.services.circuit_breaker import CircuitBreaker, circuit_breaker


def test_singleton_uses_configured_settings():
    settings = get_settings()
    assert circuit_breaker.max_failures == settings.CIRCUIT_BREAKER_FAILURES
    assert circuit_breaker.cooldown_seconds == settings.CIRCUIT_BREAKER_COOLDOWN


def test_opens_after_consecutive_failures_and_blocks():
    breaker = CircuitBreaker(max_failures=2, cooldown_seconds=60)
    for _ in range(2):
        breaker.record_failure("src")
    assert breaker.allow_request("src") is False


def test_half_open_admits_single_probe_after_cooldown():
    breaker = CircuitBreaker(max_failures=1, cooldown_seconds=0)
    breaker.record_failure("src")
    assert breaker.allow_request("src") is True
    assert breaker.allow_request("src") is False


def test_success_resets_state():
    breaker = CircuitBreaker(max_failures=2, cooldown_seconds=60)
    breaker.record_failure("src")
    breaker.record_success("src")
    status = breaker.get_status("src")
    assert status["state"] == "closed"
    assert status["failures"] == 0
    assert breaker.allow_request("src") is True
