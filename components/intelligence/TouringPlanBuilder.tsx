"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Sparkles, Clock, AlertTriangle, ArrowRight } from "lucide-react";
import type {
  RideWithLiveData,
  ParkRecommendations,
  TouringPlanPreferences,
  TouringPlan,
  PlanAdjustment,
} from "@/types";
import {
  generateTouringPlan,
  computePlanAdjustments,
  DEFAULT_TOURING_PREFERENCES,
} from "@/lib/touring-plan";
import { cn } from "@/utils/wait-time";

interface TouringPlanBuilderProps {
  rides: RideWithLiveData[];
  recommendations: ParkRecommendations;
}

export function TouringPlanBuilder({
  rides,
  recommendations,
}: TouringPlanBuilderProps) {
  const [prefs, setPrefs] = useState<TouringPlanPreferences>(
    DEFAULT_TOURING_PREFERENCES
  );
  const [plan, setPlan] = useState<TouringPlan | null>(null);
  const [adjustments, setAdjustments] = useState<PlanAdjustment[]>([]);

  const openRides = useMemo(() => rides.filter((r) => r.is_open), [rides]);

  function generatePlan() {
    const nextPlan = generateTouringPlan(
      rides,
      recommendations.byRideId,
      prefs
    );
    setPlan(nextPlan);
    setAdjustments(
      computePlanAdjustments(nextPlan, rides, recommendations.byRideId)
    );
  }

  function toggleMustDo(rideId: number) {
    setPrefs((current) => ({
      ...current,
      mustDoRideIds: current.mustDoRideIds.includes(rideId)
        ? current.mustDoRideIds.filter((id) => id !== rideId)
        : [...current.mustDoRideIds, rideId],
    }));
  }

  return (
    <section className="card p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="rounded-xl bg-[var(--surface-hover)] p-2.5">
          <Sparkles className="h-4 w-4 text-[var(--fg-secondary)]" />
        </div>
        <div>
          <h2 className="text-sm font-medium text-[var(--fg)]">
            Dynamic touring plan
          </h2>
          <p className="mt-0.5 text-xs leading-relaxed text-[var(--fg-muted)]">
            Adaptive schedule based on current waits, historical patterns, and
            your preferences. Updates as crowd conditions change.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="label">Arrival</span>
          <select
            value={prefs.arrivalHour}
            onChange={(e) =>
              setPrefs((p) => ({ ...p, arrivalHour: Number(e.target.value) }))
            }
            className="input-field mt-1.5 w-full py-2 text-sm"
          >
            {HOUR_OPTIONS.map((h) => (
              <option key={`arr-${h}`} value={h}>
                {formatHour(h)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="label">Departure</span>
          <select
            value={prefs.departureHour}
            onChange={(e) =>
              setPrefs((p) => ({ ...p, departureHour: Number(e.target.value) }))
            }
            className="input-field mt-1.5 w-full py-2 text-sm"
          >
            {HOUR_OPTIONS.map((h) => (
              <option key={`dep-${h}`} value={h}>
                {formatHour(h)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="label">Style</span>
          <select
            value={prefs.preference}
            onChange={(e) =>
              setPrefs((p) => ({
                ...p,
                preference: e.target.value as TouringPlanPreferences["preference"],
              }))
            }
            className="input-field mt-1.5 w-full py-2 text-sm"
          >
            <option value="mixed">Mixed</option>
            <option value="thrill">Thrill priority</option>
            <option value="family">Family friendly</option>
          </select>
        </label>

        <label className="block">
          <span className="label">Options</span>
          <div className="mt-2 space-y-2">
            <label className="flex items-center gap-2 text-xs text-[var(--fg-secondary)]">
              <input
                type="checkbox"
                checked={prefs.expressPass}
                onChange={(e) =>
                  setPrefs((p) => ({ ...p, expressPass: e.target.checked }))
                }
                className="rounded border-[var(--border)]"
              />
              Express pass
            </label>
            <label className="flex items-center gap-2 text-xs text-[var(--fg-secondary)]">
              <input
                type="checkbox"
                checked={prefs.lunchBreak}
                onChange={(e) =>
                  setPrefs((p) => ({ ...p, lunchBreak: e.target.checked }))
                }
                className="rounded border-[var(--border)]"
              />
              Lunch break
            </label>
          </div>
        </label>
      </div>

      <div className="mt-5">
        <p className="label mb-2">Must-do rides</p>
        <div className="flex flex-wrap gap-2">
          {openRides.map((ride) => {
            const selected = prefs.mustDoRideIds.includes(ride.ride_id);
            return (
              <button
                key={ride.ride_id}
                type="button"
                onClick={() => toggleMustDo(ride.ride_id)}
                className={cn(
                  "chip text-xs",
                  selected && "chip-active"
                )}
              >
                {ride.name}
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={generatePlan}
        className="btn-primary mt-5 w-full sm:w-auto"
      >
        Generate plan
      </button>

      {plan && (
        <div className="mt-6 border-t border-[var(--border)] pt-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium text-[var(--fg)]">
              Your optimized schedule
            </h3>
            <span className="text-[10px] text-[var(--fg-muted)]">
              {plan.items.filter((i) => i.type === "ride").length} rides
            </span>
          </div>

          {adjustments.length > 0 && (
            <div className="mb-4 space-y-2">
              {adjustments.slice(0, 3).map((adj) => (
                <div
                  key={adj.rideId}
                  className={cn(
                    "flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs",
                    adj.priority === "urgent" && "bg-[var(--wait-high)]/10 text-[var(--wait-high)]",
                    adj.priority === "opportunity" && "bg-[var(--wait-low)]/10 text-[var(--wait-low)]",
                    adj.priority === "warning" && "bg-[var(--wait-medium)]/10 text-[var(--wait-medium)]"
                  )}
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{adj.message}</span>
                </div>
              ))}
            </div>
          )}

          <ol className="space-y-2">
            {plan.items.map((item, index) => (
              <li
                key={`${item.time}-${item.label}-${index}`}
                className="flex items-center gap-3 rounded-xl bg-[var(--surface-hover)] px-3 py-2.5"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface)] text-[10px] font-medium text-[var(--fg-muted)]">
                  <Clock className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-[var(--fg-muted)]">
                      {item.time}
                    </span>
                    {item.type === "ride" && item.rideId ? (
                      <Link
                        href={`/rides/${item.rideId}`}
                        className="truncate text-sm font-medium text-[var(--fg)] hover:underline"
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <span className="text-sm font-medium text-[var(--fg)]">
                        {item.label}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-[var(--fg-muted)]">
                    {item.reason}
                    {item.estimatedWait !== undefined &&
                      item.type === "ride" &&
                      ` · ~${item.estimatedWait} min wait`}
                  </p>
                </div>
                {item.type === "ride" && (
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--fg-muted)]" />
                )}
              </li>
            ))}
          </ol>

          {plan.missedMustDo.length > 0 && (
            <p className="mt-3 text-xs text-[var(--fg-muted)]">
              Could not fit all must-do rides in your time window. Try extending
              departure or reducing selections.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

const HOUR_OPTIONS = Array.from({ length: 15 }, (_, i) => i + 7);

function formatHour(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:00 ${period}`;
}
