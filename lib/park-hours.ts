import {
  DATA_COLLECTION,
  getCollectionEndMinutes,
  getCollectionStartMinutes,
  getParkParts,
} from "@/lib/park-time";

export { DATA_COLLECTION, getCollectionStartMinutes, getCollectionEndMinutes };

/** True between 7:30 AM and 11:00 PM park time (overnight excluded) */
export function isWithinDataCollectionWindow(date: Date | string): boolean {
  const { hour, minute } = getParkParts(new Date(date));
  const mins = hour * 60 + minute;
  return mins >= getCollectionStartMinutes() && mins < getCollectionEndMinutes();
}

export function filterRecordsToCollectionWindow<T extends { timestamp: string }>(
  records: T[]
): T[] {
  return records.filter((r) => isWithinDataCollectionWindow(r.timestamp));
}
