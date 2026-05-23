import type { TrendDirection } from "@/types";
import { TrendingUp, TrendingDown, Minus, Zap } from "lucide-react";
import { cn } from "@/utils/wait-time";

interface TrendBadgeProps {
  trend: TrendDirection;
  label: string;
  change?: number;
  compact?: boolean;
}

export function TrendBadge({ trend, label, change, compact }: TrendBadgeProps) {
  const Icon =
    trend === "rising_fast"
      ? Zap
      : trend === "up"
        ? TrendingUp
        : trend === "down" || trend === "falling_fast"
          ? TrendingDown
          : Minus;

  const colorClass =
    trend === "rising_fast" || trend === "up"
      ? "text-[var(--wait-high)]"
      : trend === "down" || trend === "falling_fast"
        ? "text-[var(--wait-low)]"
        : "text-[var(--fg-muted)]";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        colorClass,
        compact ? "text-[10px]" : "text-xs"
      )}
    >
      <Icon
        className={cn(
          compact ? "h-3 w-3" : "h-3.5 w-3.5",
          (trend === "rising_fast" || trend === "falling_fast") && "animate-pulse"
        )}
      />
      <span>{label}</span>
      {change !== undefined && change !== 0 && !compact && (
        <span className="opacity-70">
          ({change > 0 ? "+" : ""}
          {change}m)
        </span>
      )}
    </span>
  );
}
