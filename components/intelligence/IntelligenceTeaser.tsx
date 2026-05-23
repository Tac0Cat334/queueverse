"use client";

import Link from "next/link";
import { ArrowRight, Brain } from "lucide-react";
import type { ParkRecommendations } from "@/types";
import { RecommendationCard } from "./RecommendationCard";

interface IntelligenceTeaserProps {
  recommendations: ParkRecommendations | null;
  loading?: boolean;
}

export function IntelligenceTeaser({
  recommendations,
  loading,
}: IntelligenceTeaserProps) {
  if (loading) {
    return (
      <section className="mx-auto mt-8 max-w-5xl px-4 sm:px-6">
        <div className="skeleton h-48 rounded-2xl" />
      </section>
    );
  }

  const items = recommendations?.bestRightNow.slice(0, 3) ?? [];

  return (
    <section className="mx-auto mt-8 max-w-5xl px-4 sm:px-6">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <div className="mb-2 inline-flex items-center gap-1.5 text-[var(--fg-secondary)]">
            <Brain className="h-3.5 w-3.5" />
            <span className="label">Ride strategy</span>
          </div>
          <h2 className="text-lg font-semibold tracking-tight text-[var(--fg)]">
            What to ride right now
          </h2>
          <p className="mt-1 text-xs text-[var(--fg-muted)]">
            {recommendations?.dataMaturity
              ? `${recommendations.dataMaturity.maturityLabel} · ${recommendations.dataMaturity.uniqueDays} days learned`
              : "Ranked by opportunity score using live waits and historical patterns"}
          </p>
        </div>
        <Link
          href="/intelligence"
          className="chip shrink-0 inline-flex items-center gap-1 text-xs"
        >
          View all
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="card flex h-28 items-center justify-center px-4">
          <p className="text-xs text-[var(--fg-muted)]">
            Recommendations appear as historical data builds.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {items.map((item, index) => (
            <RecommendationCard
              key={item.rideId}
              recommendation={item}
              rank={index + 1}
            />
          ))}
        </div>
      )}
    </section>
  );
}
