"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";

interface RelativeTimeProps {
  date: string;
  prefix?: string;
  className?: string;
}

export function RelativeTime({
  date,
  prefix = "Updated",
  className,
}: RelativeTimeProps) {
  const [label, setLabel] = useState("");

  useEffect(() => {
    const update = () => {
      const parsed = new Date(date);
      if (isNaN(parsed.getTime())) {
        setLabel("");
        return;
      }
      setLabel(
        formatDistanceToNow(parsed, { addSuffix: true })
      );
    };

    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [date]);

  if (!label) return null;

  return (
    <span className={className}>
      {prefix} {label}
    </span>
  );
}
