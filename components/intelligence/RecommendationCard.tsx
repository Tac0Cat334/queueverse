"use client";

import Link from "next/link";
import type { RideRecommendation } from "@/types";
import { OpportunityBadge } from "./OpportunityBadge";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { TrendBadge } from "../TrendBadge";

interface RecommendationCardProps {
  recommendation: RideRecommendation;
  rank?: number;
}

export function RecommendationCard({ recommendation, rank }: RecommendationCardProps) {
  return (
    <Link
      href={`/rides/${recommendation.rideId}`}
      className="card-interactive block p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {rank !== undefined && (
              <span className="text-[10px] font-medium text-[var(--fg-muted)]">
                #{rank}
              </span>
            )}
            <h3 className="truncate text-sm font-medium text-[var(--fg)]">
              {recommendation.rideName}
            </h3>
          </div>
          <p className="mt-0.5 truncate text-xs text-[var(--fg-muted)]">
            {recommendation.land}
          </p>
          <p className="mt-2 text-xs font-medium text-[var(--fg-secondary)]">
            {recommendation.label}
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--fg-muted)]">
            {recommendation.reason}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="metric text-2xl font-semibold text-[var(--fg)]">
            {recommendation.currentWait}
            <span className="ml-0.5 text-xs font-normal text-[var(--fg-muted)]">
              m
            </span>
          </p>
          <div className="mt-1.5 flex flex-col items-end gap-1">
            <OpportunityBadge score={recommendation.opportunityScore} />
            <ConfidenceBadge
              score={recommendation.confidenceScore}
              label={recommendation.confidenceLabel}
            />
            <TrendBadge
              trend={recommendation.trend.trend}
              label={recommendation.trend.label}
              compact
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
