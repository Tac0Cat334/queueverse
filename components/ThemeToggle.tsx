"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
  const { resolved, setTheme } = useTheme();
  const isDark = resolved === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="theme-toggle flex items-center justify-end px-0.5"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <span className="theme-toggle-thumb flex items-center justify-center">
        {isDark ? (
          <Moon className="h-2.5 w-2.5 text-[var(--bg)]" />
        ) : (
          <Sun className="h-2.5 w-2.5 text-[var(--bg)]" />
        )}
      </span>
    </button>
  );
}
