import type { RideWithLiveData, RideIntelligence, TouringPreference, TouringPlanMode } from "@/types";
import { getLandFlowPenalty, getLandTravelMinutes } from "./lands";

const RIDE_DURATION_MIN = 8;

export { RIDE_DURATION_MIN };

export interface RideScheduleScore {
  rideId: number;
  totalScore: number;
  urgencyScore: number;
  opportunityScore: number;
  timingScore: number;
  landScore: number;
  preferenceScore: number;
  estimatedWait: number;
  predictedWaitLater: number;
  vsAveragePercent: number | null;
  priority: "high" | "normal" | "flexible";
  priorityLabel: string;
  reason: string;
}

function waitAtHour(intel: RideIntelligence | undefined, hour: number, fallback: number): number {
  const entry = intel?.hourlyPattern.find((h) => h.hour === hour);
  return entry?.average ?? fallback;
}

function waitAtMinutes(
  intel: RideIntelligence | undefined,
  ride: RideWithLiveData,
  cursorMinutes: number,
  minutesAhead: number
): number {
  const targetMinutes = cursorMinutes + minutesAhead;
  const hour = Math.floor(targetMinutes / 60) % 24;
  const base = waitAtHour(intel, hour, ride.wait_time);

  if (!intel) return base;

  const trend = intel.trend;
  const steps = minutesAhead / 5;
  const trendPer5 = trend.change / 4;
  const trendEst = ride.wait_time + trendPer5 * steps;

  return Math.round(base * 0.6 + trendEst * 0.4);
}

function computeUrgency(
  ride: RideWithLiveData,
  intel: RideIntelligence | undefined,
  cursorMinutes: number
): { score: number; predictedLater: number; reason: string } {
  if (!intel || !ride.is_open) {
    return {
      score: ride.is_open ? 20 : 5,
      predictedLater: ride.wait_time,
      reason: ride.is_open ? "Schedule when convenient" : "May reopen — monitor status",
    };
  }

  const hour = Math.floor(cursorMinutes / 60) % 24;
  const waitNow = waitAtMinutes(intel, ride, cursorMinutes, 0);
  const waitIn60 = waitAtMinutes(intel, ride, cursorMinutes, 60);
  const predicted30 = intel.predictedWait30 ?? waitIn60;

  let score = 0;
  const reasons: string[] = [];

  const spikeRisk = waitIn60 - waitNow;
  if (spikeRisk >= 20) {
    score += 35;
    reasons.push(`Expected to rise to ~${waitIn60}m within an hour`);
  } else if (spikeRisk >= 10) {
    score += 22;
    reasons.push("Crowds likely building soon");
  }

  if (
    intel.trend.trend === "rising_fast" ||
    (intel.trend.trend === "up" && intel.trend.change >= 8)
  ) {
    score += 18;
    reasons.push("Wait rising faster than usual");
  }

  const peakHour = intel.hourlyPattern.reduce(
    (max, h) => (h.average > max.average ? h : max),
    intel.hourlyPattern[0]
  );
  if (peakHour && peakHour.hour > hour && peakHour.hour - hour <= 3) {
    score += 12;
    reasons.push(`Peak window around ${peakHour.label}`);
  }

  if (intel.vsAveragePercent !== null && intel.vsAveragePercent >= 15) {
    score += 15;
    reasons.push(`Currently ${intel.vsAveragePercent}% below normal`);
  }

  return {
    score: Math.min(40, score),
    predictedLater: waitIn60 || predicted30,
    reason: reasons[0] ?? "Standard priority",
  };
}

function computeTimingScore(
  intel: RideIntelligence | undefined,
  ride: RideWithLiveData,
  cursorMinutes: number
): number {
  if (!intel?.hourlyPattern.length) return 10;

  const hour = Math.floor(cursorMinutes / 60) % 24;
  const waitNow = waitAtHour(intel, hour, ride.wait_time);
  const waitLater = waitAtHour(intel, Math.min(hour + 2, 22), ride.wait_time);

  if (waitNow <= waitLater - 15) return 20;
  if (waitNow <= waitLater - 8) return 14;
  if (waitNow > waitLater + 10) return 4;
  return 10;
}

function computePreferenceScore(
  ride: RideWithLiveData,
  intel: RideIntelligence | undefined,
  preference: TouringPreference,
  cursorMinutes: number
): number {
  if (preference === "mixed") return 0;

  const hour = Math.floor(cursorMinutes / 60) % 24;
  const isEarlyDay = hour <= 11;
  const peak = intel?.peakTimeAverage ?? ride.wait_time;
  const volatility = intel?.volatilityScore ?? 50;

  if (preference === "thrill") {
    let score = Math.min(15, Math.round(peak / 6));
    if (isEarlyDay && volatility >= 50) score += 8;
    return score;
  }

  // Family — prefer lower-intensity / shorter waits
  if (peak <= 30) return 12;
  if (peak <= 45) return 6;
  return 0;
}

function buildPriorityLabel(
  urgency: number,
  vsAverage: number | null,
  trend: RideIntelligence["trend"] | undefined
): { priority: RideScheduleScore["priority"]; label: string } {
  if (urgency >= 30 || (vsAverage !== null && vsAverage >= 25)) {
    return { priority: "high", label: "High priority" };
  }
  if (
    trend?.trend === "rising_fast" ||
    (vsAverage !== null && vsAverage >= 12)
  ) {
    return { priority: "normal", label: "Good window" };
  }
  return { priority: "flexible", label: "Flexible timing" };
}

function buildScheduleReason(
  intel: RideIntelligence | undefined,
  urgencyReason: string,
  estimatedWait: number,
  hour: number
): string {
  if (!intel) return urgencyReason;

  const parts: string[] = [];

  if (intel.vsAveragePercent !== null && intel.vsAveragePercent >= 10) {
    parts.push(`${intel.vsAveragePercent}% below normal`);
  }

  if (urgencyReason && urgencyReason !== "Standard priority") {
    parts.push(urgencyReason);
  }

  const hourEntry = intel.hourlyPattern.find((h) => h.hour === hour);
  if (hourEntry && estimatedWait < hourEntry.average - 10) {
    parts.push(`Better than typical ${hourEntry.label} average`);
  }

  if (intel.predictedWait30 !== null && intel.predictedWait30 >= intel.currentWait + 12) {
    parts.push("Expected crowds increasing soon");
  }

  if (parts.length === 0) {
    return `~${estimatedWait} min expected around this time`;
  }

  return parts.slice(0, 2).join(" · ");
}

export function scoreRideForSchedule(params: {
  ride: RideWithLiveData;
  intel: RideIntelligence | undefined;
  cursorMinutes: number;
  lastLand: string | null;
  preference: TouringPreference;
  expressPass: boolean;
  planMode?: TouringPlanMode;
}): RideScheduleScore {
  const { ride, intel, cursorMinutes, lastLand, preference, expressPass, planMode = "live" } = params;
  const hour = Math.floor(cursorMinutes / 60) % 24;

  const urgency = computeUrgency(ride, intel, cursorMinutes);
  const opportunityBase = intel?.opportunityScore ?? 30;
  const timingScore = computeTimingScore(intel, ride, cursorMinutes);
  const landPenalty = getLandFlowPenalty(lastLand, ride.land);
  const landScore = Math.max(0, 15 - landPenalty);
  const preferenceScore = computePreferenceScore(ride, intel, preference, cursorMinutes);

  let estimatedWait = waitAtMinutes(intel, ride, cursorMinutes, 0);
  if (ride.is_open) {
    if (planMode === "live") {
      // In-park mode: current wait is the primary signal
      estimatedWait = Math.round(ride.wait_time * 0.85 + estimatedWait * 0.15);
    } else {
      estimatedWait = Math.round(estimatedWait * 0.5 + ride.wait_time * 0.5);
    }
  }
  if (expressPass) {
    estimatedWait = Math.round(estimatedWait * 0.4);
  }

  const totalScore =
    urgency.score +
    Math.round(opportunityBase * (planMode === "live" ? 0.35 : 0.25)) +
    timingScore +
    landScore +
    preferenceScore -
    (ride.is_open ? 0 : 25);

  const { priority, label } = buildPriorityLabel(
    urgency.score,
    intel?.vsAveragePercent ?? null,
    intel?.trend
  );

  return {
    rideId: ride.ride_id,
    totalScore,
    urgencyScore: urgency.score,
    opportunityScore: Math.round(opportunityBase * 0.25),
    timingScore,
    landScore,
    preferenceScore,
    estimatedWait: Math.max(0, estimatedWait),
    predictedWaitLater: urgency.predictedLater,
    vsAveragePercent: intel?.vsAveragePercent ?? null,
    priority,
    priorityLabel: label,
    reason: buildScheduleReason(intel, urgency.reason, estimatedWait, hour),
  };
}

export function findPeakLunchHour(
  rides: RideWithLiveData[],
  intelligenceByRide: Record<number, RideIntelligence>,
  arrivalHour: number,
  preferredLunchHour: number
): number {
  const hourTotals = new Map<number, number>();
  const hourCounts = new Map<number, number>();

  for (const ride of rides) {
    const intel = intelligenceByRide[ride.ride_id];
    if (!intel) continue;
    for (const entry of intel.hourlyPattern) {
      if (entry.hour < arrivalHour) continue;
      hourTotals.set(entry.hour, (hourTotals.get(entry.hour) ?? 0) + entry.average);
      hourCounts.set(entry.hour, (hourCounts.get(entry.hour) ?? 0) + 1);
    }
  }

  let peakHour = preferredLunchHour;
  let peakAvg = -1;

  for (const [hour, total] of hourTotals.entries()) {
    const count = hourCounts.get(hour) ?? 1;
    const avg = total / count;
    if (avg > peakAvg && hour >= arrivalHour) {
      peakAvg = avg;
      peakHour = hour;
    }
  }

  return Math.max(preferredLunchHour, peakHour);
}

export function getRideBlockMinutes(
  estimatedWait: number,
  fromLand: string | null,
  toLand: string
): number {
  return estimatedWait + RIDE_DURATION_MIN + getLandTravelMinutes(fromLand, toLand);
}
