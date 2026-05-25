import { NextResponse } from "next/server";
import { getSyncHealth } from "@/lib/sync-health";

export async function GET() {
  try {
    const health = await getSyncHealth();
    return NextResponse.json(health);
  } catch (error) {
    return NextResponse.json(
      {
        configured: false,
        status: "stale",
        lastSnapshotAt: null,
        snapshotsToday: 0,
        snapshotsLastHour: 0,
        expectedPerHour: 12,
        minutesSinceLastSnapshot: null,
        message: "Failed to check sync health",
        error: String(error),
      },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
