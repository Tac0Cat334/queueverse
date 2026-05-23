export const EPIC_UNIVERSE_PARK_ID =
  Number(process.env.NEXT_PUBLIC_EPIC_UNIVERSE_PARK_ID) || 334;

export const QUEUE_TIMES_BASE_URL =
  process.env.NEXT_PUBLIC_QUEUE_TIMES_BASE_URL || "https://queue-times.com";

export const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export const WAIT_THRESHOLDS = {
  low: 20,
  medium: 45,
} as const;
