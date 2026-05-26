import type { WaitTimeRecord } from "@/types";
import { formatHourLabel, formatHourMinute } from "@/utils/wait-time";
import { getParkParts, getParkDayOfWeek } from "@/lib/park-time";
import { recencyWeight } from "@/lib/analytics/recency";

export { recencyWeight };

export interface TimeBucket {
  key: string;
  hour: number;
  minute: number;
  label: string;
}

export interface HourBucket {
  hour: number;
  label: string;
  average: number;
  count: number;
}

export interface SlotAverage {
  average: number;
  sampleCount: number;
  bucketLabel: string;
  hour: number;
  minute: number;
  /** How the average was derived */
  source: "5min" | "10min" | "15min" | "hour" | "weekday" | "recency";
  /** Effective weighted sample strength */
  effectiveSamples?: number;
  weekdayAverage?: number | null;
  weekdaySampleCount?: number;
}

export function getFiveMinuteBucket(date: Date | string): TimeBucket {
  const parts = getParkParts(new Date(date));
  const minute = Math.floor(parts.minute / 5) * 5;
  return {
    key: `${parts.hour}:${minute.toString().padStart(2, "0")}`,
    hour: parts.hour,
    minute,
    label: formatHourMinute(parts.hour, minute),
  };
}

export function getFifteenMinuteBucket(date: Date | string): TimeBucket {
  const parts = getParkParts(new Date(date));
  const minute = Math.floor(parts.minute / 15) * 15;
  return {
    key: `${parts.hour}:${minute.toString().padStart(2, "0")}`,
    hour: parts.hour,
    minute,
    label: formatHourMinute(parts.hour, minute),
  };
}

export function getTenMinuteBucket(date: Date | string): TimeBucket {
  const parts = getParkParts(new Date(date));
  const minute = Math.floor(parts.minute / 10) * 10;
  return {
    key: `${parts.hour}:${minute.toString().padStart(2, "0")}`,
    hour: parts.hour,
    minute,
    label: formatHourMinute(parts.hour, minute),
  };
}

export function getHourBucket(date: Date | string): { hour: number; label: string } {
  const hour = getParkParts(new Date(date)).hour;
  return { hour, label: formatHourLabel(hour) };
}

function accumulateBucket(
  buckets: Map<string, { total: number; count: number; hour: number; minute: number }>,
  key: string,
  hour: number,
  minute: number,
  waitTime: number
) {
  const bucket = buckets.get(key) ?? { total: 0, count: 0, hour, minute };
  bucket.total += waitTime;
  bucket.count += 1;
  buckets.set(key, bucket);
}

export function bucketRecordsByFiveMinutes(records: WaitTimeRecord[]) {
  const buckets = new Map<
    string,
    { total: number; count: number; hour: number; minute: number }
  >();

  for (const record of records) {
    if (!record.is_open) continue;
    const slot = getFiveMinuteBucket(record.timestamp);
    accumulateBucket(buckets, slot.key, slot.hour, slot.minute, record.wait_time);
  }

  return buckets;
}

export function bucketRecordsByFifteenMinutes(records: WaitTimeRecord[]) {
  const buckets = new Map<
    string,
    { total: number; count: number; hour: number; minute: number }
  >();

  for (const record of records) {
    if (!record.is_open) continue;
    const slot = getFifteenMinuteBucket(record.timestamp);
    accumulateBucket(buckets, slot.key, slot.hour, slot.minute, record.wait_time);
  }

  return buckets;
}

export function bucketRecordsByTenMinutes(records: WaitTimeRecord[]) {
  const buckets = new Map<
    string,
    { total: number; count: number; hour: number; minute: number }
  >();

  for (const record of records) {
    if (!record.is_open) continue;
    const slot = getTenMinuteBucket(record.timestamp);
    accumulateBucket(buckets, slot.key, slot.hour, slot.minute, record.wait_time);
  }

  return buckets;
}

export function bucketRecordsByHour(records: WaitTimeRecord[]): HourBucket[] {
  const buckets = new Map<number, { total: number; count: number }>();

  for (const record of records) {
    if (!record.is_open) continue;
    const hour = getParkParts(new Date(record.timestamp)).hour;
    const bucket = buckets.get(hour) ?? { total: 0, count: 0 };
    bucket.total += record.wait_time;
    bucket.count += 1;
    buckets.set(hour, bucket);
  }

  return Array.from(buckets.entries())
    .map(([hour, { total, count }]) => ({
      hour,
      label: formatHourLabel(hour),
      average: Math.round(total / count),
      count,
    }))
    .sort((a, b) => a.hour - b.hour);
}

function averageMatchingSlot(
  records: WaitTimeRecord[],
  hour: number,
  minute: number,
  slotSize: 5 | 10 | 15 | 60,
  weekdayFilter?: number
): SlotAverage | null {
  const open = records.filter((r) => r.is_open);
  if (open.length === 0) return null;

  const matches = open.filter((record) => {
    const parts = getParkParts(new Date(record.timestamp));
    if (weekdayFilter !== undefined && getParkDayOfWeek(record.timestamp) !== weekdayFilter) {
      return false;
    }
    if (slotSize === 60) return parts.hour === hour;
    const recordMinute =
      slotSize === 5
        ? Math.floor(parts.minute / 5) * 5
        : slotSize === 10
          ? Math.floor(parts.minute / 10) * 10
          : Math.floor(parts.minute / 15) * 15;
    return parts.hour === hour && recordMinute === minute;
  });

  if (matches.length === 0) return null;

  const average = Math.round(
    matches.reduce((sum, r) => sum + r.wait_time, 0) / matches.length
  );

  const source: SlotAverage["source"] =
    slotSize === 60
      ? "hour"
      : slotSize === 15
        ? "15min"
        : slotSize === 10
          ? "10min"
          : "5min";

  return {
    average,
    sampleCount: matches.length,
    bucketLabel:
      slotSize === 60
        ? formatHourLabel(hour)
        : formatHourMinute(hour, minute),
    hour,
    minute,
    source,
  };
}

function recencyWeightedSlotAverage(
  records: WaitTimeRecord[],
  hour: number,
  minute: number,
  slotSize: 5 | 10 | 15 | 60,
  reference: Date,
  weekdayFilter?: number
): SlotAverage | null {
  const open = records.filter((r) => r.is_open);
  if (open.length === 0) return null;

  let weightedSum = 0;
  let weightTotal = 0;
  let rawCount = 0;

  for (const record of open) {
    const parts = getParkParts(new Date(record.timestamp));
    if (weekdayFilter !== undefined && getParkDayOfWeek(record.timestamp) !== weekdayFilter) {
      continue;
    }
    let matches = false;
    if (slotSize === 60) {
      matches = parts.hour === hour;
    } else {
      const recordMinute =
        slotSize === 5
          ? Math.floor(parts.minute / 5) * 5
          : slotSize === 10
            ? Math.floor(parts.minute / 10) * 10
            : Math.floor(parts.minute / 15) * 15;
      matches = parts.hour === hour && recordMinute === minute;
    }
    if (!matches) continue;

    const weight = recencyWeight(new Date(record.timestamp), reference);
    weightedSum += record.wait_time * weight;
    weightTotal += weight;
    rawCount += 1;
  }

  if (weightTotal <= 0 || rawCount === 0) return null;

  return {
    average: Math.round(weightedSum / weightTotal),
    sampleCount: rawCount,
    effectiveSamples: Math.round(weightTotal),
    bucketLabel:
      slotSize === 60
        ? formatHourLabel(hour)
        : formatHourMinute(hour, minute),
    hour,
    minute,
    source: weekdayFilter !== undefined ? "weekday" : "recency",
  };
}

/**
 * Smart baseline: prefers same-weekday + recency-weighted slot data,
 * falls back to broader buckets as sample count grows.
 */
export function getSmartSlotAverage(
  records: WaitTimeRecord[],
  reference: Date | string = new Date(),
  minSamples = 2
): SlotAverage | null {
  const ref = new Date(reference);
  const slot = getFiveMinuteBucket(ref);
  const weekday = getParkDayOfWeek(ref);

  // Same weekday + 5-min slot (best signal once we have multiple weeks)
  const weekdayFive = recencyWeightedSlotAverage(
    records,
    slot.hour,
    slot.minute,
    5,
    ref,
    weekday
  );
  if (weekdayFive && weekdayFive.sampleCount >= minSamples) {
    return {
      ...weekdayFive,
      weekdayAverage: weekdayFive.average,
      weekdaySampleCount: weekdayFive.sampleCount,
      average: weekdayFive.average,
      source: "weekday",
    };
  }

  // Recency-weighted 5-min across all days
  const recencyFive = recencyWeightedSlotAverage(
    records,
    slot.hour,
    slot.minute,
    5,
    ref
  );
  if (recencyFive && recencyFive.sampleCount >= minSamples) {
    const weekdayTen = recencyWeightedSlotAverage(
      records,
      slot.hour,
      Math.floor(slot.minute / 10) * 10,
      10,
      ref,
      weekday
    );
    return {
      ...recencyFive,
      weekdayAverage: weekdayTen?.average ?? null,
      weekdaySampleCount: weekdayTen?.sampleCount ?? 0,
    };
  }

  // Fall back to standard cascade
  return getHistoricalAverageForSlot(records, ref, minSamples);
}

/** Historical average for the same clock-time slot across all collected days. */
export function getHistoricalAverageForSlot(
  records: WaitTimeRecord[],
  reference: Date | string = new Date(),
  minSamples = 2
): SlotAverage | null {
  const ref = new Date(reference);
  const slot = getFiveMinuteBucket(ref);
  const fiveMin = averageMatchingSlot(
    records,
    slot.hour,
    slot.minute,
    5
  );
  if (fiveMin && fiveMin.sampleCount >= minSamples) return fiveMin;

  const fifteenMin = averageMatchingSlot(
    records,
    slot.hour,
    Math.floor(slot.minute / 15) * 15,
    15
  );
  if (fifteenMin && fifteenMin.sampleCount >= minSamples) return fifteenMin;

  const tenMin = averageMatchingSlot(
    records,
    slot.hour,
    Math.floor(slot.minute / 10) * 10,
    10
  );
  if (tenMin && tenMin.sampleCount >= minSamples) return tenMin;

  const hourAvg = averageMatchingSlot(records, slot.hour, 0, 60);
  if (hourAvg && hourAvg.sampleCount >= minSamples) return hourAvg;

  return fiveMin ?? fifteenMin ?? tenMin ?? hourAvg;
}

export function getHistoricalAverageForHour(
  records: WaitTimeRecord[],
  hour: number,
  minSamples = 2
): number | null {
  const result = averageMatchingSlot(records, hour, 0, 60);
  if (!result || result.sampleCount < minSamples) return null;
  return result.average;
}

export function findBestTenMinuteBucket(
  buckets: Map<string, { total: number; count: number; hour: number; minute: number }>
) {
  let best = { hour: 0, minute: 0, average: Infinity };
  for (const { total, count, hour, minute } of buckets.values()) {
    const average = total / count;
    if (average < best.average) {
      best = { hour, minute, average: Math.round(average) };
    }
  }
  return best;
}

export function findPeakTenMinuteBucket(
  buckets: Map<string, { total: number; count: number; hour: number; minute: number }>
) {
  let peak = { hour: 0, minute: 0, average: -Infinity };
  for (const { total, count, hour, minute } of buckets.values()) {
    const average = total / count;
    if (average > peak.average) {
      peak = { hour, minute, average: Math.round(average) };
    }
  }
  return peak;
}
