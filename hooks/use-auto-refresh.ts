"use client";

import { useEffect, useLayoutEffect, useState, useCallback } from "react";
import { REFRESH_INTERVAL_MS } from "@/lib/constants";

export function useAutoRefresh(
  callback: () => void,
  intervalMs = REFRESH_INTERVAL_MS,
  options?: { runOnMount?: boolean }
) {
  const runOnMount = options?.runOnMount !== false;

  useLayoutEffect(() => {
    if (runOnMount) callback();
  }, [callback, runOnMount]);

  useEffect(() => {
    const id = setInterval(callback, intervalMs);
    return () => clearInterval(id);
  }, [callback, intervalMs]);
}

export function useAnimatedCounter(
  target: number,
  duration = 800
): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (target === 0) {
      setValue(0);
      return;
    }

    const start = value;
    const diff = target - start;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(start + diff * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return value;
}

export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}

export function useRefreshTrigger() {
  const [trigger, setTrigger] = useState(0);
  const refresh = useCallback(() => setTrigger((t) => t + 1), []);
  return { trigger, refresh };
}

/** Run a callback once after mount without blocking the first paint. */
export function useDeferredMount(callback: () => void, delayMs = 0) {
  useEffect(() => {
    const id = setTimeout(callback, delayMs);
    return () => clearTimeout(id);
  }, [callback, delayMs]);
}
