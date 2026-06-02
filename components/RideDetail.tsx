"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { RideWithLiveData, WaitTimeRecord } from "@/types";
import { computeRideAnalytics, computeLiveTrend } from "@/lib/analytics";
import {
  computeRideIntelligence,
  buildHistoricalAverageSeries,
} from "@/lib/ride-intelligence";
import { buildTodayChartData } from "@/lib/daily-chart";
import { formatParkDateLabel, isWithinParkDay } from "@/lib/park-time";
import { SyncHealthBadge } from "./SyncHealthBadge";
import {
  getWaitLevel,
  getWaitLevelClass,
  formatRideStatusLabel,
  cn,
} from "@/utils/wait-time";
import { DailyWaitChart, WeeklyPatternChart } from "./WaitChart";
import { RelativeTime } from "./RelativeTime";
import { FavoriteButton } from "./FavoriteButton";
import { TrendBadge } from "./TrendBadge";
import { OpportunityBadge } from "./intelligence/OpportunityBadge";
import { UrgencyBadge } from "./intelligence/UrgencyBadge";
import { ConfidenceBadge } from "./intelligence/ConfidenceBadge";
import { ReasoningList } from "./intelligence/ReasoningList";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { useLiveRides } from "@/hooks/use-live-rides";
import { useFavorites } from "@/hooks/use-favorites";
import { REFRESH_INTERVAL_MS } from "@/lib/constants";

interface RideDetailProps {
  rideId: number;
  initialRides?: RideWithLiveData[];
  initialRecords?: WaitTimeRecord[];
  initialConfigured?: boolean;
}

export function RideDetail({
  rideId,
  initialRides = [],
  initialRecords = [],
  initialConfigured = true,
}: RideDetailProps) {
  const { rides, isRefreshing, isReady, refreshLive } =
    useLiveRides(initialRides);
  const ride = rides.find((r) => r.ride_id === rideId) ?? null;
  const [historyRecords, setHistoryRecords] =
    useState<WaitTimeRecord[]>(initialRecords);
  const [historyRefreshing, setHistoryRefreshing] = useState(false);
  const [configured, setConfigured] = useState(initialConfigured);
  const { isFavorite, toggleFavorite } = useFavorites();

  const fetchHistory = useCallback(async (background = false) => {
    if (!background) setHistoryRefreshing(true);
    try {
      const res = await fetch(`/api/history?rideId=${rideId}&range=30d`);
      if (!res.ok) return;
      const data = await res.json();
      setHistoryRecords(data.records ?? []);
      setConfigured(data.configured !== false);
    } catch {
      if (!background) {
        setHistoryRecords([]);
      }
    } finally {
      if (!background) setHistoryRefreshing(false);
    }
  }, [rideId]);

  useAutoRefresh(
    () => {
      void refreshLive(true);
      void fetchHistory(true);
    },
    REFRESH_INTERVAL_MS,
    { runOnMount: false }
  );

  const analytics = useMemo(
    () => computeRideAnalytics(historyRecords, "30d"),
    [historyRecords]
  );

  const intelligence = useMemo(
    () => (ride ? computeRideIntelligence(ride, historyRecords) : null),
    [ride, historyRecords]
  );

  const allRecords = historyRecords;

  const todayChartData = useMemo(() => {
    if (!ride) return [];
    const base = buildTodayChartData(allRecords, ride);
    const historicalOpen = historyRecords.filter(
      (r) => r.is_open && isWithinParkDay(r.timestamp)
    );
    const averages = buildHistoricalAverageSeries(
      historicalOpen,
      base.map((d) => d.timestamp)
    );
    return base.map((point, index) => ({
      ...point,
      historical_avg: averages[index] > 0 ? averages[index] : undefined,
    }));
  }, [allRecords, ride, historyRecords]);

  const todayParkRecords = useMemo(
    () => allRecords.filter((r) => isWithinParkDay(r.timestamp)),
    [allRecords]
  );
  const todaySnapshotCount = todayParkRecords.filter((r) => r.is_open).length;
  const closedSnapshotCount = todayParkRecords.filter((r) => !r.is_open).length;

  const trend = useMemo(
    () =>
      ride
        ? computeLiveTrend(
            historyRecords,
            ride.operationalStatus === "open" ? ride.wait_time : undefined
          )
        : { trend: "flat" as const, label: "—", change: 0 },
    [historyRecords, ride]
  );

  const chartsReady = initialRecords.length > 0 || !historyRefreshing;

  if (!ride && (isRefreshing || !isReady)) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="skeleton h-8 w-24" />
        <div className="card mt-8 p-8">
          <div className="skeleton h-4 w-32" />
          <div className="skeleton mt-4 h-20 w-40" />
        </div>
      </div>
    );
  }

  if (!ride) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-[var(--fg-muted)]">Ride not found.</p>
        <Link href="/" className="mt-4 inline-block text-sm text-[var(--fg)]">
          Back to waits
        </Link>
      </div>
    );
  }

  if (!intelligence) {
    return null;
  }

  const level = getWaitLevel(
    ride.wait_time,
    ride.is_open,
    ride.operationalStatus
  );
  const hasInsights = analytics.bestTimeToRide !== "Not enough data";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-[var(--fg-secondary)] transition-colors hover:text-[var(--fg)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <div className="card p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="label">{ride.land}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--fg)] sm:text-3xl">
              {ride.name}
            </h1>
          </div>
          <FavoriteButton
            isFavorite={isFavorite(ride.ride_id)}
            onToggle={() => toggleFavorite(ride.ride_id)}
          />
        </div>

        <div className="mt-8 flex items-end justify-between">
          <div>
            <p className="label">Current wait</p>
            <p
              className={cn(
                "metric mt-1 text-6xl font-semibold sm:text-7xl",
                getWaitLevelClass(level)
              )}
            >
              {ride.operationalStatus !== "open" ? "—" : ride.wait_time}
            </p>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">
              {formatRideStatusLabel(ride)}
            </p>
            {ride.operationalStatus === "open" && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <TrendBadge trend={trend.trend} label={trend.label} change={trend.change} />
                {intelligence.earlyEntry.active && intelligence.earlyEntry.eligible && (
                  <span className="inline-flex items-center rounded-full bg-[var(--wait-low)]/15 px-2 py-0.5 text-[10px] font-medium text-[var(--wait-low)]">
                    Early Entry window
                  </span>
                )}
                {intelligence.waitInflation.score >= 45 && intelligence.earlyEntry.eligible && (
                  <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                    {intelligence.waitInflation.isHeadliner
                      ? "Spikes after opening"
                      : "Wait inflation risk"}
                  </span>
                )}
                {intelligence.isOpen && (
                  <>
                    <OpportunityBadge score={intelligence.opportunityScore} size="md" />
                    <UrgencyBadge
                      score={intelligence.urgencyScore}
                      label={intelligence.urgencyLabel}
                      size="md"
                    />
                    <ConfidenceBadge
                      score={intelligence.confidenceScore}
                      label={intelligence.confidenceLabel}
                    />
                  </>
                )}
              </div>
            )}
            {intelligence.waitInflation.score >= 40 &&
              ride.operationalStatus === "open" && (
              <p className="mt-2 text-xs text-[var(--fg-secondary)]">
                {intelligence.waitInflation.message}
              </p>
            )}
            {intelligence.opportunityTier && ride.operationalStatus === "open" && (
              <p className="mt-2 text-xs font-medium text-[var(--wait-low)]">
                {intelligence.opportunityTier.label}
                {intelligence.estimatedMinutesSavedVsTypical
                  ? ` · ~${intelligence.estimatedMinutesSavedVsTypical}m saved vs typical`
                  : ""}
              </p>
            )}
            {intelligence.reasoning && ride.operationalStatus === "open" && (
              <ReasoningList
                reasoning={intelligence.reasoning}
                compact
                className="mt-3"
              />
            )}
            {intelligence.comparisonMessage &&
              ride.operationalStatus === "open" && (
              <p className="mt-2 text-xs text-[var(--fg-secondary)]">
                {intelligence.comparisonMessage}
              </p>
            )}
            {intelligence.learningNote && (
              <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
                {intelligence.learningNote}
              </p>
            )}
          </div>
          <div className="mb-2 text-right">
            <span className="text-sm text-[var(--fg-secondary)]">
              {ride.operationalStatus === "open"
                ? "Open"
                : formatRideStatusLabel(ride)}
            </span>
            <RelativeTime
              date={ride.last_updated}
              className="mt-1 block text-xs text-[var(--fg-muted)]"
            />
          </div>
        </div>
      </div>

      {!configured && (
        <p className="mt-4 text-sm text-[var(--fg-muted)]">
          Historical data unavailable. Live waits still work.
        </p>
      )}

      {hasInsights && (
        <div className="card mt-4 p-5 sm:p-6">
          <p className="label mb-3">Ride intelligence</p>
          <p className="text-sm leading-relaxed text-[var(--fg-secondary)]">
            {intelligence.vsAveragePercent !== null &&
            intelligence.vsAveragePercent >= 10 ? (
              <>
                Currently{" "}
                <span className="font-medium text-[var(--wait-low)]">
                  {intelligence.vsAveragePercent}% below average
                </span>{" "}
                for this time of day.
              </>
            ) : intelligence.vsAveragePercent !== null &&
              intelligence.vsAveragePercent <= -10 ? (
              <>
                Currently{" "}
                <span className="font-medium text-[var(--wait-high)]">
                  {Math.abs(intelligence.vsAveragePercent)}% above average
                </span>{" "}
                for this time of day.
              </>
            ) : (
              <>
                Wait is near typical levels for{" "}
                <span className="font-medium text-[var(--fg)]">{ride.name}</span>{" "}
                at this time.
              </>
            )}{" "}
            {intelligence.trendForecast && (
              <span>{intelligence.trendForecast}.</span>
            )}
          </p>

          {(intelligence.prediction30 || intelligence.prediction60) && (
            <div className="mt-4 space-y-2">
              {intelligence.prediction30 && (
                <div className="text-xs text-[var(--fg-secondary)]">
                  <span>{intelligence.prediction30.summary}</span>
                  <span className="ml-2 text-[var(--fg-muted)]">
                    · {intelligence.prediction30.confidenceLabel}
                  </span>
                </div>
              )}
              {intelligence.prediction60 &&
                intelligence.prediction60.summary !==
                  intelligence.prediction30?.summary && (
                  <div className="text-xs text-[var(--fg-secondary)]">
                    <span>{intelligence.prediction60.summary}</span>
                    <span className="ml-2 text-[var(--fg-muted)]">
                      · {intelligence.prediction60.confidenceLabel}
                    </span>
                  </div>
                )}
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-[var(--surface-hover)] p-3">
              <p className="label">Best window</p>
              <p className="metric mt-1 text-lg font-semibold">
                {analytics.bestTimeToRide}
              </p>
            </div>
            <div className="rounded-xl bg-[var(--surface-hover)] p-3">
              <p className="label">Peak time</p>
              <p className="metric mt-1 text-lg font-semibold">
                {analytics.peakTimeToRide}
              </p>
            </div>
            <div className="rounded-xl bg-[var(--surface-hover)] p-3">
              <p className="label">Volatility</p>
              <p className="metric mt-1 text-lg font-semibold">
                {intelligence.volatilityScore}/100
              </p>
            </div>
            <div className="rounded-xl bg-[var(--surface-hover)] p-3">
              <p className="label">Reliability</p>
              <p className="metric mt-1 text-lg font-semibold">
                {analytics.reliabilityScore !== null
                  ? `${analytics.reliabilityScore}%`
                  : "—"}
              </p>
            </div>
          </div>

          <p className="mt-4 text-xs text-[var(--fg-muted)]">
            {intelligence.recommendationLabel}
            {intelligence.historicalAverage !== null &&
              ` · Typical now: ${intelligence.historicalAverage} min`}
            {intelligence.baselineSource === "weekday" &&
              ` · ${intelligence.learningNote ?? "Weekday pattern"}`}
          </p>
        </div>
      )}

      <div className="mt-10">
        <h2 className="mb-1 text-sm font-medium text-[var(--fg)]">
          Today&apos;s wait times
        </h2>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <p className="text-xs text-[var(--fg-muted)]">
            {formatParkDateLabel()} · 7:30 AM – 11:00 PM · Updates every 5 min
          </p>
          <SyncHealthBadge compact className="text-right" />
        </div>
        {!chartsReady ? (
          <div className="skeleton h-72 rounded-2xl" />
        ) : (
          <DailyWaitChart
            data={todayChartData}
            currentWait={
              ride.operationalStatus === "open" ? ride.wait_time : undefined
            }
            isOpen={ride.operationalStatus === "open"}
            snapshotCount={todaySnapshotCount}
            closedSnapshotCount={closedSnapshotCount}
            historicalAverage={intelligence.historicalAverage}
          />
        )}
      </div>

      <div className="mt-10">
        <h2 className="mb-1 text-sm font-medium text-[var(--fg)]">
          Weekly average wait pattern
        </h2>
        <p className="mb-4 text-xs text-[var(--fg-muted)]">
          Average wait by time of day (7:30 AM – 11:00 PM) · last 30 days
        </p>
        {!chartsReady ? (
          <div className="skeleton h-64 rounded-2xl" />
        ) : (
          <WeeklyPatternChart
            data={analytics.weeklyPattern}
            bestHour={analytics.hourlyMinimum.hour}
            peakHour={
              analytics.averageWaitByHour.length > 0
                ? analytics.averageWaitByHour.reduce((max, h) =>
                    h.average > max.average ? h : max
                  ).hour
                : undefined
            }
          />
        )}
        {hasInsights && (
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--fg-muted)]">
            <span>
              Best period:{" "}
              <span className="text-[var(--wait-low)]">
                {analytics.hourlyMinimum.label} ({analytics.hourlyMinimum.average}m avg)
              </span>
            </span>
            {analytics.peakTimeToRide !== "Not enough data" && (
              <span>
                Peak period:{" "}
                <span className="text-[var(--wait-high)]">
                  {analytics.peakTimeToRide} ({analytics.peakTimeAverageWait}m avg)
                </span>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
