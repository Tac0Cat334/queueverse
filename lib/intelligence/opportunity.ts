import type { TrendInfo } from "@/types";

export type OpportunityTierId = "excellent" | "good" | "fair" | "poor";

export interface OpportunityTier {
  tier: OpportunityTierId;
  label: string;
}

export function classifyOpportunityTier(
  score: number,
  vsAveragePercent: number | null
): OpportunityTier {
  if (score >= 80 || (vsAveragePercent !== null && vsAveragePercent >= 35)) {
    return { tier: "excellent", label: "Excellent opportunity" };
  }
  if (score >= 65 || (vsAveragePercent !== null && vsAveragePercent >= 20)) {
    return { tier: "good", label: "Good opportunity" };
  }
  if (score >= 45 || (vsAveragePercent !== null && vsAveragePercent >= 8)) {
    return { tier: "fair", label: "Fair timing" };
  }
  return { tier: "poor", label: "Below average timing" };
}

/** Minutes saved vs riding at typical wait for this time slot */
export function estimateMinutesSavedVsTypical(
  currentWait: number,
  historicalAverage: number | null,
  isOpen: boolean
): number | null {
  if (!isOpen || historicalAverage === null || historicalAverage <= 0) {
    return null;
  }
  const saved = historicalAverage - currentWait;
  return saved > 0 ? Math.round(saved) : 0;
}

export interface OpportunityScoreInput {
  currentWait: number;
  historicalAvg: number | null;
  trend: TrendInfo;
  volatility: number;
  waitDrop: boolean;
  isOpen: boolean;
  popularityPercentile: number;
  confidenceScore: number;
  trendVelocity?: number;
  earlyEntryActive?: boolean;
  earlyEntryBaseline?: number | null;
  waitInflationScore?: number;
  isHeadliner?: boolean;
}

/** Dynamic 0–100 score — foundation for recommendations and rerouting */
export function computeOpportunityScore(params: OpportunityScoreInput): number {
  if (!params.isOpen) return 0;

  const baseline =
    params.earlyEntryActive && params.earlyEntryBaseline != null
      ? params.earlyEntryBaseline
      : params.historicalAvg;

  let score = 40;

  if (baseline !== null && baseline > 0) {
    const ratio = params.currentWait / baseline;
    if (ratio <= 1) {
      score += Math.min(35, Math.round((1 - ratio) * 70));
    } else {
      score -= Math.min(25, Math.round((ratio - 1) * 40));
    }
  }

  if (params.waitDrop) score += 18;

  if (params.currentWait <= 20) score += 12;
  else if (params.currentWait <= 35) score += 6;

  if (
    params.trend.trend === "rising_fast" ||
    (params.trend.trend === "up" && params.trend.change >= 8)
  ) {
    if (baseline !== null && params.currentWait < baseline) {
      score += 12;
    } else {
      score -= 8;
    }
  }

  if (params.trend.trend === "falling_fast" || params.trend.trend === "down") {
    score += 6;
  }

  score += Math.round((1 - params.popularityPercentile) * 8);
  score += Math.round((params.volatility / 100) * 6);

  if (params.trendVelocity !== undefined && params.trendVelocity < -5) {
    score += 4;
  }

  if (params.earlyEntryActive && params.waitInflationScore !== undefined) {
    score += Math.round(params.waitInflationScore * 0.25);
    if (params.isHeadliner && params.waitInflationScore >= 40) {
      score += 12;
    }
    if (baseline !== null && params.currentWait <= baseline + 15) {
      score += 8;
    }
  }

  const confidenceMultiplier = 0.55 + (params.confidenceScore / 100) * 0.45;
  score = Math.round(40 + (score - 40) * confidenceMultiplier);

  return Math.max(0, Math.min(100, Math.round(score)));
}
