/** Epic Universe — Orlando, FL */
export const PARK_TIMEZONE = "America/New_York";

export const PARK_DAY_CHART = {
  /** Typical park hours shown on the daily X-axis */
  startHour: 7,
  endHour: 22,
} as const;

export function getParkParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: PARK_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") % 24,
    minute: get("minute"),
    second: get("second"),
  };
}

function parkDateKey(date: Date): number {
  const { year, month, day } = getParkParts(date);
  return year * 10_000 + month * 100 + day;
}

/** UTC instant for midnight at the start of the park's local calendar day. */
export function getParkStartOfDay(reference = new Date()): Date {
  const target = parkDateKey(reference);
  let low = reference.getTime() - 36 * 60 * 60 * 1000;
  let high = reference.getTime() + 12 * 60 * 60 * 1000;

  while (high - low > 1000) {
    const mid = Math.floor((low + high) / 2);
    if (parkDateKey(new Date(mid)) < target) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return new Date(high);
}

export function getParkEndOfDay(reference = new Date()): Date {
  const start = getParkStartOfDay(reference);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

export function isSameParkDay(a: Date | string, b: Date | string): boolean {
  return parkDateKey(new Date(a)) === parkDateKey(new Date(b));
}

export function isWithinParkDay(timestamp: string | Date, reference = new Date()): boolean {
  const t = new Date(timestamp).getTime();
  const start = getParkStartOfDay(reference).getTime();
  const end = getParkEndOfDay(reference).getTime();
  return t >= start && t < end;
}

export function getParkDayChartWindow(reference = new Date()) {
  const dayStart = getParkStartOfDay(reference);
  const dayStartMs = dayStart.getTime();
  const chartStartMs = dayStartMs + PARK_DAY_CHART.startHour * 60 * 60 * 1000;
  const chartEndMs = dayStartMs + PARK_DAY_CHART.endHour * 60 * 60 * 1000;
  const now = reference.getTime();
  const visibleEndMs = Math.max(chartStartMs, Math.min(chartEndMs, now));

  return {
    dayStart,
    chartStartMs,
    chartEndMs,
    visibleEndMs,
  };
}

export function formatParkTime(
  date: Date | string | number,
  options?: Intl.DateTimeFormatOptions
): string {
  return new Date(date).toLocaleTimeString("en-US", {
    timeZone: PARK_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    ...options,
  });
}

export function formatParkDateLabel(reference = new Date()): string {
  return reference.toLocaleDateString("en-US", {
    timeZone: PARK_TIMEZONE,
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

/** 0 = Sunday … 6 = Saturday in park local time */
export function getParkDayOfWeek(date: Date | string): number {
  const weekday = new Date(date).toLocaleDateString("en-US", {
    timeZone: PARK_TIMEZONE,
    weekday: "short",
  });
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[weekday] ?? 0;
}

/** YYYY-MM-DD key in park timezone for deduplicating calendar days */
export function getParkDateKey(date: Date | string): string {
  const parts = getParkParts(new Date(date));
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}
