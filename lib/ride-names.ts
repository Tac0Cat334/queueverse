const DISPLAY_NAME_OVERRIDES: Record<string, string> = {
  "Hiccup Wing Glider": "Hiccup Wing Gliders",
};

export function formatRideName(name: string): string {
  return DISPLAY_NAME_OVERRIDES[name] ?? name;
}
