"use client";

import Link from "next/link";
import type { ParkIntelligenceData } from "@/lib/park-intelligence";
import type { WaitDropAlert } from "@/types";
import { cn } from "@/utils/wait-time";

interface ParkSummaryProps {
  intel: ParkIntelligenceData;
  waitDrops?: WaitDropAlert[];
}

function crowdColor(level: ParkIntelligenceData["crowdScore"]["level"]) {
  switch (level) {
    case "low":
      return "text-[var(--wait-low)]";
    case "moderate":
      return "text-[var(--wait-medium,var(--fg))]";
    case "heavy":
      return "text-[var(--wait-high)]";
  }
}

export function ParkSummary({ intel, waitDrops = [] }: ParkSummaryProps) {
  return (
    <section className="mx-auto max-w-5xl px-4 sm:px-6">
      <div className="mb-3 flex items-center justify-between">
        <p className="label">Park intelligence</p>
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs text-[var(--fg-muted)]">Crowd</span>
          <span className={cn("metric text-lg font-semibold", crowdColor(intel.crowdScore.level))}>
            {intel.crowdScore.score}
          </span>
          <span className="text-xs text-[var(--fg-muted)]">
            · {intel.crowdScore.label}
          </span>
        </div>
      </div>

      {waitDrops.length > 0 && (
        <div className="mb-3 space-y-2">
          {waitDrops.slice(0, 2).map((drop) => (
            <Link
              key={drop.rideId}
              href={`/rides/${drop.rideId}`}
              className="card-interactive flex items-center justify-between px-4 py-3 text-sm"
            >
              <span className="text-[var(--fg-secondary)]">
                <span className="font-medium text-[var(--wait-low)]">
                  ↓ {drop.amount}m
                </span>{" "}
                {drop.rideName}
              </span>
              <span className="text-xs text-[var(--fg-muted)]">
                Good time to ride
              </span>
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-4 sm:p-5">
          <p className="label">Avg wait</p>
          <p className="metric mt-2 text-3xl font-semibold">
            {intel.averageWait}
            <span className="text-base font-normal text-[var(--fg-muted)]">m</span>
          </p>
        </div>
        <div className="card p-4 sm:p-5">
          <p className="label">Open rides</p>
          <p className="metric mt-2 text-3xl font-semibold">
            {intel.openRides}
            <span className="text-base font-normal text-[var(--fg-muted)]">
              /{intel.totalRides}
            </span>
          </p>
        </div>
        <div className="card p-4 sm:p-5">
          <p className="label">Under 20 min</p>
          <p className="metric mt-2 text-3xl font-semibold">{intel.shortWaitCount}</p>
        </div>
        {intel.busiestRide.ride_id > 0 ? (
          <Link
            href={`/rides/${intel.busiestRide.ride_id}`}
            className="card-interactive p-4 sm:p-5"
          >
            <p className="label">Busiest</p>
            <p className="metric mt-2 text-3xl font-semibold">
              {intel.busiestRide.wait_time}
              <span className="text-base font-normal text-[var(--fg-muted)]">m</span>
            </p>
            <p className="mt-1 truncate text-xs text-[var(--fg-muted)]">
              {intel.busiestRide.name}
            </p>
          </Link>
        ) : (
          <div className="card p-4 sm:p-5">
            <p className="label">Busiest</p>
            <p className="metric mt-2 text-3xl font-semibold">—</p>
          </div>
        )}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {intel.bestRideNow && (
          <Link
            href={`/rides/${intel.bestRideNow.ride_id}`}
            className="card-interactive flex items-center justify-between p-4 sm:p-5"
          >
            <div>
              <p className="label">Best ride now</p>
              <p className="mt-1 text-sm font-medium text-[var(--fg)]">
                {intel.bestRideNow.name}
              </p>
            </div>
            <p className="metric text-3xl font-semibold wait-low">
              {intel.bestRideNow.wait_time}
              <span className="text-sm font-normal">m</span>
            </p>
          </Link>
        )}
        {intel.quietestRide.ride_id > 0 && intel.openRides > 1 && (
          <Link
            href={`/rides/${intel.quietestRide.ride_id}`}
            className="card-interactive flex items-center justify-between p-4 sm:p-5"
          >
            <div>
              <p className="label">Least busy</p>
              <p className="mt-1 text-sm font-medium text-[var(--fg)]">
                {intel.quietestRide.name}
              </p>
            </div>
            <p className="metric text-3xl font-semibold">
              {intel.quietestRide.wait_time}
              <span className="text-sm font-normal">m</span>
            </p>
          </Link>
        )}
      </div>
    </section>
  );
}
