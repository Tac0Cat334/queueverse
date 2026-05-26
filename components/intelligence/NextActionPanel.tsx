"use client";

import Link from "next/link";
import { Compass, TrendingUp } from "lucide-react";
import type { ParkStrategySnapshot } from "@/types";
import { OpportunityBadge } from "./OpportunityBadge";
import { UrgencyBadge } from "./UrgencyBadge";
import { ReasoningList } from "./ReasoningList";
import { cn } from "@/utils/wait-time";

interface NextActionPanelProps {
  strategy: ParkStrategySnapshot;
  className?: string;
}

export function NextActionPanel({ strategy, className }: NextActionPanelProps) {
  const { nextBestAction, crowdProgression, optimizationIndex, strategistMessage } =
    strategy;

  return (
    <div className={cn("card p-5 sm:p-6", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-[var(--fg-secondary)]" />
          <p className="label">Live strategist</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-[var(--fg-muted)]">Optimization</p>
          <p className="metric text-lg font-semibold text-[var(--fg)]">
            {optimizationIndex}
            <span className="text-xs font-normal text-[var(--fg-muted)]">/100</span>
          </p>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-[var(--fg-secondary)]">
        {strategistMessage}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-hover)] px-2.5 py-1 text-[10px] font-medium text-[var(--fg-secondary)]">
          <TrendingUp className="h-3 w-3" />
          {crowdProgression.label} · ~{crowdProgression.averageWait}m avg
        </span>
        {crowdProgression.label === "Early Entry" && (
          <span className="inline-flex items-center rounded-full bg-[var(--wait-low)]/15 px-2.5 py-1 text-[10px] font-medium text-[var(--wait-low)]">
            Optimized for Early Entry
          </span>
        )}
        <span className="text-[10px] text-[var(--fg-muted)]">
          {crowdProgression.openRideCount} rides open
        </span>
      </div>

      {nextBestAction && (
        <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface-hover)]/50 p-4">
          <p className="label">Next best action</p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <Link
                href={`/rides/${nextBestAction.rideId}`}
                className="text-xl font-semibold tracking-tight text-[var(--fg)] hover:underline"
              >
                {nextBestAction.headline}
              </Link>
              <p className="mt-1 text-sm text-[var(--fg-secondary)]">
                {nextBestAction.reason}
              </p>
              {nextBestAction.reasoning && (
                <ReasoningList
                  reasoning={nextBestAction.reasoning}
                  compact
                  className="mt-2"
                />
              )}
              <p className="mt-1 text-xs text-[var(--fg-muted)]">
                {nextBestAction.land}
                {nextBestAction.predictedWait60 !== null &&
                  ` · ~${nextBestAction.predictedWait60}m in 1 hr`}
              </p>
            </div>
            <div className="flex flex-col items-start gap-1.5 sm:items-end">
              <p className="metric text-3xl font-semibold text-[var(--fg)]">
                {nextBestAction.currentWait}
                <span className="ml-1 text-sm font-normal text-[var(--fg-muted)]">
                  min
                </span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                <OpportunityBadge score={nextBestAction.opportunityScore} />
                <UrgencyBadge
                  score={nextBestAction.urgencyScore}
                  label={nextBestAction.action === "ride_now" ? "Act now" : undefined}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
