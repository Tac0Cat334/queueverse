"use client";

import { useState, useMemo, useCallback } from "react";
import { Search, RefreshCw, Star } from "lucide-react";
import type { RideWithLiveData, SortOption, RideInsight, WaitDropAlert, RideIntelligence } from "@/types";
import { Hero } from "./Hero";
import { ParkSummary } from "./ParkSummary";
import { RideCard, RideCardSkeleton } from "./RideCard";
import { DataAttribution } from "./DataAttribution";
import { IntelligenceTeaser } from "./intelligence/IntelligenceTeaser";
import { computeParkIntelligence } from "@/lib/park-intelligence";
import { sortRidesWithFavoritesFilter } from "@/lib/analytics";
import { getLatestUpdateTime } from "@/lib/queue-times";
import { REFRESH_INTERVAL_MS } from "@/lib/constants";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { useDebouncedValue } from "@/hooks/use-auto-refresh";
import { useFavorites } from "@/hooks/use-favorites";
import { cn } from "@/utils/wait-time";
import type { ParkRecommendations } from "@/types";

interface DashboardProps {
  initialRides: RideWithLiveData[];
}

function intelligenceToInsight(intel: RideIntelligence): RideInsight {
  return {
    bestTime: intel.bestTimeToRide,
    bestTimeAvg: intel.bestTimeAverage,
    trend: intel.trend.trend,
    trendLabel: intel.trend.label,
    trendChange: intel.trend.change,
    waitDrop: intel.waitDrop,
    reliability: intel.reliabilityScore,
  };
}

const sortOptions: { value: SortOption; label: string; icon?: typeof Star }[] = [
  { value: "highest", label: "Longest" },
  { value: "lowest", label: "Shortest" },
  { value: "alphabetical", label: "A–Z" },
  { value: "open", label: "Open" },
  { value: "favorites", label: "Favorites", icon: Star },
];

export function Dashboard({ initialRides }: DashboardProps) {
  const [rides, setRides] = useState(initialRides);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("highest");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [insights, setInsights] = useState<Record<number, RideInsight>>({});
  const [intelligence, setIntelligence] = useState<ParkRecommendations | null>(null);
  const [intelLoading, setIntelLoading] = useState(true);
  const debouncedSearch = useDebouncedValue(search);
  const { favorites, toggleFavorite, isFavorite } = useFavorites();

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [liveRes, intelRes] = await Promise.all([
        fetch("/api/live", { cache: "no-store" }),
        fetch("/api/intelligence", { cache: "no-store" }),
      ]);
      if (liveRes.ok) {
        const data = await liveRes.json();
        if (data.rides) setRides(data.rides);
      }
      if (intelRes.ok) {
        const data = await intelRes.json();
        if (data.recommendations) {
          setIntelligence(data.recommendations);
          const mapped: Record<number, RideInsight> = {};
          for (const [id, intel] of Object.entries(
            data.recommendations.byRideId as Record<string, RideIntelligence>
          )) {
            mapped[Number(id)] = intelligenceToInsight(intel);
          }
          setInsights(mapped);
        }
      }
    } catch {
      // keep last known data
    } finally {
      setIsRefreshing(false);
      setIntelLoading(false);
    }
  }, []);

  useAutoRefresh(refresh, REFRESH_INTERVAL_MS);

  const lastUpdated = useMemo(() => getLatestUpdateTime(rides), [rides]);
  const intel = useMemo(() => computeParkIntelligence(rides), [rides]);

  const waitDrops = useMemo((): WaitDropAlert[] => {
    return rides
      .filter((r) => r.is_open && insights[r.ride_id]?.waitDrop)
      .map((r) => ({
        rideId: r.ride_id,
        rideName: r.name,
        amount: insights[r.ride_id].waitDrop!.amount,
        message: insights[r.ride_id].waitDrop!.message,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [rides, insights]);

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
    return sortRidesWithFavoritesFilter(result, sort, favorites);
  }, [rides, debouncedSearch, sort, favorites]);

  return (
    <>
      <Hero lastUpdated={lastUpdated} />
      <ParkSummary intel={intel} waitDrops={waitDrops} />
      <IntelligenceTeaser
        recommendations={intelligence}
        loading={intelLoading}
      />

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
                    "chip shrink-0 inline-flex items-center gap-1",
                    sort === opt.value ? "chip-active" : ""
                  )}
                >
                  {opt.icon && <opt.icon className="h-3 w-3" />}
                  {opt.label}
                </button>
              ))}
              <button
                onClick={refresh}
                disabled={isRefreshing}
                className="chip shrink-0 disabled:opacity-40"
                aria-label="Refresh"
              >
                <RefreshCw
                  className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRides.length === 0 ? (
            <p className="col-span-full py-16 text-center text-sm text-[var(--fg-muted)]">
              {sort === "favorites"
                ? "No favorite rides yet. Tap the star on any ride."
                : "No rides match your search."}
            </p>
          ) : (
            filteredRides.map((ride) => (
              <RideCard
                key={ride.ride_id}
                ride={ride}
                insight={insights[ride.ride_id]}
                opportunityScore={
                  intelligence?.byRideId[ride.ride_id]?.opportunityScore
                }
                isFavorite={isFavorite(ride.ride_id)}
                onToggleFavorite={() => toggleFavorite(ride.ride_id)}
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
