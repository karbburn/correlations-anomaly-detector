"use client";

import React from "react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="bg-card border border-accent-red/30 p-5 rounded-none font-mono">
          <h3 className="text-sm font-bold text-accent-red tracking-wider uppercase mb-2">
            [ERROR]
          </h3>
          <p className="text-xs text-dim mb-4">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-3 py-1 text-[10px] font-semibold text-accent-primary border border-border-muted hover:bg-elevated transition-all cursor-pointer uppercase rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            RETRY
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
