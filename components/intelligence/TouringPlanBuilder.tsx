"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  AlertTriangle,
  Loader2,
  MapPin,
  Check,
} from "lucide-react";
import type {
  RideWithLiveData,
  ParkRecommendations,
  TouringPlanPreferences,
  TouringPlan,
  PlanAdjustment,
  TouringPlanItem,
} from "@/types";
import {
  generateTouringPlan,
  computePlanAdjustments,
  DEFAULT_TOURING_PREFERENCES,
} from "@/lib/touring-plan";
import { groupRidesByLand } from "@/lib/touring/lands";
import { isMainRide } from "@/lib/queue-times";
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
  const [generating, setGenerating] = useState(false);
  const [search, setSearch] = useState("");

  /** All main rides from API — includes closed (e.g. Monsters Unchained) */
  const allMainRides = useMemo(
    () => rides.filter((r) => isMainRide(r.name)),
    [rides]
  );

  const ridesByLand = useMemo(
    () => groupRidesByLand(allMainRides),
    [allMainRides]
  );

  const filteredLands = useMemo(() => {
    if (!search.trim()) return ridesByLand;
    const q = search.toLowerCase();
    return ridesByLand
      .map((group) => ({
        ...group,
        rides: group.rides.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            r.land.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.rides.length > 0);
  }, [ridesByLand, search]);

  const selectedCount = prefs.mustDoRideIds.length;
  const canGenerate = selectedCount > 0 && !generating;

  async function generatePlan() {
    if (!canGenerate) return;
    setGenerating(true);
    await new Promise((r) => setTimeout(r, 400));

    const nextPlan = generateTouringPlan(
      allMainRides,
      recommendations.byRideId,
      prefs
    );
    setPlan(nextPlan);
    setAdjustments(
      computePlanAdjustments(nextPlan, allMainRides, recommendations.byRideId)
    );
    setGenerating(false);
  }

  function toggleMustDo(rideId: number) {
    setPlan(null);
    setPrefs((current) => ({
      ...current,
      mustDoRideIds: current.mustDoRideIds.includes(rideId)
        ? current.mustDoRideIds.filter((id) => id !== rideId)
        : [...current.mustDoRideIds, rideId],
    }));
  }

  function selectAllInLand(landRideIds: number[]) {
    setPlan(null);
    setPrefs((current) => {
      const set = new Set(current.mustDoRideIds);
      for (const id of landRideIds) set.add(id);
      return { ...current, mustDoRideIds: Array.from(set) };
    });
  }

  function clearSelection() {
    setPlan(null);
    setPrefs((current) => ({ ...current, mustDoRideIds: [] }));
  }

  return (
    <section className="card overflow-hidden p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="rounded-xl bg-[var(--surface-hover)] p-2.5">
          <Sparkles className="h-4 w-4 text-[var(--fg-secondary)]" />
        </div>
        <div>
          <h2 className="text-sm font-medium text-[var(--fg)]">
            Dynamic touring plan
          </h2>
          <p className="mt-0.5 text-xs leading-relaxed text-[var(--fg-muted)]">
            {prefs.planMode === "live"
              ? "Optimize selected rides using live waits for the next few hours."
              : "Schedule each ride at its historically best time across your visit."}
          </p>
        </div>
      </div>

      <div className="mb-5">
        <p className="label mb-2">Planning mode</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ModeCard
            active={prefs.planMode === "live"}
            title="In the park now"
            description="Uses current wait times to optimize your selected rides over the next few hours."
            onClick={() => {
              setPlan(null);
              setPrefs((p) => ({ ...p, planMode: "live" }));
            }}
          />
          <ModeCard
            active={prefs.planMode === "fullday"}
            title="Plan my full day"
            description="Uses historical patterns to schedule each ride at its best time of day."
            onClick={() => {
              setPlan(null);
              setPrefs((p) => ({ ...p, planMode: "fullday" }));
            }}
          />
        </div>
      </div>

      {prefs.planMode === "live" ? (
        <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className="label">Time window</span>
            <select
              value={prefs.liveWindowHours}
              onChange={(e) =>
                setPrefs((p) => ({
                  ...p,
                  liveWindowHours: Number(e.target.value),
                }))
              }
              className="input-field mt-1.5 w-full py-2 text-sm"
            >
              <option value={1}>Next 1 hour</option>
              <option value={2}>Next 2 hours</option>
              <option value={3}>Next 3 hours</option>
              <option value={4}>Next 4 hours</option>
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
            <div className="mt-2">
              <Checkbox
                label="Express pass"
                checked={prefs.expressPass}
                onChange={(v) => setPrefs((p) => ({ ...p, expressPass: v }))}
              />
            </div>
          </label>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PrefSelect
            label="Arrival"
            value={prefs.arrivalHour}
            onChange={(v) => setPrefs((p) => ({ ...p, arrivalHour: v }))}
          />
          <PrefSelect
            label="Departure"
            value={prefs.departureHour}
            onChange={(v) => setPrefs((p) => ({ ...p, departureHour: v }))}
          />
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
              <Checkbox
                label="Express pass"
                checked={prefs.expressPass}
                onChange={(v) => setPrefs((p) => ({ ...p, expressPass: v }))}
              />
              <Checkbox
                label="Lunch during peak"
                checked={prefs.lunchBreak}
                onChange={(v) => setPrefs((p) => ({ ...p, lunchBreak: v }))}
              />
            </div>
          </label>
        </div>
      )}

      <div className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="label">Your rides</p>
            <p className="mt-0.5 text-[11px] text-[var(--fg-muted)]">
              {selectedCount} selected · plan includes only these rides
            </p>
          </div>
          {selectedCount > 0 && (
            <button
              type="button"
              onClick={clearSelection}
              className="text-[11px] text-[var(--fg-muted)] hover:text-[var(--fg)]"
            >
              Clear all
            </button>
          )}
        </div>

        <input
          type="text"
          placeholder="Search rides..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field mb-4 w-full py-2 px-3 text-sm"
        />

        <div className="max-h-72 space-y-4 overflow-y-auto pr-1">
          {filteredLands.map((group) => (
            <div key={group.land}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-[var(--fg-secondary)]">
                  {group.land}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    selectAllInLand(group.rides.map((r) => r.ride_id))
                  }
                  className="text-[10px] text-[var(--fg-muted)] hover:text-[var(--fg)]"
                >
                  Select land
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {group.rides.map((ride) => {
                  const selected = prefs.mustDoRideIds.includes(ride.ride_id);
                  const intel = recommendations.byRideId[ride.ride_id];
                  return (
                    <button
                      key={ride.ride_id}
                      type="button"
                      onClick={() => toggleMustDo(ride.ride_id)}
                      className={cn(
                        "inline-flex max-w-full items-center gap-1.5 rounded-xl border px-3 py-2 text-left text-xs transition-all",
                        selected
                          ? "border-[var(--fg)] bg-[var(--fg)] text-[var(--bg)]"
                          : "border-[var(--border)] bg-[var(--surface)] text-[var(--fg-secondary)] hover:border-[var(--fg-muted)]"
                      )}
                    >
                      {selected && <Check className="h-3 w-3 shrink-0" />}
                      <span className="truncate">{ride.name}</span>
                      {!ride.is_open && (
                        <span
                          className={cn(
                            "shrink-0 rounded px-1 py-0.5 text-[9px] font-medium",
                            selected
                              ? "bg-[var(--bg)]/20 text-[var(--bg)]"
                              : "bg-[var(--surface-hover)] text-[var(--fg-muted)]"
                          )}
                        >
                          Closed
                        </span>
                      )}
                      {ride.is_open && intel && (
                        <span
                          className={cn(
                            "shrink-0 tabular-nums",
                            selected ? "opacity-80" : "text-[var(--fg-muted)]"
                          )}
                        >
                          {ride.wait_time}m
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={generatePlan}
        disabled={!canGenerate}
        className="btn-primary mt-5 inline-flex w-full items-center justify-center gap-2 sm:w-auto disabled:opacity-40"
      >
        {generating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Optimizing…
          </>
        ) : selectedCount === 0 ? (
          "Select rides to generate"
        ) : prefs.planMode === "live" ? (
          `Optimize next ${prefs.liveWindowHours}h (${selectedCount} ride${selectedCount === 1 ? "" : "s"})`
        ) : (
          `Build full-day plan (${selectedCount} ride${selectedCount === 1 ? "" : "s"})`
        )}
      </button>

      {plan && (
        <PlanTimeline
          plan={plan}
          adjustments={adjustments}
          onDismiss={() => setPlan(null)}
        />
      )}
    </section>
  );
}

function PlanTimeline({
  plan,
  adjustments,
}: {
  plan: TouringPlan;
  adjustments: PlanAdjustment[];
  onDismiss?: () => void;
}) {
  const rideCount = plan.items.filter((i) => i.type === "ride").length;

  return (
    <div className="mt-6 border-t border-[var(--border)] pt-6">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-[var(--fg)]">
          Optimized schedule
        </h3>
        <span className="text-[10px] text-[var(--fg-muted)]">
          {rideCount} ride{rideCount === 1 ? "" : "s"}
        </span>
      </div>
      {plan.summary && (
        <p className="mb-4 text-xs text-[var(--fg-secondary)]">{plan.summary}</p>
      )}

      {adjustments.length > 0 && (
        <div className="mb-5 space-y-2">
          <p className="label">Live adjustments</p>
          {adjustments.slice(0, 4).map((adj) => (
            <div
              key={adj.rideId}
              className={cn(
                "flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs",
                adj.priority === "urgent" &&
                  "bg-[var(--wait-high)]/10 text-[var(--wait-high)]",
                adj.priority === "opportunity" &&
                  "bg-[var(--wait-low)]/10 text-[var(--wait-low)]",
                adj.priority === "warning" &&
                  "bg-[var(--wait-medium)]/10 text-[var(--wait-medium)]"
              )}
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{adj.message}</span>
            </div>
          ))}
        </div>
      )}

      <ol className="relative space-y-0">
        {plan.items.map((item, index) => (
          <TimelineItem
            key={`${item.type}-${item.time}-${item.label}-${index}`}
            item={item}
            isLast={index === plan.items.length - 1}
          />
        ))}
      </ol>

      {plan.missedMustDo.length > 0 && (
        <p className="mt-4 text-xs text-[var(--wait-high)]">
          Could not fit {plan.missedMustDo.length} selected ride
          {plan.missedMustDo.length === 1 ? "" : "s"} in your time window.
          Try extending departure.
        </p>
      )}
    </div>
  );
}

function TimelineItem({
  item,
  isLast,
}: {
  item: TouringPlanItem;
  isLast: boolean;
}) {
  if (item.type === "travel") {
    return (
      <li className="relative flex gap-4 pb-4">
        {!isLast && (
          <div className="absolute left-[15px] top-8 h-full w-px bg-[var(--border)]" />
        )}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-[var(--border)] bg-[var(--surface)]">
          <MapPin className="h-3.5 w-3.5 text-[var(--fg-muted)]" />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[11px] text-[var(--fg-muted)]">{item.time}</p>
          <p className="text-xs text-[var(--fg-secondary)]">{item.label}</p>
          <p className="mt-0.5 text-[10px] text-[var(--fg-muted)]">{item.reason}</p>
        </div>
      </li>
    );
  }

  if (item.type === "break") {
    return (
      <li className="relative flex gap-4 pb-4">
        {!isLast && (
          <div className="absolute left-[15px] top-8 h-full w-px bg-[var(--border)]" />
        )}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-hover)]">
          <span className="text-sm">🍽</span>
        </div>
        <div className="min-w-0 flex-1 rounded-xl bg-[var(--surface-hover)] px-3 py-2.5">
          <p className="text-[11px] text-[var(--fg-muted)]">{item.time}</p>
          <p className="text-sm font-medium text-[var(--fg)]">{item.label}</p>
          <p className="mt-0.5 text-[11px] text-[var(--fg-muted)]">{item.reason}</p>
        </div>
      </li>
    );
  }

  return (
    <li className="relative flex gap-4 pb-4">
      {!isLast && (
        <div className="absolute left-[15px] top-8 h-full w-px bg-[var(--border)]" />
      )}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2",
          item.priority === "high"
            ? "border-[var(--wait-low)] bg-[var(--wait-low)]/10"
            : "border-[var(--border)] bg-[var(--surface)]"
        )}
      >
        <span className="text-[10px] font-semibold text-[var(--fg-muted)]">
          {item.estimatedWait ?? "—"}
        </span>
      </div>
      <div className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium text-[var(--fg-muted)]">
            {item.time}
          </span>
          {item.priorityLabel && (
            <PriorityBadge priority={item.priority} label={item.priorityLabel} />
          )}
          {item.isOpen === false && (
            <span className="rounded-full bg-[var(--surface-hover)] px-1.5 py-0.5 text-[9px] text-[var(--fg-muted)]">
              Closed — monitor
            </span>
          )}
        </div>
        {item.rideId ? (
          <Link
            href={`/rides/${item.rideId}`}
            className="mt-0.5 block text-sm font-medium text-[var(--fg)] hover:underline"
          >
            {item.label}
          </Link>
        ) : (
          <p className="mt-0.5 text-sm font-medium text-[var(--fg)]">
            {item.label}
          </p>
        )}
        {item.land && (
          <p className="text-[10px] text-[var(--fg-muted)]">{item.land}</p>
        )}
        {item.idealTime && (
          <p className="text-[10px] text-[var(--wait-low)]">
            Ideal window: {item.idealTime}
          </p>
        )}
        <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--fg-secondary)]">
          {item.reason}
        </p>
        <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-[var(--fg-muted)]">
          {item.estimatedWait !== undefined && (
            <span>~{item.estimatedWait} min wait</span>
          )}
          {item.predictedWait !== undefined && (
            <span>→ ~{item.predictedWait}m in 1 hr</span>
          )}
          {item.vsAveragePercent != null && item.vsAveragePercent >= 8 && (
            <span className="text-[var(--wait-low)]">
              {item.vsAveragePercent}% below normal
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

function PriorityBadge({
  priority,
  label,
}: {
  priority?: TouringPlanItem["priority"];
  label: string;
}) {
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-0.5 text-[9px] font-medium",
        priority === "high" && "bg-[var(--wait-low)]/15 text-[var(--wait-low)]",
        priority === "normal" &&
          "bg-[var(--wait-medium)]/15 text-[var(--wait-medium)]",
        priority === "flexible" &&
          "bg-[var(--surface-hover)] text-[var(--fg-muted)]"
      )}
    >
      {label}
    </span>
  );
}

function ModeCard({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border p-3 text-left transition-all",
        active
          ? "border-[var(--fg)] bg-[var(--surface-hover)]"
          : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--fg-muted)]"
      )}
    >
      <p className="text-sm font-medium text-[var(--fg)]">{title}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-[var(--fg-muted)]">
        {description}
      </p>
    </button>
  );
}

function PrefSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="input-field mt-1.5 w-full py-2 text-sm"
      >
        {HOUR_OPTIONS.map((h) => (
          <option key={`${label}-${h}`} value={h}>
            {formatHour(h)}
          </option>
        ))}
      </select>
    </label>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-[var(--fg-secondary)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-[var(--border)]"
      />
      {label}
    </label>
  );
}

const HOUR_OPTIONS = Array.from({ length: 15 }, (_, i) => i + 7);

function formatHour(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:00 ${period}`;
}
