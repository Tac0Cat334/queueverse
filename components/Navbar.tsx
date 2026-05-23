"use client";

import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";
import { QueueVerseLogo } from "./QueueVerseLogo";

export function Navbar() {
  return (
    <header className="nav-bar sticky top-0 z-50">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5 sm:px-6">
        <QueueVerseLogo size="sm" />

        <div className="flex items-center gap-4">
          <Link
            href="/intelligence"
            className="hidden text-sm text-[var(--fg-secondary)] transition-colors hover:text-[var(--fg)] sm:block"
          >
            Strategy
          </Link>
          <Link
            href="/"
            className="hidden text-sm text-[var(--fg-secondary)] transition-colors hover:text-[var(--fg)] sm:block"
          >
            Waits
          </Link>
          <Link
            href="/contact"
            className="hidden text-sm text-[var(--fg-secondary)] transition-colors hover:text-[var(--fg)] sm:block"
          >
            Contact
          </Link>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
