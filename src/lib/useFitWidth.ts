import { useLayoutEffect, useRef, useState } from 'react';

interface Options {
  /** Narrowest an item may get; `null` turns fitting off (items keep their own width). */
  min: number | null;
  /** Gap between items, in px. */
  gap: number;
  /** Space the row leaves on both sides together (padding or margin), in px. */
  inset: number;
  /** Measuring starts once the row is on screen (e.g. an empty tier renders none). */
  active?: boolean;
}

/**
 * Width that fits a whole number of items in a horizontal row, each at least `min`
 * wide, so the last visible one is never cut in half; the rest are a scroll away.
 * Attach `ref` to an element as wide as the row.
 */
export function useFitWidth({ min, gap, inset, active = true }: Options) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || min == null) {
      setWidth(undefined);
      return;
    }
    const fit = () => {
      const inner = el.clientWidth - inset;
      const n = Math.max(1, Math.floor((inner + gap) / (min + gap)));
      setWidth((inner - (n - 1) * gap) / n);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [min, gap, inset, active]);
  return [ref, width] as const;
}
