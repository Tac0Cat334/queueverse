"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Search, RefreshCw } from "lucide-react";
import type { RideWithLiveData, SortOption, RideInsight } from "@/types";
import { Hero } from "./Hero";
import { ParkSummary } from "./ParkSummary";
import { RideCard, RideCardSkeleton } from "./RideCard";
import { DataAttribution } from "./DataAttribution";
import { computeParkIntelligence } from "@/lib/park-intelligence";
import { sortRides } from "@/lib/analytics";
import { getLatestUpdateTime } from "@/lib/queue-times";
import { REFRESH_INTERVAL_MS } from "@/lib/constants";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { useDebouncedValue } from "@/hooks/use-auto-refresh";
import { cn } from "@/utils/wait-time";

interface DashboardProps {
  initialRides: RideWithLiveData[];
}

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "highest", label: "Longest" },
  { value: "lowest", label: "Shortest" },
  { value: "alphabetical", label: "A–Z" },
  { value: "open", label: "Open" },
];

export function Dashboard({ initialRides }: DashboardProps) {
  const [rides, setRides] = useState(initialRides);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("highest");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [insights, setInsights] = useState<Record<number, RideInsight>>({});
  const debouncedSearch = useDebouncedValue(search);

  const fetchInsights = useCallback(async () => {
    try {
      const res = await fetch("/api/insights");
      const data = await res.json();
      if (data.insights) setInsights(data.insights);
    } catch {
      // optional
    }
  }, []);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [liveRes] = await Promise.all([
        fetch("/api/live", { cache: "no-store" }),
        fetchInsights(),
      ]);
      if (!liveRes.ok) return;

      const data = await liveRes.json();
      if (data.rides) setRides(data.rides);
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchInsights]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  useAutoRefresh(refresh, REFRESH_INTERVAL_MS);

  const lastUpdated = useMemo(() => getLatestUpdateTime(rides), [rides]);
  const intel = useMemo(() => computeParkIntelligence(rides), [rides]);

  const filteredRides = useMemo(() => {
    let result = rides;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.land.toLowerCase().includes(q)
      );
    }
    return sortRides(result, sort);
  }, [rides, debouncedSearch, sort]);

  return (
    <>
      <Hero lastUpdated={lastUpdated} />
      <ParkSummary intel={intel} />

      <section className="mx-auto mt-10 max-w-5xl px-4 pb-16 sm:px-6" id="rides">
        <div className="sticky top-[57px] z-40 -mx-4 bg-[var(--bg)] px-4 py-3 sm:-mx-6 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fg-muted)]" />
              <input
                type="text"
                placeholder="Search rides..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field w-full py-2.5 pl-9 pr-4 text-sm"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto">
              {sortOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSort(opt.value)}
                  className={cn(
                    "chip shrink-0",
                    sort === opt.value ? "chip-active" : ""
                  )}
                >
                  {opt.label}
                </button>
              ))}
              <button
                onClick={refresh}
                disabled={isRefreshing}
                className="chip shrink-0 disabled:opacity-40"
                aria-label="Refresh"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRides.length === 0 ? (
            <p className="col-span-full py-16 text-center text-sm text-[var(--fg-muted)]">
              No rides match your search.
            </p>
          ) : (
            filteredRides.map((ride) => (
              <RideCard
                key={ride.ride_id}
                ride={ride}
                insight={insights[ride.ride_id]}
              />
            ))
          )}
        </div>
      </section>

      <DataAttribution />
    </>
  );
}

export function DashboardSkeleton() {
  return (
    <>
      <div className="px-4 pt-16 pb-8 sm:px-6">
        <div className="mx-auto max-w-5xl space-y-3">
          <div className="skeleton h-4 w-32" />
          <div className="skeleton h-10 w-72 max-w-full" />
          <div className="skeleton h-5 w-56" />
        </div>
      </div>
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-24 rounded-2xl" />
          ))}
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <RideCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </>
  );
}
