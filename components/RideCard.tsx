"use client";

import Link from "next/link";
import type { RideWithLiveData } from "@/types";
import type { RideInsight } from "@/types";
import { getWaitLevel, getWaitLevelClass, formatWaitTime } from "@/utils/wait-time";
import { RelativeTime } from "./RelativeTime";

interface RideCardProps {
  ride: RideWithLiveData;
  insight?: RideInsight;
}

export function RideCard({ ride, insight }: RideCardProps) {
  const level = getWaitLevel(ride.wait_time, ride.is_open);

  return (
    <Link href={`/rides/${ride.ride_id}`} className="block">
      <article className="card-interactive p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-medium text-[var(--fg)]">
              {ride.name}
            </h3>
            <p className="mt-0.5 truncate text-xs text-[var(--fg-muted)]">
              {ride.land}
            </p>
          </div>

          <div className="shrink-0 text-right">
            <p className={`metric text-4xl font-semibold ${getWaitLevelClass(level)}`}>
              {!ride.is_open ? "—" : ride.wait_time}
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--fg-muted)]">
              {formatWaitTime(ride.wait_time, ride.is_open)}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 text-xs text-[var(--fg-muted)]">
          <span className="flex items-center gap-1.5">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                ride.is_open ? "bg-[var(--wait-low)]" : "bg-[var(--wait-closed)]"
              }`}
            />
            {ride.is_open ? "Open" : "Closed"}
          </span>

          <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
            <RelativeTime date={ride.last_updated} />
            {insight?.bestTime && (
              <span>Best: {insight.bestTime}</span>
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
