"""
Rule-based interpretation engine for correlation anomalies.

Maps asset pair × regime × z-score magnitude → plain-English explanations.
No ML — deterministic rules based on known macro drivers.
"""

import logging
from dataclasses import dataclass
from typing import Optional

import pandas as pd

logger = logging.getLogger(__name__)


@dataclass
class InterpretationResult:
    headline: str
    explanation: str
    confidence: str  # "high" | "medium" | "low"
    historical_context: str


# ---------------------------------------------------------------------------
# Rule table: pair → regime → explanation template
# Each pair has explanations for both "breakdown" (negative z) and "surge" (positive z)
# ---------------------------------------------------------------------------

PAIR_RULES: dict[tuple[str, str], dict[str, str]] = {
    ("NIFTY50", "USDINR"): {
        "breakdown": (
            "Equity-currency decoupling typically signals capital flight or "
            "divergent monetary policy. When NIFTY falls while INR strengthens "
            "(or vice versa), it often indicates FII outflows being offset by "
            "RBI intervention or trade surplus flows."
        ),
        "surge": (
            "Rising equity-currency correlation suggests risk-on capital flows "
            "driving both assets in tandem. This typically occurs during periods "
            "of strong FII inflows where equity buying also supports the rupee."
        ),
    },
    ("NIFTY50", "GOLD"): {
        "breakdown": (
            "Equity-gold decoupling breaks the traditional risk-on/risk-off "
            "dynamic. This can occur when domestic gold demand (weddings, festivals) "
            "diverges from equity sentiment, or when global gold is driven by "
            "USD weakness rather than risk aversion."
        ),
        "surge": (
            "When equities and gold move together, it usually signals liquidity-driven "
            "rallies where all asset classes benefit from easy monetary policy. "
            "Can also indicate inflation hedging alongside equity optimism."
        ),
    },
    ("NIFTY50", "CRUDE"): {
        "breakdown": (
            "India is a net oil importer, so NIFTY-CRUDE decoupling often signals "
            "domestic growth resilience despite oil price moves, or supply-driven "
            "oil shocks that haven't yet transmitted to corporate earnings."
        ),
        "surge": (
            "Rising NIFTY-CRUDE correlation suggests global growth expectations "
            "driving both — strong demand pushes oil higher while lifting equities. "
            "This is typical of synchronized global expansion phases."
        ),
    },
    ("NIFTY50", "GSEC10Y"): {
        "breakdown": (
            "Equity-bond yield decoupling can signal a disconnect between growth "
            "expectations and interest rate trajectories. Falling yields with "
            "rising equities suggests RBI easing while markets are bullish — "
            "a supportive 'Goldilocks' environment."
        ),
        "surge": (
            "When equity and bond yields rise together, it typically reflects "
            "strong growth expectations with rising inflation concerns. The market "
            "expects RBI tightening but believes growth can withstand higher rates."
        ),
    },
    ("NIFTY50", "FII_FLOW"): {
        "breakdown": (
            "NIFTY rising without FII support (or falling despite FII buying) "
            "indicates a shift to domestic-driven markets. DII and retail flows "
            "may be offsetting FII behavior, a structural maturation signal."
        ),
        "surge": (
            "Strong NIFTY-FII correlation confirms foreign capital as the dominant "
            "driver. Markets are highly sensitive to FII sentiment, increasing "
            "vulnerability to global risk-off events or EM rotation."
        ),
    },
    ("USDINR", "GOLD"): {
        "breakdown": (
            "INR and gold typically move inversely (weaker INR → higher gold in INR). "
            "A breakdown in this pattern suggests global gold moves dominated by "
            "factors other than USD strength, or RBI FX intervention distorting "
            "the usual transmission."
        ),
        "surge": (
            "Heightened INR-gold correlation reinforces the traditional safe-haven "
            "dynamic where currency weakness and gold strength coincide. This "
            "is typical during periods of elevated geopolitical risk or capital flight."
        ),
    },
    ("USDINR", "CRUDE"): {
        "breakdown": (
            "INR-crude decoupling breaks the usual petrodollar channel. This can "
            "happen when India secures rupee-denominated oil deals, or when "
            "strong services exports insulate the current account from oil shocks."
        ),
        "surge": (
            "Strong INR-crude correlation reflects the traditional current account "
            "channel — rising oil widens the trade deficit, pressuring the rupee. "
            "This is the default macro regime for India as a net importer."
        ),
    },
    ("USDINR", "GSEC10Y"): {
        "breakdown": (
            "Currency and yield decoupling suggests RBI is managing the exchange "
            "rate independently of interest rate policy. This can occur during "
            "FX reserve drawdowns or when capital controls reduce rate sensitivity."
        ),
        "surge": (
            "Rising yields attracting carry trade flows that strengthen INR — the "
            "classic interest rate parity channel. Higher rates → more capital "
            "inflow → stronger currency."
        ),
    },
    ("USDINR", "FII_FLOW"): {
        "breakdown": (
            "FII flows not transmitting to currency moves suggests RBI is actively "
            "absorbing flows through reserve accumulation, preventing INR appreciation "
            "despite capital inflows."
        ),
        "surge": (
            "FII flows directly driving INR — the standard EM channel. Large FII "
            "buying strengthens INR through dollar selling on the FX desk, and "
            "FII selling causes depreciation pressure."
        ),
    },
    ("GOLD", "CRUDE"): {
        "breakdown": (
            "Gold-crude decoupling breaks the commodity supercycle linkage. This "
            "can signal sector-specific dynamics: e.g., OPEC supply management "
            "driving oil while gold responds to monetary policy independently."
        ),
        "surge": (
            "Gold and crude moving together is the classic inflation trade — "
            "rising commodity prices signal reflation, with gold as the ultimate "
            "inflation hedge and crude as the input cost driver."
        ),
    },
    ("GOLD", "GSEC10Y"): {
        "breakdown": (
            "Gold and yields decoupling breaks the real-rate framework. Gold "
            "typically falls when real yields rise. Decoupling suggests market "
            "stress or a breakdown in the Treasuries-as-safe-haven assumption."
        ),
        "surge": (
            "Gold rising with yields is unusual and signals deep market stress — "
            "investors are buying gold for safety even as bond prices fall. This "
            "pattern appeared during 2022 stagflation fears."
        ),
    },
    ("GOLD", "FII_FLOW"): {
        "breakdown": (
            "Gold disconnecting from FII flows suggests domestic gold demand "
            "(physical, ETFs) is driving prices independently of foreign equity "
            "sentiment. A sign of gold's standalone safe-haven bid in India."
        ),
        "surge": (
            "Gold moving with FII flows indicates risk-off correlation — FII "
            "selling equities coincides with gold buying, confirming the "
            "traditional flight-to-safety pattern."
        ),
    },
    ("CRUDE", "GSEC10Y"): {
        "breakdown": (
            "Crude-yield decoupling breaks the inflation expectations channel. "
            "RBI may be holding rates steady despite oil-driven inflation, or "
            "the market expects oil price moves to be transitory."
        ),
        "surge": (
            "Rising crude pushing yields higher through the inflation channel — "
            "markets price in RBI rate hikes as oil-driven CPI acceleration "
            "becomes inevitable. The standard cost-push inflation transmission."
        ),
    },
    ("CRUDE", "FII_FLOW"): {
        "breakdown": (
            "Crude decoupling from FII flows suggests foreign investors are "
            "looking through oil price volatility and focusing on India's "
            "growth story. A sign of structural conviction in Indian equities."
        ),
        "surge": (
            "FII flows tracking crude prices indicates macro-sensitivity — "
            "foreign investors adjust India allocation based on oil's impact "
            "on the current account and corporate margins."
        ),
    },
    ("GSEC10Y", "FII_FLOW"): {
        "breakdown": (
            "Bond yields disconnecting from FII flows suggests domestic factors "
            "(RBI OMOs, government borrowing calendar, banking system liquidity) "
            "are dominating the yield curve over foreign capital."
        ),
        "surge": (
            "FII debt flows driving yields — a sign that India's bond market is "
            "increasingly integrated with global capital. FAR (Fully Accessible "
            "Route) bond demand from index inclusion may be the driver."
        ),
    },
}


def _get_confidence(zscore: float) -> str:
    """Map |z-score| magnitude to confidence level."""
    abs_z = abs(zscore)
    if abs_z >= 3.0:
        return "high"
    if abs_z >= 2.5:
        return "medium"
    return "low"


def _find_historical_precedent(
    pair_corr_series: Optional[pd.Series],
    current_zscore: float,
    threshold: float,
    zscore_series: Optional[pd.Series] = None,
) -> str:
    """
    Scan the cached pair correlation z-score history to find the last
    date when z-score exceeded the current threshold in the same direction.
    """
    if pair_corr_series is None or pair_corr_series.empty:
        return "Insufficient historical data for precedent analysis."

    if zscore_series is not None:
        z_series = zscore_series
    else:
        from app.services.anomaly_detector import compute_zscore_series
        z_series, _, _ = compute_zscore_series(pair_corr_series, hist_window=252)
    z_series = z_series.dropna()

    if z_series.empty:
        return "Insufficient historical data for precedent analysis."

    # Find dates where z-score exceeded threshold in same direction
    if current_zscore > 0:
        similar = z_series[z_series > threshold]
    else:
        similar = z_series[z_series < -threshold]

    if len(similar) <= 1:
        return "This is the first time this anomaly pattern has been observed in the dataset."

    # Get the second most recent occurrence (first is current)
    sorted_dates = similar.index.sort_values(ascending=False)
    if len(sorted_dates) >= 2:
        prev_date = sorted_dates[1]
        date_str = str(prev_date.date()) if hasattr(prev_date, "date") else str(prev_date)
        prev_z = round(float(similar.loc[prev_date]), 2)
        return f"This pair last saw similar levels on {date_str} (z={prev_z:+.2f}σ)."

    return "This is a rare anomaly with limited historical precedent."


def interpret_anomaly(
    asset1: str,
    asset2: str,
    zscore: float,
    correlation: float,
    regime: str,
    pair_corr_series: Optional[pd.Series] = None,
    zscore_series: Optional[pd.Series] = None,
    threshold: float = 2.0,
) -> InterpretationResult:
    """
    Generate a plain-English interpretation of a correlation anomaly.
    Uses deterministic rules — no ML.
    """
    # Normalize pair order for rule lookup
    pair_key = (asset1, asset2)
    if pair_key not in PAIR_RULES:
        pair_key = (asset2, asset1)

    rules = PAIR_RULES.get(pair_key)

    # Headline
    direction = "above" if zscore > 0 else "below"
    headline = (
        f"{asset1}–{asset2} correlation at {correlation:+.3f}, "
        f"{abs(zscore):.1f}σ {direction} normal"
    )

    # Explanation
    if rules:
        rule_key = "surge" if zscore > 0 else "breakdown"
        explanation = rules.get(rule_key, "No specific interpretation available for this regime.")
    else:
        explanation = (
            f"The correlation between {asset1} and {asset2} has deviated "
            f"significantly from its historical norm. A {abs(zscore):.1f}σ "
            f"{'positive' if zscore > 0 else 'negative'} deviation suggests "
            f"structural changes in the relationship between these assets."
        )

    confidence = _get_confidence(zscore)

    historical_context = _find_historical_precedent(
        pair_corr_series, zscore, threshold, zscore_series=zscore_series
    )

    return InterpretationResult(
        headline=headline,
        explanation=explanation,
        confidence=confidence,
        historical_context=historical_context,
    )
