"""
Correlation engine — vectorized pairwise rolling Pearson correlations.
"""

import numpy as np
import pandas as pd
from itertools import combinations
from app.config import ASSETS


def compute_all_pair_correlations(
    returns: pd.DataFrame,
    window: int = 60,
) -> pd.DataFrame:
    """
    Compute rolling Pearson correlation for all 15 asset pairs.
    Uses pandas native rolling().corr() — vectorized in C, fast.

    Returns a DataFrame where:
      - index: date
      - columns: "ASSET1__ASSET2" for all N*(N-1)/2 pairs
      - values: rolling correlation coefficient [-1, 1]

    """
    pairs = {}
    assets = [c for c in ASSETS if c in returns.columns]
    min_periods = max(int(window * 0.8), 10)

    for a1, a2 in combinations(assets, 2):
        col = f"{a1}__{a2}"
        pairs[col] = (
            returns[a1]
            .rolling(window=window, min_periods=min_periods)
            .corr(returns[a2])
        )

    return pd.DataFrame(pairs, index=returns.index)


def pair_corr_to_matrix(pair_row: pd.Series, assets: list = None) -> pd.DataFrame:
    """
    Reconstruct a square N×N matrix from a single row of pair correlations.
    Used by /api/correlation/matrix to serve a snapshot without recomputing.

    pair_row: one row from compute_all_pair_correlations output
              (a pd.Series indexed by "ASSET1__ASSET2" strings)
    """
    if assets is None:
        assets = ASSETS

    n = len(assets)
    matrix = pd.DataFrame(np.eye(n), index=assets, columns=assets)

    for col, val in pair_row.items():
        parts = col.split("__")
        if len(parts) != 2:
            continue
        a1, a2 = parts
        if a1 in assets and a2 in assets:
            fval = float(val) if not np.isnan(val) else 0.0
            matrix.loc[a1, a2] = fval
            matrix.loc[a2, a1] = fval  # symmetric

    return matrix
