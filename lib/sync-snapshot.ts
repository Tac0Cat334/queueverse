import type { RideWithLiveData } from "@/types";
import { createServiceClient } from "@/lib/supabase";

export function roundToFiveMinutes(date: Date): Date {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);
  rounded.setMilliseconds(0);
  rounded.setMinutes(Math.floor(rounded.getMinutes() / 5) * 5);
  return rounded;
}

export async function syncWaitTimeSnapshots(
  rides: RideWithLiveData[],
  timestamp = roundToFiveMinutes(new Date())
): Promise<{ saved: number }> {
  const supabase = createServiceClient();
  const ts = timestamp.toISOString();

  await Promise.all(
    rides.map((ride) =>
      supabase.from("rides").upsert(
        {
          ride_id: ride.ride_id,
          name: ride.name,
          land: ride.land,
        },
        { onConflict: "ride_id" }
      )
    )
  );

  await Promise.all(
    rides.map((ride) =>
      supabase.from("wait_times").upsert(
        {
          ride_id: ride.ride_id,
          wait_time: ride.wait_time,
          is_open: ride.is_open,
          timestamp: ts,
        },
        { onConflict: "ride_id,timestamp", ignoreDuplicates: true }
      )
    )
  );

  return { saved: rides.length };
}
