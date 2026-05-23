import type {
  RideWithLiveData,
  RideIntelligence,
  TouringPlan,
  TouringPlanItem,
  TouringPlanPreferences,
  PlanAdjustment,
} from "@/types";
import { formatHourMinute } from "@/utils/wait-time";

const RIDE_DURATION_MIN = 8;
const WALK_MINUTES = 10;
const LUNCH_MINUTES = 45;

function estimateWaitAtHour(
  intel: RideIntelligence | undefined,
  hour: number,
  fallback: number
): number {
  const hourData = intel?.hourlyPattern.find((entry) => entry.hour === hour);
  return hourData?.average ?? fallback;
}

function scoreRideForSlot(
  ride: RideWithLiveData,
  intel: RideIntelligence | undefined,
  hour: number,
  mustDo: boolean
): number {
  if (!ride.is_open) return -1;

  const historical = estimateWaitAtHour(intel, hour, ride.wait_time);
  let score = intel?.opportunityScore ?? 50;

  score += Math.max(0, 40 - historical);
  if (mustDo) score += 30;
  if (historical <= 25) score += 15;

  return score;
}

function preferenceBoost(
  ride: RideWithLiveData,
  intel: RideIntelligence | undefined,
  preference: TouringPlanPreferences["preference"]
): number {
  if (preference === "mixed") return 0;
  const peak = intel?.peakTimeAverage ?? ride.wait_time;
  if (preference === "thrill") return Math.min(20, Math.round(peak / 5));
  return peak <= 35 ? 12 : 0;
}

export function generateTouringPlan(
  rides: RideWithLiveData[],
  intelligenceByRide: Record<number, RideIntelligence>,
  preferences: TouringPlanPreferences
): TouringPlan {
  const scheduled: TouringPlanItem[] = [];
  const done = new Set<number>();
  let cursorMinutes = preferences.arrivalHour * 60;
  const endMinutes = preferences.departureHour * 60;
  const mustDoRemaining = new Set(preferences.mustDoRideIds);
  let lunchTaken = !preferences.lunchBreak;

  const availableRides = () =>
    rides.filter((r) => r.is_open && !done.has(r.ride_id));

  while (cursorMinutes < endMinutes) {
    const hour = Math.floor(cursorMinutes / 60) % 24;

    if (
      preferences.lunchBreak &&
      !lunchTaken &&
      preferences.lunchHour !== undefined &&
      hour >= preferences.lunchHour
    ) {
      scheduled.push({
        time: formatHourMinute(hour, cursorMinutes % 60),
        timeMinutes: cursorMinutes,
        type: "break",
        label: "Lunch break",
        reason: "Scheduled rest",
      });
      cursorMinutes += LUNCH_MINUTES;
      lunchTaken = true;
      continue;
    }

    const candidates = availableRides();
    if (candidates.length === 0) break;

    let best: RideWithLiveData | null = null;
    let bestScore = -1;
    let bestWait = 0;

    for (const ride of candidates) {
      const intel = intelligenceByRide[ride.ride_id];
      const isMustDo = mustDoRemaining.has(ride.ride_id);
      let score = scoreRideForSlot(ride, intel, hour, isMustDo);
      score += preferenceBoost(ride, intel, preferences.preference);

      if (preferences.expressPass) score += 5;

      if (score > bestScore) {
        bestScore = score;
        best = ride;
        bestWait = estimateWaitAtHour(intel, hour, ride.wait_time);
      }
    }

    if (!best || bestScore < 0) break;

    const intel = intelligenceByRide[best.ride_id];
    const effectiveWait = preferences.expressPass
      ? Math.round(bestWait * 0.4)
      : bestWait;

    scheduled.push({
      time: formatHourMinute(hour, cursorMinutes % 60),
      timeMinutes: cursorMinutes,
      type: "ride",
      rideId: best.ride_id,
      rideName: best.name,
      land: best.land,
      estimatedWait: effectiveWait,
      label: best.name,
      reason:
        intel?.comparisonMessage ??
        `Typical ${effectiveWait} min wait around this time`,
    });

    done.add(best.ride_id);
    mustDoRemaining.delete(best.ride_id);
    cursorMinutes += effectiveWait + RIDE_DURATION_MIN + WALK_MINUTES;
  }

  const missedMustDo = preferences.mustDoRideIds.filter((id) => !done.has(id));

  return {
    items: scheduled,
    preferences,
    missedMustDo,
    generatedAt: new Date().toISOString(),
  };
}

export function computePlanAdjustments(
  plan: TouringPlan,
  rides: RideWithLiveData[],
  intelligenceByRide: Record<number, RideIntelligence>
): PlanAdjustment[] {
  const adjustments: PlanAdjustment[] = [];
  const rideMap = new Map(rides.map((r) => [r.ride_id, r]));

  for (const item of plan.items) {
    if (item.type !== "ride" || !item.rideId) continue;

    const ride = rideMap.get(item.rideId);
    const intel = intelligenceByRide[item.rideId];
    if (!ride || !intel || !ride.is_open) continue;

    const planned = item.estimatedWait ?? 0;
    const delta = ride.wait_time - planned;
    const vsAvg = intel.vsAveragePercent;

    if (delta <= -15 || (vsAvg !== null && vsAvg >= 20)) {
      adjustments.push({
        rideId: item.rideId,
        rideName: item.rideName ?? ride.name,
        message: `${ride.name} currently ${Math.abs(vsAvg ?? 0)}% below normal — great time to ride now.`,
        priority: "opportunity",
      });
      continue;
    }

    if (
      intel.trend.trend === "rising_fast" &&
      ride.wait_time < (intel.predictedWait30 ?? ride.wait_time)
    ) {
      adjustments.push({
        rideId: item.rideId,
        rideName: item.rideName ?? ride.name,
        message: `Move ${ride.name} earlier — wait rising faster than expected.`,
        priority: "urgent",
      });
      continue;
    }

    if (delta >= 20) {
      adjustments.push({
        rideId: item.rideId,
        rideName: item.rideName ?? ride.name,
        message: `${ride.name} wait ${delta} min higher than planned — consider swapping order.`,
        priority: "warning",
      });
    }
  }

  const seen = new Set<number>();
  return adjustments.filter((a) => {
    if (seen.has(a.rideId)) return false;
    seen.add(a.rideId);
    return true;
  });
}

export const DEFAULT_TOURING_PREFERENCES: TouringPlanPreferences = {
  arrivalHour: 9,
  departureHour: 18,
  mustDoRideIds: [],
  preference: "mixed",
  expressPass: false,
  lunchBreak: true,
  lunchHour: 12,
};
