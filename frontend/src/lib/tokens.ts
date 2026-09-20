export const tokenFallbacks: Record<string, { light: string; dark: string }> = {
  "--accent-primary": { light: "#047857", dark: "#10b981" },
  "--accent-amber": { light: "#b45309", dark: "#f59e0b" },
  "--accent-red": { light: "#b91c1c", dark: "#ef4444" },
  "--accent-teal": { light: "#0f766e", dark: "#14b8a6" },
  "--bg-elevated": { light: "#ede8df", dark: "#0d1f18" },
  "--bg-surface": { light: "#e4dfd6", dark: "#112a20" },
  "--bg-primary": { light: "#f5f0e8", dark: "#060d0a" },
  "--border-default": { light: "#d4cfc6", dark: "#1a3a2e" },
  "--text-muted": { light: "#6b6b6b", dark: "#5eead4" },
  "--text-dim": { light: "#999999", dark: "#2dd4bf" },
  "--corr-positive": { light: "#2563eb", dark: "#60a5fa" },
  "--corr-negative": { light: "#9a3412", dark: "#c2410c" },
};

export function getTokenFallback(name: string, theme: "light" | "dark"): string {
  return tokenFallbacks[name]?.[theme] ?? "";
}
