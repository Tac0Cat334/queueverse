import Link from "next/link";
import { ExternalLink } from "lucide-react";

export function DataAttribution() {
  return (
    <div className="mx-auto max-w-5xl px-4 pb-10 sm:px-6">
      <div className="card flex flex-col items-center gap-2 p-6 text-center sm:flex-row sm:justify-center sm:gap-2.5">
        <p className="text-sm text-[var(--fg-secondary)]">
          Wait time data provided by
        </p>
        <Link
          href="https://queue-times.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--fg)] underline underline-offset-4 transition-opacity hover:opacity-70"
        >
          Queue-Times.com
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
