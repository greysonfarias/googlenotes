"use client";

import { useState, useRef, useCallback, useEffect, useLayoutEffect } from "react";

interface UseResizableOptions {
  min?: number;
  max?: number;
}

export function useResizable(
  initialWidth: number,
  storageKey: string,
  { min = 180, max = 520 }: UseResizableOptions = {}
) {
  // Always start with initialWidth (matches server render — avoids hydration mismatch).
  // useLayoutEffect patches in the stored value before the browser paints.
  const [width, setWidth] = useState<number>(initialWidth);
  const widthRef = useRef(initialWidth);

  useLayoutEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const val = parseInt(stored, 10);
      if (!isNaN(val) && val >= min && val <= max) {
        setWidth(val);
        widthRef.current = val;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep ref in sync during drag
  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const startW = widthRef.current;

      const onMove = (e: MouseEvent) => {
        const next = Math.max(min, Math.min(max, startW + e.clientX - startX));
        setWidth(next);
        widthRef.current = next;
      };

      const onUp = () => {
        // Persist final width
        localStorage.setItem(storageKey, String(widthRef.current));
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [min, max, storageKey]
  );

  return { width, startResize };
}
