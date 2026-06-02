import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Ride, WaitTimeRecord } from "@/types";
import { filterRecordsToCollectionWindow } from "@/lib/park-hours";
import { getParkEndOfDay, getParkStartOfDay } from "@/lib/park-time";

const WAIT_TIMES_PAGE_SIZE = 1000;

let supabaseClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }
  if (!supabaseClient) {
    supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return supabaseClient;
}

export function createServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey);
}

export async function getRides(): Promise<Ride[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("rides")
    .select("*")
    .order("name");

  if (error) throw error;
  return data ?? [];
}

export async function getRideByRideId(rideId: number): Promise<Ride | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("rides")
    .select("*")
    .eq("ride_id", rideId)
    .single();

  if (error) return null;
  return data;
}

/** Paginate past Supabase's default 1000-row cap (ascending order misses today otherwise). */
export async function fetchWaitTimesForRide(
  supabase: SupabaseClient,
  rideId: number,
  since: Date,
  until?: Date
): Promise<WaitTimeRecord[]> {
  const records: WaitTimeRecord[] = [];
  let offset = 0;

  while (true) {
    let query = supabase
      .from("wait_times")
      .select("id, ride_id, wait_time, is_open, timestamp")
      .eq("ride_id", rideId)
      .gte("timestamp", since.toISOString())
      .order("timestamp", { ascending: true })
      .range(offset, offset + WAIT_TIMES_PAGE_SIZE - 1);

    if (until) {
      query = query.lt("timestamp", until.toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data?.length) break;

    records.push(...data);
    if (data.length < WAIT_TIMES_PAGE_SIZE) break;
    offset += WAIT_TIMES_PAGE_SIZE;
  }

  return records;
}

export async function getWaitTimesForRide(
  rideId: number,
  since: Date,
  until?: Date
): Promise<WaitTimeRecord[]> {
  return fetchWaitTimesForRide(getSupabase(), rideId, since, until);
}

/** Full park-day snapshots for the daily chart (small query, always complete). */
export async function getTodayWaitTimesForRide(
  rideId: number,
  reference = new Date()
): Promise<WaitTimeRecord[]> {
  const supabase = getSupabase();
  const start = getParkStartOfDay(reference);
  const end = getParkEndOfDay(reference);
  const records = await fetchWaitTimesForRide(supabase, rideId, start, end);
  return filterRecordsToCollectionWindow(records);
}

export async function getRecentWaitTimesForRide(
  rideId: number,
  limit = 24
): Promise<WaitTimeRecord[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("wait_times")
    .select("*")
    .eq("ride_id", rideId)
    .order("timestamp", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).reverse();
}

export async function getAllWaitTimesForRide(
  rideId: number
): Promise<WaitTimeRecord[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("wait_times")
    .select("*")
    .eq("ride_id", rideId)
    .order("timestamp", { ascending: true });

  if (error) throw error;
  return data ?? [];
}
