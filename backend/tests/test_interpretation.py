"""
Tests for the rule-based interpretation engine.

Covers two behaviors that have been sources of subtle bugs:

1. ``interpret_anomaly`` is symmetric in (asset1, asset2) — the rule table
   is keyed on either ordering.
2. Confidence levels map to |z-score| magnitude: high (>=3.0), medium
   (>=2.5), else low. This must hold for both signs of z.
"""

import pytest

from app.services.interpretation import interpret_anomaly


def test_pair_key_ordering_is_symmetric():
    """interpret_anomaly should return the same explanation regardless of
    whether the caller passes (A, B) or (B, A). The headline is built
    from the caller-supplied order, so we only assert on the rule-driven
    fields (explanation, confidence)."""
    r1 = interpret_anomaly("NIFTY50", "GOLD", zscore=2.5, correlation=0.5, regime="surge")
    r2 = interpret_anomaly("GOLD", "NIFTY50", zscore=2.5, correlation=0.5, regime="surge")
    assert r1.explanation == r2.explanation
    assert r1.confidence == r2.confidence


def test_pair_key_ordering_breakdown_regime():
    """Symmetry must hold for the negative-z (breakdown) regime too."""
    r1 = interpret_anomaly("USDINR", "CRUDE", zscore=-2.7, correlation=-0.2, regime="breakdown")
    r2 = interpret_anomaly("CRUDE", "USDINR", zscore=-2.7, correlation=-0.2, regime="breakdown")
    assert r1.explanation == r2.explanation
    assert r1.confidence == r2.confidence


def test_confidence_levels_positive_z():
    """Mapping for positive z: |z|>=3 → high, |z|>=2.5 → medium, else low."""
    high = interpret_anomaly("X", "Y", zscore=3.1, correlation=0.0, regime="surge")
    medium = interpret_anomaly("X", "Y", zscore=2.7, correlation=0.0, regime="surge")
    low = interpret_anomaly("X", "Y", zscore=1.5, correlation=0.0, regime="surge")

    assert high.confidence == "high"
    assert medium.confidence == "medium"
    assert low.confidence == "low"


def test_confidence_levels_negative_z():
    """Mapping must hold for negative z too — uses |z|."""
    high = interpret_anomaly("X", "Y", zscore=-3.5, correlation=0.0, regime="breakdown")
    medium = interpret_anomaly("X", "Y", zscore=-2.6, correlation=0.0, regime="breakdown")
    low = interpret_anomaly("X", "Y", zscore=-1.0, correlation=0.0, regime="breakdown")

    assert high.confidence == "high"
    assert medium.confidence == "medium"
    assert low.confidence == "low"


def test_confidence_threshold_boundaries():
    """Exact boundary values: |z|=3.0 is high, |z|=2.5 is medium, |z|=2.49 is low."""
    boundary_high = interpret_anomaly("X", "Y", zscore=3.0, correlation=0.0, regime="surge")
    boundary_medium = interpret_anomaly("X", "Y", zscore=2.5, correlation=0.0, regime="surge")
    just_below = interpret_anomaly("X", "Y", zscore=2.49, correlation=0.0, regime="surge")

    assert boundary_high.confidence == "high"
    assert boundary_medium.confidence == "medium"
    assert just_below.confidence == "low"


def test_unknown_pair_uses_generic_template():
    """Pairs not in PAIR_RULES should fall back to the generic explanation."""
    result = interpret_anomaly("UNKNOWN1", "UNKNOWN2", zscore=2.5, correlation=0.0, regime="surge")
    assert "UNKNOWN1" in result.explanation
    assert "UNKNOWN2" in result.explanation
    # Confidence still follows the magnitude rule
    assert result.confidence == "medium"
