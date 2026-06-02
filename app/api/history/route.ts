import { NextResponse } from "next/server";
import {
  getTodayWaitTimesForRide,
  getWaitTimesForRide,
  isSupabaseConfigured,
} from "@/lib/supabase";
import { getTimeRangeStart } from "@/lib/analytics";
import { filterRecordsToCollectionWindow } from "@/lib/park-hours";
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
    const id = Number(rideId);
    const records =
      range === "today"
        ? await getTodayWaitTimesForRide(id)
        : filterRecordsToCollectionWindow(
            await getWaitTimesForRide(id, getTimeRangeStart(range))
          );
    return NextResponse.json(
      { records, configured: true },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch historical data", details: String(error) },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
