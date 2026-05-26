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
  getSmartSlotAverage,
  getHistoricalAverageForHour,
} from "@/lib/time-buckets";
import {
  computeParkDataMaturity,
  computeRideConfidence,
  getWeekdayLabel,
} from "@/lib/data-maturity";
import {
  computeAllWeekdayPatterns,
  computeParkWeekdayInsights,
} from "@/lib/weekday-analytics";
import { formatHourMinute } from "@/utils/wait-time";
import { getParkParts } from "@/lib/park-time";
import {
  computeOpportunityScore,
  classifyOpportunityTier,
  estimateMinutesSavedVsTypical,
} from "@/lib/intelligence/opportunity";
import type { RideAggregateProfile } from "@/lib/analytics/baselines";
import {
  buildOpportunityReasoning,
  buildUrgencyReasoning,
} from "@/lib/intelligence/reasoning";
import {
  predictWaitAt,
  buildTrendForecast,
  findPeakAndLowWindows,
  buildWaitPredictionDetail,
} from "@/lib/intelligence/prediction";
import {
  computeRideUrgency,
  computeTrendVelocity,
} from "@/lib/intelligence/urgency";
import { buildParkStrategySnapshot } from "@/lib/intelligence/strategy";

export { predictWaitAt, computeOpportunityScore };

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

function computeVsAveragePercent(
  currentWait: number,
  historicalAvg: number | null
): number | null {
  if (historicalAvg === null || historicalAvg <= 0) return null;
  return Math.round(((historicalAvg - currentWait) / historicalAvg) * 100);
}

function buildComparisonMessage(
  vsAveragePercent: number | null,
  slotSource?: string,
  confidenceLevel?: string
): string {
  if (vsAveragePercent === null) {
    return confidenceLevel === "low"
      ? "Still learning this ride's patterns"
      : "Building historical baseline";
  }

  const weekdayNote =
    slotSource === "weekday" ? ` for ${getWeekdayLabel(new Date())}s` : "";

  if (vsAveragePercent >= 15) {
    return `${vsAveragePercent}% below normal${weekdayNote}`;
  }
  if (vsAveragePercent <= -15) {
    return `${Math.abs(vsAveragePercent)}% above normal${weekdayNote}`;
  }
  return `Near typical for this time${weekdayNote}`;
}

function buildRecommendationType(
  vsAveragePercent: number | null,
  trend: TrendInfo,
  waitDrop: boolean,
  opportunityScore: number,
  confidenceLevel: string
): RecommendationType {
  if (confidenceLevel === "low" && !waitDrop) return "neutral";
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

export function computeRideIntelligence(
  ride: RideWithLiveData,
  records: WaitTimeRecord[],
  popularityPercentile = 0.5,
  aggregateProfile?: RideAggregateProfile | null
): RideIntelligence {
  const openRecords = records.filter((r) => r.is_open);
  const trend = computeLiveTrend(
    records,
    ride.is_open ? ride.wait_time : undefined
  );
  const waitDropResult = detectWaitDrop(records);
  const slotAvg =
    aggregateProfile?.currentSlot ??
    getSmartSlotAverage(openRecords, new Date(), 2);
  const historicalAvg = slotAvg?.average ?? null;
  const vsAveragePercent = computeVsAveragePercent(
    ride.wait_time,
    historicalAvg
  );
  const volatility =
    aggregateProfile?.volatilityScore ?? computeVolatilityScore(records);
  const reliability = computeReliabilityScore(records);
  const downtimeFrequency =
    aggregateProfile?.downtimePercent ?? computeDowntimeFrequency(records);

  const confidence = computeRideConfidence(
    records,
    slotAvg?.sampleCount ?? 0
  );

  const hourlyPattern =
    aggregateProfile?.hourlyPattern ?? bucketRecordsByHour(openRecords);
  const bestBucket = aggregateProfile?.bestHour != null
    ? {
        hour: aggregateProfile.bestHour,
        minute: aggregateProfile.bestMinute ?? 0,
        average: aggregateProfile.bestTimeAverage ?? Infinity,
      }
    : findBestTenMinuteBucket(bucketRecordsByTenMinutes(openRecords));
  const peakBucket = aggregateProfile?.peakHour != null
    ? {
        hour: aggregateProfile.peakHour,
        minute: aggregateProfile.peakMinute ?? 0,
        average: aggregateProfile.peakTimeAverage ?? -Infinity,
      }
    : findPeakTenMinuteBucket(bucketRecordsByTenMinutes(openRecords));

  const opportunityScore = computeOpportunityScore({
    currentWait: ride.wait_time,
    historicalAvg,
    trend,
    volatility,
    waitDrop: !!waitDropResult,
    isOpen: ride.is_open,
    popularityPercentile,
    confidenceScore: confidence.confidenceScore,
    trendVelocity: computeTrendVelocity(trend),
  });

  const opportunityTier = classifyOpportunityTier(
    opportunityScore,
    vsAveragePercent
  );
  const estimatedMinutesSavedVsTypical = estimateMinutesSavedVsTypical(
    ride.wait_time,
    historicalAvg,
    ride.is_open
  );

  const recommendationType = buildRecommendationType(
    vsAveragePercent,
    trend,
    !!waitDropResult,
    opportunityScore,
    confidence.confidenceLevel
  );

  const prediction30 = ride.is_open
    ? buildWaitPredictionDetail({
        records,
        currentWait: ride.wait_time,
        minutesAhead: 30,
        trend,
        slotSampleCount: slotAvg?.sampleCount ?? 0,
        dataDays: confidence.uniqueDays,
        volatility,
        isOpen: ride.is_open,
      })
    : null;
  const prediction60 = ride.is_open
    ? buildWaitPredictionDetail({
        records,
        currentWait: ride.wait_time,
        minutesAhead: 60,
        trend,
        slotSampleCount: slotAvg?.sampleCount ?? 0,
        dataDays: confidence.uniqueDays,
        volatility,
        isOpen: ride.is_open,
      })
    : null;

  const predictedWait30 = prediction30?.estimatedWait ?? null;
  const predictedWait60 = prediction60?.estimatedWait ?? null;

  const currentHour = getParkParts(new Date()).hour;

  let trendForecast = "";
  if (ride.is_open) {
    const windows = findPeakAndLowWindows(hourlyPattern, currentHour);
    trendForecast = buildTrendForecast({
      currentWait: ride.wait_time,
      predictedWait30,
      prediction30,
      isOpen: ride.is_open,
      peak: windows.peak,
      low: windows.low,
      upcomingLow: windows.upcomingLow,
      currentHour,
    });
  }

  const urgency = computeRideUrgency({
    currentWait: ride.wait_time,
    isOpen: ride.is_open,
    predictedWait30,
    predictedWait60,
    vsAveragePercent,
    trend,
    hourlyPattern,
    peakTimeToRide:
      peakBucket.average === -Infinity
        ? null
        : formatHourMinute(peakBucket.hour, peakBucket.minute),
  });

  const partialIntel = {
    currentWait: ride.wait_time,
    historicalAverage: historicalAvg,
    vsAveragePercent,
    trend,
    waitDrop: waitDropResult,
    bestTimeToRide:
      bestBucket.average === Infinity
        ? null
        : formatHourMinute(bestBucket.hour, bestBucket.minute),
    peakTimeToRide:
      peakBucket.average === -Infinity
        ? null
        : formatHourMinute(peakBucket.hour, peakBucket.minute),
    predictedWait30,
    predictedWait60,
    volatilityScore: volatility,
    baselineSource: slotAvg?.source ?? null,
    slotSampleCount: slotAvg?.sampleCount ?? 0,
    dataDays: confidence.uniqueDays,
    urgencyScore: urgency.score,
    rideName: ride.name,
  };

  const reasoning = buildOpportunityReasoning(partialIntel, aggregateProfile);
  const urgencyReasoning = buildUrgencyReasoning({
    ...partialIntel,
    urgencyScore: urgency.score,
  });

  const baselines = aggregateProfile
    ? {
        weekdayAverageAtHour: aggregateProfile.weekdayAverageAtHour,
        weekendAverageAtHour: aggregateProfile.weekendAverageAtHour,
        bestTimeLabel: aggregateProfile.bestTimeLabel,
        peakTimeLabel: aggregateProfile.peakTimeLabel,
        volatilityScore: aggregateProfile.volatilityScore,
        uniqueDays: aggregateProfile.uniqueDays,
      }
    : null;

  const learningNote =
    confidence.confidenceLevel === "low"
      ? `Learning from ${confidence.snapshotCount} snapshots`
      : confidence.confidenceLevel === "moderate"
        ? `Based on ${confidence.uniqueDays} day${confidence.uniqueDays === 1 ? "" : "s"} of data`
        : slotAvg?.source === "weekday"
          ? `${getWeekdayLabel(new Date())} pattern active`
          : null;

  return {
    rideId: ride.ride_id,
    rideName: ride.name,
    land: ride.land,
    currentWait: ride.wait_time,
    isOpen: ride.is_open,
    historicalAverage: historicalAvg,
    vsAveragePercent,
    comparisonMessage: buildComparisonMessage(
      vsAveragePercent,
      slotAvg?.source,
      confidence.confidenceLevel
    ),
    opportunityScore,
    opportunityTier,
    urgencyScore: urgency.score,
    urgencyLabel: urgency.label,
    urgencyReason: urgency.reason,
    estimatedMinutesSavedVsTypical,
    recommendationType,
    recommendationLabel: recommendationLabel(recommendationType),
    trend,
    waitDrop: waitDropResult,
    predictedWait30,
    predictedWait60,
    prediction30,
    prediction60,
    reasoning,
    urgencyReasoning,
    baselines,
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
    confidenceScore: confidence.confidenceScore,
    confidenceLevel: confidence.confidenceLevel,
    confidenceLabel: confidence.confidenceLabel,
    slotSampleCount: slotAvg?.sampleCount ?? 0,
    dataDays: confidence.uniqueDays,
    baselineSource: slotAvg?.source ?? null,
    learningNote,
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
    reason: intel.reasoning.headline,
    category,
    vsAveragePercent: intel.vsAveragePercent,
    trend: intel.trend,
    confidenceScore: intel.confidenceScore,
    confidenceLabel: intel.confidenceLabel,
    reasoning: intel.reasoning,
  };
}

function rankByOpportunity(intel: RideIntelligence[]): RideIntelligence[] {
  return [...intel].sort((a, b) => {
    const scoreA = a.opportunityScore * (0.7 + a.confidenceScore / 333);
    const scoreB = b.opportunityScore * (0.7 + b.confidenceScore / 333);
    return scoreB - scoreA;
  });
}

export function computeParkRecommendations(
  rides: RideWithLiveData[],
  recordsByRide: Map<number, WaitTimeRecord[]>,
  aggregateProfiles?: Map<number, RideAggregateProfile>
): ParkRecommendations {
  const openRides = rides.filter((r) => r.is_open);
  const avgWaits = openRides.map((r) => r.wait_time).sort((a, b) => a - b);

  const allRecords: WaitTimeRecord[] = [];
  for (const records of recordsByRide.values()) {
    allRecords.push(...records);
  }

  const dataMaturity = computeParkDataMaturity(
    allRecords,
    rides.length,
    recordsByRide
  );

  const intelligence: RideIntelligence[] = rides.map((ride) => {
    const records = recordsByRide.get(ride.ride_id) ?? [];
    const rank = avgWaits.indexOf(ride.wait_time);
    const popularityPercentile =
      avgWaits.length > 1 ? rank / (avgWaits.length - 1) : 0.5;
    return computeRideIntelligence(
      ride,
      records,
      popularityPercentile,
      aggregateProfiles?.get(ride.ride_id)
    );
  });

  const openIntel = intelligence.filter((i) => i.isOpen);
  const ranked = rankByOpportunity(openIntel);

  const bestRightNow = ranked
    .slice(0, 5)
    .map((i) => toRecommendation(i, "best_right_now"));

  const greatTimeToRide = openIntel
    .filter(
      (i) =>
        i.confidenceLevel !== "low" &&
        i.vsAveragePercent !== null &&
        i.vsAveragePercent >= 15 &&
        i.recommendationType !== "expected_rise"
    )
    .sort((a, b) => (b.vsAveragePercent ?? 0) - (a.vsAveragePercent ?? 0))
    .slice(0, 5)
    .map((i) => toRecommendation(i, "great_time"));

  const lowerThanNormal = openIntel
    .filter(
      (i) =>
        i.vsAveragePercent !== null &&
        i.vsAveragePercent >= 8 &&
        i.confidenceLevel !== "low"
    )
    .sort((a, b) => (b.vsAveragePercent ?? 0) - (a.vsAveragePercent ?? 0))
    .slice(0, 5)
    .map((i) => toRecommendation(i, "below_normal"));

  const trendingUpFast = openIntel
    .filter(
      (i) =>
        i.confidenceLevel !== "low" &&
        (i.trend.trend === "rising_fast" ||
          (i.trend.trend === "up" && i.trend.change >= 8))
    )
    .sort((a, b) => b.trend.change - a.trend.change)
    .slice(0, 5)
    .map((i) => toRecommendation(i, "trending_up"));

  const expectedToRiseSoon = openIntel
    .filter(
      (i) =>
        i.confidenceLevel !== "low" &&
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

  const weekdayPatternsByRide = computeAllWeekdayPatterns(recordsByRide);
  const parkWeekdayInsights = computeParkWeekdayInsights(allRecords);

  const strategy = buildParkStrategySnapshot(rides, byRideId, bestRightNow);

  return {
    bestRightNow,
    greatTimeToRide,
    lowerThanNormal,
    trendingUpFast,
    expectedToRiseSoon,
    byRideId,
    strategy,
    dataMaturity,
    weekdayPatternsByRide,
    parkWeekdayInsights,
    generatedAt: new Date().toISOString(),
  };
}

export function buildHistoricalAverageSeries(
  records: WaitTimeRecord[],
  timestamps: string[]
): number[] {
  return timestamps.map((ts) => {
    const slot = getSmartSlotAverage(records, ts, 1);
    return slot?.average ?? 0;
  });
}

export function getHourlyExpectedWait(
  records: WaitTimeRecord[],
  hour: number
): number | null {
  return getHistoricalAverageForHour(records, hour, 1);
}
