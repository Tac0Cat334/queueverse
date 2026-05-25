import { createServiceClient, isSupabaseConfigured } from "@/lib/supabase";
import { getParkStartOfDay } from "@/lib/park-time";

export type SyncHealthStatus = "healthy" | "delayed" | "stale" | "unconfigured";

export interface SyncHealth {
  configured: boolean;
  status: SyncHealthStatus;
  lastSnapshotAt: string | null;
  snapshotsToday: number;
  snapshotsLastHour: number;
  expectedPerHour: number;
  minutesSinceLastSnapshot: number | null;
  message: string;
}

const EXPECTED_PER_HOUR = 12;
const DELAYED_MINUTES = 10;
const STALE_MINUTES = 20;

function countUniqueTimestamps(
  rows: { timestamp: string }[] | null,
  sinceMs: number
): number {
  const times = new Set<string>();
  for (const row of rows ?? []) {
    if (new Date(row.timestamp).getTime() >= sinceMs) {
      times.add(row.timestamp);
    }
  }
  return times.size;
}

export async function getSyncHealth(): Promise<SyncHealth> {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      configured: false,
      status: "unconfigured",
      lastSnapshotAt: null,
      snapshotsToday: 0,
      snapshotsLastHour: 0,
      expectedPerHour: EXPECTED_PER_HOUR,
      minutesSinceLastSnapshot: null,
      message: "Historical sync not configured — charts need Supabase + CRON_SECRET.",
    };
  }

  const supabase = createServiceClient();
  const sinceToday = getParkStartOfDay();
  const sinceHourMs = Date.now() - 60 * 60 * 1000;

  const { data: recent, error } = await supabase
    .from("wait_times")
    .select("timestamp")
    .gte("timestamp", sinceToday.toISOString())
    .order("timestamp", { ascending: false })
    .limit(2000);

  if (error) {
    return {
      configured: true,
      status: "stale",
      lastSnapshotAt: null,
      snapshotsToday: 0,
      snapshotsLastHour: 0,
      expectedPerHour: EXPECTED_PER_HOUR,
      minutesSinceLastSnapshot: null,
      message: "Could not read sync status from database.",
    };
  }

  const lastSnapshotAt = recent?.[0]?.timestamp ?? null;
  const snapshotsToday = countUniqueTimestamps(recent, sinceToday.getTime());
  const snapshotsLastHour = countUniqueTimestamps(recent, sinceHourMs);

  const minutesSinceLastSnapshot = lastSnapshotAt
    ? Math.round((Date.now() - new Date(lastSnapshotAt).getTime()) / 60000)
    : null;

  let status: SyncHealthStatus = "healthy";
  let message = `Collecting every ~5 min · ${snapshotsToday} snapshot${
    snapshotsToday === 1 ? "" : "s"
  } today`;

  if (minutesSinceLastSnapshot === null) {
    status = "stale";
    message = "No snapshots collected yet today.";
  } else if (minutesSinceLastSnapshot >= STALE_MINUTES) {
    status = "stale";
    message = `Last snapshot ${minutesSinceLastSnapshot} min ago — sync may be down. Check GitHub Actions or cron-job.org backup.`;
  } else if (minutesSinceLastSnapshot >= DELAYED_MINUTES) {
    status = "delayed";
    message = `Last snapshot ${minutesSinceLastSnapshot} min ago — running behind the 5-minute schedule.`;
  } else if (snapshotsLastHour < 4) {
    status = "delayed";
    message = `Only ${snapshotsLastHour} snapshot${
      snapshotsLastHour === 1 ? "" : "s"
    } in the last hour (expected ~${EXPECTED_PER_HOUR}).`;
  }

  return {
    configured: true,
    status,
    lastSnapshotAt,
    snapshotsToday,
    snapshotsLastHour,
    expectedPerHour: EXPECTED_PER_HOUR,
    minutesSinceLastSnapshot,
    message,
  };
}
