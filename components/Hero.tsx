"use client";

import { BRAND } from "@/lib/brand";
import { RelativeTime } from "./RelativeTime";
import { SyncHealthBadge } from "./SyncHealthBadge";

interface HeroProps {
  lastUpdated: string | null;
}

export function Hero({ lastUpdated }: HeroProps) {
  return (
    <section className="px-4 pt-12 pb-8 sm:px-6 sm:pt-16">
      <div className="mx-auto max-w-5xl">
        <p className="label mb-3">{BRAND.name}</p>

        <h1 className="text-4xl font-semibold tracking-tight text-[var(--fg)] sm:text-5xl">
          {BRAND.parkPageTitle}
        </h1>

        <p className="mt-3 max-w-lg text-base leading-relaxed text-[var(--fg-secondary)]">
          {BRAND.tagline}. {BRAND.subtitle}
        </p>

        <div className="mt-5 space-y-1">
          {lastUpdated && (
            <p className="label">
              <RelativeTime date={lastUpdated} />
            </p>
          )}
          <SyncHealthBadge compact />
        </div>
      </div>
    </section>
  );
}
