import { subDays } from "date-fns";
import type { WaitTimeRecord, RideWithLiveData, ParkRecommendations } from "@/types";
import { isSupabaseConfigured, createServiceClient } from "@/lib/supabase";
import { fetchLiveQueueTimes, flattenRides, stampFetchTime } from "@/lib/queue-times";
import { computeParkRecommendations } from "@/lib/ride-intelligence";
import { buildAllRideAggregateProfiles } from "@/lib/analytics/baselines";
import type { RideAggregateProfile } from "@/lib/analytics/baselines";
import { cacheKey, getCached, setCached } from "@/lib/analytics/cache";
import { filterRecordsToCollectionWindow } from "@/lib/park-hours";
import { getDefaultPark } from "@/lib/parks";

const HISTORY_DAYS = 30;
const CACHE_TTL_MS = 90_000;

export interface IntelligenceContext {
  rides: RideWithLiveData[];
  recordsByRide: Map<number, WaitTimeRecord[]>;
  aggregateProfiles: Map<number, RideAggregateProfile>;
  recommendations: ParkRecommendations;
  configured: boolean;
  parkId: string;
  loadedAt: string;
}

async function loadHistoricalRecords(): Promise<Map<number, WaitTimeRecord[]>> {
  const byRide = new Map<number, WaitTimeRecord[]>();
  if (!isSupabaseConfigured()) return byRide;

  const since = subDays(new Date(), HISTORY_DAYS).toISOString();
  const supabase = createServiceClient();

  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("wait_times")
      .select("id, ride_id, wait_time, is_open, timestamp")
      .gte("timestamp", since)
      .order("timestamp", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error || !data?.length) break;

    for (const record of filterRecordsToCollectionWindow(data)) {
      const list = byRide.get(record.ride_id) ?? [];
      list.push(record);
      byRide.set(record.ride_id, list);
    }

    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return byRide;
}

export async function loadIntelligenceContext(options?: {
  skipCache?: boolean;
}): Promise<IntelligenceContext> {
  const key = cacheKey("intelligence");
  if (!options?.skipCache) {
    const cached = getCached<IntelligenceContext>(key);
    if (cached) return cached;
  }

  const fetchedAt = new Date().toISOString();
  const reference = new Date(fetchedAt);
  const liveData = await fetchLiveQueueTimes({ noStore: false });
  const rides = stampFetchTime(flattenRides(liveData, reference), fetchedAt);
  const configured = isSupabaseConfigured();
  const recordsByRide = configured
    ? await loadHistoricalRecords()
    : new Map<number, WaitTimeRecord[]>();

  const aggregateProfiles = buildAllRideAggregateProfiles(recordsByRide);
  const recommendations = computeParkRecommendations(
    rides,
    recordsByRide,
    aggregateProfiles
  );

  const context: IntelligenceContext = {
    rides,
    recordsByRide,
    aggregateProfiles,
    recommendations,
    configured,
    parkId: getDefaultPark().id,
    loadedAt: fetchedAt,
  };

  if (configured) {
    setCached(key, context, CACHE_TTL_MS);
  }

  return context;
}
