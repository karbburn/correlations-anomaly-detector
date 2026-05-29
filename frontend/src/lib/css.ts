/**
 * Shared CSS variable utility for theme-aware D3 and component rendering.
 */

export function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
