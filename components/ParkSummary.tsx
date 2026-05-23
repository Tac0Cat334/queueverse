"use client";

import Link from "next/link";
import type { ParkIntelligenceData } from "@/lib/park-intelligence";

interface ParkSummaryProps {
  intel: ParkIntelligenceData;
}

export function ParkSummary({ intel }: ParkSummaryProps) {
  return (
    <section className="mx-auto max-w-5xl px-4 sm:px-6">
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
        <div className="card p-4 sm:p-5">
          <p className="label">Longest wait</p>
          <p className="metric mt-2 text-3xl font-semibold">
            {intel.busiestRide.wait_time}
            <span className="text-base font-normal text-[var(--fg-muted)]">m</span>
          </p>
          <p className="mt-1 truncate text-xs text-[var(--fg-muted)]">
            {intel.busiestRide.name}
          </p>
        </div>
      </div>

      {intel.bestRideNow && (
        <Link
          href={`/rides/${intel.bestRideNow.ride_id}`}
          className="card-interactive mt-3 flex items-center justify-between p-4 sm:p-5"
        >
          <div>
            <p className="label">Shortest wait right now</p>
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
    </section>
  );
}
