"use client";

import clsx from "clsx";

interface InterpretationResult {
  headline: string;
  explanation: string;
  confidence: string;
  historical_context: string;
}

interface InterpretationCardProps {
  interpretation: InterpretationResult;
}

const CONFIDENCE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  high:   { bg: "bg-accent-red/10",     text: "text-accent-red",     label: "HIGH CONF" },
  medium: { bg: "bg-accent-amber/10",   text: "text-accent-amber",   label: "MED CONF" },
  low:    { bg: "bg-accent-primary/10",  text: "text-accent-primary", label: "LOW CONF" },
};

export function InterpretationCard({ interpretation }: InterpretationCardProps) {
  const conf = CONFIDENCE_STYLES[interpretation.confidence] ?? CONFIDENCE_STYLES.low;

  return (
    <div className="border-l-2 border-accent-amber bg-elevated/50 px-4 py-3 font-mono animate-in">
      {/* Headline */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-xs font-bold text-foreground leading-snug">
          {interpretation.headline}
        </p>
        <span
          className={clsx(
            "shrink-0 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
            conf.bg,
            conf.text,
          )}
        >
          {conf.label}
        </span>
      </div>

      {/* Explanation */}
      <p className="text-[11px] text-secondary leading-relaxed mb-2">
        {interpretation.explanation}
      </p>

      {/* Historical Context */}
      <p className="text-[10px] text-dim italic">
        {interpretation.historical_context}
      </p>
    </div>
  );
}
