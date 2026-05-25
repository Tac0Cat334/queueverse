"use client";

import { useCallback, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, Brain } from "lucide-react";
import type { RideWithLiveData, ParkRecommendations } from "@/types";
import { RecommendationSection } from "./RecommendationSection";
import { TouringPlanBuilder } from "./TouringPlanBuilder";
import { MaturityBanner } from "./MaturityBanner";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { computeParkIntelligence } from "@/lib/park-intelligence";
import { EMPTY_DATA_MATURITY } from "@/lib/data-maturity";
import { REFRESH_INTERVAL_MS } from "@/lib/constants";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { cn } from "@/utils/wait-time";

interface IntelligenceHubProps {
  initialRides: RideWithLiveData[];
}

const EMPTY_RECOMMENDATIONS: ParkRecommendations = {
  bestRightNow: [],
  greatTimeToRide: [],
  lowerThanNormal: [],
  trendingUpFast: [],
  expectedToRiseSoon: [],
  byRideId: {},
  dataMaturity: EMPTY_DATA_MATURITY,
  weekdayPatternsByRide: {},
  parkWeekdayInsights: {},
  generatedAt: new Date().toISOString(),
};

export function IntelligenceHub({ initialRides }: IntelligenceHubProps) {
  const [rides, setRides] = useState(initialRides);
  const [recommendations, setRecommendations] =
    useState<ParkRecommendations>(EMPTY_RECOMMENDATIONS);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchIntelligence = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch("/api/intelligence", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.rides) setRides(data.rides);
      if (data.recommendations) setRecommendations(data.recommendations);
      setConfigured(data.configured !== false);
    } catch {
      // keep last known data
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useAutoRefresh(() => fetchIntelligence(false), REFRESH_INTERVAL_MS);

  const parkIntel = computeParkIntelligence(rides);
  const topPick = recommendations.bestRightNow[0];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-[var(--fg-secondary)] transition-colors hover:text-[var(--fg)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to waits
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[var(--surface-hover)] px-3 py-1">
            <Brain className="h-3.5 w-3.5 text-[var(--fg-secondary)]" />
            <span className="text-[11px] font-medium text-[var(--fg-secondary)]">
              Park intelligence
            </span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--fg)] sm:text-4xl">
            Ride strategy
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--fg-secondary)]">
            Recommendations learn from every 5-minute snapshot — weekday patterns,
            recency weighting, and confidence scoring improve automatically over time.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchIntelligence(true)}
          disabled={refreshing}
          className="chip shrink-0 disabled:opacity-40"
          aria-label="Refresh intelligence"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
        </button>
      </div>

      {!configured && (
        <p className="mt-4 text-sm text-[var(--fg-muted)]">
          Historical data is still building. Recommendations improve as more
          snapshots are collected every 5 minutes.
        </p>
      )}

      {!loading && recommendations.dataMaturity && (
        <MaturityBanner maturity={recommendations.dataMaturity} className="mt-6" />
      )}

      {topPick && !loading && (
        <div className="card mt-8 p-5 sm:p-6">
          <p className="label">Best ride right now</p>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <Link
                href={`/rides/${topPick.rideId}`}
                className="text-2xl font-semibold tracking-tight text-[var(--fg)] hover:underline"
              >
                {topPick.rideName}
              </Link>
              <p className="mt-1 text-sm text-[var(--fg-secondary)]">
                {topPick.label} · {topPick.reason}
              </p>
              <p className="mt-1 text-xs text-[var(--fg-muted)]">{topPick.land}</p>
            </div>
            <div className="text-left sm:text-right">
              <p className="metric text-4xl font-semibold text-[var(--fg)]">
                {topPick.currentWait}
                <span className="ml-1 text-base font-normal text-[var(--fg-muted)]">
                  min
                </span>
              </p>
              <p className="mt-1 text-xs text-[var(--fg-muted)]">
                Opportunity {topPick.opportunityScore}/100
              </p>
              <ConfidenceBadge
                score={topPick.confidenceScore}
                label={topPick.confidenceLabel}
                className="mt-1.5"
              />
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Crowd level" value={parkIntel.crowdScore.label} />
        <StatCard label="Avg wait" value={`${parkIntel.averageWait}m`} />
        <StatCard label="Open rides" value={String(parkIntel.openRides)} />
        <StatCard
          label="Intelligence"
          value={recommendations.dataMaturity?.maturityLabel ?? "—"}
        />
      </div>

      {loading ? (
        <div className="mt-10 space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-40 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="mt-10 space-y-10">
          <RecommendationSection
            title="Best opportunities"
            subtitle="Ranked by opportunity score — current wait vs historical patterns"
            items={recommendations.bestRightNow}
          />

          <RecommendationSection
            title="Great time to ride"
            subtitle="Significantly below typical waits for this time of day"
            items={recommendations.greatTimeToRide}
            emptyMessage="No rides significantly below normal right now."
          />

          <RecommendationSection
            title="Lower than normal"
            subtitle="Waits below historical average for the current time slot"
            items={recommendations.lowerThanNormal}
          />

          <RecommendationSection
            title="Trending up fast"
            subtitle="Rides where waits are climbing — ride soon or expect longer queues"
            items={recommendations.trendingUpFast}
            emptyMessage="No rides with rapidly rising waits."
          />

          <RecommendationSection
            title="Expected to rise soon"
            subtitle="Currently favorable but predicted to spike within 30 minutes"
            items={recommendations.expectedToRiseSoon}
            emptyMessage="No imminent spikes detected."
          />

          <TouringPlanBuilder rides={rides} recommendations={recommendations} />
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="card p-3 sm:p-4">
      <p className="label">{label}</p>
      <p className="metric mt-1 text-lg font-semibold text-[var(--fg)]">{value}</p>
    </div>
  );
}
