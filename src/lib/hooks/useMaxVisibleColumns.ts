import { useEffect, useState } from "react";

/**
 * How many list columns to show across the viewport before horizontal scroll.
 * Persisted per-screen in localStorage; defaults to 4 on desktop, 1 on tablet/mobile.
 */
const STORAGE_KEY = (screen: string) => `multitask.maxVisibleColumns.${screen}`;
const DEFAULT_MAX = 4;
const MIN = 1;
const MAX = 8;

export function useMaxVisibleColumns(
  screenKey: string
): [number, (n: number) => void] {
  const [value, setValueState] = useState<number>(() => {
    if (typeof window === "undefined") return DEFAULT_MAX;
    const raw = localStorage.getItem(STORAGE_KEY(screenKey));
    const n = raw ? Number(raw) : NaN;
    if (!Number.isFinite(n)) return DEFAULT_MAX;
    return Math.min(MAX, Math.max(MIN, n));
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY(screenKey), String(value));
  }, [screenKey, value]);

  const setValue = (n: number) => {
    setValueState(Math.min(MAX, Math.max(MIN, n)));
  };

  return [value, setValue];
}

export const MAX_VISIBLE_BOUNDS = { MIN, MAX, DEFAULT: DEFAULT_MAX };
