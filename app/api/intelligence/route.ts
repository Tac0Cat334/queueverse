import { NextResponse } from "next/server";
import { subDays } from "date-fns";
import { isSupabaseConfigured, createServiceClient } from "@/lib/supabase";
import { fetchLiveQueueTimes, flattenRides } from "@/lib/queue-times";
import { computeParkRecommendations } from "@/lib/ride-intelligence";
import { EMPTY_DATA_MATURITY } from "@/lib/data-maturity";
import type { WaitTimeRecord } from "@/types";

export async function GET() {
  try {
    const liveData = await fetchLiveQueueTimes({ noStore: true });
    const rides = flattenRides(liveData);

    if (!isSupabaseConfigured()) {
      return NextResponse.json({
        recommendations: {
          bestRightNow: [],
          greatTimeToRide: [],
          lowerThanNormal: [],
          trendingUpFast: [],
          expectedToRiseSoon: [],
          byRideId: {},
          dataMaturity: { ...EMPTY_DATA_MATURITY, totalRides: rides.length },
          weekdayPatternsByRide: {},
          parkWeekdayInsights: {},
          generatedAt: new Date().toISOString(),
        },
        rides,
        configured: false,
      });
    }

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

    const recommendations = computeParkRecommendations(rides, byRide);

    return NextResponse.json({
      recommendations,
      rides,
      configured: true,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch intelligence", details: String(error) },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
