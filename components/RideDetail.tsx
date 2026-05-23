"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { RideWithLiveData, WaitTimeRecord } from "@/types";
import { DailyWaitChart, WeeklyPatternChart } from "./WaitChart";
import { computeRideAnalytics, computeLiveTrend } from "@/lib/analytics";
import { buildTodayChartData } from "@/lib/daily-chart";
import { formatParkDateLabel } from "@/lib/park-time";
import { getWaitLevel, getWaitLevelClass, formatWaitTime, cn } from "@/utils/wait-time";
import { RelativeTime } from "./RelativeTime";
import { FavoriteButton } from "./FavoriteButton";
import { TrendBadge } from "./TrendBadge";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { useFavorites } from "@/hooks/use-favorites";
import { REFRESH_INTERVAL_MS } from "@/lib/constants";

interface RideDetailProps {
  ride: RideWithLiveData;
}

export function RideDetail({ ride: initialRide }: RideDetailProps) {
  const [ride, setRide] = useState(initialRide);
  const [todayRecords, setTodayRecords] = useState<WaitTimeRecord[]>([]);
  const [historyRecords, setHistoryRecords] = useState<WaitTimeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const { isFavorite, toggleFavorite } = useFavorites();

  const refreshLive = useCallback(async () => {
    try {
      const res = await fetch("/api/live", { cache: "no-store" });
      if (!res.ok) return;

      const data = await res.json();
      const updated = data.rides?.find(
        (r: RideWithLiveData) => r.ride_id === initialRide.ride_id
      );
      if (updated) setRide(updated);
    } catch {
      // keep showing last known data
    }
  }, [initialRide.ride_id]);

  const fetchHistory = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const [todayRes, historyRes] = await Promise.all([
        fetch(`/api/history?rideId=${ride.ride_id}&range=today`, {
          cache: "no-store",
        }),
        fetch(`/api/history?rideId=${ride.ride_id}&range=30d`, {
          cache: "no-store",
        }),
      ]);

      const todayData = await todayRes.json();
      const historyData = await historyRes.json();

      setTodayRecords(todayData.records ?? []);
      setHistoryRecords(historyData.records ?? []);
      setConfigured(
        todayData.configured !== false && historyData.configured !== false
      );
    } catch {
      setTodayRecords([]);
      setHistoryRecords([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [ride.ride_id]);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshLive(), fetchHistory(false)]);
  }, [refreshLive, fetchHistory]);

  useEffect(() => {
    fetchHistory(true);
  }, [fetchHistory]);

  useAutoRefresh(refreshAll, REFRESH_INTERVAL_MS);

  const analytics = useMemo(
    () => computeRideAnalytics(historyRecords, "30d"),
    [historyRecords]
  );

  const allRecords = useMemo(() => {
    const byKey = new Map<string, WaitTimeRecord>();
    for (const record of [...historyRecords, ...todayRecords]) {
      byKey.set(`${record.ride_id}-${record.timestamp}`, record);
    }
    return Array.from(byKey.values());
  }, [historyRecords, todayRecords]);

  const todayChartData = useMemo(
    () => buildTodayChartData(allRecords, ride),
    [allRecords, ride]
  );

  const todaySnapshotCount = todayChartData.length;

  const trend = useMemo(
    () =>
      computeLiveTrend(
        [...historyRecords, ...todayRecords],
        ride.is_open ? ride.wait_time : undefined
      ),
    [historyRecords, todayRecords, ride.wait_time, ride.is_open]
  );

  const level = getWaitLevel(ride.wait_time, ride.is_open);
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
              {!ride.is_open ? "—" : ride.wait_time}
            </p>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">
              {formatWaitTime(ride.wait_time, ride.is_open)}
            </p>
            {ride.is_open && (
              <div className="mt-3">
                <TrendBadge trend={trend.trend} label={trend.label} change={trend.change} />
              </div>
            )}
          </div>
          <div className="mb-2 text-right">
            <span className="text-sm text-[var(--fg-secondary)]">
              {ride.is_open ? "Open" : "Closed"}
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
            Historically,{" "}
            <span className="font-medium text-[var(--fg)]">{ride.name}</span> has
            its lowest average wait around{" "}
            <span className="font-medium text-[var(--fg)]">
              {analytics.bestTimeToRide}
            </span>{" "}
            ({analytics.bestTimeAverageWait} min avg). Peak crowds typically hit
            around{" "}
            <span className="font-medium text-[var(--fg)]">
              {analytics.peakTimeToRide}
            </span>{" "}
            ({analytics.peakTimeAverageWait} min avg).
          </p>
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
              <p className="label">Avg today</p>
              <p className="metric mt-1 text-lg font-semibold">
                {analytics.averageWaitToday}m
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
        </div>
      )}

      <div className="mt-10">
        <h2 className="mb-1 text-sm font-medium text-[var(--fg)]">
          Today&apos;s wait times
        </h2>
        <p className="mb-4 text-xs text-[var(--fg-muted)]">
          {formatParkDateLabel()} · Full day history · Updates every 5 min
        </p>
        {loading ? (
          <div className="skeleton h-72 rounded-2xl" />
        ) : (
          <DailyWaitChart
            data={todayChartData}
            currentWait={ride.is_open ? ride.wait_time : undefined}
            isOpen={ride.is_open}
            snapshotCount={todaySnapshotCount}
          />
        )}
      </div>

      <div className="mt-10">
        <h2 className="mb-1 text-sm font-medium text-[var(--fg)]">
          Weekly average wait pattern
        </h2>
        <p className="mb-4 text-xs text-[var(--fg-muted)]">
          Average wait by time of day from the last 30 days
        </p>
        {loading ? (
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
