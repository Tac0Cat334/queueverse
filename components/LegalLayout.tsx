import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface LegalLayoutProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

export function LegalLayout({ title, description, children }: LegalLayoutProps) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-[var(--fg-secondary)] transition-colors hover:text-[var(--fg)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <h1 className="text-3xl font-semibold tracking-tight text-[var(--fg)]">
        {title}
      </h1>
      <p className="mt-2 text-sm text-[var(--fg-muted)]">{description}</p>

      <div className="prose-legal mt-8">{children}</div>
    </div>
  );
}
