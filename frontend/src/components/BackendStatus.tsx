"use client";
import { useEffect, useState, useCallback } from "react";
import { fetchHealth } from "@/lib/api";

type Status = "checking" | "warming" | "ready" | "error";

export function BackendStatus({ onReady }: { onReady: () => void }) {
  const [status, setStatus] = useState<Status>("checking");
  const [elapsed, setElapsed] = useState(0);

  const stableOnReady = useCallback(onReady, [onReady]);

  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);

    let cancelled = false;

    const poll = async () => {
      const maxAttempts = 20;
      for (let i = 0; i < maxAttempts; i++) {
        if (cancelled) return;
        try {
          const data = await fetchHealth();
          if (data.startup_complete && data.cache_status?.corr_60d?.fresh) {
            setStatus("ready");
            clearInterval(timer);
            stableOnReady();
            return;
          }
          setStatus("warming");
        } catch {
          setStatus(i === 0 ? "checking" : "warming");
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
      if (!cancelled) {
        setStatus("error");
        clearInterval(timer);
      }
    };

    poll();
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [stableOnReady]);

  if (status === "ready") return null;

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="text-center space-y-5 max-w-sm">
        {status === "error" ? (
          <>
            <div className="w-14 h-14 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
              <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-red-400 text-lg font-medium">Backend unavailable</p>
            <p className="text-slate-500 text-sm">Try refreshing the page in a minute.</p>
          </>
        ) : (
          <>
            <div className="relative w-14 h-14 mx-auto">
              <div className="absolute inset-0 rounded-full border-2 border-cyan-500/30" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-400 animate-spin" />
            </div>
            <p className="text-white text-lg font-medium tracking-tight">
              {status === "checking" ? "Connecting to backend…" : "Warming up correlations…"}
            </p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-slate-500 text-sm tabular-nums">{elapsed}s</span>
              <span className="w-1 h-1 rounded-full bg-slate-600" />
              <span className="text-slate-600 text-xs">
                {status === "warming" ? "Computing 3 windows × 15 pairs" : "Establishing connection"}
              </span>
            </div>
            {elapsed > 12 && (
              <p className="text-slate-600 text-xs leading-relaxed px-4">
                The free-tier backend is waking from sleep. This only happens once — subsequent loads are instant.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
