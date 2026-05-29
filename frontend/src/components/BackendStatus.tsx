"use client";
import { useEffect, useState } from "react";
import { fetchHealth } from "@/lib/api";

type Status = "checking" | "warming" | "ready" | "error";

export function BackendStatus({ onReady }: { onReady: () => void }) {
  const [status, setStatus] = useState<Status>("checking");
  const [elapsed, setElapsed] = useState(0);

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
          if (cancelled) return;
          if (data.startup_complete && data.cache_status?.corr_60d?.fresh) {
            setStatus("ready");
            clearInterval(timer);
            onReady();
            return;
          }
          setStatus("warming");
        } catch {
          if (cancelled) return;
          setStatus(i === 0 ? "checking" : "warming");
        }
        if (cancelled) return;
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === "ready") return null;

  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-sm text-center space-y-4">
        {status === "error" ? (
          <>
            <div className="w-12 h-12 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-accent-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-accent-red text-base font-medium">Backend unavailable</p>
            <p className="text-dim text-sm">The backend may be cold-starting or temporarily down.</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-[10px] font-semibold text-accent-primary border border-border-muted hover:bg-elevated transition-all cursor-pointer uppercase rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              RETRY
            </button>
          </>
        ) : (
          <>
            <div className="relative w-12 h-12 mx-auto">
              <div className="absolute inset-0 rounded-full border-2 border-accent-primary/30" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent-teal animate-spin" />
            </div>
            <p className="text-foreground text-lg font-medium">
              {status === "checking" ? "Connecting to backend..." : "Warming up correlations..."}
            </p>
            <p className="text-dim text-sm tabular-nums">{elapsed}s</p>
            {elapsed > 10 && (
              <p className="text-muted text-xs">
                The backend is waking from sleep. This only happens once — subsequent loads are instant.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
