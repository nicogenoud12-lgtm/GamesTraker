import type { TierId } from './types';

// Hand-made tier icons (24×24). Each is one or two filled shapes; holes are cut
// with the even-odd rule, so the same data draws in SVG and on a canvas (Path2D).
// `shine` is a lighter second layer drawn on top.

export interface TierIconDef {
  /** Main shape(s), filled with the tier's gradient. */
  body: string;
  /** Optional highlight drawn over the body in a lighter tone. */
  shine?: string;
}

export const TIER_ICONS: Record<TierId, TierIconDef> = {
  // Crown with three jewels.
  historico: {
    body:
      'M3.2 8.1 7.6 11.6 12 4.9 16.4 11.6 20.8 8.1 19.1 17.6H4.9Z' +
      'M5.1 19.1H18.9V20.4A.9.9 0 0 1 18 21.3H6A.9.9 0 0 1 5.1 20.4Z',
    shine:
      'M12 1.9A1.55 1.55 0 1 1 12 5 1.55 1.55 0 1 1 12 1.9Z' +
      'M3 5.6A1.35 1.35 0 1 1 3 8.3 1.35 1.35 0 1 1 3 5.6Z' +
      'M21 5.6A1.35 1.35 0 1 1 21 8.3 1.35 1.35 0 1 1 21 5.6Z' +
      'M12 12.2 13.5 14.2 12 16.2 10.5 14.2Z',
  },
  // Flame with two tongues and a bright core.
  buenisimo: {
    body:
      'M11.6 1.3C12 3.7 13.5 5.3 15 6.9 15.3 5.8 15.2 4.7 14.8 3.6 17.7 5.7 19.8 9.2 19.8 13.6 19.8 18.2 16.3 21.9 12 21.9S4.2 18.2 4.2 13.8C4.2 10.6 5.7 8 7.6 6.2 7.5 7.9 8 9.2 9 10 8.7 6.7 9.6 3.7 11.6 1.3Z',
    shine:
      'M12 11.4C13.6 13 15.1 14.5 15.1 16.8A3.1 3.1 0 0 1 8.9 16.8C8.9 15.7 9.3 14.8 10 14.1 10.2 15.1 10.7 15.7 11.3 16 11 14.4 11.2 12.8 12 11.4Z',
  },
  // Seal with a check cut out.
  bueno: {
    body:
      'M12 1.8 14.5 3.6 17.6 3.5 18.6 6.4 21.1 8.2 20.2 11.2 21.1 14.1 18.6 15.9 17.6 18.8 14.5 18.7 12 20.5 9.5 18.7 6.4 18.8 5.4 15.9 2.9 14.1 3.8 11.2 2.9 8.2 5.4 6.4 6.4 3.5 9.5 3.6Z' +
      'M7.6 11.1 10.6 14.1 16.5 8.2 15.1 6.8 10.6 11.3 9 9.7Z',
  },
  // A "meh" face: dot eyes and a slanted mouth.
  safa: {
    body:
      'M12 2.2A9.8 9.8 0 1 1 12 21.8 9.8 9.8 0 1 1 12 2.2Z' +
      'M8.6 8.3A1.45 1.45 0 1 0 8.6 11.2 1.45 1.45 0 1 0 8.6 8.3Z' +
      'M15.4 8.3A1.45 1.45 0 1 0 15.4 11.2 1.45 1.45 0 1 0 15.4 8.3Z' +
      'M7.9 15.6 15.8 14.2A.8.8 0 0 1 16.1 15.8L8.2 17.2A.8.8 0 0 1 7.9 15.6Z',
  },
  // Sleepy moon with a "z".
  aburrido: {
    body: 'M18.9 14.8A8.6 8.6 0 1 1 8.4 4.3 7 7 0 0 0 18.9 14.8Z',
    shine: 'M14.2 2.6H19.4V4.1L16.4 7.4H19.5V9H14.1V7.5L17.1 4.2H14.2Z',
  },
  // Skull.
  malo: {
    body:
      'M12 2.1C7.4 2.1 3.8 5.5 3.8 9.9 3.8 12.6 5.1 14.8 7.1 16.1V19.4A1.4 1.4 0 0 0 8.5 20.8H9.8V18.6H11.2V20.8H12.8V18.6H14.2V20.8H15.5A1.4 1.4 0 0 0 16.9 19.4V16.1C18.9 14.8 20.2 12.6 20.2 9.9 20.2 5.5 16.6 2.1 12 2.1Z' +
      'M8.7 8.3A2.05 2.05 0 1 0 8.7 12.4 2.05 2.05 0 1 0 8.7 8.3Z' +
      'M15.3 8.3A2.05 2.05 0 1 0 15.3 12.4 2.05 2.05 0 1 0 15.3 8.3Z' +
      'M12 13.3 13.1 15.4H10.9Z',
  },
};

/** Draws a tier icon on a canvas, `size` pixels wide, with its top-left corner at (x, y). */
export function drawTierIcon(ctx: CanvasRenderingContext2D, id: TierId, x: number, y: number, size: number, color: string, shine = '#ffffff') {
  const icon = TIER_ICONS[id];
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.fillStyle = color;
  ctx.fill(new Path2D(icon.body), 'evenodd');
  if (icon.shine) {
    ctx.fillStyle = shine;
    ctx.globalAlpha = 0.85;
    ctx.fill(new Path2D(icon.shine), 'evenodd');
  }
  ctx.restore();
}
