import type {
  RideIntelligence,
  RideRecommendation,
  RideWithLiveData,
  NextBestAction,
  ParkStrategySnapshot,
} from "@/types";
import { getDefaultPark } from "@/lib/parks";
import { getParkParts } from "@/lib/park-time";
import { isEarlyEntryWindowHour } from "@/lib/analytics/operational-phases";
import {
  analyzeCrowdProgression,
  computeOptimizationIndex,
} from "./crowd-progression";

export const EMPTY_PARK_STRATEGY: ParkStrategySnapshot = {
  parkId: getDefaultPark().id,
  nextBestAction: null,
  topOpportunities: [],
  crowdProgression: {
    phase: "opening",
    label: "Analyzing",
    message: "Collecting live data — recommendations improve throughout the day.",
    parkAverageTrend: "flat",
    averageWait: 0,
    openRideCount: 0,
  },
  optimizationIndex: 0,
  strategistMessage:
    "Collecting live data — recommendations improve as the park day progresses.",
};

function buildNextBestAction(
  intelligence: RideIntelligence[]
): NextBestAction | null {
  const park = getDefaultPark();
  const inEarlyEntry = isEarlyEntryWindowHour(getParkParts(new Date()).hour, park);

  const candidates = intelligence
    .filter((i) => i.isOpen && i.confidenceLevel !== "low")
    .sort((a, b) => {
      const eeBoostA =
        inEarlyEntry && a.earlyEntry.eligible
          ? a.waitInflation.score * 0.3
          : 0;
      const eeBoostB =
        inEarlyEntry && b.earlyEntry.eligible
          ? b.waitInflation.score * 0.3
          : 0;
      const scoreA = a.opportunityScore * 0.6 + a.urgencyScore * 0.4 + eeBoostA;
      const scoreB = b.opportunityScore * 0.6 + b.urgencyScore * 0.4 + eeBoostB;
      return scoreB - scoreA;
    });

  const best = candidates[0];
  if (!best) return null;

  const action: NextBestAction["action"] =
    best.urgencyScore >= 70
      ? "ride_now"
      : best.urgencyScore >= 45
        ? "ride_soon"
        : best.opportunityScore >= 60
          ? "ride_soon"
          : "monitor";

  const headline =
    action === "ride_now"
      ? `Ride ${best.rideName} now`
      : action === "ride_soon"
        ? `${best.rideName} is a strong next pick`
        : `Keep ${best.rideName} on your radar`;

  return {
    rideId: best.rideId,
    rideName: best.rideName,
    land: best.land,
    action,
    headline,
    reason: best.reasoning.headline,
    reasoning: best.reasoning,
    opportunityScore: best.opportunityScore,
    urgencyScore: best.urgencyScore,
    currentWait: best.currentWait,
    predictedWait60: best.predictedWait60,
  };
}

function buildStrategistMessage(
  next: NextBestAction | null,
  optimizationIndex: number,
  crowdLabel: string
): string {
  if (!next) {
    return "Collecting live data — recommendations improve as the park day progresses.";
  }
  if (optimizationIndex >= 70) {
    return `${crowdLabel} · Multiple strong ride windows active. ${next.reason}.`;
  }
  if (next.urgencyScore >= 60) {
    const topReason = next.reasoning.bullets[0];
    return topReason
      ? `${next.headline} — ${topReason}`
      : `${next.headline} — ${next.reason}`;
  }
  const bullet = next.reasoning.bullets[0];
  return bullet ? `${crowdLabel} · ${bullet}` : `${crowdLabel} · ${next.reason}`;
}

/** Park-level strategist snapshot — answers "what should I do next?" */
export function buildParkStrategySnapshot(
  rides: RideWithLiveData[],
  intelligenceByRide: Record<number, RideIntelligence>,
  topOpportunities: RideRecommendation[]
): ParkStrategySnapshot {
  const park = getDefaultPark();
  const hour = getParkParts(new Date()).hour;
  const intelligence = Object.values(intelligenceByRide);
  const crowd = analyzeCrowdProgression(rides, intelligenceByRide, hour);
  const nextBestAction = buildNextBestAction(intelligence);
  const optimizationIndex = computeOptimizationIndex(intelligence);

  return {
    parkId: park.id,
    nextBestAction,
    topOpportunities: topOpportunities.slice(0, 5),
    crowdProgression: crowd,
    optimizationIndex,
    strategistMessage: buildStrategistMessage(
      nextBestAction,
      optimizationIndex,
      crowd.label
    ),
  };
}
