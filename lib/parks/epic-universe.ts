import type { ParkConfig } from "./types";

export const EPIC_UNIVERSE_PARK: ParkConfig = {
  id: "epic-universe",
  queueTimesParkId: 334,
  name: "Epic Universe",
  shortName: "Epic",
  resort: "Universal Orlando Resort",
  timezone: "America/New_York",
  chartHours: { startHour: 7, endHour: 22 },
  landOrder: [
    "Celestial Park",
    "Dark Universe",
    "How to Train Your Dragon - Isle of Berk",
    "SUPER NINTENDO WORLD",
    "The Wizarding World of Harry Potter - Ministry of Magic",
  ],
  enabled: true,
};
