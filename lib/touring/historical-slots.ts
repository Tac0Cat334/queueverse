import type { RideWithLiveData, RideIntelligence } from "@/types";
import type { HourBucket } from "@/lib/time-buckets";
import type { WeekdayPatternsByRide, WeekdayCrowdInsight } from "@/types";
import { formatHourMinute } from "@/utils/wait-time";
import { isEarlyEntryEligibleRide, isHeadlinerRide } from "@/lib/analytics/operational-phases";
import { getDefaultPark } from "@/lib/parks";
import { getPatternForVisitDay } from "@/lib/weekday-analytics";

export interface HistoricalSlot {
  rideId: number;
  hour: number;
  minute: number;
  timeMinutes: number;
  historicalAverage: number;
  peakAverage: number;
  label: string;
  reason: string;
  rank: number;
  usesWeekdayData: boolean;
}

export interface VisitDayContext {
  dayOfWeek: number;
  dayLabel: string;
  weekdayPatternsByRide?: WeekdayPatternsByRide;
  parkWeekdayInsight?: WeekdayCrowdInsight | null;
}

function hoursInWindow(
  pattern: HourBucket[],
  arrivalHour: number,
  departureHour: number
) {
  if (!pattern.length) return [];

  return pattern
    .filter((h) => h.hour >= arrivalHour && h.hour < departureHour)
    .sort((a, b) => a.average - b.average);
}

function parseBestTimeMinutes(bestTime: string | null): number | null {
  if (!bestTime) return null;
  const match = bestTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;

  let hour = Number(match[1]) % 12;
  const minute = Number(match[2]);
  if (match[3].toUpperCase() === "PM") hour += 12;
  if (match[1] === "12" && match[3].toUpperCase() === "AM") hour = 0;

  return hour * 60 + minute;
}

/** Rank every hour in the visit window; lowest historical wait first. */
export function rankHistoricalHoursForRide(
  ride: RideWithLiveData,
  intel: RideIntelligence | undefined,
  arrivalHour: number,
  departureHour: number,
  visitContext?: VisitDayContext,
  earlyEntry = false
): HistoricalSlot[] {
  const fallbackPattern = intel?.hourlyPattern ?? [];
  const { pattern, usesWeekday, sampleDays } = visitContext?.weekdayPatternsByRide
    ? getPatternForVisitDay(
        ride.ride_id,
        visitContext.dayOfWeek,
        visitContext.weekdayPatternsByRide,
        fallbackPattern
      )
    : { pattern: fallbackPattern, usesWeekday: false, sampleDays: 0 };

  const park = getDefaultPark();
  const gaHour = park.earlyEntry?.generalAdmissionHour ?? 10;

  const ranked = hoursInWindow(pattern, arrivalHour, departureHour).sort((a, b) => {
    let scoreA = a.average;
    let scoreB = b.average;

    if (earlyEntry && isEarlyEntryEligibleRide(ride.name, park)) {
      const headliner = isHeadlinerRide(ride.name, park);
      const inflation = intel?.waitInflation.score ?? 0;
      if (a.hour >= arrivalHour && a.hour < gaHour) {
        scoreA -= headliner ? 25 + inflation * 0.15 : 10;
      }
      if (b.hour >= arrivalHour && b.hour < gaHour) {
        scoreB -= headliner ? 25 + inflation * 0.15 : 10;
      }
    }

    return scoreA - scoreB;
  });
  const peakAverage =
    pattern.reduce((max, h) => (h.average > max ? h.average : max), 0) ||
    intel?.hourlyPattern.reduce((max, h) => (h.average > max ? h.average : max), 0) ||
    ride.wait_time;

  const dayLabel = visitContext?.dayLabel ?? "Typical";

  if (ranked.length === 0) {
    const bestMinutes =
      parseBestTimeMinutes(intel?.bestTimeToRide ?? null) ??
      arrivalHour * 60;
    const hour = Math.floor(bestMinutes / 60);
    const minute = bestMinutes % 60;
    const avg = intel?.bestTimeAverage ?? ride.wait_time;

    return [
      {
        rideId: ride.ride_id,
        hour,
        minute,
        timeMinutes: bestMinutes,
        historicalAverage: avg,
        peakAverage,
        label: formatHourMinute(hour, minute),
        reason: usesWeekday
          ? `On ${dayLabel}s, best around ${formatHourMinute(hour, minute)} (${avg}m avg, ${sampleDays} days)`
          : intel?.bestTimeToRide
            ? `Historically best around ${intel.bestTimeToRide} (${avg}m avg)`
            : `Scheduled at ${formatHourMinute(hour, minute)}`,
        rank: 0,
        usesWeekdayData: usesWeekday,
      },
    ];
  }

  return ranked.map((entry, index) => {
    const savings =
      peakAverage > 0
        ? Math.round(((peakAverage - entry.average) / peakAverage) * 100)
        : 0;

    let reason: string;
    if (usesWeekday && index === 0) {
      reason =
        savings >= 10
          ? `On ${dayLabel}s, best at ${entry.label} — ~${savings}% below peak (${peakAverage}m)`
          : `On ${dayLabel}s, lowest typical wait at ${entry.label} (${entry.average}m avg)`;
    } else if (earlyEntry && index === 0 && entry.hour < gaHour && isHeadlinerRide(ride.name, park)) {
      reason = `Best Early Entry window — historically spikes after ${gaHour}:00 opening`;
    } else if (index === 0 && savings >= 10) {
      reason = `Best time of day — ~${savings}% lower than peak (${peakAverage}m)`;
    } else if (index === 0) {
      reason = `Lowest typical wait window (${entry.average}m avg)`;
    } else {
      reason = usesWeekday
        ? `On ${dayLabel}s, ${entry.average}m avg at ${entry.label}`
        : `Historically ${entry.average}m avg at ${entry.label}`;
    }

    return {
      rideId: ride.ride_id,
      hour: entry.hour,
      minute: 0,
      timeMinutes: entry.hour * 60,
      historicalAverage: entry.average,
      peakAverage,
      label: entry.label,
      reason,
      rank: index,
      usesWeekdayData: usesWeekday,
    };
  });
}

export function assignHistoricalSlots(
  rides: RideWithLiveData[],
  intelligenceByRide: Record<number, RideIntelligence>,
  arrivalHour: number,
  departureHour: number,
  visitContext?: VisitDayContext,
  earlyEntry = false
): HistoricalSlot[] {
  const candidates = rides.map((ride) => ({
    ride,
    intel: intelligenceByRide[ride.ride_id],
    slots: rankHistoricalHoursForRide(
      ride,
      intelligenceByRide[ride.ride_id],
      arrivalHour,
      departureHour,
      visitContext,
      earlyEntry
    ),
  }));

  candidates.sort((a, b) => {
    const spreadA = effectiveAssignmentSpread(a.slots, visitContext);
    const spreadB = effectiveAssignmentSpread(b.slots, visitContext);
    return spreadB - spreadA;
  });

  const usedHours = new Set<number>();
  const assignments: HistoricalSlot[] = [];

  for (const { ride, slots } of candidates) {
    let chosen = slots.find((s) => !usedHours.has(s.hour));

    if (!chosen) {
      for (const slot of slots) {
        const offsetHour = slot.hour;
        const halfHourKey = offsetHour * 60 + 30;
        if (!usedHours.has(offsetHour) && halfHourKey < departureHour * 60) {
          chosen = {
            ...slot,
            minute: 30,
            timeMinutes: halfHourKey,
            label: formatHourMinute(slot.hour, 30),
            reason: `${slot.reason} · offset to avoid overlap`,
          };
          usedHours.add(offsetHour);
          break;
        }
      }
    }

    if (!chosen) {
      chosen = slots[0] ?? {
        rideId: ride.ride_id,
        hour: arrivalHour,
        minute: 0,
        timeMinutes: arrivalHour * 60,
        historicalAverage: ride.wait_time,
        peakAverage: ride.wait_time,
        label: formatHourMinute(arrivalHour, 0),
        reason: "Scheduled in available window",
        rank: 0,
        usesWeekdayData: false,
      };
    } else {
      usedHours.add(chosen.hour);
    }

    assignments.push(chosen);
  }

  return assignments.sort((a, b) => a.timeMinutes - b.timeMinutes);
}

/** On busier weekdays, slightly favor rides whose best window is early morning. */
function effectiveAssignmentSpread(
  slots: HistoricalSlot[],
  visitContext?: VisitDayContext
): number {
  const best = slots[0];
  if (!best) return 0;

  let spread = best.peakAverage - best.historicalAverage;
  if (
    visitContext?.parkWeekdayInsight?.crowdLevel === "busier" &&
    best.hour <= 10
  ) {
    spread += 10;
  }
  return spread;
}

export function estimateHistoricalWait(
  intel: RideIntelligence | undefined,
  hour: number,
  fallback: number,
  expressPass: boolean,
  weekdayPattern?: HourBucket[]
): number {
  const entry =
    weekdayPattern?.find((h) => h.hour === hour) ??
    intel?.hourlyPattern.find((h) => h.hour === hour);
  let wait = entry?.average ?? intel?.bestTimeAverage ?? fallback;
  if (expressPass) wait = Math.round(wait * 0.4);
  return Math.max(0, wait);
}

export function findPeakLunchHourForVisit(
  rides: RideWithLiveData[],
  intelligenceByRide: Record<number, RideIntelligence>,
  weekdayPatternsByRide: WeekdayPatternsByRide | undefined,
  dayOfWeek: number,
  arrivalHour: number,
  preferredLunchHour: number
): number {
  const hourTotals = new Map<number, number>();
  const hourCounts = new Map<number, number>();

  for (const ride of rides) {
    const intel = intelligenceByRide[ride.ride_id];
    const { pattern } = weekdayPatternsByRide
      ? getPatternForVisitDay(
          ride.ride_id,
          dayOfWeek,
          weekdayPatternsByRide,
          intel?.hourlyPattern ?? []
        )
      : { pattern: intel?.hourlyPattern ?? [] };

    for (const entry of pattern) {
      if (entry.hour < arrivalHour) continue;
      hourTotals.set(entry.hour, (hourTotals.get(entry.hour) ?? 0) + entry.average);
      hourCounts.set(entry.hour, (hourCounts.get(entry.hour) ?? 0) + 1);
    }
  }

  let peakHour = preferredLunchHour;
  let peakAvg = -1;

  for (const [hour, total] of hourTotals.entries()) {
    const count = hourCounts.get(hour) ?? 1;
    const avg = total / count;
    if (avg > peakAvg && hour >= arrivalHour) {
      peakAvg = avg;
      peakHour = hour;
    }
  }

  return Math.max(preferredLunchHour, peakHour);
}
