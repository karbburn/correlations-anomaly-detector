"use client";

import { useEffect, useRef, useCallback } from "react";

interface MethodologyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MethodologyModal({ isOpen, onClose }: MethodologyModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
      const closeBtn = contentRef.current?.querySelector<HTMLElement>("button");
      closeBtn?.focus();
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  useEffect(() => {
    if (!isOpen) return;
    const content = contentRef.current;
    if (!content) return;

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusable = content.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", handleTab);
    return () => document.removeEventListener("keydown", handleTab);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        ref={contentRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Methodology"
        className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-background border border-border-muted p-6 sm:p-8 font-mono text-xs text-secondary rounded-none shadow-2xl focus:outline-none"
      >
        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close methodology modal"
          className="absolute top-4 right-4 text-dim hover:text-foreground text-sm font-bold cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
        >
          [×]
        </button>

        <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-6">
          [METHODOLOGY]
        </h2>

        {/* Section 1: Rolling Correlation */}
        <section className="mb-6">
          <h3 className="text-[11px] font-bold text-accent-primary uppercase tracking-wider mb-2 border-b border-border-muted pb-1">
            1. Rolling Pearson Correlation
          </h3>
          <p className="leading-relaxed mb-2">
            For each asset pair (A, B), we compute the rolling Pearson correlation
            coefficient over a sliding window of <code className="text-accent-primary">W</code> trading days:
          </p>
          <div className="bg-elevated border border-border-muted px-3 py-2 mb-2 text-[10px]">
            <code>ρ(A,B)ₜ = Cov(Rₐ, R_b) / (σₐ · σ_b)</code>
            <br />
            <span className="text-dim">computed over [t−W+1, t] with min_periods = 0.8 × W</span>
          </div>
          <p className="leading-relaxed">
            Window sizes available: <code className="text-accent-primary">30D</code> (short-term noise),{" "}
            <code className="text-accent-primary">60D</code> (default regime detection),{" "}
            <code className="text-accent-primary">252D</code> (structural shifts). Returns are log-returns
            for price-based assets (NIFTY50, USDINR, GOLD, CRUDE) and first-differences
            for rate-based assets (GSEC10Y). FII_FLOW is z-score normalized raw net flow.
          </p>
        </section>

        {/* Section 2: Z-Score Normalization */}
        <section className="mb-6">
          <h3 className="text-[11px] font-bold text-accent-primary uppercase tracking-wider mb-2 border-b border-border-muted pb-1">
            2. Z-Score Normalization
          </h3>
          <p className="leading-relaxed mb-2">
            Each pairwise rolling correlation is standardized against its own trailing
            252-day history to detect deviations from the pair&apos;s historical norm:
          </p>
          <div className="bg-elevated border border-border-muted px-3 py-2 mb-2 text-[10px]">
            <code>z(t) = (ρₜ − μ₂₅₂) / σ₂₅₂</code>
            <br />
            <span className="text-dim">
              μ₂₅₂ = rolling mean over 252 days, σ₂₅₂ = rolling std (min_periods=60)
            </span>
          </div>
          <p className="leading-relaxed">
            Z-scores are clipped to <code className="text-accent-primary">±10</code> to prevent
            outlier contamination. Standard deviations below{" "}
            <code className="text-accent-primary">10⁻⁶</code> are treated as NaN to avoid
            division-by-zero in flat correlation regimes.
          </p>
        </section>

        {/* Section 3: Anomaly Detection */}
        <section className="mb-6">
          <h3 className="text-[11px] font-bold text-accent-primary uppercase tracking-wider mb-2 border-b border-border-muted pb-1">
            3. Anomaly Detection
          </h3>
          <p className="leading-relaxed mb-2">
            An anomaly is flagged when the absolute z-score exceeds a user-configurable
            threshold (default: <code className="text-accent-primary">±2.0σ</code>):
          </p>
          <div className="bg-elevated border border-border-muted px-3 py-2 mb-2 text-[10px]">
            <code>anomaly(t) = |z(t)| &gt; threshold</code>
          </div>
          <p className="leading-relaxed">
            At 2.0σ, roughly 4.6% of historical observations would be flagged under
            a normal distribution. In practice, correlation z-scores are fat-tailed,
            so the actual anomaly rate is higher — typically 6–8%.
          </p>
        </section>

        {/* Section 4: Regime Classification */}
        <section className="mb-6">
          <h3 className="text-[11px] font-bold text-accent-primary uppercase tracking-wider mb-2 border-b border-border-muted pb-1">
            4. Regime Classification
          </h3>
          <p className="leading-relaxed mb-2">
            Each pair-date is classified into one of six regimes based on the raw
            correlation value and z-score:
          </p>
          <table className="w-full text-[10px] border border-border-muted mb-2">
            <thead>
              <tr className="bg-elevated">
                <th className="px-2 py-1 text-left font-bold text-muted uppercase">Regime</th>
                <th className="px-2 py-1 text-left font-bold text-muted uppercase">Condition</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["ANOMALY", "|z| > threshold"],
                ["STRONG_POSITIVE", "ρ ≥ 0.7"],
                ["MILD_POSITIVE", "0.3 ≤ ρ < 0.7"],
                ["NEUTRAL", "−0.3 < ρ < 0.3"],
                ["MILD_NEGATIVE", "−0.7 < ρ ≤ −0.3"],
                ["STRONG_NEGATIVE", "ρ ≤ −0.7"],
              ].map(([regime, condition]) => (
                <tr key={regime} className="border-t border-border-muted">
                  <td className="px-2 py-1 font-semibold text-foreground">{regime}</td>
                  <td className="px-2 py-1 text-secondary">{condition}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="leading-relaxed text-dim">
            ANOMALY takes precedence — if |z| exceeds the threshold, the regime is
            classified as anomaly regardless of the raw correlation level.
          </p>
        </section>

        {/* Section 5: Data Sources */}
        <section>
          <h3 className="text-[11px] font-bold text-accent-primary uppercase tracking-wider mb-2 border-b border-border-muted pb-1">
            5. Data Sources
          </h3>
          <table className="w-full text-[10px] border border-border-muted">
            <thead>
              <tr className="bg-elevated">
                <th className="px-2 py-1 text-left font-bold text-muted uppercase">Asset</th>
                <th className="px-2 py-1 text-left font-bold text-muted uppercase">Source</th>
                <th className="px-2 py-1 text-left font-bold text-muted uppercase">Transform</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["NIFTY50", "yfinance (^NSEI)", "log-returns"],
                ["USDINR", "yfinance (USDINR=X)", "log-returns"],
                ["GOLD", "yfinance (GC=F)", "log-returns"],
                ["CRUDE", "yfinance (CL=F)", "log-returns"],
                ["GSEC10Y", "FBIL API", "first-difference"],
                ["FII_FLOW", "NSE FII/DII API", "z-score of raw flow"],
              ].map(([asset, source, transform]) => (
                <tr key={asset} className="border-t border-border-muted">
                  <td className="px-2 py-1 font-semibold text-foreground">{asset}</td>
                  <td className="px-2 py-1 text-secondary">{source}</td>
                  <td className="px-2 py-1 text-dim">{transform}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 leading-relaxed text-dim">
            All series are aligned on the NIFTY50 trading calendar. Gaps are
            forward-filled (limit=5). If any asset has &gt;20% missing values after
            alignment, the pipeline raises a DataQualityError.
          </p>
        </section>
      </div>
    </div>
  );
}
