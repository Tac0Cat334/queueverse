import { NextResponse } from "next/server";
import { getWaitTimesForRide, isSupabaseConfigured } from "@/lib/supabase";
import { getTimeRangeStart } from "@/lib/analytics";
import type { TimeRange } from "@/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rideId = searchParams.get("rideId");
  const range = (searchParams.get("range") ?? "today") as TimeRange;

  if (!rideId) {
    return NextResponse.json({ error: "rideId is required" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ records: [], configured: false });
  }

  try {
    const since = getTimeRangeStart(range);
    const records = await getWaitTimesForRide(Number(rideId), since);
    return NextResponse.json({ records, configured: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch historical data", details: String(error) },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
