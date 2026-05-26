"use client";

import { cn } from "@/utils/wait-time";

interface UrgencyBadgeProps {
  score: number;
  label?: string;
  size?: "sm" | "md";
  className?: string;
}

function urgencyTone(score: number): string {
  if (score >= 75) return "text-[var(--wait-high)] bg-[var(--wait-high)]/10";
  if (score >= 55) return "text-[var(--wait-medium)] bg-[var(--wait-medium)]/10";
  return "text-[var(--fg-muted)] bg-[var(--surface-hover)]";
}

export function UrgencyBadge({
  score,
  label,
  size = "sm",
  className,
}: UrgencyBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium tabular-nums",
        urgencyTone(score),
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
        className
      )}
    >
      {label ? label : `Urgency ${score}`}
    </span>
  );
}
