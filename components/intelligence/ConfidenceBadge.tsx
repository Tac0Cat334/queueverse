"use client";

import { cn } from "@/utils/wait-time";

interface ConfidenceBadgeProps {
  score: number;
  label: string;
  className?: string;
}

function tone(score: number): string {
  if (score >= 65) return "text-[var(--wait-low)] bg-[var(--wait-low)]/10";
  if (score >= 35) return "text-[var(--fg-secondary)] bg-[var(--surface-hover)]";
  return "text-[var(--fg-muted)] bg-[var(--surface-hover)]";
}

export function ConfidenceBadge({ score, label, className }: ConfidenceBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
        tone(score),
        className
      )}
      title={`Prediction confidence: ${score}/100`}
    >
      {label}
    </span>
  );
}
