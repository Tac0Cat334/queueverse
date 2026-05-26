export const BRAND = {
  name: "QueueVerse",
  tagline: "Live park strategist",
  subtitle:
    "Predictive crowd intelligence and adaptive ride optimization for your day.",
  parkName: "Epic Universe",
  parkPageTitle: "Epic Universe",
  disclaimer:
    "QueueVerse is an independent fan-made project and is not affiliated with Universal Destinations & Experiences, NBCUniversal, or any theme park operator.",
} as const;

export function pageTitle(segment?: string): string {
  if (!segment) return `${BRAND.parkPageTitle} | ${BRAND.name}`;
  return `${segment} | ${BRAND.name}`;
}
