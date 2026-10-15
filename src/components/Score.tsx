import { TIER_BY_ID, scoreColor } from '../lib/tiers';
import type { TierId } from '../lib/types';

export function ScoreBadge({ score, className = '' }: { score: number; className?: string }) {
  const color = scoreColor(score);
  return (
    <span
      className={`inline-flex min-w-9 items-center justify-center rounded-lg px-1.5 py-0.5 font-display text-sm font-bold tabular-nums ${className}`}
      style={{ background: `${color}22`, color, boxShadow: `inset 0 0 0 1px ${color}55` }}
    >
      {score}
    </span>
  );
}

export function TierChip({ tier, size = 'md' }: { tier: TierId; size?: 'sm' | 'md' }) {
  const t = TIER_BY_ID[tier];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'}`}
      style={{ background: `${t.color}1f`, color: t.color }}
    >
      <span>{t.emoji}</span>
      {t.label}
    </span>
  );
}

export function ScoreRing({ score, size = 88, stroke = 8 }: { score: number; size?: number; stroke?: number }) {
  const color = scoreColor(score);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ffffff14" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          style={{ transition: 'stroke-dashoffset .4s ease, stroke .2s' }}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-display font-bold tabular-nums"
        style={{ color, fontSize: size * 0.36 }}
      >
        {score}
      </span>
    </div>
  );
}
