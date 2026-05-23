"use client";

import { cn } from "@/utils/wait-time";

interface OpportunityBadgeProps {
  score: number;
  size?: "sm" | "md";
  className?: string;
}

function scoreTone(score: number): string {
  if (score >= 75) return "text-[var(--wait-low)] bg-[var(--wait-low)]/10";
  if (score >= 50) return "text-[var(--wait-medium)] bg-[var(--wait-medium)]/10";
  return "text-[var(--fg-muted)] bg-[var(--surface-hover)]";
}

export function OpportunityBadge({
  score,
  size = "sm",
  className,
}: OpportunityBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium tabular-nums",
        scoreTone(score),
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
        className
      )}
    >
      {score}/100
    </span>
  );
}
