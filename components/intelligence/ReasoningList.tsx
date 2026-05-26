"use client";

import { Info } from "lucide-react";
import type { RecommendationReasoning } from "@/types";
import { cn } from "@/utils/wait-time";

interface ReasoningListProps {
  reasoning: RecommendationReasoning;
  compact?: boolean;
  className?: string;
}

export function ReasoningList({
  reasoning,
  compact = false,
  className,
}: ReasoningListProps) {
  if (!reasoning.bullets.length && !reasoning.headline) return null;

  return (
    <div className={cn("space-y-1.5", className)}>
      {!compact && reasoning.headline && (
        <p className="text-xs font-medium text-[var(--fg-secondary)]">
          {reasoning.headline}
        </p>
      )}
      {reasoning.bullets.length > 0 && (
        <ul className="space-y-1">
          {reasoning.bullets.map((bullet) => (
            <li
              key={bullet}
              className="flex items-start gap-1.5 text-[11px] leading-relaxed text-[var(--fg-muted)]"
            >
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--fg-muted)]" />
              {bullet}
            </li>
          ))}
        </ul>
      )}
      {reasoning.dataNote && !compact && (
        <p className="flex items-center gap-1 text-[10px] text-[var(--fg-muted)]">
          <Info className="h-3 w-3 shrink-0 opacity-60" />
          {reasoning.dataNote}
        </p>
      )}
    </div>
  );
}

interface WhyTooltipProps {
  reasoning: RecommendationReasoning;
  label?: string;
}

export function WhyTooltip({ reasoning, label = "Why?" }: WhyTooltipProps) {
  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-[10px] font-medium text-[var(--fg-muted)] hover:text-[var(--fg-secondary)]">
        {label}
      </summary>
      <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--surface-hover)]/50 p-3">
        <ReasoningList reasoning={reasoning} compact />
      </div>
    </details>
  );
}
