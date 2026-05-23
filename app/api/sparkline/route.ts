import { NextResponse } from "next/server";
import { getRecentWaitTimesForRide, isSupabaseConfigured } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rideId = searchParams.get("rideId");
  const limit = Number(searchParams.get("limit") ?? 24);

  if (!rideId) {
    return NextResponse.json({ error: "rideId is required" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ records: [], configured: false });
  }

  try {
    const records = await getRecentWaitTimesForRide(Number(rideId), limit);
    return NextResponse.json({ records, configured: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch sparkline data", details: String(error) },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
