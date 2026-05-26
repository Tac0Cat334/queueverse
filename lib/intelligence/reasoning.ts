import type {
  RideIntelligence,
  RecommendationReasoning,
  TrendInfo,
} from "@/types";
import type { RideHistoricalBaseline } from "@/lib/analytics/baselines";
import { getWeekdayLabel } from "@/lib/data-maturity";
import { getParkDayOfWeek } from "@/lib/park-time";

function isWeekend(reference = new Date()): boolean {
  const dow = getParkDayOfWeek(reference);
  return dow === 0 || dow === 6;
}

/** Human-readable bullets explaining why a ride is recommended */
export function buildOpportunityReasoning(
  intel: Pick<
    RideIntelligence,
    | "currentWait"
    | "historicalAverage"
    | "vsAveragePercent"
    | "earlyEntryVsAveragePercent"
    | "earlyEntryBaseline"
    | "earlyEntry"
    | "waitInflation"
    | "trend"
    | "waitDrop"
    | "bestTimeToRide"
    | "peakTimeToRide"
    | "predictedWait30"
    | "predictedWait60"
    | "volatilityScore"
    | "baselineSource"
    | "slotSampleCount"
    | "dataDays"
  >,
  baseline?: RideHistoricalBaseline | null
): RecommendationReasoning {
  const bullets: string[] = [];

  const vsAvg =
    intel.earlyEntry?.active && intel.earlyEntryVsAveragePercent != null
      ? intel.earlyEntryVsAveragePercent
      : intel.vsAveragePercent;

  if (vsAvg !== null && vsAvg >= 8) {
    const label = intel.earlyEntry?.active ? "Early Entry" : "typical";
    bullets.push(
      `${vsAvg}% below ${label} for this time (${intel.earlyEntry?.active ? intel.earlyEntryBaseline : intel.historicalAverage}m average)`
    );
  } else if (vsAvg !== null && vsAvg <= -12) {
    bullets.push(
      `${Math.abs(vsAvg)}% above typical — not an ideal window`
    );
  }

  if (intel.waitDrop) {
    bullets.push(intel.waitDrop.message);
  }

  if (
    intel.trend.trend === "rising_fast" ||
    (intel.trend.trend === "up" && intel.trend.change >= 8)
  ) {
    if (intel.predictedWait30 !== null && intel.predictedWait30 > intel.currentWait + 8) {
      bullets.push(
        `Usually spikes soon — trending toward ~${intel.predictedWait30}m`
      );
    } else {
      bullets.push(`${intel.trend.label} — crowds building`);
    }
  } else if (
    intel.trend.trend === "falling_fast" ||
    intel.trend.trend === "down"
  ) {
    bullets.push("Wait falling — window may improve if you can wait briefly");
  }

  if (intel.peakTimeToRide && intel.bestTimeToRide) {
    if (intel.currentWait <= (intel.historicalAverage ?? intel.currentWait)) {
      bullets.push(`Historically lowest around ${intel.bestTimeToRide}`);
    }
  }

  if (baseline) {
    const dowLabel = getWeekdayLabel(new Date());
    const dowAvg = isWeekend()
      ? baseline.weekendAverageAtHour
      : baseline.weekdayAverageAtHour;
    if (dowAvg !== null && intel.currentWait < dowAvg - 10) {
      bullets.push(
        `${dowLabel} average at this hour: ~${dowAvg}m — currently better`
      );
    }
  }

  if (intel.earlyEntry?.active && intel.waitInflation.isHeadliner) {
    bullets.push("Best opening-hour opportunity — historically spikes after general opening");
  } else if (intel.earlyEntry?.active && intel.waitInflation.score >= 45) {
    bullets.push(`Strong Early Entry timing — ${intel.waitInflation.message}`);
  } else if (intel.waitInflation.score >= 55) {
    bullets.push(intel.waitInflation.message);
  }

  if (intel.volatilityScore >= 65) {
    bullets.push("High volatility ride — windows shift quickly");
  }

  const dataNote =
    intel.slotSampleCount >= 4
      ? `Based on ${intel.slotSampleCount} snapshots for this time slot`
      : intel.dataDays >= 3
        ? `Based on ${intel.dataDays} days of park data`
        : "Limited historical data — treat as directional";

  const headline =
    intel.vsAveragePercent !== null && intel.vsAveragePercent >= 20
      ? "Strong opportunity vs typical"
      : intel.vsAveragePercent !== null && intel.vsAveragePercent >= 8
        ? "Better than usual for right now"
        : bullets.length > 0
          ? "Worth considering now"
          : "Typical conditions";

  return {
    headline,
    bullets: bullets.slice(0, 4),
    dataNote,
    baselineSource: intel.baselineSource,
  };
}

export function buildUrgencyReasoning(
  intel: Pick<
    RideIntelligence,
    | "rideName"
    | "currentWait"
    | "predictedWait30"
    | "predictedWait60"
    | "vsAveragePercent"
    | "trend"
    | "urgencyScore"
  >
): RecommendationReasoning {
  const bullets: string[] = [];
  const rise60 =
    (intel.predictedWait60 ?? intel.currentWait) - intel.currentWait;

  if (rise60 >= 15) {
    bullets.push(
      `Expected ~${intel.predictedWait60}m within an hour (+${rise60}m from now)`
    );
  }

  if (intel.vsAveragePercent !== null && intel.vsAveragePercent >= 15) {
    bullets.push("Below-normal window may not last");
  }

  if (
    intel.trend.trend === "rising_fast" ||
    (intel.trend.trend === "up" && intel.trend.change >= 10)
  ) {
    bullets.push(intel.trend.label);
  }

  const headline =
    intel.urgencyScore >= 70
      ? "Ride soon before conditions worsen"
      : intel.urgencyScore >= 45
        ? "Good timing — monitor for changes"
        : "Flexible timing";

  return {
    headline,
    bullets: bullets.slice(0, 3),
    dataNote: "Urgency reflects live trend + predicted movement",
    baselineSource: null,
  };
}

export function buildRerouteReasoning(params: {
  triggerRideName: string;
  triggerWait: number;
  planWait: number;
  alternativeName?: string;
  alternativeWait?: number;
  vsAveragePercent?: number | null;
  trend?: TrendInfo;
  type: "spike" | "closure" | "opportunity" | "defer";
  earlyEntry?: boolean;
  waitInflationMessage?: string;
}): RecommendationReasoning {
  const bullets: string[] = [];
  const delta = params.triggerWait - params.planWait;

  if (params.earlyEntry) {
    bullets.push("Optimized for Early Entry — protect opening-hour windows");
  }

  if (params.waitInflationMessage) {
    bullets.push(params.waitInflationMessage);
  }

  if (params.type === "spike" && delta >= 10) {
    bullets.push(
      `${params.triggerRideName} increased from ~${params.planWait}m → ${params.triggerWait}m`
    );
  }

  if (params.type === "closure") {
    bullets.push(`${params.triggerRideName} is currently closed`);
  }

  if (
    params.alternativeName &&
    params.alternativeWait !== undefined &&
    params.vsAveragePercent != null &&
    params.vsAveragePercent >= 15
  ) {
    bullets.push(
      `${params.alternativeName} at ${params.alternativeWait}m — ${params.vsAveragePercent}% below typical`
    );
  } else if (params.alternativeName && params.alternativeWait !== undefined) {
    bullets.push(
      `${params.alternativeName} at ${params.alternativeWait}m nearby`
    );
  }

  if (params.type === "defer" && delta >= 15) {
    bullets.push(`Wait ${delta}m above plan estimate — crowds may ease later`);
  }

  const headline =
    params.type === "closure"
      ? "Switch to an open alternative"
      : params.type === "spike"
        ? "Prioritize before the spike"
        : params.type === "opportunity"
          ? params.earlyEntry
            ? "Best opening-hour opportunity"
            : "Strong window — ride if next"
          : "Consider deferring";

  return {
    headline,
    bullets,
    dataNote: "Compared to your plan and live park conditions",
    baselineSource: null,
  };
}

export function mergeReasoningBullets(
  ...groups: RecommendationReasoning[]
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const group of groups) {
    for (const bullet of group.bullets) {
      if (!seen.has(bullet)) {
        seen.add(bullet);
        out.push(bullet);
      }
    }
  }
  return out.slice(0, 5);
}
