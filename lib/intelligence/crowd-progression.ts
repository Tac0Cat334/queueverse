import type {
  RideIntelligence,
  RideWithLiveData,
  TrendDirection,
} from "@/types";

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

function phaseFromHour(hour: number): CrowdPhase {
  if (hour < 10) return "opening";
  if (hour < 13) return "building";
  if (hour < 16) return "peak";
  if (hour < 19) return "declining";
  return "closing";
}

const PHASE_MESSAGES: Record<CrowdPhase, string> = {
  opening: "Early day — headliners often have their best windows now",
  building: "Crowds building — prioritize high-opportunity rides before spikes",
  peak: "Peak hours — use intelligence to find pockets of lower waits",
  declining: "Afternoon/evening — waits often ease on select rides",
  closing: "Late day — shorter waits possible on remaining open rides",
};

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

  const phase = phaseFromHour(parkHour);

  return {
    phase,
    label: phase.charAt(0).toUpperCase() + phase.slice(1),
    message: PHASE_MESSAGES[phase],
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
      (i.vsAveragePercent ?? 0) >= 15 || i.opportunityScore >= 70
  ).length;

  const windowBonus = (strongWindows / open.length) * 25;
  return Math.round(Math.min(100, avgOpportunity * 0.75 + windowBonus));
}
