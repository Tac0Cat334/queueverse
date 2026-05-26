import type { WaitTimeRecord, TrendInfo, WaitPredictionDetail } from "@/types";
import { getSmartSlotAverage } from "@/lib/time-buckets";
import { bucketRecordsByHour, type HourBucket } from "@/lib/time-buckets";

export interface PeakLowWindow {
  type: "peak" | "low";
  hour: number;
  label: string;
  average: number;
}

function confidenceFromFactors(params: {
  slotSampleCount: number;
  dataDays: number;
  volatility: number;
  trend: TrendInfo;
  minutesAhead: number;
}): { score: number; level: WaitPredictionDetail["confidenceLevel"]; label: string } {
  let score = 35;

  if (params.slotSampleCount >= 8) score += 25;
  else if (params.slotSampleCount >= 4) score += 15;
  else if (params.slotSampleCount >= 2) score += 8;

  if (params.dataDays >= 14) score += 20;
  else if (params.dataDays >= 7) score += 12;
  else if (params.dataDays >= 3) score += 6;

  if (params.volatility >= 70) score -= 12;
  else if (params.volatility <= 35) score += 8;

  if (
    params.trend.trend === "flat" ||
    params.trend.trend === "down" ||
    params.trend.trend === "up"
  ) {
    score += 6;
  } else {
    score -= 4;
  }

  if (params.minutesAhead > 45) score -= 8;

  const clamped = Math.max(15, Math.min(95, score));
  const level: WaitPredictionDetail["confidenceLevel"] =
    clamped >= 70 ? "high" : clamped >= 45 ? "moderate" : "low";
  const label =
    level === "high"
      ? "High confidence"
      : level === "moderate"
        ? "Medium confidence"
        : "Low confidence — limited data";

  return { score: clamped, level, label };
}

function roundToNearestFive(n: number): number {
  return Math.round(n / 5) * 5;
}

/** Core numeric prediction — blends live trend with historical slot average */
export function predictWaitAt(
  records: WaitTimeRecord[],
  currentWait: number,
  minutesAhead: number,
  trend: TrendInfo,
  confidenceScore = 50
): number {
  const targetTime = new Date(Date.now() + minutesAhead * 60 * 1000);
  const historical = getSmartSlotAverage(records, targetTime, 2);
  const historicalAvg = historical?.average ?? currentWait;

  const trendPer5Min = trend.change / 4;
  const steps = minutesAhead / 5;
  const trendEstimate = currentWait + trendPer5Min * steps;

  const confidenceFactor = confidenceScore / 100;
  const baseTrendWeight = minutesAhead <= 30 ? 0.5 : 0.32;
  const trendWeight = baseTrendWeight * (1.15 - confidenceFactor * 0.45);
  const prediction = Math.round(
    trendWeight * trendEstimate + (1 - trendWeight) * historicalAvg
  );

  return Math.max(0, prediction);
}

export function buildWaitPredictionDetail(params: {
  records: WaitTimeRecord[];
  currentWait: number;
  minutesAhead: number;
  trend: TrendInfo;
  slotSampleCount: number;
  dataDays: number;
  volatility: number;
  isOpen: boolean;
}): WaitPredictionDetail {
  const {
    records,
    currentWait,
    minutesAhead,
    trend,
    slotSampleCount,
    dataDays,
    volatility,
    isOpen,
  } = params;

  if (!isOpen) {
    return {
      minutesAhead,
      direction: "stable",
      summary: "Ride is currently closed",
      estimatedWait: null,
      estimatedRange: null,
      confidenceScore: 20,
      confidenceLevel: "low",
      confidenceLabel: "Low confidence",
      factors: ["Ride closed — no live prediction"],
    };
  }

  const confidence = confidenceFromFactors({
    slotSampleCount,
    dataDays,
    volatility,
    trend,
    minutesAhead,
  });

  const rawEstimate = predictWaitAt(
    records,
    currentWait,
    minutesAhead,
    trend,
    confidence.score
  );

  const delta = rawEstimate - currentWait;
  const direction: WaitPredictionDetail["direction"] =
    delta >= 8 ? "rising" : delta <= -8 ? "falling" : "stable";

  const spread = Math.round(8 + volatility * 0.12 + (100 - confidence.score) * 0.08);
  const range =
    confidence.level === "low"
      ? null
      : {
          low: Math.max(0, roundToNearestFive(rawEstimate - spread)),
          high: roundToNearestFive(rawEstimate + spread),
        };

  const rounded = roundToNearestFive(rawEstimate);
  const factors: string[] = [];

  const targetTime = new Date(Date.now() + minutesAhead * 60 * 1000);
  const historical = getSmartSlotAverage(records, targetTime, 2);
  if (historical) {
    factors.push(
      `Historical average ~${historical.average}m at that time (${historical.sampleCount} samples)`
    );
  }

  if (Math.abs(trend.change) >= 5) {
    factors.push(`Recent trend: ${trend.label}`);
  }

  if (volatility >= 60) {
    factors.push("Higher volatility — wider uncertainty");
  }

  let summary: string;
  if (confidence.level === "low") {
    summary =
      direction === "rising"
        ? "Likely to increase — exact timing uncertain"
        : direction === "falling"
          ? "May decrease — limited historical data"
          : "Stable — prediction based on limited data";
  } else if (direction === "rising") {
    summary = `Expected to rise toward ~${rounded}m in ${minutesAhead} min`;
  } else if (direction === "falling") {
    summary = `Likely to ease toward ~${rounded}m in ${minutesAhead} min`;
  } else {
    summary = `Likely to stay near ~${rounded}m in ${minutesAhead} min`;
  }

  return {
    minutesAhead,
    direction,
    summary,
    estimatedWait: confidence.level === "low" ? null : rounded,
    estimatedRange: range,
    confidenceScore: confidence.score,
    confidenceLevel: confidence.level,
    confidenceLabel: confidence.label,
    factors: factors.slice(0, 3),
  };
}

export function findPeakAndLowWindows(
  hourlyPattern: HourBucket[],
  currentHour: number
): { peak: PeakLowWindow | null; low: PeakLowWindow | null; upcomingLow: PeakLowWindow | null } {
  if (!hourlyPattern.length) {
    return { peak: null, low: null, upcomingLow: null };
  }

  const peak = hourlyPattern.reduce((max, h) =>
    h.average > max.average ? h : max
  );
  const low = hourlyPattern.reduce((min, h) =>
    h.average < min.average ? h : min
  );

  const upcomingLow =
    low.hour > currentHour
      ? { type: "low" as const, hour: low.hour, label: low.label, average: low.average }
      : null;

  return {
    peak: {
      type: "peak",
      hour: peak.hour,
      label: peak.label,
      average: peak.average,
    },
    low: {
      type: "low",
      hour: low.hour,
      label: low.label,
      average: low.average,
    },
    upcomingLow,
  };
}

export function buildTrendForecast(params: {
  currentWait: number;
  predictedWait30: number | null;
  prediction30?: WaitPredictionDetail | null;
  isOpen: boolean;
  peak: PeakLowWindow | null;
  low: PeakLowWindow | null;
  upcomingLow: PeakLowWindow | null;
  currentHour: number;
}): string {
  if (!params.isOpen) return "Ride is currently closed";

  if (params.prediction30?.summary && params.prediction30.confidenceLevel !== "low") {
    return params.prediction30.summary;
  }

  const { currentWait, predictedWait30, upcomingLow, peak } = params;

  if (predictedWait30 !== null && predictedWait30 >= currentWait + 10) {
    return `Expected to rise toward ~${roundToNearestFive(predictedWait30)}m within 30 min`;
  }
  if (predictedWait30 !== null && predictedWait30 <= currentWait - 10) {
    return "Wait likely to keep easing";
  }
  if (upcomingLow) {
    return `Historically lowest after ${upcomingLow.label}`;
  }
  if (peak && peak.hour > params.currentHour) {
    return `Peak crowds typically around ${peak.label}`;
  }
  return "Stable compared to recent trend";
}

export { bucketRecordsByHour, getSmartSlotAverage };
