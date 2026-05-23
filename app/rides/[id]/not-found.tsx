import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-xl font-semibold text-[var(--fg)]">Page not found</h1>
      <p className="mt-2 text-sm text-[var(--fg-muted)]">
        This page doesn&apos;t exist or may have moved.
      </p>
      <Link href="/" className="chip chip-active mt-6">
        Go home
      </Link>
    </div>
  );
}
