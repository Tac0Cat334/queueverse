import type {
  RideIntelligence,
  RideWithLiveData,
  TouringPlan,
  TouringPlanItem,
  RerouteSuggestion,
  TimeSavedEstimate,
} from "@/types";
import { getLandTravelMinutes } from "@/lib/touring/lands";
import { buildRerouteReasoning } from "@/lib/intelligence/reasoning";
import { isEarlyEntryWindowHour } from "@/lib/analytics/operational-phases";
import { getDefaultPark } from "@/lib/parks";
import { getParkParts } from "@/lib/park-time";

function isEarlyEntryContext(
  plan: TouringPlan,
  intelligenceByRide: Record<number, RideIntelligence>
): boolean {
  if (plan.earlyEntryOptimized || plan.preferences.earlyEntry) return true;
  const hour = getParkParts(new Date()).hour;
  if (!isEarlyEntryWindowHour(hour, getDefaultPark())) return false;
  return Object.values(intelligenceByRide).some((i) => i.earlyEntry.active);
}

function effectiveVsAverage(intel: RideIntelligence): number {
  if (intel.earlyEntry.active && intel.earlyEntryVsAveragePercent != null) {
    return intel.earlyEntryVsAveragePercent;
  }
  return intel.vsAveragePercent ?? 0;
}

function sumRideWaits(items: TouringPlanItem[]): number {
  return items
    .filter((i) => i.type === "ride")
    .reduce((s, i) => s + (i.estimatedWait ?? 0), 0);
}

function confidenceLabel(score: number): string {
  if (score >= 70) return "High confidence";
  if (score >= 45) return "Medium confidence";
  return "Low confidence";
}

/**
 * Conservative time-saved estimate vs riding each scheduled ride
 * at its historical typical wait for the current time slot.
 */
export function estimatePlanTimeSaved(
  plan: TouringPlan,
  rides: RideWithLiveData[],
  intelligenceByRide: Record<number, RideIntelligence>
): TimeSavedEstimate {
  const rideItems = plan.items.filter((i) => i.type === "ride" && i.rideId);
  const optimizedWaitMinutes = sumRideWaits(plan.items);

  let baselineWaitMinutes = 0;
  let ridesWithBaseline = 0;

  for (const item of rideItems) {
    const intel = item.rideId ? intelligenceByRide[item.rideId] : undefined;
    const ride = rides.find((r) => r.ride_id === item.rideId);
    const useEarlyEntryBaseline =
      plan.earlyEntryOptimized &&
      intel?.earlyEntry.eligible &&
      intel.earlyEntryBaseline != null;
    const baseline =
      (useEarlyEntryBaseline ? intel?.earlyEntryBaseline : null) ??
      intel?.historicalAverage ??
      (intel?.confidenceLevel !== "low" ? ride?.wait_time : null) ??
      item.estimatedWait ??
      0;

    if (
      (useEarlyEntryBaseline && intel?.earlyEntryBaseline != null) ||
      (intel?.historicalAverage !== null && intel?.historicalAverage !== undefined)
    ) {
      ridesWithBaseline += 1;
    }
    baselineWaitMinutes += baseline;
  }

  const rawSaved = baselineWaitMinutes - optimizedWaitMinutes;
  const minutesSaved = Math.max(0, Math.round(rawSaved * 0.85));
  const percentSaved =
    baselineWaitMinutes > 0
      ? Math.round((minutesSaved / baselineWaitMinutes) * 100)
      : 0;

  const confScore =
    ridesWithBaseline >= rideItems.length * 0.7
      ? 75
      : ridesWithBaseline >= rideItems.length * 0.4
        ? 55
        : 35;

  return {
    optimizedWaitMinutes,
    baselineWaitMinutes,
    minutesSaved,
    percentSaved,
    baselineLabel: plan.earlyEntryOptimized
      ? "Early Entry typical waits at each scheduled time"
      : "Typical waits at each scheduled time",
    methodology:
      "Compares optimized plan waits to historical slot averages — capped to avoid inflated estimates",
    confidenceLabel: confidenceLabel(confScore),
  };
}

/** Live rerouting with explainable suggestions */
export function generateRerouteSuggestions(
  plan: TouringPlan,
  rides: RideWithLiveData[],
  intelligenceByRide: Record<number, RideIntelligence>
): RerouteSuggestion[] {
  const suggestions: RerouteSuggestion[] = [];
  const earlyEntryMode = isEarlyEntryContext(plan, intelligenceByRide);
  const rideMap = new Map(rides.map((r) => [r.ride_id, r]));
  const scheduledIds = plan.items
    .filter((i) => i.type === "ride" && i.rideId)
    .map((i) => i.rideId!);

  let lastLand: string | null = null;
  for (const item of plan.items) {
    if (item.type === "ride" && item.land) lastLand = item.land;
  }

  for (const rideId of scheduledIds) {
    const ride = rideMap.get(rideId);
    const intel = intelligenceByRide[rideId];
    const planItem = plan.items.find(
      (i) => i.type === "ride" && i.rideId === rideId
    );
    if (!ride || !intel || !planItem) continue;

    const confScore = intel.confidenceScore;
    const confLabel = confidenceLabel(confScore);

    if (!ride.is_open) {
      const alt = findBestAlternative(
        ride,
        rides,
        intelligenceByRide,
        new Set(scheduledIds),
        lastLand
      );
      const altIntel = alt ? intelligenceByRide[alt.ride_id] : undefined;
      const reasoning = buildRerouteReasoning({
        triggerRideName: ride.name,
        triggerWait: ride.wait_time,
        planWait: planItem.estimatedWait ?? 0,
        alternativeName: alt?.name,
        alternativeWait: alt?.wait_time,
        vsAveragePercent: altIntel?.vsAveragePercent,
        type: "closure",
      });

      suggestions.push({
        type: "closure",
        rideId,
        rideName: ride.name,
        message: alt
          ? `${ride.name} closed — try ${alt.name} (${alt.wait_time}m)`
          : `${ride.name} is closed — monitor for reopening`,
        estimatedMinutesSaved: alt
          ? Math.max(0, (planItem.estimatedWait ?? 0) - alt.wait_time)
          : 0,
        priority: "urgent",
        alternativeRideId: alt?.ride_id,
        alternativeRideName: alt?.name,
        reasoning,
        confidenceScore: altIntel?.confidenceScore ?? confScore,
        confidenceLabel: altIntel?.confidenceLabel ?? confLabel,
      });
      continue;
    }

    const liveVsPlan = ride.wait_time - (planItem.estimatedWait ?? 0);
    const vsAvg = effectiveVsAverage(intel);
    const spikeRisk =
      (intel.predictedWait60 ?? ride.wait_time) - ride.wait_time;

    const eeHeadlinerPriority =
      earlyEntryMode &&
      intel.earlyEntry.eligible &&
      intel.waitInflation.isHeadliner &&
      intel.waitInflation.score >= 40;

    if (eeHeadlinerPriority && intel.urgencyScore >= 45) {
      const reasoning = buildRerouteReasoning({
        triggerRideName: ride.name,
        triggerWait: ride.wait_time,
        planWait: planItem.estimatedWait ?? 0,
        vsAveragePercent: vsAvg,
        trend: intel.trend,
        type: "opportunity",
        earlyEntry: true,
        waitInflationMessage: intel.waitInflation.message,
      });

      suggestions.push({
        type: "prioritize",
        rideId,
        rideName: ride.name,
        message: `Best opening-hour opportunity — ${ride.name} (${intel.waitInflation.message})`,
        estimatedMinutesSaved:
          intel.estimatedMinutesSavedVsTypical ??
          Math.round(intel.waitInflation.peakDeltaMinutes * 0.4),
        priority: "urgent",
        reasoning,
        confidenceScore: confScore,
        confidenceLabel: confLabel,
      });
      continue;
    }

    if (spikeRisk >= 20 && intel.urgencyScore >= 55) {
      const reasoning = buildRerouteReasoning({
        triggerRideName: ride.name,
        triggerWait: ride.wait_time,
        planWait: planItem.estimatedWait ?? 0,
        trend: intel.trend,
        type: "spike",
      });

      suggestions.push({
        type: "prioritize",
        rideId,
        rideName: ride.name,
        message: `${ride.name} rising faster than expected — ride before ~${intel.predictedWait60 ?? ride.wait_time + spikeRisk}m`,
        estimatedMinutesSaved: Math.min(Math.round(spikeRisk * 0.7), 40),
        priority: "urgent",
        reasoning,
        confidenceScore: intel.prediction60?.confidenceScore ?? confScore,
        confidenceLabel: intel.prediction60?.confidenceLabel ?? confLabel,
      });
    } else if (vsAvg >= (earlyEntryMode ? 8 : 20) && intel.confidenceLevel !== "low") {
      const reasoning = buildRerouteReasoning({
        triggerRideName: ride.name,
        triggerWait: ride.wait_time,
        planWait: planItem.estimatedWait ?? 0,
        vsAveragePercent: vsAvg,
        type: "opportunity",
        earlyEntry: earlyEntryMode && intel.earlyEntry.eligible,
        waitInflationMessage:
          earlyEntryMode && intel.waitInflation.score >= 40
            ? intel.waitInflation.message
            : undefined,
      });

      suggestions.push({
        type: "prioritize",
        rideId,
        rideName: ride.name,
        message:
          earlyEntryMode && intel.earlyEntry.eligible
            ? `${ride.name} — ${vsAvg}% below Early Entry typical${intel.waitInflation.isHeadliner ? " · headliner window" : ""}`
            : `${ride.name} is ${vsAvg}% below typical — strong window if it's next`,
        estimatedMinutesSaved: intel.estimatedMinutesSavedVsTypical ?? Math.round(vsAvg * 0.5),
        priority: "opportunity",
        reasoning,
        confidenceScore: confScore,
        confidenceLabel: confLabel,
      });
    } else if (
      liveVsPlan >= 25 &&
      !(earlyEntryMode && intel.waitInflation.isHeadliner && intel.earlyEntry.eligible)
    ) {
      const alt = findBestAlternative(
        ride,
        rides,
        intelligenceByRide,
        new Set(scheduledIds),
        ride.land
      );
      const altIntel = alt ? intelligenceByRide[alt.ride_id] : undefined;
      const reasoning = buildRerouteReasoning({
        triggerRideName: ride.name,
        triggerWait: ride.wait_time,
        planWait: planItem.estimatedWait ?? 0,
        alternativeName: alt?.name,
        alternativeWait: alt?.wait_time,
        vsAveragePercent: altIntel?.vsAveragePercent,
        type: "defer",
      });

      suggestions.push({
        type: alt ? "alternative" : "defer",
        rideId,
        rideName: ride.name,
        message: alt
          ? `${ride.name} +${liveVsPlan}m above plan — consider ${alt.name} (${alt.wait_time}m) instead`
          : `${ride.name} wait ${liveVsPlan}m above plan — consider deferring`,
        estimatedMinutesSaved: alt
          ? Math.max(0, ride.wait_time - alt.wait_time)
          : 0,
        priority: "warning",
        alternativeRideId: alt?.ride_id,
        alternativeRideName: alt?.name,
        reasoning,
        confidenceScore: altIntel?.confidenceScore ?? confScore,
        confidenceLabel: altIntel?.confidenceLabel ?? confLabel,
      });
    }
  }

  const seen = new Set<number>();
  return suggestions
    .sort((a, b) => {
      const order = { urgent: 0, opportunity: 1, warning: 2 };
      return order[a.priority] - order[b.priority];
    })
    .filter((s) => {
      if (seen.has(s.rideId)) return false;
      seen.add(s.rideId);
      return true;
    })
    .slice(0, 6);
}

function findBestAlternative(
  triggerRide: RideWithLiveData,
  rides: RideWithLiveData[],
  intelligenceByRide: Record<number, RideIntelligence>,
  exclude: Set<number>,
  preferredLand: string | null
): RideWithLiveData | null {
  const scoreRide = (r: RideWithLiveData) => {
    const intel = intelligenceByRide[r.ride_id];
    const travel = getLandTravelMinutes(preferredLand, r.land);
    const opp = intel?.opportunityScore ?? 0;
    const travelPenalty = Math.min(20, travel * 2);
    return opp - travelPenalty;
  };

  const sameLand = rides
    .filter(
      (r) =>
        r.is_open &&
        r.land === triggerRide.land &&
        r.ride_id !== triggerRide.ride_id &&
        !exclude.has(r.ride_id)
    )
    .sort((a, b) => scoreRide(b) - scoreRide(a));

  if (sameLand[0]) return sameLand[0];

  return (
    rides
      .filter((r) => r.is_open && !exclude.has(r.ride_id))
      .sort((a, b) => scoreRide(b) - scoreRide(a))[0] ?? null
  );
}
