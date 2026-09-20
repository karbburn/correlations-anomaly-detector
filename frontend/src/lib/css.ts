/**
 * Shared CSS variable utility for theme-aware D3 and component rendering.
 * Caches per theme to avoid forced reflow on every render.
 */

const cache = new Map<string, string>();

export function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function getCssVarCached(name: string, theme: string, fallback: string): string {
  const key = `${theme}:${name}`;
  if (cache.has(key)) return cache.get(key) as string;
  const val = getCssVar(name) || fallback;
  cache.set(key, val);
  return val;
}

export function clearCssVarCache() {
  cache.clear();
}
