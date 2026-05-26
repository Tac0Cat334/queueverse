/** Shared recency decay for weighted historical averages */
export const RECENCY_HALF_LIFE_DAYS = 10;

export function recencyWeight(recordTime: Date, reference: Date): number {
  const ageDays =
    (reference.getTime() - recordTime.getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays < 0) return 1;
  return Math.exp(-ageDays / RECENCY_HALF_LIFE_DAYS);
}
