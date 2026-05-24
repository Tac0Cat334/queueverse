const DISPLAY_NAME_OVERRIDES: Record<string, string> = {
  "Hiccup Wing Glider": "Hiccup Wing Gliders",
  "Mario KartT: Bowser's Challenge": "Mario Kart: Bowser's Challenge",
  "Mine-Cart MadnessT": "Mine-Cart Madness",
  "Yoshi's AdventureT": "Yoshi's Adventure",
  "Harry Potter and the Battle at the MinistryT":
    "Harry Potter and the Battle at the Ministry",
};

export function formatRideName(name: string): string {
  return DISPLAY_NAME_OVERRIDES[name] ?? name;
}
