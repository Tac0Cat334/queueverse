import type { RideIntelligence } from "@/types";
import { isHeadlinerRide } from "@/lib/analytics/operational-phases";

export interface WaitInflationMetric {
  /** 0–100 — how much harder this ride gets later today */
  score: number;
  peakDeltaMinutes: number;
  predictedDelta60: number;
  message: string;
  isHeadliner: boolean;
}

/** Estimates future wait inflation — drives Early Entry prioritization */
export function computeWaitInflation(
  rideName: string,
  intel: Pick<
    RideIntelligence,
    | "currentWait"
    | "peakTimeAverage"
    | "predictedWait60"
    | "hourlyPattern"
    | "trend"
  >
): WaitInflationMetric {
  const isHeadliner = isHeadlinerRide(rideName);
  const peak = intel.peakTimeAverage ?? intel.currentWait;
  const peakDelta = Math.max(0, peak - intel.currentWait);
  const predictedDelta = Math.max(
    0,
    (intel.predictedWait60 ?? intel.currentWait) - intel.currentWait
  );

  const gaHour = intel.hourlyPattern.reduce(
    (max, h) => (h.average > max.average ? h : max),
    intel.hourlyPattern[0] ?? { hour: 14, average: intel.currentWait, label: "", count: 0 }
  );
  const riseToPeak = Math.max(0, gaHour.average - intel.currentWait);

  let score = 0;
  score += Math.min(40, Math.round(peakDelta * 0.6));
  score += Math.min(25, Math.round(predictedDelta * 0.8));
  score += Math.min(20, Math.round(riseToPeak * 0.35));

  if (
    intel.trend.trend === "rising_fast" ||
    (intel.trend.trend === "up" && intel.trend.change >= 10)
  ) {
    score += 12;
  }

  if (isHeadliner) score += 10;

  const clamped = Math.max(0, Math.min(100, score));

  let message: string;
  if (clamped >= 65) {
    message = `Historically spikes heavily later (+${peakDelta}m to peak)`;
  } else if (clamped >= 40) {
    message = `Wait likely to rise ~${Math.max(predictedDelta, Math.round(peakDelta * 0.5))}m+ later`;
  } else if (clamped >= 20) {
    message = "Moderate crowd build expected later";
  } else {
    message = "Relatively stable through the day";
  }

  return {
    score: clamped,
    peakDeltaMinutes: peakDelta,
    predictedDelta60: predictedDelta,
    message,
    isHeadliner,
  };
}
