"use client";

import { Star } from "lucide-react";
import { cn } from "@/utils/wait-time";

interface FavoriteButtonProps {
  isFavorite: boolean;
  onToggle: () => void;
  className?: string;
}

export function FavoriteButton({
  isFavorite,
  onToggle,
  className,
}: FavoriteButtonProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
      className={cn(
        "rounded-full p-1.5 transition-colors hover:bg-[var(--surface-hover)]",
        className
      )}
    >
      <Star
        className={cn(
          "h-4 w-4 transition-colors",
          isFavorite
            ? "fill-[var(--fg)] text-[var(--fg)]"
            : "text-[var(--fg-muted)]"
        )}
      />
    </button>
  );
}
