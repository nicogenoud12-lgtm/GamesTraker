import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { TIERS, type Tier } from '../lib/tiers';

/** "80–91": the default score range of a tier. */
function range(tier: Tier): string {
  const next = TIERS[TIERS.indexOf(tier) + 1];
  return next ? `${tier.min}–${next.min - 1}` : `${tier.min}–100`;
}

interface Props {
  tier: Tier;
  count: number;
  /** "Ver todos" opens the tier on its own; omitted where there is nowhere to go. */
  onOpen?: () => void;
  children?: ReactNode;
}

/**
 * One tier of the tier list: a dark card lightly tinted with the tier's color,
 * a header with its emoji, name, score range and count, and the covers below.
 */
export default function TierSection({ tier, count, onOpen, children }: Props) {
  const empty = count === 0;
  return (
    <section
      className={`relative overflow-hidden rounded-2xl border ${empty ? 'opacity-55' : ''}`}
      style={{
        borderColor: `${tier.color}2e`,
        background: `linear-gradient(120deg, ${tier.color}1f 0%, ${tier.color}08 38%, transparent 70%), var(--color-surface)`,
      }}
    >
      <span
        aria-hidden
        className="absolute top-3 bottom-3 left-0 w-[3px] rounded-r-full"
        style={{ background: tier.color, boxShadow: `0 0 14px ${tier.color}aa` }}
      />
      <header className={`flex items-center gap-2.5 pr-3 pl-4 ${empty ? 'py-2.5' : 'pt-3 pb-2.5'}`}>
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[17px] leading-none"
          style={{ background: `${tier.color}24`, boxShadow: `inset 0 0 0 1px ${tier.color}45` }}
        >
          {tier.emoji}
        </span>
        <div className="min-w-0 leading-tight">
          <h3 className="font-display text-[15px] font-bold tracking-tight" style={{ color: tier.color }}>
            {tier.label}
          </h3>
          <p className="text-[11px] text-muted tabular-nums">{range(tier)}</p>
        </div>
        <span
          className="ml-1 rounded-full px-2 py-0.5 font-display text-xs font-semibold tabular-nums"
          style={{ background: `${tier.color}1a`, color: `${tier.color}` }}
        >
          {count}
        </span>
        {empty ? (
          <span className="ml-auto text-xs text-muted">Nada todavía</span>
        ) : (
          onOpen && (
            <button onClick={onOpen} className="ml-auto flex items-center gap-0.5 rounded-full px-2 py-1 text-xs font-medium text-muted transition hover:bg-white/5 hover:text-white">
              Ver todos <ChevronRight size={14} />
            </button>
          )
        )}
      </header>
      {!empty && children}
    </section>
  );
}

/** The score on a cover, in the tier's color. */
export function CoverScore({ score, color }: { score: number; color: string }) {
  return (
    <span
      className="absolute right-1 bottom-1 rounded-md bg-black/75 px-1.5 py-px font-display text-[11px] font-bold tabular-nums shadow backdrop-blur"
      style={{ color, boxShadow: `inset 0 0 0 1px ${color}40` }}
    >
      {score}
    </span>
  );
}
