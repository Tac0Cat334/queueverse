import type { ChartDataPoint, RideWithLiveData, WaitTimeRecord } from "@/types";
import { formatParkTime, isWithinParkDay } from "@/lib/park-time";

const STORAGE_PREFIX = "qv-daily-chart-";
const BUCKET_MS = 5 * 60 * 1000;

function parkDateKey(reference = new Date()): string {
  return reference.toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });
}

function roundToFiveMinutes(date: Date): Date {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);
  rounded.setMilliseconds(0);
  rounded.setMinutes(Math.floor(rounded.getMinutes() / 5) * 5);
  return rounded;
}

function bufferKey(rideId: number, reference = new Date()): string {
  return `${STORAGE_PREFIX}${rideId}-${parkDateKey(reference)}`;
}

function readBuffer(key: string): ChartDataPoint[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeBuffer(key: string, points: ChartDataPoint[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(points));
}

/** Persist a 5-min snapshot locally so the chart grows through the day. */
export function appendDailySnapshot(
  rideId: number,
  waitTime: number,
  isOpen: boolean,
  timestamp = new Date()
): ChartDataPoint[] {
  if (typeof window === "undefined" || !isOpen) return getDailyBuffer(rideId);

  const rounded = roundToFiveMinutes(timestamp);
  const key = bufferKey(rideId, timestamp);
  const points = readBuffer(key);
  const point: ChartDataPoint = {
    timestamp: rounded.toISOString(),
    wait_time: waitTime,
    label: formatParkTime(rounded),
  };

  const bucket = rounded.getTime();
  const idx = points.findIndex(
    (p) => Math.abs(new Date(p.timestamp).getTime() - bucket) < BUCKET_MS / 2
  );

  if (idx >= 0) {
    points[idx] = point;
  } else {
    points.push(point);
  }

  points.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  writeBuffer(key, points);
  return points;
}

export function getDailyBuffer(rideId: number, reference = new Date()): ChartDataPoint[] {
  return readBuffer(bufferKey(rideId, reference));
}

function toChartPoint(record: WaitTimeRecord): ChartDataPoint | null {
  if (!record.is_open) return null;
  return {
    timestamp: record.timestamp,
    wait_time: record.wait_time,
    label: formatParkTime(record.timestamp),
  };
}

function mergeChartPoints(points: ChartDataPoint[]): ChartDataPoint[] {
  const byBucket = new Map<number, ChartDataPoint>();

  for (const point of points) {
    const bucket = roundToFiveMinutes(new Date(point.timestamp)).getTime();
    byBucket.set(bucket, point);
  }

  return Array.from(byBucket.entries())
    .sort(([a], [b]) => a - b)
    .map(([, point]) => point);
}

/** Merge Supabase history + local buffer into today's chart line. */
export function buildTodayChartData(
  records: WaitTimeRecord[],
  rideId: number,
  liveRide?: Pick<RideWithLiveData, "wait_time" | "is_open" | "last_updated">
): ChartDataPoint[] {
  const now = new Date();

  const fromDb = records
    .filter((r) => isWithinParkDay(r.timestamp, now))
    .map(toChartPoint)
    .filter((p): p is ChartDataPoint => p !== null);

  const fromBuffer = getDailyBuffer(rideId, now);

  let merged = mergeChartPoints([...fromDb, ...fromBuffer]);

  if (liveRide?.is_open) {
    merged = mergeChartPoints([
      ...merged,
      ...appendDailySnapshot(rideId, liveRide.wait_time, true, now),
    ]);
  }

  return merged;
}

export function countTodaySnapshots(
  records: WaitTimeRecord[],
  rideId: number
): number {
  return buildTodayChartData(records, rideId).length;
}
