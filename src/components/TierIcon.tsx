import { useId } from 'react';
import { TIER_ICONS } from '../lib/tierIcons';
import { TIER_BY_ID } from '../lib/tiers';
import type { TierId } from '../lib/types';

/** Lighter version of a hex color, for the top of the gradient and the shine. */
function lighten(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix(n >> 16)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}

interface Props {
  tier: TierId;
  size?: number;
  className?: string;
}

/** The tier's own icon, filled with a gradient of its color. */
export default function TierIcon({ tier, size = 20, className = '' }: Props) {
  const id = useId();
  const { color } = TIER_BY_ID[tier];
  const icon = TIER_ICONS[tier];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className={`shrink-0 ${className}`}>
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={lighten(color, 0.35)} />
          <stop offset="1" stopColor={color} />
        </linearGradient>
      </defs>
      <path d={icon.body} fill={`url(#${id}g)`} fillRule="evenodd" />
      {icon.shine && <path d={icon.shine} fill={lighten(color, 0.75)} fillRule="evenodd" />}
    </svg>
  );
}

/** The icon inside a softly tinted, glowing tile. */
export function TierBadge({ tier, size = 32 }: { tier: TierId; size?: number }) {
  const { color } = TIER_BY_ID[tier];
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-[30%]"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 30% 20%, ${color}38, ${color}14 70%)`,
        boxShadow: `inset 0 0 0 1px ${color}45, 0 4px 14px -6px ${color}aa`,
      }}
    >
      <TierIcon tier={tier} size={Math.round(size * 0.62)} />
    </span>
  );
}
