import type { RideWithLiveData } from "@/types";
import { WAIT_THRESHOLDS } from "@/lib/constants";

export interface ParkIntelligenceData {
  averageWait: number;
  openRides: number;
  closedRides: number;
  totalRides: number;
  busiestRide: { name: string; wait_time: number };
  quietestRide: { name: string; wait_time: number };
  shortWaitCount: number;
  bestRideNow: RideWithLiveData | null;
}

export function computeParkIntelligence(
  rides: RideWithLiveData[]
): ParkIntelligenceData {
  const open = rides.filter((r) => r.is_open);
  const closed = rides.filter((r) => !r.is_open);
  const waits = open.map((r) => r.wait_time);

  const averageWait =
    waits.length > 0
      ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length)
      : 0;

  const busiest =
    open.length > 0
      ? open.reduce((max, r) => (r.wait_time > max.wait_time ? r : max))
      : { name: "—", wait_time: 0 };

  const quietest =
    open.length > 0
      ? open.reduce((min, r) => (r.wait_time < min.wait_time ? r : min))
      : { name: "—", wait_time: 0 };

  const shortWaitCount = open.filter(
    (r) => r.wait_time <= WAIT_THRESHOLDS.low
  ).length;

  const bestRideNow =
    open.length > 0
      ? open.reduce((best, r) => (r.wait_time < best.wait_time ? r : best))
      : null;

  return {
    averageWait,
    openRides: open.length,
    closedRides: closed.length,
    totalRides: rides.length,
    busiestRide: { name: busiest.name, wait_time: busiest.wait_time },
    quietestRide: { name: quietest.name, wait_time: quietest.wait_time },
    shortWaitCount,
    bestRideNow,
  };
}
