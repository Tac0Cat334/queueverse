import type { RideWithLiveData } from "@/types";
import { createServiceClient } from "@/lib/supabase";
import { roundToParkFiveMinutes } from "@/lib/park-time";

export { roundToParkFiveMinutes as roundToFiveMinutes };

export async function syncWaitTimeSnapshots(
  rides: RideWithLiveData[],
  timestamp = roundToParkFiveMinutes(new Date())
): Promise<{ saved: number }> {
  const supabase = createServiceClient();
  const ts = timestamp.toISOString();

  const rideRows = rides.map((ride) => ({
    ride_id: ride.ride_id,
    name: ride.name,
    land: ride.land,
  }));

  const waitRows = rides.map((ride) => ({
    ride_id: ride.ride_id,
    wait_time: ride.wait_time,
    is_open: ride.is_open,
    timestamp: ts,
  }));

  const { error: rideError } = await supabase
    .from("rides")
    .upsert(rideRows, { onConflict: "ride_id" });

  if (rideError) throw rideError;

  const { error: waitError } = await supabase.from("wait_times").upsert(waitRows, {
    onConflict: "ride_id,timestamp",
    ignoreDuplicates: true,
  });

  if (waitError) throw waitError;

  return { saved: rides.length };
}
