import { type Candidate, type RawgTag, type TasteFacts, rawgCandidates, rawgTasteFacts } from './rawg';
import type { Game, Rating } from './types';

// Game recommendations from the player's own ratings. Every rated game lends
// its RAWG tags, genres and studios a weight: how much it was liked compared
// with the player's average (abandoned or "wouldn't replay" counts against).
// Rare tags ("Souls-like") say more than common ones ("Singleplayer").
// Candidates share the strongest tags or studios and are ranked by how well
// they fit that profile, nudged by how good they are.

/** Store and platform features, not something a game is "about". */
const META_TAGS = new Set([
  'steam-achievements',
  'full-controller-support',
  'partial-controller-support',
  'controller-support',
  'steam-cloud',
  'steam-trading-cards',
  'steam-leaderboards',
  'steam-workshop',
  'steamvr-collectibles',
  'includes-level-editor',
  'remote-play',
  'remote-play-together',
  'remote-play-on-tv',
  'remote-play-on-phone',
  'remote-play-on-tablet',
  'in-app-purchases',
  'cloud-saves',
  'achievements',
  'stats',
  'steam-turn-notifications',
  'valve-anti-cheat-enabled',
  'exclusive',
  'true-exclusive',
  'console-exclusive',
  'family-sharing',
  'tracked-controller-support',
  'includes-source-sdk',
  'captions-available',
  'commentary-available',
  'hdr-available',
  'playstation-trophies',
]);

/** RAWG tags are in English; the common ones read better in Spanish. */
const TAG_ES: Record<string, string> = {
  'open-world': 'Mundo abierto',
  'story-rich': 'Gran historia',
  difficult: 'Difícil',
  'dark-fantasy': 'Fantasía oscura',
  atmospheric: 'Atmosférico',
  'great-soundtrack': 'Gran banda sonora',
  exploration: 'Exploración',
  'sci-fi': 'Ciencia ficción',
  horror: 'Terror',
  survival: 'Supervivencia',
  'survival-horror': 'Survival horror',
  'co-op': 'Cooperativo',
  'online-co-op': 'Cooperativo online',
  multiplayer: 'Multijugador',
  singleplayer: 'Para un jugador',
  'third-person': 'Tercera persona',
  'first-person': 'Primera persona',
  fantasy: 'Fantasía',
  stealth: 'Sigilo',
  puzzle: 'Puzles',
  'female-protagonist': 'Protagonista mujer',
  'post-apocalyptic': 'Postapocalíptico',
  'turn-based': 'Por turnos',
  'turn-based-combat': 'Combate por turnos',
  funny: 'Humor',
  'choices-matter': 'Decisiones que importan',
  'pixel-graphics': 'Pixel art',
  'action-rpg': 'Action RPG',
  'hack-and-slash': 'Hack and slash',
  'character-customization': 'Personalización',
  'crafting': 'Crafteo',
  'building': 'Construcción',
  'strategy': 'Estrategia',
  'racing': 'Carreras',
  'sports': 'Deportes',
  'fps': 'Shooter en primera persona',
  'cyberpunk': 'Cyberpunk',
  'medieval': 'Medieval',
  'zombies': 'Zombies',
  'space': 'Espacio',
  'mystery': 'Misterio',
  'platformer': 'Plataformas',
  '2d': '2D',
  'relaxing': 'Relajante',
  'cute': 'Tierno',
  'emotional': 'Emotivo',
  'psychological-horror': 'Terror psicológico',
  'loot': 'Loot',
  'parkour': 'Parkour',
  'combat': 'Combate',
};
const tagName = (t: RawgTag) => TAG_ES[t.slug] ?? t.name;

const RAWG_GAMES = 900_000;
const usable = (t: RawgTag) => (t.language ?? 'eng') === 'eng' && !META_TAGS.has(t.slug);
const rarity = (t: RawgTag) => Math.log(1 + RAWG_GAMES / Math.max(50, t.games_count ?? 5000));

// Tags and studios of a game don't change; keep them so each rated game is fetched once.
const FACTS_KEY = 'gamestraker-taste-facts';
let factsCache: Record<string, TasteFacts> | null = null;
function facts(): Record<string, TasteFacts> {
  if (!factsCache) {
    try {
      factsCache = JSON.parse(localStorage.getItem(FACTS_KEY) ?? '{}');
    } catch {
      factsCache = {};
    }
  }
  return factsCache!;
}
function saveFacts() {
  try {
    localStorage.setItem(FACTS_KEY, JSON.stringify(facts()));
  } catch {
    // Storage full or blocked: the profile is just rebuilt from the network next time.
  }
}

interface Liked {
  name: string;
  weight: number;
  /** Tag id → rarity, and the length of that vector for cosine similarity. */
  tags: Map<number, number>;
  norm: number;
  developers: Set<number>;
}

export interface Profile {
  tags: Map<number, { tag: RawgTag; weight: number }>;
  genres: Map<string, number>;
  developers: Map<number, { name: string; weight: number }>;
  liked: Liked[];
  /** Strongest likes, for "Te gustan: …". */
  top: string[];
}

/** How much a rating says "more like this" (positive) or "less like this" (negative). */
function ratingWeight(r: Rating, average: number): number {
  let w = (r.score - average) / 15 + (r.score - 70) / 30;
  if (r.replay === 'si') w += 0.3;
  if (r.replay === 'no') w -= 0.3;
  if (r.status === 'abandonado') w -= 0.5;
  return w;
}

async function inBatches<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
}

export async function gameProfile(
  key: string,
  ratings: Rating[],
  games: Record<string, Game>,
  signal?: AbortSignal,
): Promise<Profile | null> {
  const rated = ratings
    .filter((r) => r.gameId.startsWith('rawg:') && games[r.gameId])
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 60);
  if (rated.length < 2) return null;

  const cache = facts();
  const missing = rated.filter((r) => !cache[r.gameId]);
  await inBatches(missing, 4, async (r) => {
    try {
      cache[r.gameId] = await rawgTasteFacts(key, r.gameId.slice(5), signal);
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
    }
  });
  if (missing.length) saveFacts();

  const average = rated.reduce((sum, r) => sum + r.score, 0) / rated.length;
  const profile: Profile = { tags: new Map(), genres: new Map(), developers: new Map(), liked: [], top: [] };
  for (const r of rated) {
    const f = cache[r.gameId];
    if (!f) continue;
    const w = ratingWeight(r, average);
    const tags = new Map<number, number>();
    for (const t of f.tags.filter(usable)) {
      const entry = profile.tags.get(t.id) ?? { tag: t, weight: 0 };
      entry.weight += w * rarity(t);
      profile.tags.set(t.id, entry);
      tags.set(t.id, rarity(t));
    }
    for (const g of f.genres) profile.genres.set(g, (profile.genres.get(g) ?? 0) + w);
    for (const d of f.developers) {
      const entry = profile.developers.get(d.id) ?? { name: d.name, weight: 0 };
      entry.weight += w;
      profile.developers.set(d.id, entry);
    }
    if (w > 0.3) {
      const norm = Math.sqrt([...tags.values()].reduce((sum, x) => sum + x * x, 0));
      profile.liked.push({ name: games[r.gameId].name, weight: w, tags, norm, developers: new Set(f.developers.map((d) => d.id)) });
    }
  }
  profile.top = [...profile.tags.values()]
    .filter((t) => t.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((t) => tagName(t.tag));
  return profile.tags.size ? profile : null;
}

const strongest = <K, V extends { weight: number }>(m: Map<K, V>, n: number) =>
  [...m.entries()]
    .filter(([, v]) => v.weight > 0)
    .sort((a, b) => b[1].weight - a[1].weight)
    .slice(0, n);

/** The liked game a candidate resembles most (cosine similarity of rarity-weighted tags). */
function closest(c: Candidate, profile: Profile): { liked: Liked; similarity: number } | null {
  const tags = c.tags.filter(usable);
  const norm = Math.sqrt(tags.reduce((sum, t) => sum + rarity(t) ** 2, 0));
  let best: { liked: Liked; similarity: number } | null = null;
  for (const liked of profile.liked) {
    let dot = 0;
    for (const t of tags) dot += (liked.tags.get(t.id) ?? 0) * rarity(t);
    // Among equally similar games, the one liked more explains it better.
    const similarity = norm && liked.norm ? (dot / (norm * liked.norm)) * (1 + liked.weight / 20) : 0;
    if (!best || similarity > best.similarity) best = { liked, similarity };
  }
  return best;
}

export async function recommendFromProfile(
  key: string,
  profile: Profile,
  exclude: Set<string>,
  signal?: AbortSignal,
): Promise<{ games: Game[]; notes: Record<string, string> }> {
  const today = new Date().toISOString().slice(0, 10);
  const dates = `1985-01-01,${today}`;
  const topTags = strongest(profile.tags, 5).map(([id]) => id);
  const studios = strongest(profile.developers, 2);
  // Also start from each favourite game's most distinctive tags, so one
  // dominant taste (say, soulslikes) doesn't crowd out the rest.
  const favourites = [...profile.liked].sort((a, b) => b.weight - a.weight).slice(0, 4);
  const signature = (liked: Liked) =>
    [...liked.tags.entries()]
      .filter(([id]) => (profile.tags.get(id)?.weight ?? 0) > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([id]) => id)
      .join(',');
  const queries: { params: Record<string, string>; studio?: number }[] = [
    ...topTags.map((id) => ({ params: { tags: String(id), ordering: '-added', dates } })),
    ...[...new Set(favourites.map(signature).filter(Boolean))].map((tags) => ({ params: { tags, ordering: '-added', dates } })),
    ...studios.map(([id]) => ({ params: { developers: String(id), ordering: '-added', dates }, studio: id })),
  ];
  const pages = await Promise.all(
    queries.map((q) =>
      rawgCandidates(key, q.params, signal)
        .then((list) => list.map((c) => ({ c, studio: q.studio })))
        .catch((e: Error) => {
          if (e.name === 'AbortError') throw e;
          return [];
        }),
    ),
  );

  const seen = new Map<string, { c: Candidate; studio?: number }>();
  for (const page of pages) {
    for (const item of page) {
      const prev = seen.get(item.c.game.id);
      if (!prev) seen.set(item.c.game.id, item);
      else if (item.studio && !prev.studio) prev.studio = item.studio;
    }
  }

  const scored = [...seen.values()]
    .filter(({ c }) => !exclude.has(c.game.id) && c.game.released && c.game.released <= today && c.ratingsCount >= 15)
    .map(({ c, studio }) => {
      const tags = c.tags.filter(usable);
      const fit = tags.reduce((sum, t) => sum + (profile.tags.get(t.id)?.weight ?? 0), 0) / Math.sqrt(tags.length + 1);
      const genre = c.game.genres.reduce((sum, g) => sum + (profile.genres.get(g) ?? 0), 0) / (c.game.genres.length || 1);
      const studioBonus = studio != null ? (profile.developers.get(studio)?.weight ?? 0) : 0;
      const quality =
        c.game.metacritic != null && !c.game.scoreLabel
          ? (c.game.metacritic - 75) / 15
          : c.ratingsCount >= 30
            ? (c.rating - 3.7) / 0.8
            : 0;
      return { c, studio, fit: fit + genre * 0.5 + studioBonus, quality: Math.max(-1.5, Math.min(1.5, quality)) };
    });
  const maxFit = Math.max(...scored.map((s) => s.fit), 1e-6);
  const pool = scored
    .filter((s) => s.fit > 0)
    .map((s) => {
      const near = closest(s.c, profile);
      const studio = s.studio != null ? profile.developers.get(s.studio)?.name : undefined;
      const similar = near && near.similarity > 0.35;
      const why =
        studio && (!near || near.similarity < 0.6)
          ? `De ${studio}`
          : near && (similar || !studio)
            ? `Como ${near.liked.name}`
            : '';
      return { ...s, why, total: s.fit / maxFit + 0.25 * s.quality + 0.4 * (near?.similarity ?? 0) };
    });

  // Greedy pick with a penalty for repeating the same "why", so the row mixes tastes.
  const picked: typeof pool = [];
  const used = new Map<string, number>();
  while (picked.length < 20 && pool.length) {
    let bestIdx = 0;
    let bestValue = -Infinity;
    pool.forEach((s, i) => {
      const value = s.total - 0.25 * (used.get(s.why) ?? 0);
      if (value > bestValue) [bestIdx, bestValue] = [i, value];
    });
    const [s] = pool.splice(bestIdx, 1);
    picked.push(s);
    used.set(s.why, (used.get(s.why) ?? 0) + 1);
  }

  const notes: Record<string, string> = {};
  for (const s of picked) if (s.why) notes[s.c.game.id] = s.why;
  return { games: picked.map((s) => s.c.game), notes };
}
