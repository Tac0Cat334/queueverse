import type { ChartDataPoint, RideWithLiveData, WaitTimeRecord } from "@/types";
import { formatParkTime, isWithinParkDay } from "@/lib/park-time";

const LIVE_POINT_GAP_MS = 4 * 60 * 1000;

/** Build today's chart points — park day only, grows every 5 min, resets at midnight ET. */
export function buildTodayChartData(
  records: WaitTimeRecord[],
  liveRide?: Pick<RideWithLiveData, "wait_time" | "is_open" | "last_updated">
): ChartDataPoint[] {
  const now = new Date();

  const todayOpen = records
    .filter((r) => isWithinParkDay(r.timestamp, now) && r.is_open)
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )
    .map((r) => ({
      timestamp: r.timestamp,
      wait_time: r.wait_time,
      label: formatParkTime(r.timestamp),
    }));

  if (!liveRide?.is_open) {
    return todayOpen;
  }

  const last = todayOpen[todayOpen.length - 1];
  const lastUpdatedMs = new Date(liveRide.last_updated).getTime();
  const nowMs = now.getTime();

  if (
    last &&
    Math.abs(new Date(last.timestamp).getTime() - lastUpdatedMs) <
      LIVE_POINT_GAP_MS
  ) {
    return todayOpen;
  }

  if (
    last &&
    Math.abs(new Date(last.timestamp).getTime() - nowMs) < LIVE_POINT_GAP_MS
  ) {
    return todayOpen;
  }

  const liveTimestamp = isWithinParkDay(liveRide.last_updated, now)
    ? liveRide.last_updated
    : now.toISOString();

  return [
    ...todayOpen,
    {
      timestamp: liveTimestamp,
      wait_time: liveRide.wait_time,
      label: `${formatParkTime(liveTimestamp)} (live)`,
    },
  ];
}

export function countTodaySnapshots(records: WaitTimeRecord[]): number {
  const now = new Date();
  return records.filter(
    (r) => isWithinParkDay(r.timestamp, now) && r.is_open
  ).length;
}
