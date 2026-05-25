"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { RideWithLiveData } from "@/types";
import { REFRESH_INTERVAL_MS } from "@/lib/constants";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";

/** Fetch fresh live waits immediately on mount (before paint), then on interval. */
export function useLiveRides(initialRides: RideWithLiveData[] = []) {
  const [rides, setRides] = useState(initialRides);
  const [isRefreshing, setIsRefreshing] = useState(initialRides.length === 0);
  const mounted = useRef(false);

  const [isReady, setIsReady] = useState(initialRides.length > 0);

  const refreshLive = useCallback(async (background = false) => {
    if (!background && !mounted.current) setIsRefreshing(true);
    try {
      const res = await fetch("/api/live", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.rides?.length) setRides(data.rides);
    } catch {
      // keep last known data
    } finally {
      mounted.current = true;
      setIsRefreshing(false);
      setIsReady(true);
    }
  }, []);

  useLayoutEffect(() => {
    refreshLive(false);
  }, [refreshLive]);

  useAutoRefresh(() => refreshLive(true), REFRESH_INTERVAL_MS, {
    runOnMount: false,
  });

  return { rides, isRefreshing, isReady, refreshLive };
}
