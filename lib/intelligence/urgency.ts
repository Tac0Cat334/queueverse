import type { RideIntelligence, TrendInfo } from "@/types";

export interface UrgencyResult {
  score: number;
  label: string;
  reason: string;
  predictedWait60: number | null;
}

function urgencyLabel(score: number): string {
  if (score >= 75) return "Act now";
  if (score >= 55) return "Ride soon";
  if (score >= 35) return "Monitor";
  return "Flexible";
}

/** How urgently a guest should ride before conditions worsen (0–100). */
export function computeRideUrgency(
  intel: Pick<
    RideIntelligence,
    | "currentWait"
    | "isOpen"
    | "predictedWait30"
    | "predictedWait60"
    | "vsAveragePercent"
    | "trend"
    | "hourlyPattern"
    | "peakTimeToRide"
  >
): UrgencyResult {
  if (!intel.isOpen) {
    return {
      score: 5,
      label: "Closed",
      reason: "Monitor for reopening",
      predictedWait60: null,
    };
  }

  let score = 20;
  const reasons: string[] = [];
  const predicted60 = intel.predictedWait60 ?? intel.currentWait;
  const spike = predicted60 - intel.currentWait;

  if (spike >= 25) {
    score += 35;
    reasons.push(`Expected ~${predicted60}m within an hour (+${spike}m)`);
  } else if (spike >= 15) {
    score += 25;
    reasons.push(`Likely rising toward ${predicted60}m`);
  } else if (spike >= 8) {
    score += 12;
    reasons.push("Crowds building gradually");
  }

  if (
    intel.trend.trend === "rising_fast" ||
    (intel.trend.trend === "up" && intel.trend.change >= 10)
  ) {
    score += 18;
    reasons.push(intel.trend.label);
  }

  if (intel.vsAveragePercent !== null && intel.vsAveragePercent >= 20) {
    score += 15;
    reasons.push(`${intel.vsAveragePercent}% below typical — window may close`);
  }

  if (intel.predictedWait30 !== null && intel.predictedWait30 >= intel.currentWait + 12) {
    score += 10;
    reasons.push(`~${intel.predictedWait30}m predicted in 30 min`);
  }

  const clamped = Math.max(0, Math.min(100, score));

  return {
    score: clamped,
    label: urgencyLabel(clamped),
    reason: reasons[0] ?? "Standard priority — no immediate spike detected",
    predictedWait60: intel.predictedWait60,
  };
}

export function computeTrendVelocity(trend: TrendInfo): number {
  switch (trend.trend) {
    case "rising_fast":
      return trend.change * 1.5;
    case "up":
      return trend.change;
    case "falling_fast":
      return -trend.change * 1.5;
    case "down":
      return -trend.change;
    default:
      return 0;
  }
}
