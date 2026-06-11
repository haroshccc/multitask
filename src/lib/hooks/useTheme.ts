import { useCallback, useState } from "react";

/**
 * Light/dark theme toggle (beta). The `dark` class on <html> drives
 * Tailwind's `darkMode: "class"` plus the CSS-variable ink scale in
 * index.css. The choice persists per device; an inline script in
 * index.html applies it before first paint to avoid a light flash.
 * Default is light — dark is opt-in.
 */
export type Theme = "light" | "dark";

const STORAGE_KEY = "multitask:theme";

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() =>
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")
      ? "dark"
      : "light",
  );

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* private mode — non-fatal */
    }
    document.documentElement.classList.toggle("dark", t === "dark");
  }, []);

  const toggle = useCallback(
    () => setTheme(theme === "dark" ? "light" : "dark"),
    [theme, setTheme],
  );

  return { theme, setTheme, toggle };
}
