/**
 * Optional user-context foundation for future personalization.
 * Not persisted or fully implemented — interfaces only.
 */

export type RideIntensityPreference = "thrill" | "family" | "mixed";

export interface UserParkContext {
  /** Park-local area or land the guest is nearest to */
  currentLand?: string;
  /** Ride IDs already completed this visit */
  completedRideIds?: number[];
  /** Ride IDs remaining on the guest's must-do list */
  remainingMustDoIds?: number[];
  /** Minutes the guest is willing to wait before skipping */
  waitToleranceMinutes?: number;
  /** Preferred ride intensity */
  intensityPreference?: RideIntensityPreference;
  /** Whether the guest has Express Pass */
  hasExpressPass?: boolean;
  /** Target departure time in park-local minutes since midnight */
  departureTimeMinutes?: number;
}

export interface UserContextSnapshot {
  context: UserParkContext;
  /** When this context was last updated (ISO) */
  updatedAt: string;
  /** Whether enough context exists to personalize recommendations */
  isActionable: boolean;
}

export function createEmptyUserContext(): UserContextSnapshot {
  return {
    context: {},
    updatedAt: new Date().toISOString(),
    isActionable: false,
  };
}

export function isUserContextActionable(context: UserParkContext): boolean {
  return Boolean(
    context.currentLand ||
      (context.completedRideIds && context.completedRideIds.length > 0) ||
      (context.remainingMustDoIds && context.remainingMustDoIds.length > 0)
  );
}
