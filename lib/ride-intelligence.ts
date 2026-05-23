import type {
  RideWithLiveData,
  TrendInfo,
  WaitTimeRecord,
  RideIntelligence,
  RecommendationCategory,
  RideRecommendation,
  ParkRecommendations,
  RecommendationType,
} from "@/types";
import {
  computeLiveTrend,
  detectWaitDrop,
  computeReliabilityScore,
} from "@/lib/analytics";
import {
  bucketRecordsByHour,
  bucketRecordsByTenMinutes,
  findBestTenMinuteBucket,
  findPeakTenMinuteBucket,
  getHistoricalAverageForSlot,
  getHistoricalAverageForHour,
} from "@/lib/time-buckets";
import { formatHourMinute } from "@/utils/wait-time";
import { getParkParts } from "@/lib/park-time";

function computeVolatilityScore(records: WaitTimeRecord[]): number {
  const open = records.filter((r) => r.is_open);
  if (open.length < 6) return 50;

  const waits = open.map((r) => r.wait_time);
  const mean = waits.reduce((sum, w) => sum + w, 0) / waits.length;
  const variance =
    waits.reduce((sum, w) => sum + (w - mean) ** 2, 0) / waits.length;
  const stdDev = Math.sqrt(variance);

  return Math.min(100, Math.max(0, Math.round((stdDev / 35) * 100)));
}

function computeDowntimeFrequency(records: WaitTimeRecord[]): number {
  if (records.length < 6) return 0;
  const closedCount = records.filter((r) => !r.is_open).length;
  return Math.round((closedCount / records.length) * 100);
}

export function predictWaitAt(
  records: WaitTimeRecord[],
  currentWait: number,
  minutesAhead: number,
  trend: TrendInfo
): number {
  const targetTime = new Date(Date.now() + minutesAhead * 60 * 1000);
  const historical = getHistoricalAverageForSlot(records, targetTime, 1);
  const historicalAvg = historical?.average ?? currentWait;

  const trendPer5Min = trend.change / 4;
  const steps = minutesAhead / 5;
  const trendEstimate = currentWait + trendPer5Min * steps;

  const trendWeight = minutesAhead <= 30 ? 0.55 : 0.35;
  const prediction = Math.round(
    trendWeight * trendEstimate + (1 - trendWeight) * historicalAvg
  );

  return Math.max(0, prediction);
}

function computeVsAveragePercent(
  currentWait: number,
  historicalAvg: number | null
): number | null {
  if (historicalAvg === null || historicalAvg <= 0) return null;
  return Math.round(((historicalAvg - currentWait) / historicalAvg) * 100);
}

function buildComparisonMessage(vsAveragePercent: number | null): string {
  if (vsAveragePercent === null) return "Building historical baseline";
  if (vsAveragePercent >= 15) return `${vsAveragePercent}% below normal`;
  if (vsAveragePercent <= -15) return `${Math.abs(vsAveragePercent)}% above normal`;
  return "Near typical for this time";
}

function buildRecommendationType(
  vsAveragePercent: number | null,
  trend: TrendInfo,
  waitDrop: boolean,
  opportunityScore: number
): RecommendationType {
  if (waitDrop) return "unusually_low";
  if (vsAveragePercent !== null && vsAveragePercent >= 20) return "great_time";
  if (
    trend.trend === "rising_fast" ||
    (trend.trend === "up" && trend.change >= 10)
  ) {
    return trend.change >= 15 ? "expected_rise" : "trending_up";
  }
  if (opportunityScore >= 75) return "best_now";
  if (vsAveragePercent !== null && vsAveragePercent >= 10) return "below_normal";
  return "neutral";
}

function recommendationLabel(type: RecommendationType): string {
  switch (type) {
    case "best_now":
      return "Best opportunity currently";
    case "great_time":
      return "Great time to ride";
    case "below_normal":
      return "Lower than normal";
    case "unusually_low":
      return "Unusually low wait";
    case "trending_up":
      return "Likely increasing soon";
    case "expected_rise":
      return "Expected to spike soon";
    default:
      return "Stable wait";
  }
}

export function computeOpportunityScore(params: {
  currentWait: number;
  historicalAvg: number | null;
  trend: TrendInfo;
  volatility: number;
  waitDrop: boolean;
  isOpen: boolean;
  popularityPercentile: number;
}): number {
  if (!params.isOpen) return 0;

  let score = 40;

  if (params.historicalAvg !== null && params.historicalAvg > 0) {
    const ratio = params.currentWait / params.historicalAvg;
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
    if (params.historicalAvg !== null && params.currentWait < params.historicalAvg) {
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

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function computeRideIntelligence(
  ride: RideWithLiveData,
  records: WaitTimeRecord[],
  popularityPercentile = 0.5
): RideIntelligence {
  const openRecords = records.filter((r) => r.is_open);
  const trend = computeLiveTrend(
    records,
    ride.is_open ? ride.wait_time : undefined
  );
  const waitDropResult = detectWaitDrop(records);
  const slotAvg = getHistoricalAverageForSlot(openRecords, new Date(), 1);
  const historicalAvg = slotAvg?.average ?? null;
  const vsAveragePercent = computeVsAveragePercent(
    ride.wait_time,
    historicalAvg
  );
  const volatility = computeVolatilityScore(records);
  const reliability = computeReliabilityScore(records);
  const downtimeFrequency = computeDowntimeFrequency(records);

  const tenMinBuckets = bucketRecordsByTenMinutes(openRecords);
  const bestBucket = findBestTenMinuteBucket(tenMinBuckets);
  const peakBucket = findPeakTenMinuteBucket(tenMinBuckets);
  const hourlyPattern = bucketRecordsByHour(openRecords);

  const opportunityScore = computeOpportunityScore({
    currentWait: ride.wait_time,
    historicalAvg,
    trend,
    volatility,
    waitDrop: !!waitDropResult,
    isOpen: ride.is_open,
    popularityPercentile,
  });

  const recommendationType = buildRecommendationType(
    vsAveragePercent,
    trend,
    !!waitDropResult,
    opportunityScore
  );

  const predictedWait30 = ride.is_open
    ? predictWaitAt(records, ride.wait_time, 30, trend)
    : null;
  const predictedWait60 = ride.is_open
    ? predictWaitAt(records, ride.wait_time, 60, trend)
    : null;

  const currentHour = getParkParts(new Date()).hour;
  const peakHour =
    hourlyPattern.length > 0
      ? hourlyPattern.reduce((max, h) => (h.average > max.average ? h : max))
      : null;
  const lowHour =
    hourlyPattern.length > 0
      ? hourlyPattern.reduce((min, h) => (h.average < min.average ? h : min))
      : null;

  let trendForecast = "";
  if (predictedWait30 !== null && ride.is_open) {
    if (predictedWait30 >= ride.wait_time + 10) {
      trendForecast = `Expected to rise after ${formatHourMinute(currentHour)}`;
    } else if (predictedWait30 <= ride.wait_time - 10) {
      trendForecast = "Wait likely to keep falling";
    } else if (lowHour && lowHour.hour > currentHour) {
      trendForecast = `Historically lowest after ${lowHour.label}`;
    } else if (peakHour && peakHour.hour > currentHour) {
      trendForecast = `Peak crowds typically around ${peakHour.label}`;
    }
  }

  return {
    rideId: ride.ride_id,
    rideName: ride.name,
    land: ride.land,
    currentWait: ride.wait_time,
    isOpen: ride.is_open,
    historicalAverage: historicalAvg,
    vsAveragePercent,
    comparisonMessage: buildComparisonMessage(vsAveragePercent),
    opportunityScore,
    recommendationType,
    recommendationLabel: recommendationLabel(recommendationType),
    trend,
    waitDrop: waitDropResult,
    predictedWait30,
    predictedWait60,
    volatilityScore: volatility,
    reliabilityScore: reliability,
    downtimeFrequency,
    bestTimeToRide:
      bestBucket.average === Infinity
        ? null
        : formatHourMinute(bestBucket.hour, bestBucket.minute),
    bestTimeAverage:
      bestBucket.average === Infinity ? null : bestBucket.average,
    peakTimeToRide:
      peakBucket.average === -Infinity
        ? null
        : formatHourMinute(peakBucket.hour, peakBucket.minute),
    peakTimeAverage:
      peakBucket.average === -Infinity ? null : peakBucket.average,
    hourlyPattern,
    trendForecast,
    popularityPercentile,
  };
}

function toRecommendation(
  intel: RideIntelligence,
  category: RecommendationCategory
): RideRecommendation {
  return {
    rideId: intel.rideId,
    rideName: intel.rideName,
    land: intel.land,
    currentWait: intel.currentWait,
    opportunityScore: intel.opportunityScore,
    label: intel.recommendationLabel,
    reason: intel.comparisonMessage,
    category,
    vsAveragePercent: intel.vsAveragePercent,
    trend: intel.trend,
  };
}

export function computeParkRecommendations(
  rides: RideWithLiveData[],
  recordsByRide: Map<number, WaitTimeRecord[]>
): ParkRecommendations {
  const openRides = rides.filter((r) => r.is_open);
  const avgWaits = openRides.map((r) => r.wait_time).sort((a, b) => a - b);

  const intelligence: RideIntelligence[] = rides.map((ride) => {
    const records = recordsByRide.get(ride.ride_id) ?? [];
    const rank = avgWaits.indexOf(ride.wait_time);
    const popularityPercentile =
      avgWaits.length > 1 ? rank / (avgWaits.length - 1) : 0.5;
    return computeRideIntelligence(ride, records, popularityPercentile);
  });

  const openIntel = intelligence.filter((i) => i.isOpen);

  const bestRightNow = [...openIntel]
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, 5)
    .map((i) => toRecommendation(i, "best_right_now"));

  const greatTimeToRide = openIntel
    .filter(
      (i) =>
        i.vsAveragePercent !== null &&
        i.vsAveragePercent >= 15 &&
        i.recommendationType !== "expected_rise"
    )
    .sort((a, b) => (b.vsAveragePercent ?? 0) - (a.vsAveragePercent ?? 0))
    .slice(0, 5)
    .map((i) => toRecommendation(i, "great_time"));

  const lowerThanNormal = openIntel
    .filter((i) => i.vsAveragePercent !== null && i.vsAveragePercent >= 8)
    .sort((a, b) => (b.vsAveragePercent ?? 0) - (a.vsAveragePercent ?? 0))
    .slice(0, 5)
    .map((i) => toRecommendation(i, "below_normal"));

  const trendingUpFast = openIntel
    .filter(
      (i) =>
        i.trend.trend === "rising_fast" ||
        (i.trend.trend === "up" && i.trend.change >= 8)
    )
    .sort((a, b) => b.trend.change - a.trend.change)
    .slice(0, 5)
    .map((i) => toRecommendation(i, "trending_up"));

  const expectedToRiseSoon = openIntel
    .filter(
      (i) =>
        i.predictedWait30 !== null &&
        i.predictedWait30 >= i.currentWait + 12 &&
        i.currentWait < (i.historicalAverage ?? i.currentWait)
    )
    .sort(
      (a, b) =>
        (b.predictedWait30! - b.currentWait) -
        (a.predictedWait30! - a.currentWait)
    )
    .slice(0, 5)
    .map((i) => toRecommendation(i, "expected_rise"));

  const byRideId = Object.fromEntries(
    intelligence.map((i) => [i.rideId, i])
  ) as Record<number, RideIntelligence>;

  return {
    bestRightNow,
    greatTimeToRide,
    lowerThanNormal,
    trendingUpFast,
    expectedToRiseSoon,
    byRideId,
    generatedAt: new Date().toISOString(),
  };
}

export function buildHistoricalAverageSeries(
  records: WaitTimeRecord[],
  timestamps: string[]
): number[] {
  return timestamps.map((ts) => {
    const slot = getHistoricalAverageForSlot(records, ts, 1);
    return slot?.average ?? 0;
  });
}

export function getHourlyExpectedWait(
  records: WaitTimeRecord[],
  hour: number
): number | null {
  return getHistoricalAverageForHour(records, hour, 1);
}
