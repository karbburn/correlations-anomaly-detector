"use client";

import {
  parseAsInteger,
  parseAsFloat,
  parseAsString,
  useQueryStates,
} from "nuqs";

/**
 * URL query parameter definitions for the dashboard.
 * nuqs handles SSR hydration, StrictMode dedup, and batched router.replace.
 */
export const dashboardParams = {
  w: parseAsInteger.withDefault(60),
  z: parseAsFloat.withDefault(2.0),
  pair: parseAsString.withDefault(""),
  range: parseAsString.withDefault("2Y"),
};

/**
 * Hook to read/write dashboard URL params.
 * Returns [values, setters] — call setters to update the URL without full navigation.
 */
export function useQueryParams() {
  return useQueryStates(dashboardParams);
}
