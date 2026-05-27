import type { ChartDataPoint, RideWithLiveData, WaitTimeRecord } from "@/types";
import { isWithinDataCollectionWindow } from "@/lib/park-hours";
import { formatParkTime, isWithinParkDay } from "@/lib/park-time";
import { roundToFiveMinutes } from "@/lib/sync-snapshot";

const BUCKET_MS = 5 * 60 * 1000;

function toChartPoint(record: WaitTimeRecord): ChartDataPoint {
  return {
    timestamp: record.timestamp,
    wait_time: record.is_open ? record.wait_time : null,
    is_open: record.is_open,
    operational_status: record.is_open ? "open" : "closed",
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

function hasBucket(points: ChartDataPoint[], bucketMs: number): boolean {
  return points.some(
    (p) =>
      Math.abs(
        roundToFiveMinutes(new Date(p.timestamp)).getTime() - bucketMs
      ) < BUCKET_MS / 2
  );
}

function isOpenChartPoint(point: ChartDataPoint): boolean {
  return point.is_open !== false && point.wait_time !== null;
}

/** Drop pre-opening closed snapshots — chart starts when the ride first has open data */
export function trimLeadingClosedSnapshots(
  points: ChartDataPoint[]
): ChartDataPoint[] {
  const firstOpen = points.findIndex(isOpenChartPoint);
  if (firstOpen === -1) return [];
  return points.slice(firstOpen);
}

/** Build today's chart purely from server-collected history (Supabase). */
export function buildTodayChartData(
  records: WaitTimeRecord[],
  liveRide?: Pick<RideWithLiveData, "wait_time" | "is_open" | "last_updated">
): ChartDataPoint[] {
  const now = new Date();

  const points = records
    .filter(
      (r) =>
        isWithinParkDay(r.timestamp, now) &&
        isWithinDataCollectionWindow(r.timestamp)
    )
    .map(toChartPoint);

  let merged = mergeChartPoints(points);

  // Only add live reading if this 5-min bucket isn't in the database yet
  if (liveRide?.is_open) {
    const bucket = roundToFiveMinutes(now).getTime();
    if (!hasBucket(merged, bucket)) {
      merged = mergeChartPoints([
        ...merged,
        {
          timestamp: new Date(bucket).toISOString(),
          wait_time: liveRide.wait_time,
          is_open: true,
          label: `${formatParkTime(bucket)} (live)`,
        },
      ]);
    }
  }

  return trimLeadingClosedSnapshots(merged);
}
