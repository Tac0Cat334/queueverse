import type { WaitTimeRecord } from "@/types";
import {
  bucketRecordsByHour,
  bucketRecordsByFiveMinutes,
  bucketRecordsByFifteenMinutes,
  findBestTenMinuteBucket,
  findPeakTenMinuteBucket,
  getSmartSlotAverage,
  bucketRecordsByTenMinutes,
  type HourBucket,
  type SlotAverage,
} from "@/lib/time-buckets";
import { formatHourMinute } from "@/utils/wait-time";
import { getParkDayOfWeek, getParkParts } from "@/lib/park-time";
import { countUniqueParkDays } from "@/lib/data-maturity";
import {
  filterEarlyEntryRecords,
  isEarlyEntryWindowHour,
} from "@/lib/analytics/operational-phases";
import { getDefaultPark } from "@/lib/parks";

export interface RideHistoricalBaseline {
  rideId: number;
  /** Current time-slot baseline */
  currentSlot: SlotAverage | null;
  /** Baseline from Early Entry hour snapshots only */
  earlyEntrySlot: SlotAverage | null;
  /** Weekday (Mon–Fri) average at current hour */
  weekdayAverageAtHour: number | null;
  weekdaySampleCount: number;
  /** Weekend (Sat–Sun) average at current hour */
  weekendAverageAtHour: number | null;
  weekendSampleCount: number;
  bestTimeLabel: string | null;
  bestTimeAverage: number | null;
  bestHour: number | null;
  bestMinute: number | null;
  peakTimeLabel: string | null;
  peakTimeAverage: number | null;
  peakHour: number | null;
  peakMinute: number | null;
  hourlyPattern: HourBucket[];
  volatilityScore: number;
  downtimePercent: number;
  uniqueDays: number;
  totalSnapshots: number;
}

function averageAtHourForDays(
  records: WaitTimeRecord[],
  hour: number,
  dayFilter: (dow: number) => boolean
): { average: number | null; count: number } {
  const open = records.filter((r) => {
    if (!r.is_open) return false;
    const parts = getParkParts(new Date(r.timestamp));
    return parts.hour === hour && dayFilter(getParkDayOfWeek(r.timestamp));
  });
  if (open.length < 2) return { average: null, count: open.length };
  const avg = Math.round(
    open.reduce((s, r) => s + r.wait_time, 0) / open.length
  );
  return { average: avg, count: open.length };
}

function computeVolatility(records: WaitTimeRecord[]): number {
  const open = records.filter((r) => r.is_open);
  if (open.length < 6) return 50;
  const waits = open.map((r) => r.wait_time);
  const mean = waits.reduce((s, w) => s + w, 0) / waits.length;
  const variance =
    waits.reduce((s, w) => s + (w - mean) ** 2, 0) / waits.length;
  return Math.min(100, Math.max(0, Math.round((Math.sqrt(variance) / 35) * 100)));
}

function computeDowntimePercent(records: WaitTimeRecord[]): number {
  if (records.length < 6) return 0;
  const closed = records.filter((r) => !r.is_open).length;
  return Math.round((closed / records.length) * 100);
}

/** Full historical baseline profile for a single ride */
export function buildRideHistoricalBaseline(
  rideId: number,
  records: WaitTimeRecord[],
  reference = new Date()
): RideHistoricalBaseline {
  const openRecords = records.filter((r) => r.is_open);
  const park = getDefaultPark();
  const inEarlyEntry = isEarlyEntryWindowHour(getParkParts(reference).hour, park);
  const eeRecords = filterEarlyEntryRecords(openRecords, park);
  const baselineRecords = inEarlyEntry && eeRecords.length >= 4 ? eeRecords : openRecords;

  const currentSlot = getSmartSlotAverage(baselineRecords, reference, 2);
  const earlyEntrySlot =
    eeRecords.length >= 2
      ? getSmartSlotAverage(eeRecords, reference, 2)
      : null;
  const hour = getParkParts(reference).hour;
  const hourlyPattern = bucketRecordsByHour(openRecords);
  const tenMin = bucketRecordsByTenMinutes(openRecords);
  const best = findBestTenMinuteBucket(tenMin);
  const peak = findPeakTenMinuteBucket(tenMin);

  const weekday = averageAtHourForDays(
    records,
    hour,
    (d) => d >= 1 && d <= 5
  );
  const weekend = averageAtHourForDays(records, hour, (d) => d === 0 || d === 6);

  return {
    rideId,
    currentSlot,
    earlyEntrySlot,
    weekdayAverageAtHour: weekday.average,
    weekdaySampleCount: weekday.count,
    weekendAverageAtHour: weekend.average,
    weekendSampleCount: weekend.count,
    bestTimeLabel:
      best.average === Infinity
        ? null
        : formatHourMinute(best.hour, best.minute),
    bestTimeAverage: best.average === Infinity ? null : best.average,
    bestHour: best.average === Infinity ? null : best.hour,
    bestMinute: best.average === Infinity ? null : best.minute,
    peakTimeLabel:
      peak.average === -Infinity
        ? null
        : formatHourMinute(peak.hour, peak.minute),
    peakTimeAverage: peak.average === -Infinity ? null : peak.average,
    peakHour: peak.average === -Infinity ? null : peak.hour,
    peakMinute: peak.average === -Infinity ? null : peak.minute,
    hourlyPattern,
    volatilityScore: computeVolatility(records),
    downtimePercent: computeDowntimePercent(records),
    uniqueDays: countUniqueParkDays(records),
    totalSnapshots: records.length,
  };
}

export interface RideAggregateProfile extends RideHistoricalBaseline {
  fiveMinuteBuckets: ReturnType<typeof bucketRecordsByFiveMinutes>;
  fifteenMinuteBuckets: ReturnType<typeof bucketRecordsByFifteenMinutes>;
}

/** Precomputed per-ride analytics — avoids repeated bucket scans */
export function buildRideAggregateProfile(
  rideId: number,
  records: WaitTimeRecord[],
  reference = new Date()
): RideAggregateProfile {
  const openRecords = records.filter((r) => r.is_open);
  const baseline = buildRideHistoricalBaseline(rideId, records, reference);
  return {
    ...baseline,
    fiveMinuteBuckets: bucketRecordsByFiveMinutes(openRecords),
    fifteenMinuteBuckets: bucketRecordsByFifteenMinutes(openRecords),
  };
}

export function buildAllRideAggregateProfiles(
  recordsByRide: Map<number, WaitTimeRecord[]>,
  reference = new Date()
): Map<number, RideAggregateProfile> {
  const profiles = new Map<number, RideAggregateProfile>();
  for (const [rideId, records] of recordsByRide.entries()) {
    profiles.set(rideId, buildRideAggregateProfile(rideId, records, reference));
  }
  return profiles;
}
