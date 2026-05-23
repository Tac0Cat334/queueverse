import type { Metadata } from "next";
import { BRAND, pageTitle } from "./brand";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://queueverse.app";

export const siteMetadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: pageTitle(),
    template: `%s | ${BRAND.name}`,
  },
  description: `Live ${BRAND.parkName} wait times, ride analytics, and historical crowd trends powered by ${BRAND.name}.`,
  keywords: [
    BRAND.name,
    BRAND.parkName,
    "wait times",
    "theme park analytics",
    "ride wait times",
    "crowd trends",
    "Universal Orlando",
  ],
  authors: [{ name: BRAND.name }],
  creator: BRAND.name,
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: BRAND.name,
    title: pageTitle(),
    description: `${BRAND.tagline}. ${BRAND.subtitle}`,
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle(),
    description: `${BRAND.tagline}. ${BRAND.subtitle}`,
  },
  robots: {
    index: true,
    follow: true,
  },
  appleWebApp: {
    capable: true,
    title: BRAND.name,
    statusBarStyle: "default",
  },
};
