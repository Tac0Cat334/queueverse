import type {
  WaitTimeRecord,
  WeekdayCrowdInsight,
  WeekdayPatternsByRide,
} from "@/types";
import { getParkDateKey, getParkDayOfWeek } from "@/lib/park-time";
import { bucketRecordsByHour, type HourBucket } from "@/lib/time-buckets";
import { getWeekdayLabel } from "@/lib/data-maturity";

const MIN_WEEKDAY_HOURS = 2;
const MIN_WEEKDAY_DAYS = 2;

/** Hourly wait pattern for a single ride on a specific weekday (0=Sun … 6=Sat). */
export function computeWeekdayHourlyPattern(
  records: WaitTimeRecord[],
  dayOfWeek: number
): HourBucket[] {
  const filtered = records.filter(
    (record) =>
      record.is_open && getParkDayOfWeek(record.timestamp) === dayOfWeek
  );
  return bucketRecordsByHour(filtered);
}

export function countWeekdaySampleDays(
  records: WaitTimeRecord[],
  dayOfWeek: number
): number {
  const days = new Set<string>();
  for (const record of records) {
    if (getParkDayOfWeek(record.timestamp) !== dayOfWeek) continue;
    days.add(getParkDateKey(record.timestamp));
  }
  return days.size;
}

/** Precompute hourly patterns for all 7 weekdays per ride. */
export function computeWeekdayPatternsForRide(
  records: WaitTimeRecord[]
): Record<number, HourBucket[]> {
  const patterns: Record<number, HourBucket[]> = {};
  for (let dow = 0; dow <= 6; dow++) {
    patterns[dow] = computeWeekdayHourlyPattern(records, dow);
  }
  return patterns;
}

export function computeAllWeekdayPatterns(
  recordsByRide: Map<number, WaitTimeRecord[]>
): WeekdayPatternsByRide {
  const result: WeekdayPatternsByRide = {};
  for (const [rideId, records] of recordsByRide.entries()) {
    result[rideId] = computeWeekdayPatternsForRide(records);
  }
  return result;
}

export function hasReliableWeekdayPattern(
  pattern: HourBucket[] | undefined,
  records: WaitTimeRecord[],
  dayOfWeek: number
): boolean {
  if (!pattern || pattern.length < MIN_WEEKDAY_HOURS) return false;
  return countWeekdaySampleDays(records, dayOfWeek) >= MIN_WEEKDAY_DAYS;
}

export function getPatternForVisitDay(
  rideId: number,
  dayOfWeek: number,
  weekdayPatternsByRide: WeekdayPatternsByRide | undefined,
  fallbackPattern: HourBucket[],
  records?: WaitTimeRecord[]
): { pattern: HourBucket[]; usesWeekday: boolean; sampleDays: number } {
  const weekdayPattern = weekdayPatternsByRide?.[rideId]?.[dayOfWeek];
  const sampleDays = records
    ? countWeekdaySampleDays(records, dayOfWeek)
    : 0;

  if (
    weekdayPattern &&
    weekdayPattern.length >= MIN_WEEKDAY_HOURS &&
    sampleDays >= MIN_WEEKDAY_DAYS
  ) {
    return { pattern: weekdayPattern, usesWeekday: true, sampleDays };
  }

  return {
    pattern: fallbackPattern,
    usesWeekday: false,
    sampleDays,
  };
}

/** Park-wide crowd comparison for each weekday vs overall average. */
export function computeParkWeekdayInsights(
  records: WaitTimeRecord[]
): Record<number, WeekdayCrowdInsight> {
  const open = records.filter((r) => r.is_open);
  const overallAvg =
    open.length > 0
      ? open.reduce((s, r) => s + r.wait_time, 0) / open.length
      : 0;

  const insights: Record<number, WeekdayCrowdInsight> = {};

  for (let dow = 0; dow <= 6; dow++) {
    const dayRecords = open.filter(
      (r) => getParkDayOfWeek(r.timestamp) === dow
    );
    const sampleDays = countWeekdaySampleDays(records, dow);

    if (dayRecords.length < 6 || sampleDays < 1) continue;

    const averageWait = Math.round(
      dayRecords.reduce((s, r) => s + r.wait_time, 0) / dayRecords.length
    );

    const vsOverallPercent =
      overallAvg > 0
        ? Math.round(((averageWait - overallAvg) / overallAvg) * 100)
        : 0;

    const crowdLevel: WeekdayCrowdInsight["crowdLevel"] =
      vsOverallPercent >= 12
        ? "busier"
        : vsOverallPercent <= -12
          ? "lighter"
          : "typical";

    const refDates = [
      "2024-01-07",
      "2024-01-01",
      "2024-01-02",
      "2024-01-03",
      "2024-01-04",
      "2024-01-05",
      "2024-01-06",
    ];
    const label = getWeekdayLabel(refDates[dow]);

    let message = `${label}s are typical compared to other days.`;
    if (crowdLevel === "busier") {
      message = `${label}s run ~${vsOverallPercent}% busier — prioritize headliners early or use afternoon low windows.`;
    } else if (crowdLevel === "lighter") {
      message = `${label}s are ~${Math.abs(vsOverallPercent)}% lighter — more flexible scheduling.`;
    }

    insights[dow] = {
      dayOfWeek: dow,
      label,
      averageWait,
      sampleDays,
      vsOverallPercent,
      crowdLevel,
      message,
    };
  }

  return insights;
}

export function getVisitDayInsight(
  insights: Record<number, WeekdayCrowdInsight> | undefined,
  dayOfWeek: number
): WeekdayCrowdInsight | null {
  return insights?.[dayOfWeek] ?? null;
}
