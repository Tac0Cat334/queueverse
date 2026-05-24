import type { RideWithLiveData, RideIntelligence } from "@/types";
import { formatHourMinute } from "@/utils/wait-time";

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
}

function hoursInWindow(
  intel: RideIntelligence | undefined,
  arrivalHour: number,
  departureHour: number
) {
  if (!intel?.hourlyPattern.length) return [];

  return intel.hourlyPattern
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
  departureHour: number
): HistoricalSlot[] {
  const ranked = hoursInWindow(intel, arrivalHour, departureHour);
  const peakAverage =
    intel?.hourlyPattern.reduce(
      (max, h) => (h.average > max ? h.average : max),
      0
    ) ?? ride.wait_time;

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
        reason: intel?.bestTimeToRide
          ? `Historically best around ${intel.bestTimeToRide} (${avg}m avg)`
          : `Scheduled at ${formatHourMinute(hour, minute)}`,
        rank: 0,
      },
    ];
  }

  return ranked.map((entry, index) => {
    const savings =
      peakAverage > 0
        ? Math.round(((peakAverage - entry.average) / peakAverage) * 100)
        : 0;

    let reason = `Historically ${entry.average}m avg at ${entry.label}`;
    if (index === 0 && savings >= 10) {
      reason = `Best time of day — ~${savings}% lower than peak (${peakAverage}m)`;
    } else if (index === 0) {
      reason = `Lowest typical wait window (${entry.average}m avg)`;
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
    };
  });
}

/**
 * Assign each ride a non-conflicting optimal hour using historical patterns.
 * Rides with the biggest peak-to-best spread get first pick of their ideal slot.
 */
export function assignHistoricalSlots(
  rides: RideWithLiveData[],
  intelligenceByRide: Record<number, RideIntelligence>,
  arrivalHour: number,
  departureHour: number
): HistoricalSlot[] {
  const candidates = rides.map((ride) => ({
    ride,
    intel: intelligenceByRide[ride.ride_id],
    slots: rankHistoricalHoursForRide(
      ride,
      intelligenceByRide[ride.ride_id],
      arrivalHour,
      departureHour
    ),
  }));

  candidates.sort((a, b) => {
    const spreadA =
      (a.slots[0]?.peakAverage ?? 0) - (a.slots[0]?.historicalAverage ?? 0);
    const spreadB =
      (b.slots[0]?.peakAverage ?? 0) - (b.slots[0]?.historicalAverage ?? 0);
    return spreadB - spreadA;
  });

  const usedHours = new Set<number>();
  const assignments: HistoricalSlot[] = [];

  for (const { ride, slots } of candidates) {
    let chosen = slots.find((s) => !usedHours.has(s.hour));

    if (!chosen) {
      // All ideal hours taken — use next-best or offset by 30 min
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
      };
    } else {
      usedHours.add(chosen.hour);
    }

    assignments.push(chosen);
  }

  return assignments.sort((a, b) => a.timeMinutes - b.timeMinutes);
}

export function estimateHistoricalWait(
  intel: RideIntelligence | undefined,
  hour: number,
  fallback: number,
  expressPass: boolean
): number {
  const entry = intel?.hourlyPattern.find((h) => h.hour === hour);
  let wait = entry?.average ?? intel?.bestTimeAverage ?? fallback;
  if (expressPass) wait = Math.round(wait * 0.4);
  return Math.max(0, wait);
}
