import type { RideOperationalStatus, WaitLevel } from "@/types";
import { WAIT_THRESHOLDS } from "@/lib/constants";
import { getOperationalStatusLabel } from "@/lib/ride-status";

export function getWaitLevel(
  waitTime: number,
  isOpen: boolean,
  operationalStatus?: RideOperationalStatus
): WaitLevel {
  if (operationalStatus && operationalStatus !== "open") return "closed";
  if (!isOpen) return "closed";
  if (waitTime <= WAIT_THRESHOLDS.low) return "low";
  if (waitTime <= WAIT_THRESHOLDS.medium) return "medium";
  return "high";
}

export function getWaitLevelClass(level: WaitLevel): string {
  switch (level) {
    case "low":
      return "wait-low";
    case "medium":
      return "wait-medium";
    case "high":
      return "wait-high";
    case "closed":
      return "wait-closed";
  }
}

export function formatWaitTime(minutes: number, isOpen: boolean): string {
  if (!isOpen) return "Closed";
  if (minutes === 0) return "Walk-on";
  return `${minutes} min`;
}

export function formatRideStatusLabel(ride: {
  is_open: boolean;
  wait_time: number;
  operationalStatus: RideOperationalStatus;
}): string {
  if (ride.operationalStatus !== "open") {
    return getOperationalStatusLabel(ride.operationalStatus);
  }
  return formatWaitTime(ride.wait_time, true);
}

export function formatHourLabel(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:00 ${period}`;
}

export function formatHourMinute(hour: number, minute = 0): string {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const displayMinute = minute.toString().padStart(2, "0");
  return `${displayHour}:${displayMinute} ${period}`;
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
