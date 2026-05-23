import { NextResponse } from "next/server";
import { subDays, getHours, getMinutes } from "date-fns";
import { isSupabaseConfigured, createServiceClient } from "@/lib/supabase";
import { formatHourMinute } from "@/utils/wait-time";
import type { WaitTimeRecord, RideInsight } from "@/types";

function computeInsight(records: WaitTimeRecord[]): RideInsight {
  const open = records.filter((r) => r.is_open);
  if (open.length < 2) {
    return { bestTime: null, bestTimeAvg: null, trend: "flat" };
  }

  const first = open[0].wait_time;
  const last = open[open.length - 1].wait_time;
  const diff = last - first;
  const trend = diff > 5 ? "up" : diff < -5 ? "down" : "flat";

  if (open.length < 3) {
    return { bestTime: null, bestTimeAvg: null, trend };
  }

  const buckets = new Map<string, { total: number; count: number }>();
  for (const record of open) {
    const date = new Date(record.timestamp);
    const key = `${getHours(date)}:${Math.floor(getMinutes(date) / 10) * 10}`;
    const bucket = buckets.get(key) ?? { total: 0, count: 0 };
    bucket.total += record.wait_time;
    bucket.count += 1;
    buckets.set(key, bucket);
  }

  let best = { hour: 0, minute: 0, average: Infinity };
  for (const [key, { total, count }] of buckets.entries()) {
    const [h, m] = key.split(":").map(Number);
    const avg = total / count;
    if (avg < best.average) best = { hour: h, minute: m, average: avg };
  }

  return {
    bestTime:
      best.average === Infinity
        ? null
        : formatHourMinute(best.hour, best.minute),
    bestTimeAvg:
      best.average === Infinity ? null : Math.round(best.average),
    trend,
  };
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ insights: {}, configured: false });
  }

  try {
    const since = subDays(new Date(), 30).toISOString();
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("wait_times")
      .select("*")
      .gte("timestamp", since)
      .order("timestamp", { ascending: true });

    if (error) throw error;

    const byRide = new Map<number, WaitTimeRecord[]>();
    for (const record of data ?? []) {
      const list = byRide.get(record.ride_id) ?? [];
      list.push(record);
      byRide.set(record.ride_id, list);
    }

    const insights: Record<number, RideInsight> = {};
    for (const [rideId, records] of byRide.entries()) {
      insights[rideId] = computeInsight(records);
    }

    return NextResponse.json({ insights, configured: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch insights", details: String(error) },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
