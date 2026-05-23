"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-xl font-semibold text-[var(--fg)]">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-sm text-[var(--fg-muted)]">
        {error.message || "Unable to load wait times."}
      </p>
      <button onClick={reset} className="chip chip-active mt-6">
        Try again
      </button>
    </div>
  );
}
