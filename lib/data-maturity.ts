import type { WaitTimeRecord } from "@/types";
import type { DataMaturityMetrics } from "@/types";
import { getParkDateKey, getParkDayOfWeek } from "@/lib/park-time";
import { recencyWeight } from "@/lib/analytics/recency";

export function countUniqueParkDays(records: WaitTimeRecord[]): number {
  const days = new Set<string>();
  for (const record of records) {
    days.add(getParkDateKey(record.timestamp));
  }
  return days.size;
}

export function countUniqueParkDaysForRide(records: WaitTimeRecord[]): number {
  return countUniqueParkDays(records);
}

export interface WeightedAverage {
  average: number;
  effectiveSampleCount: number;
  rawSampleCount: number;
}

export function computeRecencyWeightedAverage(
  records: WaitTimeRecord[],
  reference = new Date()
): WeightedAverage | null {
  const open = records.filter((r) => r.is_open);
  if (open.length === 0) return null;

  let weightedSum = 0;
  let weightTotal = 0;

  for (const record of open) {
    const weight = recencyWeight(new Date(record.timestamp), reference);
    weightedSum += record.wait_time * weight;
    weightTotal += weight;
  }

  if (weightTotal <= 0) return null;

  return {
    average: Math.round(weightedSum / weightTotal),
    effectiveSampleCount: Math.round(weightTotal),
    rawSampleCount: open.length,
  };
}

export interface RideConfidenceMetrics {
  /** 0–100 — confidence in this ride's predictions right now */
  confidenceScore: number;
  confidenceLevel: "low" | "moderate" | "high";
  confidenceLabel: string;
  snapshotCount: number;
  uniqueDays: number;
  slotSampleCount: number;
}

function maturityTier(score: number): DataMaturityMetrics["maturityLevel"] {
  if (score >= 80) return "expert";
  if (score >= 55) return "reliable";
  if (score >= 25) return "developing";
  return "learning";
}

function maturityLabel(level: DataMaturityMetrics["maturityLevel"]): string {
  switch (level) {
    case "expert":
      return "Expert";
    case "reliable":
      return "Reliable";
    case "developing":
      return "Developing";
    default:
      return "Learning";
  }
}

function nextTierInfo(score: number): {
  daysToNextTier: number | null;
  nextTierLabel: string | null;
} {
  if (score >= 80) return { daysToNextTier: null, nextTierLabel: null };
  if (score >= 55) {
    return {
      daysToNextTier: Math.max(1, Math.ceil((80 - score) / 2.5)),
      nextTierLabel: "Expert",
    };
  }
  if (score >= 25) {
    return {
      daysToNextTier: Math.max(1, Math.ceil((55 - score) / 2.5)),
      nextTierLabel: "Reliable",
    };
  }
  return {
    daysToNextTier: Math.max(1, Math.ceil((25 - score) / 2.5)),
    nextTierLabel: "Developing",
  };
}

function buildMaturityMessage(
  level: DataMaturityMetrics["maturityLevel"],
  uniqueDays: number,
  totalSnapshots: number
): string {
  switch (level) {
    case "expert":
      return `Deep history across ${uniqueDays} days and ${totalSnapshots.toLocaleString()} snapshots — predictions use weekday patterns and recency weighting.`;
    case "reliable":
      return `${uniqueDays} days of data — weekday and time-slot patterns are active. Accuracy improves daily.`;
    case "developing":
      return `${uniqueDays} day${uniqueDays === 1 ? "" : "s"} collected — basic patterns emerging. More park days = sharper predictions.`;
    default:
      return "Still learning the park — every 5-minute snapshot makes recommendations smarter.";
  }
}

export function computeParkDataMaturity(
  allRecords: WaitTimeRecord[],
  totalRides: number,
  recordsByRide: Map<number, WaitTimeRecord[]>
): DataMaturityMetrics {
  const totalSnapshots = allRecords.length;
  const uniqueDays = countUniqueParkDays(allRecords);
  const ridesWithData = Array.from(recordsByRide.values()).filter(
    (r) => r.length >= 6
  ).length;

  const timestamps = allRecords.map((r) => new Date(r.timestamp).getTime());
  const oldestSnapshot =
    timestamps.length > 0
      ? new Date(Math.min(...timestamps)).toISOString()
      : null;
  const newestSnapshot =
    timestamps.length > 0
      ? new Date(Math.max(...timestamps)).toISOString()
      : null;

  // Maturity grows with days (40%), snapshots (35%), ride coverage (25%)
  const dayScore = Math.min(40, Math.round((uniqueDays / 21) * 40));
  const snapshotScore = Math.min(35, Math.round((totalSnapshots / 2000) * 35));
  const coverageScore =
    totalRides > 0
      ? Math.min(25, Math.round((ridesWithData / totalRides) * 25))
      : 0;

  const maturityScore = Math.min(
    100,
    dayScore + snapshotScore + coverageScore
  );
  const level = maturityTier(maturityScore);
  const { daysToNextTier, nextTierLabel } = nextTierInfo(maturityScore);

  return {
    maturityScore,
    maturityLevel: level,
    maturityLabel: maturityLabel(level),
    totalSnapshots,
    uniqueDays,
    ridesWithData,
    totalRides,
    oldestSnapshot,
    newestSnapshot,
    daysToNextTier,
    nextTierLabel,
    message: buildMaturityMessage(level, uniqueDays, totalSnapshots),
  };
}

export function computeRideConfidence(
  records: WaitTimeRecord[],
  slotSampleCount: number
): RideConfidenceMetrics {
  const snapshotCount = records.length;
  const uniqueDays = countUniqueParkDaysForRide(records);

  // Confidence from total history (40%), unique days (35%), current slot samples (25%)
  const volumeScore = Math.min(40, Math.round((snapshotCount / 120) * 40));
  const dayScore = Math.min(35, Math.round((uniqueDays / 14) * 35));
  const slotScore = Math.min(25, Math.round((slotSampleCount / 8) * 25));

  const confidenceScore = Math.min(
    100,
    volumeScore + dayScore + slotScore
  );

  const confidenceLevel: RideConfidenceMetrics["confidenceLevel"] =
    confidenceScore >= 65
      ? "high"
      : confidenceScore >= 35
        ? "moderate"
        : "low";

  const confidenceLabel =
    confidenceLevel === "high"
      ? "High confidence"
      : confidenceLevel === "moderate"
        ? "Moderate confidence"
        : "Building baseline";

  return {
    confidenceScore,
    confidenceLevel,
    confidenceLabel,
    snapshotCount,
    uniqueDays,
    slotSampleCount,
  };
}

export function isWeekendDay(date: Date | string): boolean {
  const dow = getParkDayOfWeek(date);
  return dow === 0 || dow === 6;
}

export function getWeekdayLabel(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
  });
}

export const EMPTY_DATA_MATURITY: DataMaturityMetrics = {
  maturityScore: 0,
  maturityLevel: "learning",
  maturityLabel: "Learning",
  totalSnapshots: 0,
  uniqueDays: 0,
  ridesWithData: 0,
  totalRides: 0,
  oldestSnapshot: null,
  newestSnapshot: null,
  daysToNextTier: 3,
  nextTierLabel: "Developing",
  message: "Still learning the park — every 5-minute snapshot makes recommendations smarter.",
};
