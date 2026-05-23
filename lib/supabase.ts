import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Ride, WaitTimeRecord } from "@/types";

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

export async function getWaitTimesForRide(
  rideId: number,
  since: Date
): Promise<WaitTimeRecord[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("wait_times")
    .select("*")
    .eq("ride_id", rideId)
    .gte("timestamp", since.toISOString())
    .order("timestamp", { ascending: true });

  if (error) throw error;
  return data ?? [];
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
