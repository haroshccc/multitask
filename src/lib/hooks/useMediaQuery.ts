import { useSyncExternalStore } from "react";

/**
 * Hook to react to a CSS media query. Uses the browser's MediaQueryList so the
 * hook re-renders exactly when the match state flips.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      if (typeof window === "undefined") return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    () => {
      if (typeof window === "undefined") return false;
      return window.matchMedia(query).matches;
    },
    () => false
  );
}
