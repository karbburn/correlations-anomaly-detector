"""
CLI entry point — run anomaly detection from the command line.

Usage:
  python detect.py --window 60 --threshold 2.0 --output alerts.csv
  python detect.py --matrix --window 30
  python detect.py --pair NIFTY50 GOLD --window 60
"""

import sys
from pathlib import Path

# Ensure the backend package is importable
sys.path.insert(0, str(Path(__file__).parent))

import click
import pandas as pd

from app.services.data_fetcher import build_master_dataframe
from app.services.correlation_engine import (
    compute_all_pair_correlations,
    pair_corr_to_matrix,
    ASSETS,
)
from app.services.anomaly_detector import detect_anomalies, compute_zscore_series


@click.command()
@click.option("--window",    default=60,           help="Rolling window days (30|60|252)")
@click.option("--threshold", default=2.0,          help="Z-score threshold")
@click.option("--start",     default="2022-01-01", help="Start date YYYY-MM-DD")
@click.option("--output",    default="alerts.csv",  help="Output CSV path")
@click.option("--matrix",    is_flag=True,         help="Print today's corr matrix")
@click.option("--pair",      nargs=2,              help="Drilldown: two asset names")
def detect(window, threshold, start, output, matrix, pair):
    """Cross-Asset Correlations Anomaly Detector CLI."""
    click.echo(f"Fetching data from {start}...")
    returns = build_master_dataframe(start=start)

    if matrix:
        click.echo(f"\nCorrelation Matrix (window={window}d, as of {returns.index[-1].date()})\n")
        corrs = compute_all_pair_correlations(returns, window=window)
        last_row = corrs.dropna(how="all").iloc[-1]
        mat = pair_corr_to_matrix(last_row, ASSETS)
        click.echo(mat.round(3).to_string())
        return

    if pair:
        a1, a2 = pair
        corrs = compute_all_pair_correlations(returns, window=window)

        # Find the column (order-independent)
        col = f"{a1}__{a2}"
        if col not in corrs.columns:
            col = f"{a2}__{a1}"
            if col not in corrs.columns:
                click.echo(f"Pair {a1}/{a2} not found. Valid assets: {ASSETS}")
                return

        series = corrs[col]
        z, _, _ = compute_zscore_series(series)
        out = pd.DataFrame({"correlation": series, "zscore": z}).dropna().tail(30)
        click.echo(f"\nPair: {a1} vs {a2}  (window={window}d)\n")
        click.echo(out.round(4).to_string())
        return

    # Default: full anomaly detection
    click.echo(f"Computing rolling correlations (window={window}d)...")
    corrs = compute_all_pair_correlations(returns, window=window)

    click.echo(f"Detecting anomalies (threshold=±{threshold}σ)...")
    alerts = detect_anomalies(corrs, threshold=threshold)

    if alerts.empty:
        click.echo("No anomalies detected.")
        return

    alerts.to_csv(output, index=False)
    click.echo(f"{len(alerts)} alerts written to {output}")


if __name__ == "__main__":
    detect()
