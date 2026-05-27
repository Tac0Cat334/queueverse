import type { QueueTimesRide, RideOperationalStatus, RideWithLiveData } from "@/types";

const STATUS_FIELD_KEYS = [
  "status",
  "operating_status",
  "operating_state",
  "state",
  "closed_reason",
  "reason",
] as const;

function readOptionalString(
  ride: QueueTimesRide & Record<string, unknown>,
  key: string
): string | undefined {
  const value = ride[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function normalizeStatusToken(value: string): RideOperationalStatus | null {
  const token = value.toLowerCase();

  if (
    token.includes("maintenance") ||
    token.includes("refurb") ||
    token.includes("down") ||
    token === "offline"
  ) {
    return "maintenance";
  }

  if (
    token.includes("delay") ||
    token.includes("weather") ||
    token.includes("temporarily") ||
    token.includes("stoppage") ||
    token === "paused"
  ) {
    return "delayed";
  }

  if (
    token.includes("open") ||
    token.includes("operating") ||
    token === "running"
  ) {
    return "open";
  }

  if (
    token.includes("close") ||
    token.includes("shutdown") ||
    token === "closed"
  ) {
    return "closed";
  }

  return null;
}

function statusFromApiFields(
  ride: QueueTimesRide & Record<string, unknown>
): RideOperationalStatus | null {
  for (const key of STATUS_FIELD_KEYS) {
    const raw = readOptionalString(ride, key);
    if (!raw) continue;
    const parsed = normalizeStatusToken(raw);
    if (parsed) return parsed;
  }
  return null;
}

function isStaleLastUpdated(
  lastUpdated: string,
  referenceMs: number,
  staleMinutes = 45
): boolean {
  const updatedMs = new Date(lastUpdated).getTime();
  if (Number.isNaN(updatedMs)) return false;
  return referenceMs - updatedMs >= staleMinutes * 60 * 1000;
}

/** Map Queue-Times ride payload to a guest-facing operational status */
export function resolveRideOperationalStatus(
  ride: QueueTimesRide,
  referenceTime = new Date()
): RideOperationalStatus {
  const extended = ride as QueueTimesRide & Record<string, unknown>;
  const fromApi = statusFromApiFields(extended);
  if (fromApi) return fromApi;

  if (ride.is_open) return "open";

  if (ride.wait_time > 0) {
    return "delayed";
  }

  if (isStaleLastUpdated(ride.last_updated, referenceTime.getTime())) {
    return "maintenance";
  }

  return "closed";
}

export function enrichRideWithStatus(
  ride: Omit<RideWithLiveData, "operationalStatus">,
  referenceTime = new Date()
): RideWithLiveData {
  const queueRide: QueueTimesRide = {
    id: ride.ride_id,
    name: ride.name,
    is_open: ride.is_open,
    wait_time: ride.wait_time,
    last_updated: ride.last_updated,
  };

  return {
    ...ride,
    operationalStatus: resolveRideOperationalStatus(queueRide, referenceTime),
  };
}

export function getOperationalStatusLabel(
  status: RideOperationalStatus
): string {
  switch (status) {
    case "open":
      return "Open";
    case "closed":
      return "Closed";
    case "delayed":
      return "Delayed";
    case "maintenance":
      return "Maintenance";
  }
}

export function isRideGuestAccessible(status: RideOperationalStatus): boolean {
  return status === "open";
}
