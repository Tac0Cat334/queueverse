"use client";

import { useCallback, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, RefreshCw, Brain } from "lucide-react";
import type { ParkRecommendations } from "@/types";
import { RecommendationSection } from "./RecommendationSection";
import { MaturityBanner } from "./MaturityBanner";
import { NextActionPanel } from "./NextActionPanel";
import { computeParkIntelligence } from "@/lib/park-intelligence";
import { EMPTY_DATA_MATURITY } from "@/lib/data-maturity";
import { EMPTY_PARK_STRATEGY } from "@/lib/intelligence/strategy";
import { REFRESH_INTERVAL_MS } from "@/lib/constants";
import { useAutoRefresh, useDeferredMount } from "@/hooks/use-auto-refresh";
import { useLiveRides } from "@/hooks/use-live-rides";
import { cn } from "@/utils/wait-time";

const TouringPlanBuilder = dynamic(
  () =>
    import("./TouringPlanBuilder").then((m) => m.TouringPlanBuilder),
  {
    loading: () => <div className="skeleton h-64 rounded-2xl" />,
  }
);

interface IntelligenceHubProps {
  initialRides?: import("@/types").RideWithLiveData[];
}

const EMPTY_RECOMMENDATIONS: ParkRecommendations = {
  bestRightNow: [],
  greatTimeToRide: [],
  lowerThanNormal: [],
  trendingUpFast: [],
  expectedToRiseSoon: [],
  byRideId: {},
  strategy: EMPTY_PARK_STRATEGY,
  dataMaturity: EMPTY_DATA_MATURITY,
  weekdayPatternsByRide: {},
  parkWeekdayInsights: {},
  generatedAt: new Date().toISOString(),
};

export function IntelligenceHub({ initialRides = [] }: IntelligenceHubProps) {
  const { rides, refreshLive } = useLiveRides(initialRides);
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
      if (data.recommendations) setRecommendations(data.recommendations);
      setConfigured(data.configured !== false);
    } catch {
      // keep last known data
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useDeferredMount(() => fetchIntelligence(false), 0);

  useAutoRefresh(() => fetchIntelligence(false), REFRESH_INTERVAL_MS, {
    runOnMount: false,
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshLive(false), fetchIntelligence(true)]);
    setRefreshing(false);
  }, [refreshLive, fetchIntelligence]);

  const parkIntel = computeParkIntelligence(rides);
  const strategy = recommendations.strategy ?? EMPTY_PARK_STRATEGY;

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
              Predictive optimization
            </span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--fg)] sm:text-4xl">
            Park strategist
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--fg-secondary)]">
            Live opportunity scoring, predictive waits, and adaptive touring —
            built to answer what you should do next, not just show current queues.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
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

      {!loading && (
        <NextActionPanel strategy={strategy} className="mt-8" />
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Crowd phase" value={strategy.crowdProgression.label} />
        <StatCard label="Avg wait" value={`${parkIntel.averageWait}m`} />
        <StatCard label="Open rides" value={String(parkIntel.openRides)} />
        <StatCard
          label="Optimization"
          value={`${strategy.optimizationIndex}/100`}
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
            subtitle="Opportunity scores compare live waits to historical patterns and predicted trends"
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
