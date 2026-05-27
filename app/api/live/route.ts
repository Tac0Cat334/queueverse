import { NextResponse } from "next/server";
import { fetchLiveQueueTimes, flattenRides, stampFetchTime } from "@/lib/queue-times";
import { isWithinDataCollectionWindow } from "@/lib/park-hours";
import { isSupabaseConfigured } from "@/lib/supabase";
import { syncWaitTimeSnapshots } from "@/lib/sync-snapshot";

export async function GET() {
  try {
    const fetchedAt = new Date().toISOString();
    const reference = new Date(fetchedAt);
    const data = await fetchLiveQueueTimes({ noStore: true });
    const rides = stampFetchTime(flattenRides(data, reference), fetchedAt);

    if (
      isSupabaseConfigured() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      isWithinDataCollectionWindow(reference)
    ) {
      syncWaitTimeSnapshots(rides).catch((err) =>
        console.error("Background snapshot sync failed:", err)
      );
    }

    return NextResponse.json(
      { rides, fetchedAt },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch live wait times", details: String(error) },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
