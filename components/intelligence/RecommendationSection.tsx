"use client";

import type { RideRecommendation } from "@/types";
import { RecommendationCard } from "./RecommendationCard";

interface RecommendationSectionProps {
  title: string;
  subtitle?: string;
  items: RideRecommendation[];
  emptyMessage?: string;
}

export function RecommendationSection({
  title,
  subtitle,
  items,
  emptyMessage = "Nothing to highlight right now.",
}: RecommendationSectionProps) {
  if (items.length === 0) {
    return (
      <section>
        <div className="mb-3">
          <h2 className="text-sm font-medium text-[var(--fg)]">{title}</h2>
          {subtitle && (
            <p className="mt-0.5 text-xs text-[var(--fg-muted)]">{subtitle}</p>
          )}
        </div>
        <div className="card flex h-24 items-center justify-center px-4">
          <p className="text-xs text-[var(--fg-muted)]">{emptyMessage}</p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-3">
        <h2 className="text-sm font-medium text-[var(--fg)]">{title}</h2>
        {subtitle && (
          <p className="mt-0.5 text-xs text-[var(--fg-muted)]">{subtitle}</p>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item, index) => (
          <RecommendationCard
            key={`${item.category}-${item.rideId}`}
            recommendation={item}
            rank={index + 1}
          />
        ))}
      </div>
    </section>
  );
}
