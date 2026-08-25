/**
 * Parse YYYY-MM-DD strings as local midnight so UTC-based parsing
 * doesn't shift the displayed calendar day in negative-offset timezones.
 */
export function parseLocalDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}
