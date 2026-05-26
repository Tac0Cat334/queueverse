import type {
  RideIntelligence,
  RideWithLiveData,
  TrendDirection,
} from "@/types";
import { getOperationalPhase } from "@/lib/analytics/operational-phases";
import { getDefaultPark } from "@/lib/parks";

export type CrowdPhase =
  | "opening"
  | "building"
  | "peak"
  | "declining"
  | "closing";

export interface CrowdProgressionInsight {
  phase: CrowdPhase;
  label: string;
  message: string;
  parkAverageTrend: TrendDirection;
  averageWait: number;
  openRideCount: number;
}

function phaseFromHour(hour: number): {
  phase: CrowdPhase;
  label: string;
  message: string;
} {
  const park = getDefaultPark();
  const op = getOperationalPhase(hour, park);

  switch (op.phase) {
    case "early_entry":
      return {
        phase: "opening",
        label: op.label,
        message:
          "Early Entry window — prioritize headliners before general admission crowds",
      };
    case "rope_drop":
      return {
        phase: "building",
        label: op.label,
        message: op.message,
      };
    case "morning_peak":
      return {
        phase: "building",
        label: op.label,
        message: op.message,
      };
    case "midday_peak":
      return {
        phase: "peak",
        label: op.label,
        message: op.message,
      };
    case "evening_drop":
      return hour >= 19
        ? {
            phase: "closing",
            label: op.label,
            message: "Late day — shorter waits possible on remaining open rides",
          }
        : {
            phase: "declining",
            label: op.label,
            message: op.message,
          };
    default:
      return {
        phase: "building",
        label: op.label,
        message: op.message,
      };
  }
}

/** Park-wide crowd progression from live ride intelligence */
export function analyzeCrowdProgression(
  rides: RideWithLiveData[],
  intelligenceByRide: Record<number, RideIntelligence>,
  parkHour: number
): CrowdProgressionInsight {
  const open = rides.filter((r) => r.is_open);
  const avgWait =
    open.length > 0
      ? Math.round(
          open.reduce((s, r) => s + r.wait_time, 0) / open.length
        )
      : 0;

  const trends = open
    .map((r) => intelligenceByRide[r.ride_id]?.trend.trend)
    .filter(Boolean);

  const rising = trends.filter(
    (t) => t === "rising_fast" || t === "up"
  ).length;
  const falling = trends.filter(
    (t) => t === "falling_fast" || t === "down"
  ).length;

  let parkAverageTrend: TrendDirection = "flat";
  if (rising > falling + 2) parkAverageTrend = "up";
  else if (falling > rising + 2) parkAverageTrend = "down";
  else if (rising > open.length * 0.4) parkAverageTrend = "rising_fast";

  const phaseInfo = phaseFromHour(parkHour);

  return {
    phase: phaseInfo.phase,
    label: phaseInfo.label,
    message: phaseInfo.message,
    parkAverageTrend,
    averageWait: avgWait,
    openRideCount: open.length,
  };
}

export function computeOptimizationIndex(
  intelligence: RideIntelligence[]
): number {
  const open = intelligence.filter((i) => i.isOpen);
  if (!open.length) return 0;

  const avgOpportunity =
    open.reduce((s, i) => s + i.opportunityScore, 0) / open.length;

  const strongWindows = open.filter(
    (i) =>
      (i.vsAveragePercent ?? 0) >= 15 ||
      (i.earlyEntryVsAveragePercent ?? 0) >= 10 ||
      i.opportunityScore >= 70
  ).length;

  const windowBonus = (strongWindows / open.length) * 25;
  return Math.round(Math.min(100, avgOpportunity * 0.75 + windowBonus));
}
