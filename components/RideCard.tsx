"use client";

import Link from "next/link";
import type { RideWithLiveData } from "@/types";
import type { RideInsight } from "@/types";
import {
  getWaitLevel,
  getWaitLevelClass,
  formatRideStatusLabel,
} from "@/utils/wait-time";
import { RelativeTime } from "./RelativeTime";
import { TrendBadge } from "./TrendBadge";
import { FavoriteButton } from "./FavoriteButton";
import { OpportunityBadge } from "./intelligence/OpportunityBadge";

interface RideCardProps {
  ride: RideWithLiveData;
  insight?: RideInsight;
  opportunityScore?: number;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

export function RideCard({
  ride,
  insight,
  opportunityScore,
  isFavorite,
  onToggleFavorite,
}: RideCardProps) {
  const level = getWaitLevel(
    ride.wait_time,
    ride.is_open,
    ride.operationalStatus
  );

  return (
    <Link href={`/rides/${ride.ride_id}`} className="block">
      <article className="card-interactive p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <h3 className="truncate text-sm font-medium text-[var(--fg)]">
                {ride.name}
              </h3>
              {onToggleFavorite && (
                <FavoriteButton
                  isFavorite={!!isFavorite}
                  onToggle={onToggleFavorite}
                  className="shrink-0 p-1"
                />
              )}
            </div>
            <p className="mt-0.5 truncate text-xs text-[var(--fg-muted)]">
              {ride.land}
            </p>
          </div>

          <div className="shrink-0 text-right">
            <p
              className={`metric text-4xl font-semibold ${getWaitLevelClass(level)}`}
            >
              {!ride.is_open ? "—" : ride.wait_time}
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--fg-muted)]">
              {formatRideStatusLabel(ride)}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-end justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs text-[var(--fg-muted)]">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                ride.is_open ? "bg-[var(--wait-low)]" : "bg-[var(--wait-closed)]"
              }`}
            />
            {ride.operationalStatus === "open"
              ? "Open"
              : formatRideStatusLabel(ride)}
          </span>

          <div className="flex shrink-0 flex-col items-end gap-1 text-right">
            {opportunityScore !== undefined && ride.is_open && (
              <OpportunityBadge score={opportunityScore} />
            )}
            {insight?.waitDrop && (
              <span className="text-[10px] font-medium text-[var(--wait-low)]">
                ↓ {insight.waitDrop.amount}m drop
              </span>
            )}
            {insight && ride.is_open && (
              <TrendBadge
                trend={insight.trend}
                label={insight.trendLabel}
                compact
              />
            )}
            <RelativeTime date={ride.last_updated} />
            {insight?.bestTime && (
              <span className="text-[10px] text-[var(--fg-muted)]">
                Best: {insight.bestTime}
              </span>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}

export function RideCardSkeleton() {
  return (
    <div className="card p-5">
      <div className="flex justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 w-3/4" />
          <div className="skeleton h-3 w-1/2" />
        </div>
        <div className="skeleton h-10 w-14" />
      </div>
    </div>
  );
}
