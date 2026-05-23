"use client";

import type { DataMaturityMetrics } from "@/types";
import { cn } from "@/utils/wait-time";

interface MaturityBannerProps {
  maturity: DataMaturityMetrics;
  className?: string;
}

function tierColor(level: DataMaturityMetrics["maturityLevel"]): string {
  switch (level) {
    case "expert":
      return "text-[var(--wait-low)]";
    case "reliable":
      return "text-[var(--fg)]";
    case "developing":
      return "text-[var(--wait-medium)]";
    default:
      return "text-[var(--fg-muted)]";
  }
}

export function MaturityBanner({ maturity, className }: MaturityBannerProps) {
  const progress = maturity.maturityScore;

  return (
    <div className={cn("card p-4 sm:p-5", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="label">Intelligence level</p>
            <span
              className={cn(
                "text-xs font-medium",
                tierColor(maturity.maturityLevel)
              )}
            >
              {maturity.maturityLabel}
            </span>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--fg-secondary)]">
            {maturity.message}
          </p>
          <p className="mt-2 text-[11px] text-[var(--fg-muted)]">
            {maturity.totalSnapshots.toLocaleString()} snapshots ·{" "}
            {maturity.uniqueDays} park day{maturity.uniqueDays === 1 ? "" : "s"} ·{" "}
            {maturity.ridesWithData}/{maturity.totalRides} rides with history
          </p>
        </div>

        <div className="shrink-0 sm:w-36">
          <div className="flex items-end justify-between">
            <span className="metric text-2xl font-semibold text-[var(--fg)]">
              {progress}
            </span>
            <span className="text-[10px] text-[var(--fg-muted)]">/ 100</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-hover)]">
            <div
              className="h-full rounded-full bg-[var(--fg)] transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          {maturity.nextTierLabel && maturity.daysToNextTier !== null && (
            <p className="mt-1.5 text-[10px] text-[var(--fg-muted)]">
              ~{maturity.daysToNextTier} more day
              {maturity.daysToNextTier === 1 ? "" : "s"} to {maturity.nextTierLabel}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
