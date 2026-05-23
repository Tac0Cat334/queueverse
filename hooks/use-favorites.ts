"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "queueverse-favorites";

function readFavorites(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is number => typeof id === "number")
      : [];
  } catch {
    return [];
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<number[]>([]);

  useEffect(() => {
    setFavorites(readFavorites());
  }, []);

  const toggleFavorite = useCallback((rideId: number) => {
    setFavorites((prev) => {
      const next = prev.includes(rideId)
        ? prev.filter((id) => id !== rideId)
        : [...prev, rideId];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const isFavorite = useCallback(
    (rideId: number) => favorites.includes(rideId),
    [favorites]
  );

  return { favorites, toggleFavorite, isFavorite };
}
