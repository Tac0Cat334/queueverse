"use client";

import { useCallback, useEffect, useState } from "react";
import type { SyncHealth } from "@/lib/sync-health";
import { RelativeTime } from "./RelativeTime";
import { cn } from "@/utils/wait-time";
import { useDeferredMount } from "@/hooks/use-auto-refresh";

interface SyncHealthBadgeProps {
  className?: string;
  compact?: boolean;
}

export function SyncHealthBadge({ className, compact = false }: SyncHealthBadgeProps) {
  const [health, setHealth] = useState<SyncHealth | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/sync-health", { cache: "no-store" });
      if (!res.ok) return;
      setHealth(await res.json());
    } catch {
      // ignore
    }
  }, []);

  useDeferredMount(fetchHealth, 100);

  useEffect(() => {
    const id = setInterval(fetchHealth, 60_000);
    return () => clearInterval(id);
  }, [fetchHealth]);

  if (!health?.configured) return null;

  const statusStyles = {
    healthy: "text-[var(--fg-muted)]",
    delayed: "text-amber-600 dark:text-amber-400",
    stale: "text-red-600 dark:text-red-400",
    unconfigured: "text-[var(--fg-muted)]",
  };

  return (
    <div className={cn("text-xs leading-relaxed", className)}>
      {health.lastSnapshotAt && (
        <p className={cn("label", statusStyles[health.status])}>
          {compact ? (
            <>
              Chart data{" "}
              <RelativeTime
                date={health.lastSnapshotAt}
                prefix="collected"
                className="inline"
              />
            </>
          ) : (
            <>
              Chart snapshots{" "}
              <RelativeTime
                date={health.lastSnapshotAt}
                prefix="collected"
                className="inline"
              />
            </>
          )}
        </p>
      )}
      {!compact && health.status !== "healthy" && (
        <p className={cn("mt-1", statusStyles[health.status])}>{health.message}</p>
      )}
      {compact && health.status !== "healthy" && (
        <p className={cn("mt-0.5", statusStyles[health.status])}>
          {health.minutesSinceLastSnapshot !== null
            ? `Sync delayed (${health.minutesSinceLastSnapshot}m since last)`
            : "Sync delayed"}
        </p>
      )}
    </div>
  );
}
