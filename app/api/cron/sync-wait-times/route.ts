import { NextResponse } from "next/server";
import { fetchLiveQueueTimes, flattenRides } from "@/lib/queue-times";
import { createServiceClient } from "@/lib/supabase";

function roundToFiveMinutes(date: Date): Date {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);
  const minutes = rounded.getMinutes();
  rounded.setMinutes(Math.floor(minutes / 5) * 5);
  return rounded;
}

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
    const data = await fetchLiveQueueTimes();
    const rides = flattenRides(data);
    const timestamp = roundToFiveMinutes(new Date());

    const supabase = createServiceClient();
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const ride of rides) {
      const { data: existingRide } = await supabase
        .from("rides")
        .select("id, name, land")
        .eq("ride_id", ride.ride_id)
        .single();

      if (existingRide) {
        if (
          existingRide.name !== ride.name ||
          existingRide.land !== ride.land
        ) {
          await supabase
            .from("rides")
            .update({ name: ride.name, land: ride.land })
            .eq("ride_id", ride.ride_id);
          updated++;
        }
      } else {
        await supabase.from("rides").insert({
          ride_id: ride.ride_id,
          name: ride.name,
          land: ride.land,
        });
        inserted++;
      }

      const { error: waitError } = await supabase.from("wait_times").upsert(
        {
          ride_id: ride.ride_id,
          wait_time: ride.wait_time,
          is_open: ride.is_open,
          timestamp: timestamp.toISOString(),
        },
        { onConflict: "ride_id,timestamp", ignoreDuplicates: true }
      );

      if (waitError?.code === "23505") {
        skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: timestamp.toISOString(),
      ridesProcessed: rides.length,
      ridesInserted: inserted,
      ridesUpdated: updated,
      duplicatesSkipped: skipped,
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
