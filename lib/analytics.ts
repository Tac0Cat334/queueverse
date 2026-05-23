import type { RideAnalytics, WaitTimeRecord } from "@/types";
import { formatHourLabel, formatHourMinute } from "@/utils/wait-time";
import {
  startOfDay,
  subDays,
  isAfter,
  getHours,
  getMinutes,
} from "date-fns";

export function getTimeRangeStart(range: "today" | "7d" | "30d"): Date {
  const now = new Date();
  switch (range) {
    case "today":
      return startOfDay(now);
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
  return records.filter((r) => isAfter(new Date(r.timestamp), start));
}

export function computeRideAnalytics(
  records: WaitTimeRecord[],
  range: "today" | "7d" | "30d"
): RideAnalytics {
  const filtered = filterRecordsByRange(records, range);
  const openRecords = filtered.filter((r) => r.is_open);

  const todayStart = startOfDay(new Date());
  const todayRecords = records.filter(
    (r) => r.is_open && isAfter(new Date(r.timestamp), todayStart)
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

  const hourlyBuckets = new Map<number, { total: number; count: number }>();

  for (const record of openRecords) {
    const date = new Date(record.timestamp);
    const hour = getHours(date);
    const bucket = hourlyBuckets.get(hour) ?? { total: 0, count: 0 };
    bucket.total += record.wait_time;
    bucket.count += 1;
    hourlyBuckets.set(hour, bucket);
  }

  const averageWaitByHour = Array.from(hourlyBuckets.entries())
    .map(([hour, { total, count }]) => ({
      hour,
      label: formatHourLabel(hour),
      average: Math.round(total / count),
      count,
    }))
    .sort((a, b) => a.hour - b.hour);

  const hourlyMinimum =
    averageWaitByHour.length > 0
      ? averageWaitByHour.reduce((min, curr) =>
          curr.average < min.average ? curr : min
        )
      : { hour: 0, label: "N/A", average: 0, count: 0 };

  const tenMinuteBuckets = new Map<string, { total: number; count: number }>();

  for (const record of openRecords) {
    const date = new Date(record.timestamp);
    const hour = getHours(date);
    const minuteBucket = Math.floor(getMinutes(date) / 10) * 10;
    const key = `${hour}:${minuteBucket}`;
    const bucket = tenMinuteBuckets.get(key) ?? { total: 0, count: 0 };
    bucket.total += record.wait_time;
    bucket.count += 1;
    tenMinuteBuckets.set(key, bucket);
  }

  let bestBucket = { hour: 0, minute: 0, average: Infinity };
  for (const [key, { total, count }] of tenMinuteBuckets.entries()) {
    const [hourStr, minuteStr] = key.split(":");
    const average = total / count;
    if (average < bestBucket.average) {
      bestBucket = {
        hour: Number(hourStr),
        minute: Number(minuteStr),
        average: Math.round(average),
      };
    }
  }

  const lowestAverageWait =
    openRecords.length > 0
      ? Math.round(
          openRecords.reduce((sum, r) => sum + r.wait_time, 0) /
            openRecords.length
        )
      : 0;

  const hasEnoughDataForInsights = openRecords.length >= 3;

  return {
    averageWaitToday,
    peakWaitToday,
    lowestAverageWait,
    bestTimeToRide:
      !hasEnoughDataForInsights || bestBucket.average === Infinity
        ? "Not enough data"
        : formatHourMinute(bestBucket.hour, bestBucket.minute),
    bestTimeAverageWait:
      !hasEnoughDataForInsights || bestBucket.average === Infinity
        ? 0
        : bestBucket.average,
    averageWaitByHour,
    hourlyMinimum,
  };
}

export function computeParkStats(
  rides: { is_open: boolean; wait_time: number; name: string }[]
) {
  const openRides = rides.filter((r) => r.is_open);
  const waits = openRides.map((r) => r.wait_time);

  const averageWait =
    waits.length > 0
      ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length)
      : 0;

  const longest = openRides.reduce(
    (max, r) => (r.wait_time > max.wait_time ? r : max),
    openRides[0] ?? { wait_time: 0, name: "N/A" }
  );

  const lowest = openRides.reduce(
    (min, r) => (r.wait_time < min.wait_time ? r : min),
    openRides[0] ?? { wait_time: 0, name: "N/A" }
  );

  return {
    averageWait,
    openRides: openRides.length,
    totalRides: rides.length,
    longestWait: longest?.wait_time ?? 0,
    longestWaitRide: longest?.name ?? "N/A",
    lowestWait: lowest?.wait_time ?? 0,
    lowestWaitRide: lowest?.name ?? "N/A",
  };
}

export function findBestRideNow(
  rides: { is_open: boolean; wait_time: number; name: string; ride_id: number }[]
) {
  const open = rides.filter((r) => r.is_open);
  if (open.length === 0) return null;
  return open.reduce((best, r) => (r.wait_time < best.wait_time ? r : best));
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
