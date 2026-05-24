import type {
  RideWithLiveData,
  RideIntelligence,
  TouringPlan,
  TouringPlanItem,
  TouringPlanPreferences,
  PlanAdjustment,
} from "@/types";
import { formatHourMinute } from "@/utils/wait-time";
import { getLandTravelMinutes } from "./lands";
import {
  scoreRideForSchedule,
  findPeakLunchHour,
  RIDE_DURATION_MIN,
} from "./scoring";

const LUNCH_MINUTES = 45;

export function generateTouringPlan(
  rides: RideWithLiveData[],
  intelligenceByRide: Record<number, RideIntelligence>,
  preferences: TouringPlanPreferences
): TouringPlan {
  const rideMap = new Map(rides.map((r) => [r.ride_id, r]));
  const mustDoIds = preferences.mustDoRideIds.filter((id) => rideMap.has(id));

  if (mustDoIds.length === 0) {
    return {
      items: [],
      preferences,
      missedMustDo: [],
      summary:
        "Select at least one ride to generate an optimized plan.",
      generatedAt: new Date().toISOString(),
    };
  }

  const selectedRides = mustDoIds
    .map((id) => rideMap.get(id)!)
    .filter(Boolean);

  const scheduled: TouringPlanItem[] = [];
  const done = new Set<number>();
  const remaining = new Set(mustDoIds);
  let cursorMinutes = preferences.arrivalHour * 60;
  const endMinutes = preferences.departureHour * 60;
  let lastLand: string | null = null;
  let lunchTaken = !preferences.lunchBreak;

  const lunchHour = preferences.lunchBreak
    ? findPeakLunchHour(
        selectedRides,
        intelligenceByRide,
        preferences.arrivalHour,
        preferences.lunchHour ?? 12
      )
    : null;

  while (cursorMinutes < endMinutes && remaining.size > 0) {
    const hour = Math.floor(cursorMinutes / 60) % 24;
    const minute = cursorMinutes % 60;

    if (
      preferences.lunchBreak &&
      !lunchTaken &&
      lunchHour !== null &&
      hour >= lunchHour &&
      remaining.size > 0
    ) {
      scheduled.push({
        time: formatHourMinute(hour, minute),
        timeMinutes: cursorMinutes,
        type: "break",
        label: "Lunch break",
        reason: "Scheduled during typical peak crowds — ride low waits before and after",
        priority: "flexible",
        priorityLabel: "Break",
      });
      cursorMinutes += LUNCH_MINUTES;
      lunchTaken = true;
      continue;
    }

    let bestRide: RideWithLiveData | null = null;
    let bestScore: RideScheduleScore | null = null;

    for (const rideId of remaining) {
      const ride = rideMap.get(rideId);
      if (!ride) continue;

      const intel = intelligenceByRide[rideId];
      const scored = scoreRideForSchedule({
        ride,
        intel,
        cursorMinutes,
        lastLand,
        preference: preferences.preference,
        expressPass: preferences.expressPass,
      });

      if (!bestScore || scored.totalScore > bestScore.totalScore) {
        bestScore = scored;
        bestRide = ride;
      }
    }

    if (!bestRide || !bestScore) break;

    const travelMinutes =
      scheduled.length === 0
        ? 0
        : getLandTravelMinutes(lastLand, bestRide.land);

    if (travelMinutes > 0 && scheduled.length > 0) {
      const travelStart = cursorMinutes;
      scheduled.push({
        time: formatHourMinute(
          Math.floor(travelStart / 60) % 24,
          travelStart % 60
        ),
        timeMinutes: travelStart,
        type: "travel",
        label: `Walk to ${bestRide.land}`,
        land: bestRide.land,
        reason: `~${travelMinutes} min walk between lands`,
        priority: "flexible",
        priorityLabel: "Travel",
        travelMinutes,
      });
      cursorMinutes += travelMinutes;
    }

    const itemHour = Math.floor(cursorMinutes / 60) % 24;
    const itemMinute = cursorMinutes % 60;

    scheduled.push({
      time: formatHourMinute(itemHour, itemMinute),
      timeMinutes: cursorMinutes,
      type: "ride",
      rideId: bestRide.ride_id,
      rideName: bestRide.name,
      land: bestRide.land,
      estimatedWait: bestScore.estimatedWait,
      predictedWait: bestScore.predictedWaitLater,
      vsAveragePercent: bestScore.vsAveragePercent,
      label: bestRide.name,
      reason: bestScore.reason,
      priority: bestScore.priority,
      priorityLabel: bestScore.priorityLabel,
      isOpen: bestRide.is_open,
    });

    done.add(bestRide.ride_id);
    remaining.delete(bestRide.ride_id);
    lastLand = bestRide.land;

    cursorMinutes += bestScore.estimatedWait + RIDE_DURATION_MIN;
  }

  const missedMustDo = mustDoIds.filter((id) => !done.has(id));

  const summary = buildPlanSummary(
    selectedRides.length,
    done.size,
    missedMustDo.length,
    preferences
  );

  return {
    items: scheduled,
    preferences,
    missedMustDo,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

type RideScheduleScore = ReturnType<typeof scoreRideForSchedule>;

function buildPlanSummary(
  selected: number,
  scheduled: number,
  missed: number,
  prefs: TouringPlanPreferences
): string {
  if (scheduled === 0) {
    return "Could not build a schedule — try a longer visit window.";
  }
  if (missed > 0) {
    return `Optimized ${scheduled} of ${selected} rides. Extend departure time to fit ${missed} remaining.`;
  }
  const mode =
    prefs.preference === "thrill"
      ? "Thrill-first routing"
      : prefs.preference === "family"
        ? "Family-friendly routing"
        : "Balanced routing";
  return `${mode} · ${scheduled} ride${scheduled === 1 ? "" : "s"} · land-aware order`;
}

export function computePlanAdjustments(
  plan: TouringPlan,
  rides: RideWithLiveData[],
  intelligenceByRide: Record<number, RideIntelligence>
): PlanAdjustment[] {
  const adjustments: PlanAdjustment[] = [];
  const rideMap = new Map(rides.map((r) => [r.ride_id, r]));
  const scheduledRideIds = plan.items
    .filter((i) => i.type === "ride" && i.rideId)
    .map((i) => i.rideId!);

  for (const rideId of scheduledRideIds) {
    const ride = rideMap.get(rideId);
    const intel = intelligenceByRide[rideId];
    if (!ride || !intel) continue;

    const planItem = plan.items.find(
      (i) => i.type === "ride" && i.rideId === rideId
    );
    const planned = planItem?.estimatedWait ?? 0;
    const vsAvg = intel.vsAveragePercent;

    if (!ride.is_open) {
      adjustments.push({
        rideId,
        rideName: ride.name,
        message: `${ride.name} is currently closed — monitor for reopening and swap order if needed.`,
        priority: "warning",
      });
      continue;
    }

    if (vsAvg !== null && vsAvg >= 20) {
      adjustments.push({
        rideId,
        rideName: ride.name,
        message: `${ride.name} is ${vsAvg}% below normal — ride now if it's next on your route.`,
        priority: "opportunity",
      });
      continue;
    }

    if (
      intel.trend.trend === "rising_fast" &&
      intel.predictedWait30 !== null &&
      intel.predictedWait30 >= ride.wait_time + 15
    ) {
      adjustments.push({
        rideId,
        rideName: ride.name,
        message: `Move ${ride.name} earlier — wait rising rapidly (${ride.wait_time}m → ~${intel.predictedWait30}m).`,
        priority: "urgent",
      });
      continue;
    }

    if (ride.wait_time - planned >= 20) {
      adjustments.push({
        rideId,
        rideName: ride.name,
        message: `${ride.name} wait ${ride.wait_time - planned}m higher than planned — consider reordering.`,
        priority: "warning",
      });
    }
  }

  // Unscheduled selected rides with great opportunities
  for (const ride of rides) {
    if (
      !plan.preferences.mustDoRideIds.includes(ride.ride_id) ||
      scheduledRideIds.includes(ride.ride_id)
    ) {
      continue;
    }
    const intel = intelligenceByRide[ride.ride_id];
    if (intel?.vsAveragePercent !== null && intel.vsAveragePercent >= 25 && ride.is_open) {
      adjustments.push({
        rideId: ride.ride_id,
        rideName: ride.name,
        message: `${ride.name} still unscheduled and ${intel.vsAveragePercent}% below normal.`,
        priority: "opportunity",
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
