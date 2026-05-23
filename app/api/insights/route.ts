import { NextResponse } from "next/server";
import { subDays } from "date-fns";
import { isSupabaseConfigured, createServiceClient } from "@/lib/supabase";
import {
  computeLiveTrend,
  detectWaitDrop,
  computeReliabilityScore,
  computeBestTimeInsight,
} from "@/lib/analytics";
import type { WaitTimeRecord, RideInsight } from "@/types";

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
      insights[rideId] = computeRideInsight(records);
    }

    return NextResponse.json({ insights, configured: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch insights", details: String(error) },
      { status: 500 }
    );
  }
}

function computeRideInsight(records: WaitTimeRecord[]): RideInsight {
  const open = records.filter((r) => r.is_open);
  const trendInfo = computeLiveTrend(records);
  const waitDrop = detectWaitDrop(records);
  const reliability = computeReliabilityScore(records);
  const bestTime = computeBestTimeInsight(open);

  return {
    bestTime: bestTime?.time ?? null,
    bestTimeAvg: bestTime?.average ?? null,
    trend: trendInfo.trend,
    trendLabel: trendInfo.label,
    trendChange: trendInfo.change,
    waitDrop,
    reliability,
  };
}

export const dynamic = "force-dynamic";
