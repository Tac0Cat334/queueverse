"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { RideWithLiveData, TimeRange, ChartDataPoint, WaitTimeRecord } from "@/types";
import { WaitChart, HourlyWaitChart } from "./WaitChart";
import { computeRideAnalytics, filterRecordsByRange } from "@/lib/analytics";
import { getWaitLevel, getWaitLevelClass, formatWaitTime, cn } from "@/utils/wait-time";
import { RelativeTime } from "./RelativeTime";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { REFRESH_INTERVAL_MS } from "@/lib/constants";
import { format } from "date-fns";

interface RideDetailProps {
  ride: RideWithLiveData;
  initialFetchedAt: string;
}

const rangeOptions: { value: TimeRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
];

export function RideDetail({ ride: initialRide, initialFetchedAt }: RideDetailProps) {
  const [ride, setRide] = useState(initialRide);
  const [lastCheckedAt, setLastCheckedAt] = useState(initialFetchedAt);
  const [range, setRange] = useState<TimeRange>("today");
  const [records, setRecords] = useState<WaitTimeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);

  const refreshLive = useCallback(async () => {
    try {
      const res = await fetch("/api/live", { cache: "no-store" });
      if (!res.ok) return;

      const data = await res.json();
      const updated = data.rides?.find(
        (r: RideWithLiveData) => r.ride_id === initialRide.ride_id
      );
      if (updated) setRide(updated);
      setLastCheckedAt(data.fetchedAt ?? new Date().toISOString());
    } catch {
      // keep showing last known data
    }
  }, [initialRide.ride_id]);

  useAutoRefresh(refreshLive, REFRESH_INTERVAL_MS);

  useEffect(() => {
    const fetchHistory = () => {
      setLoading(true);
      fetch(`/api/history?rideId=${ride.ride_id}&range=30d`)
        .then((r) => r.json())
        .then((d) => {
          setRecords(d.records ?? []);
          setConfigured(d.configured !== false);
        })
        .catch(() => setRecords([]))
        .finally(() => setLoading(false));
    };

    fetchHistory();
    const id = setInterval(fetchHistory, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [ride.ride_id]);

  const analytics = useMemo(
    () => computeRideAnalytics(records, range),
    [records, range]
  );

  const chartData: ChartDataPoint[] = useMemo(() => {
    return filterRecordsByRange(records, range)
      .filter((r) => r.is_open)
      .map((r) => ({
        timestamp: r.timestamp,
        wait_time: r.wait_time,
        label: format(new Date(r.timestamp), "MMM d, h:mm a"),
      }));
  }, [records, range]);

  const level = getWaitLevel(ride.wait_time, ride.is_open);

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
        <p className="label">{ride.land}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--fg)] sm:text-3xl">
          {ride.name}
        </h1>

        <div className="mt-8 flex items-end justify-between">
          <div>
            <p className="label">Current wait</p>
            <p className={cn("metric mt-1 text-6xl font-semibold sm:text-7xl", getWaitLevelClass(level))}>
              {!ride.is_open ? "—" : ride.wait_time}
            </p>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">
              {formatWaitTime(ride.wait_time, ride.is_open)}
            </p>
          </div>
          <div className="mb-2 text-right">
            <span className="text-sm text-[var(--fg-secondary)]">
              {ride.is_open ? "Open" : "Closed"}
            </span>
            <RelativeTime
              date={lastCheckedAt}
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

      {analytics.bestTimeToRide !== "Not enough data" && (
        <div className="card mt-4 p-5">
          <p className="label">Best time to ride</p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--fg-secondary)]">
            Historically lowest around{" "}
            <span className="font-medium text-[var(--fg)]">{analytics.bestTimeToRide}</span>
            {" "}with an average of{" "}
            <span className="font-medium text-[var(--fg)]">{analytics.bestTimeAverageWait} min</span>.
          </p>
        </div>
      )}

      <div className="mt-6 grid grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="label">Avg today</p>
          <p className="metric mt-1 text-2xl font-semibold">{analytics.averageWaitToday}m</p>
        </div>
        <div className="card p-4">
          <p className="label">Peak today</p>
          <p className="metric mt-1 text-2xl font-semibold">{analytics.peakWaitToday}m</p>
        </div>
        <div className="card p-4">
          <p className="label">Period avg</p>
          <p className="metric mt-1 text-2xl font-semibold">{analytics.lowestAverageWait}m</p>
        </div>
      </div>

      <div className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-[var(--fg)]">Wait history</h2>
          <div className="flex gap-1.5">
            {rangeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRange(opt.value)}
                className={cn("chip", range === opt.value && "chip-active")}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="skeleton h-72 rounded-2xl" />
        ) : (
          <WaitChart data={chartData} range={range} />
        )}
      </div>

      <div className="mt-6">
        <HourlyWaitChart
          data={analytics.averageWaitByHour.map((h) => ({
            label: h.label,
            average: h.average,
          }))}
        />
      </div>
    </div>
  );
}
