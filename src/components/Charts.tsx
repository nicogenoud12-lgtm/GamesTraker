import { useState } from 'react';

export interface Bar {
  key: string;
  label: string;
  value: number;
  /** Extra line shown in the tooltip. */
  detail?: string;
}

/**
 * Single-series vertical bars (one hue, magnitude only). Hover, focus or tap
 * shows the value; `onSelect` makes bars act as buttons.
 */
export function ColumnChart({
  bars,
  selected,
  onSelect,
  height = 132,
}: {
  bars: Bar[];
  selected?: string | null;
  onSelect?: (key: string) => void;
  height?: number;
}) {
  const [active, setActive] = useState<string | null>(null);
  const max = Math.max(1, ...bars.map((b) => b.value));
  const shown = bars.find((b) => b.key === active);

  return (
    <div className="relative">
      <div className="flex items-end gap-[2px]" style={{ height }} onMouseLeave={() => setActive(null)}>
        {bars.map((b) => {
          const isSel = selected === b.key;
          return (
            <button
              key={b.key}
              type="button"
              aria-label={`${b.label}: ${b.value}${b.detail ? `, ${b.detail}` : ''}`}
              onMouseEnter={() => setActive(b.key)}
              onFocus={() => setActive(b.key)}
              onBlur={() => setActive(null)}
              onClick={() => {
                setActive(b.key);
                onSelect?.(b.key);
              }}
              className="group relative flex h-full min-w-0 flex-1 items-end"
            >
              <span
                className="mx-auto w-full max-w-14 rounded-t-[4px] transition-opacity"
                style={{
                  height: b.value ? `${Math.max(4, (b.value / max) * 100)}%` : 2,
                  background: b.value ? 'var(--color-accent)' : 'var(--color-line)',
                  opacity: active && active !== b.key ? 0.45 : isSel || !selected ? 1 : 0.55,
                }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-[2px] border-t border-line pt-1.5">
        {bars.map((b) => (
          <span
            key={b.key}
            className={`min-w-0 flex-1 truncate text-center text-[10px] tabular-nums ${selected === b.key ? 'font-bold text-white' : 'text-muted'}`}
          >
            {b.label}
          </span>
        ))}
      </div>
      {shown && (
        <div className="pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2 -translate-y-full rounded-xl border border-line bg-surface-2 px-3 py-1.5 text-center text-xs whitespace-nowrap shadow-xl">
          <span className="font-semibold text-white">{shown.label}</span>
          <span className="text-muted"> · </span>
          <span className="font-semibold text-white tabular-nums">{shown.value}</span>
          <span className="text-muted"> {shown.value === 1 ? 'juego' : 'juegos'}</span>
          {shown.detail && <div className="text-muted">{shown.detail}</div>}
        </div>
      )}
    </div>
  );
}

/** Ranked horizontal bars with the value as a direct label (text stays in ink colours). */
export function RankBars({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[7.5rem_1fr_2rem] items-center gap-3 text-sm">
          <span className="truncate text-white/80">{r.label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-white/5">
            <span
              className="block h-full rounded-full"
              style={{ width: `${(r.value / max) * 100}%`, background: 'var(--color-accent)' }}
            />
          </span>
          <span className="text-right text-muted tabular-nums">{r.value}</span>
        </li>
      ))}
    </ul>
  );
}
