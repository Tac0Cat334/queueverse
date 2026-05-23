"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import {
  type Theme,
  getStoredTheme,
  setStoredTheme,
  resolveTheme,
  applyTheme,
} from "@/lib/theme";

interface ThemeContextValue {
  theme: Theme;
  resolved: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const stored = getStoredTheme();
    setThemeState(stored);
    const r = resolveTheme(stored);
    setResolved(r);
    applyTheme(stored);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (getStoredTheme() === "system") {
        const r = resolveTheme("system");
        setResolved(r);
        applyTheme("system");
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    setResolved(resolveTheme(t));
    setStoredTheme(t);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export function useChartColors() {
  const { resolved } = useTheme();
  const isDark = resolved === "dark";

  return {
    line: isDark ? "#fafafa" : "#18181b",
    fill: isDark ? "rgba(250,250,250,0.06)" : "rgba(24,24,27,0.06)",
    grid: isDark ? "#27272a" : "#e4e4e7",
    tick: isDark ? "#71717a" : "#a1a1aa",
    tooltipBg: isDark ? "#18181b" : "#ffffff",
    tooltipBorder: isDark ? "#27272a" : "#e4e4e7",
    low: isDark ? "#4ade80" : "#16a34a",
    high: isDark ? "#f87171" : "#dc2626",
  };
}
