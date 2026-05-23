export const BRAND = {
  name: "QueueVerse",
  tagline: "Live Wait Times & Park Analytics",
  subtitle: "Real-time theme park crowd insights.",
  parkName: "Epic Universe",
  parkPageTitle: "Epic Universe Wait Times",
  disclaimer:
    "QueueVerse is an independent fan-made project and is not affiliated with Universal Destinations & Experiences, NBCUniversal, or any theme park operator.",
} as const;

export function pageTitle(segment?: string): string {
  if (!segment) return `${BRAND.parkPageTitle} | ${BRAND.name}`;
  return `${segment} | ${BRAND.name}`;
}
