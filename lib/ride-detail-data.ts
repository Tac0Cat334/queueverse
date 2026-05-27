import { subDays } from "date-fns";
import type { RideWithLiveData, WaitTimeRecord } from "@/types";
import { fetchLiveQueueTimes, flattenRides, stampFetchTime } from "@/lib/queue-times";
import { filterRecordsToCollectionWindow } from "@/lib/park-hours";
import { createServiceClient, isSupabaseConfigured } from "@/lib/supabase";

export interface RideDetailInitialData {
  rides: RideWithLiveData[];
  records: WaitTimeRecord[];
  configured: boolean;
}

export async function loadRideDetailInitialData(
  rideId: number
): Promise<RideDetailInitialData> {
  const configured = isSupabaseConfigured();

  const [liveResult, recordsResult] = await Promise.all([
    fetchLiveQueueTimes({ noStore: false }).catch(() => null),
    configured ? loadRideHistoryRecords(rideId) : Promise.resolve([]),
  ]);

  const fetchedAt = new Date().toISOString();
  const reference = new Date(fetchedAt);
  const rides = liveResult
    ? stampFetchTime(flattenRides(liveResult, reference), fetchedAt)
    : [];

  return {
    rides,
    records: recordsResult,
    configured,
  };
}

async function loadRideHistoryRecords(rideId: number): Promise<WaitTimeRecord[]> {
  const since = subDays(new Date(), 30);
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("wait_times")
    .select("id, ride_id, wait_time, is_open, timestamp")
    .eq("ride_id", rideId)
    .gte("timestamp", since.toISOString())
    .order("timestamp", { ascending: true });

  if (error || !data) return [];

  return filterRecordsToCollectionWindow(data);
}
