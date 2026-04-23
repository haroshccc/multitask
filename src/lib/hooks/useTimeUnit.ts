import { useEffect, useState } from "react";

export type TimeUnit = "auto" | "minutes" | "hours" | "days";

const STORAGE_KEY = "multitask.timer_unit";

/**
 * Shared preference for how elapsed task time is rendered.
 * Persisted in localStorage so it's consistent across row / modal views.
 */
export function useTimeUnit(): [TimeUnit, (u: TimeUnit) => void] {
  const [unit, setUnitState] = useState<TimeUnit>(() => {
    if (typeof window === "undefined") return "auto";
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "minutes" || stored === "hours" || stored === "days") {
      return stored;
    }
    return "auto";
  });

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const next = e.newValue;
      if (next === "minutes" || next === "hours" || next === "days" || next === "auto") {
        setUnitState(next as TimeUnit);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setUnit = (u: TimeUnit) => {
    setUnitState(u);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, u);
  };

  return [unit, setUnit];
}

/**
 * Format `seconds` into a compact Hebrew string per the selected unit.
 * `auto` picks minutes / hours / days based on magnitude.
 */
export function formatSeconds(seconds: number, unit: TimeUnit): string {
  if (seconds <= 0) return "0ד";

  if (unit === "minutes") {
    const m = Math.round(seconds / 60);
    return `${m}ד`;
  }
  if (unit === "hours") {
    const h = seconds / 3600;
    return `${h >= 10 ? h.toFixed(0) : h.toFixed(1)}ש`;
  }
  if (unit === "days") {
    const d = seconds / 86400;
    return `${d >= 10 ? d.toFixed(0) : d.toFixed(1)}י`;
  }

  // auto
  if (seconds < 60) return "<1ד";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}ד`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  if (hours < 24) return remMin > 0 ? `${hours}ש ${remMin}ד` : `${hours}ש`;
  const days = Math.floor(hours / 24);
  const remH = hours % 24;
  return remH > 0 ? `${days}י ${remH}ש` : `${days}י`;
}
