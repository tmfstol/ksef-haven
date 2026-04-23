import { useRef, useState, useCallback } from "react";

interface SwipeableOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number; // px to trigger action
  maxSwipe?: number; // px max visual offset
}

/**
 * Lightweight swipe gesture hook for touch devices.
 * Returns handlers + current visual offset (for animating the card).
 */
export function useSwipeable({
  onSwipeLeft,
  onSwipeRight,
  threshold = 80,
  maxSwipe = 140,
}: SwipeableOptions) {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const isHorizontal = useRef<boolean | null>(null);
  const [offset, setOffset] = useState(0);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    startX.current = t.clientX;
    startY.current = t.clientY;
    isHorizontal.current = null;
  }, []);

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (startX.current === null || startY.current === null) return;
      const t = e.touches[0];
      const dx = t.clientX - startX.current;
      const dy = t.clientY - startY.current;

      // Lock direction on first significant move
      if (isHorizontal.current === null) {
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
          isHorizontal.current = Math.abs(dx) > Math.abs(dy);
        } else {
          return;
        }
      }

      if (!isHorizontal.current) return;

      // Clamp
      const clamped = Math.max(-maxSwipe, Math.min(maxSwipe, dx));
      setOffset(clamped);
    },
    [maxSwipe]
  );

  const onTouchEnd = useCallback(() => {
    if (isHorizontal.current && Math.abs(offset) >= threshold) {
      if (offset < 0) onSwipeLeft?.();
      else onSwipeRight?.();
    }
    setOffset(0);
    startX.current = null;
    startY.current = null;
    isHorizontal.current = null;
  }, [offset, threshold, onSwipeLeft, onSwipeRight]);

  return {
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
    offset,
  };
}
