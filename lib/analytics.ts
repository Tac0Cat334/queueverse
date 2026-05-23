import type {
  RideAnalytics,
  RideWithLiveData,
  TrendInfo,
  WaitDropAlert,
  WaitTimeRecord,
  SortOption,
  CrowdScore,
} from "@/types";
import { formatHourMinute } from "@/utils/wait-time";
import { WAIT_THRESHOLDS } from "@/lib/constants";
import {
  subDays,
} from "date-fns";
import { getParkStartOfDay } from "@/lib/park-time";
import {
  bucketRecordsByHour,
  bucketRecordsByTenMinutes,
  findBestTenMinuteBucket,
  findPeakTenMinuteBucket,
} from "@/lib/time-buckets";

export function getTimeRangeStart(range: "today" | "7d" | "30d"): Date {
  const now = new Date();
  switch (range) {
    case "today":
      return getParkStartOfDay(now);
    case "7d":
      return subDays(now, 7);
    case "30d":
      return subDays(now, 30);
  }
}

export function filterRecordsByRange(
  records: WaitTimeRecord[],
  range: "today" | "7d" | "30d"
): WaitTimeRecord[] {
  const start = getTimeRangeStart(range);
  return records.filter((r) => {
    const ts = new Date(r.timestamp).getTime();
    return ts >= start.getTime();
  });
}

function bucketByHour(records: WaitTimeRecord[]) {
  return bucketRecordsByHour(records);
}

function bucketByTenMinutes(records: WaitTimeRecord[]) {
  return bucketRecordsByTenMinutes(records);
}

export function computeReliabilityScore(
  records: WaitTimeRecord[]
): number | null {
  if (records.length < 6) return null;
  const openCount = records.filter((r) => r.is_open).length;
  return Math.round((openCount / records.length) * 100);
}

export function computeLiveTrend(
  records: WaitTimeRecord[],
  currentWait?: number
): TrendInfo {
  const open = records.filter((r) => r.is_open);
  if (open.length < 2) {
    return { trend: "flat", label: "Stable", change: 0 };
  }

  const recent = open.slice(-4);
  const prior = open.slice(-8, -4);

  let change: number;
  if (prior.length >= 2) {
    const recentAvg =
      recent.reduce((s, r) => s + r.wait_time, 0) / recent.length;
    const priorAvg =
      prior.reduce((s, r) => s + r.wait_time, 0) / prior.length;
    change = Math.round(recentAvg - priorAvg);
  } else {
    change = open[open.length - 1].wait_time - open[0].wait_time;
  }

  if (currentWait !== undefined && recent.length > 0) {
    const lastRecorded = recent[recent.length - 1].wait_time;
    change = currentWait - lastRecorded;
  }

  if (change >= 15) {
    return { trend: "rising_fast", label: "Wait rising quickly", change };
  }
  if (change >= 5) {
    return { trend: "up", label: "Wait rising", change };
  }
  if (change <= -15) {
    return { trend: "falling_fast", label: "Dropping from peak", change };
  }
  if (change <= -5) {
    return { trend: "down", label: "Wait falling", change };
  }
  return { trend: "flat", label: "Stable", change };
}

export function detectWaitDrop(
  records: WaitTimeRecord[],
  threshold = 15
): { amount: number; message: string } | null {
  const open = records.filter((r) => r.is_open);
  if (open.length < 2) return null;

  const latest = open[open.length - 1];
  const previous = open[open.length - 2];
  const amount = previous.wait_time - latest.wait_time;

  if (amount >= threshold) {
    return {
      amount,
      message: `Dropped ${amount} min — now may be a good time to ride`,
    };
  }
  return null;
}

export function computeCrowdScore(rides: RideWithLiveData[]): CrowdScore {
  const open = rides.filter((r) => r.is_open);
  const total = rides.length;

  if (open.length === 0) {
    return { score: 0, level: "low", label: "Low" };
  }

  const avgWait =
    open.reduce((s, r) => s + r.wait_time, 0) / open.length;
  const shortWaitRatio =
    open.filter((r) => r.wait_time <= WAIT_THRESHOLDS.low).length /
    open.length;
  const openRatio = open.length / total;

  const waitScore = Math.min(100, (avgWait / 90) * 100);
  const distributionScore = (1 - shortWaitRatio) * 100;
  const downtimeScore = (1 - openRatio) * 100;

  const score = Math.round(
    waitScore * 0.5 + distributionScore * 0.3 + downtimeScore * 0.2
  );

  const level: CrowdScore["level"] =
    score <= 35 ? "low" : score <= 65 ? "moderate" : "heavy";
  const label = level === "low" ? "Low" : level === "moderate" ? "Moderate" : "Heavy";

  return { score, level, label };
}

export function findWaitDrops(
  rides: RideWithLiveData[],
  recordsByRide: Map<number, WaitTimeRecord[]>,
  threshold = 15
): WaitDropAlert[] {
  const alerts: WaitDropAlert[] = [];

  for (const ride of rides) {
    if (!ride.is_open) continue;
    const records = recordsByRide.get(ride.ride_id);
    if (!records) continue;
    const drop = detectWaitDrop(records, threshold);
    if (drop) {
      alerts.push({
        rideId: ride.ride_id,
        rideName: ride.name,
        amount: drop.amount,
        message: `${ride.name} dropped ${drop.amount} min`,
      });
    }
  }

  return alerts.sort((a, b) => b.amount - a.amount);
}

export function computeRideAnalytics(
  records: WaitTimeRecord[],
  range: "today" | "7d" | "30d"
): RideAnalytics {
  const filtered = filterRecordsByRange(records, range);
  const openRecords = filtered.filter((r) => r.is_open);
  const historicalOpen = filterRecordsByRange(records, "30d").filter(
    (r) => r.is_open
  );

  const todayStart = getParkStartOfDay(new Date());
  const todayRecords = records.filter(
    (r) => r.is_open && new Date(r.timestamp).getTime() >= todayStart.getTime()
  );

  const averageWaitToday =
    todayRecords.length > 0
      ? Math.round(
          todayRecords.reduce((sum, r) => sum + r.wait_time, 0) /
            todayRecords.length
        )
      : 0;

  const peakWaitToday =
    todayRecords.length > 0
      ? Math.max(...todayRecords.map((r) => r.wait_time))
      : 0;

  const averageWaitByHour = bucketByHour(openRecords);
  const weeklyPattern = bucketByHour(historicalOpen);

  const hourlyMinimum =
    averageWaitByHour.length > 0
      ? averageWaitByHour.reduce((min, curr) =>
          curr.average < min.average ? curr : min
        )
      : { hour: 0, label: "N/A", average: 0, count: 0 };

  const tenMinuteBuckets = bucketByTenMinutes(historicalOpen);
  const bestBucket = findBestTenMinuteBucket(tenMinuteBuckets);
  const peakBucket = findPeakTenMinuteBucket(tenMinuteBuckets);

  const lowestAverageWait =
    openRecords.length > 0
      ? Math.round(
          openRecords.reduce((sum, r) => sum + r.wait_time, 0) /
            openRecords.length
        )
      : 0;

  const hasEnoughData = historicalOpen.length >= 3;

  return {
    averageWaitToday,
    peakWaitToday,
    lowestAverageWait,
    bestTimeToRide:
      !hasEnoughData || bestBucket.average === Infinity
        ? "Not enough data"
        : formatHourMinute(bestBucket.hour, bestBucket.minute),
    bestTimeAverageWait:
      !hasEnoughData || bestBucket.average === Infinity ? 0 : bestBucket.average,
    peakTimeToRide:
      !hasEnoughData || peakBucket.average === -Infinity
        ? "Not enough data"
        : formatHourMinute(peakBucket.hour, peakBucket.minute),
    peakTimeAverageWait:
      !hasEnoughData || peakBucket.average === -Infinity ? 0 : peakBucket.average,
    averageWaitByHour,
    hourlyMinimum,
    weeklyPattern,
    reliabilityScore: computeReliabilityScore(
      filterRecordsByRange(records, "30d")
    ),
  };
}

export function computeBestTimeInsight(
  openRecords: WaitTimeRecord[]
): { time: string; average: number } | null {
  if (openRecords.length < 3) return null;

  const buckets = bucketByTenMinutes(openRecords);
  const best = findBestTenMinuteBucket(buckets);
  if (best.average === Infinity) return null;

  return {
    time: formatHourMinute(best.hour, best.minute),
    average: best.average,
  };
}

export function sortRides<T extends { name: string; is_open: boolean; wait_time: number }>(
  rides: T[],
  sort: "highest" | "lowest" | "alphabetical" | "open"
): T[] {
  const copy = [...rides];
  switch (sort) {
    case "highest":
      return copy.sort((a, b) => b.wait_time - a.wait_time);
    case "lowest":
      return copy.sort((a, b) => a.wait_time - b.wait_time);
    case "alphabetical":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case "open":
      return copy
        .filter((r) => r.is_open)
        .sort((a, b) => b.wait_time - a.wait_time);
  }
}

export function sortRidesWithFavoritesFilter<
  T extends { ride_id: number; name: string; is_open: boolean; wait_time: number },
>(rides: T[], sort: SortOption, favoriteIds: number[]): T[] {
  let result = rides;
  if (sort === "favorites") {
    result = rides.filter((r) => favoriteIds.includes(r.ride_id));
  }
  return sortRides(
    result,
    sort === "favorites" ? "highest" : sort
  );
}
