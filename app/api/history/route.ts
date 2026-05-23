import { NextResponse } from "next/server";
import { getWaitTimesForRide, isSupabaseConfigured } from "@/lib/supabase";
import { getTimeRangeStart } from "@/lib/analytics";
import { getParkEndOfDay } from "@/lib/park-time";
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
    const until = range === "today" ? getParkEndOfDay() : undefined;
    const records = await getWaitTimesForRide(Number(rideId), since, until);
    return NextResponse.json({ records, configured: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch historical data", details: String(error) },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
