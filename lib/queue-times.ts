import type { QueueTimesResponse, RideWithLiveData } from "@/types";
import { EPIC_UNIVERSE_PARK_ID, QUEUE_TIMES_BASE_URL } from "@/lib/constants";
import { formatRideName } from "@/lib/ride-names";

export async function fetchLiveQueueTimes(
  options?: { noStore?: boolean }
): Promise<QueueTimesResponse> {
  const res = await fetch(
    `${QUEUE_TIMES_BASE_URL}/parks/${EPIC_UNIVERSE_PARK_ID}/queue_times.json`,
    options?.noStore ? { cache: "no-store" } : { next: { revalidate: 60 } }
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch queue times: ${res.status}`);
  }

  return res.json();
}

export function isMainRide(name: string): boolean {
  return !/single rider/i.test(name);
}

export function flattenRides(data: QueueTimesResponse): RideWithLiveData[] {
  return data.lands.flatMap((land) =>
    land.rides
      .filter((ride) => isMainRide(ride.name))
      .map((ride) => ({
      id: String(ride.id),
      ride_id: ride.id,
        name: formatRideName(ride.name),
      land: land.name,
      is_open: ride.is_open,
      wait_time: ride.wait_time,
      last_updated: ride.last_updated,
    }))
  );
}

export function getLatestUpdateTime(rides: RideWithLiveData[]): string | null {
  if (rides.length === 0) return null;
  return rides.reduce((latest, ride) => {
    if (!latest) return ride.last_updated;
    return new Date(ride.last_updated) > new Date(latest)
      ? ride.last_updated
      : latest;
  }, rides[0].last_updated);
}
