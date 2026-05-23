import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { QueueVerseLogo } from "./QueueVerseLogo";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[var(--border)] mt-auto">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <QueueVerseLogo showTagline />
            <p className="mt-4 text-xs leading-relaxed text-[var(--fg-muted)]">
              {BRAND.disclaimer}
            </p>
          </div>

          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-[var(--fg-secondary)]">
            <Link href="/privacy" className="hover:text-[var(--fg)] transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-[var(--fg)] transition-colors">
              Terms
            </Link>
            <Link href="/disclaimer" className="hover:text-[var(--fg)] transition-colors">
              Disclaimer
            </Link>
            <Link href="/contact" className="hover:text-[var(--fg)] transition-colors">
              Contact
            </Link>
          </nav>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-[var(--border)] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[var(--fg-muted)]">
            © {year} {BRAND.name}
          </p>
          <p className="text-xs text-[var(--fg-secondary)]">
            Powered by{" "}
            <a
              href="https://queue-times.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[var(--fg)] underline underline-offset-2 hover:opacity-70 transition-opacity"
            >
              Queue-Times.com
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
