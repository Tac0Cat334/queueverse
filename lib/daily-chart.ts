import type { ChartDataPoint, RideWithLiveData, WaitTimeRecord } from "@/types";
import { isWithinDataCollectionWindow } from "@/lib/park-hours";
import {
  formatParkTime,
  getParkStartOfDay,
  isWithinParkDay,
} from "@/lib/park-time";
import { roundToFiveMinutes } from "@/lib/sync-snapshot";

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

function bucketKey(timestamp: string): number {
  return roundToFiveMinutes(new Date(timestamp)).getTime();
}

function isLiveRideOpen(
  ride: Pick<RideWithLiveData, "is_open" | "operationalStatus">
): boolean {
  return ride.operationalStatus === "open" || ride.is_open;
}

function filterTodayRecords(
  records: WaitTimeRecord[],
  reference = new Date()
): WaitTimeRecord[] {
  const dayStart = getParkStartOfDay(reference).getTime();

  return records.filter((r) => {
    const ts = new Date(r.timestamp).getTime();
    return (
      ts >= dayStart &&
      isWithinParkDay(r.timestamp, reference) &&
      isWithinDataCollectionWindow(r.timestamp)
    );
  });
}

/** Build today's chart from all snapshots collected today (open and closed). */
export function buildTodayChartData(
  records: WaitTimeRecord[],
  liveRide?: Pick<
    RideWithLiveData,
    "wait_time" | "is_open" | "operationalStatus" | "last_updated"
  >
): ChartDataPoint[] {
  const now = new Date();
  const points = filterTodayRecords(records, now).map(toChartPoint);
  let merged = mergeChartPoints(points);

  if (liveRide && isLiveRideOpen(liveRide)) {
    const bucket = roundToFiveMinutes(now).getTime();
    const livePoint: ChartDataPoint = {
      timestamp: new Date(bucket).toISOString(),
      wait_time: liveRide.wait_time,
      is_open: true,
      operational_status: "open",
      label: `${formatParkTime(bucket)} (live)`,
    };

    const withoutCurrentBucket = merged.filter(
      (p) => bucketKey(p.timestamp) !== bucket
    );
    merged = mergeChartPoints([...withoutCurrentBucket, livePoint]);
  }

  return merged;
}
