import { NextResponse } from "next/server";
import { fetchLiveQueueTimes, flattenRides } from "@/lib/queue-times";

export async function GET() {
  try {
    const data = await fetchLiveQueueTimes({ noStore: true });
    const rides = flattenRides(data);
    return NextResponse.json({ rides, fetchedAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch live wait times", details: String(error) },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
export const revalidate = 60;
