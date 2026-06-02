import { subDays } from "date-fns";
import type { RideWithLiveData, WaitTimeRecord } from "@/types";
import { fetchLiveQueueTimes, flattenRides, stampFetchTime } from "@/lib/queue-times";
import { filterRecordsToCollectionWindow } from "@/lib/park-hours";
import {
  createServiceClient,
  fetchWaitTimesForRide,
  isSupabaseConfigured,
} from "@/lib/supabase";
import { getParkEndOfDay, getParkStartOfDay } from "@/lib/park-time";

export interface RideDetailInitialData {
  rides: RideWithLiveData[];
  /** Full 30d history for analytics */
  records: WaitTimeRecord[];
  /** Today's snapshots for the daily chart */
  todayRecords: WaitTimeRecord[];
  configured: boolean;
}

function mergeRecordsByTimestamp(
  ...groups: WaitTimeRecord[][]
): WaitTimeRecord[] {
  const byKey = new Map<string, WaitTimeRecord>();
  for (const group of groups) {
    for (const record of group) {
      byKey.set(`${record.ride_id}-${record.timestamp}`, record);
    }
  }
  return Array.from(byKey.values()).sort(
    (a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

export async function loadRideDetailInitialData(
  rideId: number
): Promise<RideDetailInitialData> {
  const configured = isSupabaseConfigured();

  const [liveResult, historyResult] = await Promise.all([
    fetchLiveQueueTimes({ noStore: false }).catch(() => null),
    configured ? loadRideHistoryRecords(rideId) : Promise.resolve({
      records: [] as WaitTimeRecord[],
      todayRecords: [] as WaitTimeRecord[],
    }),
  ]);

  const fetchedAt = new Date().toISOString();
  const reference = new Date(fetchedAt);
  const rides = liveResult
    ? stampFetchTime(flattenRides(liveResult, reference), fetchedAt)
    : [];

  return {
    rides,
    records: historyResult.records,
    todayRecords: historyResult.todayRecords,
    configured,
  };
}

async function loadRideHistoryRecords(rideId: number): Promise<{
  records: WaitTimeRecord[];
  todayRecords: WaitTimeRecord[];
}> {
  const supabase = createServiceClient();
  const since = subDays(new Date(), 30);
  const dayStart = getParkStartOfDay();
  const dayEnd = getParkEndOfDay();

  const [todayRaw, historyRaw] = await Promise.all([
    fetchWaitTimesForRide(supabase, rideId, dayStart, dayEnd),
    fetchWaitTimesForRide(supabase, rideId, since),
  ]);

  const todayRecords = filterRecordsToCollectionWindow(todayRaw);
  const records = filterRecordsToCollectionWindow(
    mergeRecordsByTimestamp(historyRaw, todayRecords)
  );

  return { records, todayRecords };
}
