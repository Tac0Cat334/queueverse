import { NextResponse } from "next/server";
import { fetchLiveQueueTimes, flattenRides } from "@/lib/queue-times";
import { isWithinDataCollectionWindow } from "@/lib/park-hours";
import { roundToFiveMinutes, syncWaitTimeSnapshots } from "@/lib/sync-snapshot";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    if (!isWithinDataCollectionWindow(now)) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "Outside collection window (7:30 AM – 11:00 PM park time)",
        timestamp: now.toISOString(),
      });
    }

    const timestamp = roundToFiveMinutes(now);
    const data = await fetchLiveQueueTimes({ noStore: true });
    const rides = flattenRides(data);

    await syncWaitTimeSnapshots(rides, timestamp);

    return NextResponse.json({
      success: true,
      timestamp: timestamp.toISOString(),
      ridesProcessed: rides.length,
    });
  } catch (error) {
    console.error("Cron sync failed:", error);
    return NextResponse.json(
      { error: "Failed to sync wait times", details: String(error) },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;
