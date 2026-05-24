import type {
  RideWithLiveData,
  RideIntelligence,
  TouringPlan,
  TouringPlanItem,
  TouringPlanPreferences,
  PlanAdjustment,
} from "@/types";
import { formatHourMinute } from "@/utils/wait-time";
import { getParkTimeMinutes } from "@/lib/park-time";
import { getLandTravelMinutes } from "./lands";
import {
  scoreRideForSchedule,
  findPeakLunchHour,
  RIDE_DURATION_MIN,
} from "./scoring";
import {
  assignHistoricalSlots,
  estimateHistoricalWait,
} from "./historical-slots";

const LUNCH_MINUTES = 45;

type RideScheduleScore = ReturnType<typeof scoreRideForSchedule>;

export function generateTouringPlan(
  rides: RideWithLiveData[],
  intelligenceByRide: Record<number, RideIntelligence>,
  preferences: TouringPlanPreferences
): TouringPlan {
  const rideMap = new Map(rides.map((r) => [r.ride_id, r]));
  const mustDoIds = preferences.mustDoRideIds.filter((id) => rideMap.has(id));

  if (mustDoIds.length === 0) {
    return emptyPlan(preferences, "Select at least one ride to generate an optimized plan.");
  }

  if (preferences.planMode === "fullday") {
    return generateFullDayPlan(
      rides,
      intelligenceByRide,
      preferences,
      mustDoIds,
      rideMap
    );
  }

  return generateLivePlan(
    rides,
    intelligenceByRide,
    preferences,
    mustDoIds,
    rideMap
  );
}

/** In-park now: optimize selected rides over the next N hours using live waits. */
function generateLivePlan(
  rides: RideWithLiveData[],
  intelligenceByRide: Record<number, RideIntelligence>,
  preferences: TouringPlanPreferences,
  mustDoIds: number[],
  rideMap: Map<number, RideWithLiveData>
): TouringPlan {
  const startMinutes = getParkTimeMinutes();
  const windowHours = preferences.liveWindowHours ?? 2;
  const endMinutes = startMinutes + windowHours * 60;

  const scheduled: TouringPlanItem[] = [];
  const done = new Set<number>();
  const remaining = new Set(mustDoIds);
  let cursorMinutes = startMinutes;
  let lastLand: string | null = null;

  while (cursorMinutes < endMinutes && remaining.size > 0) {
    let bestRide: RideWithLiveData | null = null;
    let bestScore: RideScheduleScore | null = null;

    for (const rideId of remaining) {
      const ride = rideMap.get(rideId);
      if (!ride) continue;

      const scored = scoreRideForSchedule({
        ride,
        intel: intelligenceByRide[rideId],
        cursorMinutes,
        lastLand,
        preference: preferences.preference,
        expressPass: preferences.expressPass,
        planMode: "live",
      });

      if (!bestScore || scored.totalScore > bestScore.totalScore) {
        bestScore = scored;
        bestRide = ride;
      }
    }

    if (!bestRide || !bestScore) break;

    cursorMinutes = appendRideToSchedule({
      scheduled,
      ride: bestRide,
      score: bestScore,
      cursorMinutes,
      lastLand,
      preferences,
    });

    done.add(bestRide.ride_id);
    remaining.delete(bestRide.ride_id);
    lastLand = bestRide.land;
    cursorMinutes += bestScore.estimatedWait + RIDE_DURATION_MIN;
  }

  const missedMustDo = mustDoIds.filter((id) => !done.has(id));
  const selectedCount = mustDoIds.length;

  let summary = `Live plan · next ${windowHours} hr${windowHours === 1 ? "" : "s"} · current waits`;
  if (done.size === 0) {
    summary = "Not enough time in window — try a longer window or fewer rides.";
  } else if (missedMustDo.length > 0) {
    summary = `Fits ${done.size} of ${selectedCount} rides in ${windowHours}h — extend window or drop a ride.`;
  } else {
    summary += ` · ${done.size} ride${done.size === 1 ? "" : "s"} optimized for right now`;
  }

  return {
    items: scheduled,
    preferences,
    missedMustDo,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

/** Full day: assign each ride its statistically best time between arrival and departure. */
function generateFullDayPlan(
  rides: RideWithLiveData[],
  intelligenceByRide: Record<number, RideIntelligence>,
  preferences: TouringPlanPreferences,
  mustDoIds: number[],
  rideMap: Map<number, RideWithLiveData>
): TouringPlan {
  const selectedRides = mustDoIds.map((id) => rideMap.get(id)!).filter(Boolean);
  const arrivalMinutes = preferences.arrivalHour * 60;
  const endMinutes = preferences.departureHour * 60;

  const slots = assignHistoricalSlots(
    selectedRides,
    intelligenceByRide,
    preferences.arrivalHour,
    preferences.departureHour
  );

  const scheduled: TouringPlanItem[] = [];
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
  const lunchMinutes = lunchHour !== null ? lunchHour * 60 : null;

  let cursorMinutes = arrivalMinutes;
  let slotIndex = 0;

  while (slotIndex < slots.length) {
    const hour = Math.floor(cursorMinutes / 60) % 24;
    const minute = cursorMinutes % 60;

    if (
      preferences.lunchBreak &&
      !lunchTaken &&
      lunchMinutes !== null &&
      cursorMinutes >= lunchMinutes &&
      slotIndex < slots.length
    ) {
      scheduled.push({
        time: formatHourMinute(hour, minute),
        timeMinutes: cursorMinutes,
        type: "break",
        label: "Lunch break",
        reason: "Scheduled during typical daily peak — ride low-wait windows before and after",
        priority: "flexible",
        priorityLabel: "Break",
      });
      cursorMinutes += LUNCH_MINUTES;
      lunchTaken = true;
      continue;
    }

    const slot = slots[slotIndex];
    const ride = rideMap.get(slot.rideId);
    if (!ride) {
      slotIndex++;
      continue;
    }

    const intel = intelligenceByRide[slot.rideId];

    // Aim for historical optimal time, but not before we can physically arrive
    const targetMinutes = Math.max(cursorMinutes, slot.timeMinutes);
    const travelMinutes =
      scheduled.length === 0 && targetMinutes === slot.timeMinutes
        ? 0
        : getLandTravelMinutes(lastLand, ride.land);

    let rideStart = targetMinutes;
    if (travelMinutes > 0 && lastLand !== null) {
      const travelStart = Math.max(cursorMinutes, targetMinutes - travelMinutes);
      if (travelStart > cursorMinutes) {
        rideStart = travelStart + travelMinutes;
      } else {
        scheduled.push({
          time: formatHourMinute(
            Math.floor(cursorMinutes / 60) % 24,
            cursorMinutes % 60
          ),
          timeMinutes: cursorMinutes,
          type: "travel",
          label: `Walk to ${ride.land}`,
          land: ride.land,
          reason: `~${travelMinutes} min between lands`,
          priority: "flexible",
          priorityLabel: "Travel",
          travelMinutes,
        });
        cursorMinutes += travelMinutes;
        rideStart = Math.max(slot.timeMinutes, cursorMinutes);
      }
    }

    const wait = estimateHistoricalWait(
      intel,
      slot.hour,
      ride.wait_time,
      preferences.expressPass
    );

    const delayedFromIdeal = rideStart > slot.timeMinutes + 20;
    const reason = delayedFromIdeal
      ? `${slot.reason} · adjusted for park flow`
      : slot.reason;

    const itemHour = Math.floor(rideStart / 60) % 24;
    const itemMinute = rideStart % 60;

    scheduled.push({
      time: formatHourMinute(itemHour, itemMinute),
      timeMinutes: rideStart,
      type: "ride",
      rideId: ride.ride_id,
      rideName: ride.name,
      land: ride.land,
      estimatedWait: wait,
      predictedWait: slot.peakAverage,
      vsAveragePercent:
        slot.peakAverage > 0
          ? Math.round(
              ((slot.peakAverage - slot.historicalAverage) / slot.peakAverage) *
                100
            )
          : null,
      label: ride.name,
      reason,
      priority: slot.rank === 0 ? "high" : "normal",
      priorityLabel: slot.rank === 0 ? "Best window" : "Good window",
      isOpen: ride.is_open,
      idealTime: slot.label,
    });

    lastLand = ride.land;
    cursorMinutes = rideStart + wait + RIDE_DURATION_MIN;
    slotIndex++;

    if (cursorMinutes >= endMinutes) break;
  }

  const scheduledIds = new Set(
    scheduled.filter((i) => i.type === "ride").map((i) => i.rideId)
  );
  const missedMustDo = mustDoIds.filter((id) => !scheduledIds.has(id));

  let summary = `Full-day plan · historical best times · ${preferences.arrivalHour}:00–${preferences.departureHour}:00`;
  if (missedMustDo.length > 0) {
    summary = `Full-day plan · ${scheduledIds.size} of ${mustDoIds.length} rides fit — extend departure to include all.`;
  }

  return {
    items: scheduled,
    preferences,
    missedMustDo,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

function appendRideToSchedule(params: {
  scheduled: TouringPlanItem[];
  ride: RideWithLiveData;
  score: RideScheduleScore;
  cursorMinutes: number;
  lastLand: string | null;
  preferences: TouringPlanPreferences;
}): number {
  const { scheduled, ride, score, lastLand, preferences } = params;
  let cursorMinutes = params.cursorMinutes;

  const travelMinutes =
    scheduled.length === 0 ? 0 : getLandTravelMinutes(lastLand, ride.land);

  if (travelMinutes > 0 && scheduled.length > 0) {
    scheduled.push({
      time: formatHourMinute(
        Math.floor(cursorMinutes / 60) % 24,
        cursorMinutes % 60
      ),
      timeMinutes: cursorMinutes,
      type: "travel",
      label: `Walk to ${ride.land}`,
      land: ride.land,
      reason: `~${travelMinutes} min walk between lands`,
      priority: "flexible",
      priorityLabel: "Travel",
      travelMinutes,
    });
    cursorMinutes += travelMinutes;
  }

  scheduled.push({
    time: formatHourMinute(
      Math.floor(cursorMinutes / 60) % 24,
      cursorMinutes % 60
    ),
    timeMinutes: cursorMinutes,
    type: "ride",
    rideId: ride.ride_id,
    rideName: ride.name,
    land: ride.land,
    estimatedWait: score.estimatedWait,
    predictedWait: score.predictedWaitLater,
    vsAveragePercent: score.vsAveragePercent,
    label: ride.name,
    reason:
      preferences.planMode === "live" && ride.is_open
        ? `Ride now — ${score.reason}`
        : score.reason,
    priority: score.priority,
    priorityLabel: score.priorityLabel,
    isOpen: ride.is_open,
  });

  return cursorMinutes;
}

function emptyPlan(preferences: TouringPlanPreferences, summary: string): TouringPlan {
  return {
    items: [],
    preferences,
    missedMustDo: [],
    summary,
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
  const isLive = plan.preferences.planMode === "live";

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

    if (!ride.is_open) {
      adjustments.push({
        rideId,
        rideName: ride.name,
        message: `${ride.name} is currently closed — monitor for reopening.`,
        priority: "warning",
      });
      continue;
    }

    if (isLive) {
      const vsAvg = intel.vsAveragePercent;
      if (vsAvg !== null && vsAvg >= 20) {
        adjustments.push({
          rideId,
          rideName: ride.name,
          message: `${ride.name} is ${vsAvg}% below normal — ride now if it's next.`,
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
          message: `Move ${ride.name} earlier — ${ride.wait_time}m now, ~${intel.predictedWait30}m in 30 min.`,
          priority: "urgent",
        });
      }
    } else if (planItem) {
      const currentVsPlan = ride.wait_time - (planItem.estimatedWait ?? 0);
      if (currentVsPlan <= -15) {
        adjustments.push({
          rideId,
          rideName: ride.name,
          message: `${ride.name} wait lower than typical for its slot — good time if you're ahead of schedule.`,
          priority: "opportunity",
        });
      } else if (currentVsPlan >= 20) {
        adjustments.push({
          rideId,
          rideName: ride.name,
          message: `${ride.name} wait ${currentVsPlan}m above historical average for this window.`,
          priority: "warning",
        });
      }
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
  planMode: "live",
  liveWindowHours: 2,
  arrivalHour: 9,
  departureHour: 18,
  mustDoRideIds: [],
  preference: "mixed",
  expressPass: false,
  lunchBreak: true,
  lunchHour: 12,
};
