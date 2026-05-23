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
    line: isDark ? "#e4e4e7" : "#3f3f46",
    fillStart: isDark ? "rgba(228,228,231,0.14)" : "rgba(24,24,27,0.1)",
    fillEnd: isDark ? "rgba(228,228,231,0)" : "rgba(24,24,27,0)",
    grid: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
    tick: isDark ? "#52525b" : "#a1a1aa",
    cursor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
    tooltipBg: isDark ? "rgba(24,24,27,0.92)" : "rgba(255,255,255,0.96)",
    tooltipBorder: isDark ? "rgba(63,63,70,0.8)" : "rgba(228,228,231,0.9)",
    tooltipShadow: isDark
      ? "0 8px 32px rgba(0,0,0,0.45)"
      : "0 8px 24px rgba(0,0,0,0.08)",
    glow: isDark ? "#fafafa" : "#18181b",
    low: isDark ? "#4ade80" : "#16a34a",
    high: isDark ? "#f87171" : "#dc2626",
  };
}
