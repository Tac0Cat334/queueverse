import Link from "next/link";

interface QueueVerseLogoProps {
  size?: "sm" | "md";
  showTagline?: boolean;
}

export function QueueVerseLogo({ size = "md", showTagline = false }: QueueVerseLogoProps) {
  const iconSize = size === "sm" ? 28 : 32;
  const textSize = size === "sm" ? "text-sm" : "text-base";

  return (
    <Link href="/" className="group inline-flex items-center gap-2.5">
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <circle
          cx="16"
          cy="16"
          r="13"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-[var(--fg-muted)] opacity-40"
        />
        <path
          d="M16 3 A13 13 0 0 1 29 16"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="text-[var(--fg)]"
        />
        <circle cx="16" cy="16" r="3" fill="currentColor" className="text-[var(--fg)]" />
      </svg>
      <div>
        <span className={`${textSize} font-semibold tracking-tight text-[var(--fg)]`}>
          Queue<span className="font-normal text-[var(--fg-secondary)]">Verse</span>
        </span>
        {showTagline && (
          <span className="block text-[11px] text-[var(--fg-muted)]">
            Live Wait Times &amp; Park Analytics
          </span>
        )}
      </div>
    </Link>
  );
}
