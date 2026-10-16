// GamesTracker sync API: user accounts (username + password) and one JSON
// document per user with their ratings, lists and game snapshots, plus a
// critic-score lookup (Steam's Metacritic, optionally IGDB), game lengths
// (HowLongToBeat, or IGDB), IMDb ratings (from IMDb's daily public file), Rotten
// Tomatoes scores, friends, notifications and Trakt (Nuvio).
// No dependencies; everything lives under DATA_DIR.
//
// CLI (inside the container):
//   node index.mjs reset-password <usuario> <contraseña-nueva>
//   node index.mjs rename-user <usuario> <nombre-nuevo>
import http from 'node:http';
import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import { Readable } from 'node:stream';
import { createGunzip } from 'node:zlib';
import { promisify } from 'node:util';
import { generateVapidKeys, sendPush } from './webpush.mjs';

const scrypt = promisify(scryptCb);

const PORT = Number(process.env.PORT ?? 8787);
const DATA_DIR = process.env.DATA_DIR ?? '/data';
const ALLOW_SIGNUP = process.env.ALLOW_SIGNUP === 'true';
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SECRET_FILE = path.join(DATA_DIR, 'secret');
const STATE_DIR = path.join(DATA_DIR, 'state');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const LEGACY_STATE = path.join(DATA_DIR, 'state.json');
const ACTIVITY_DIR = path.join(DATA_DIR, 'activity');
const PUSH_DIR = path.join(DATA_DIR, 'push');
const VAPID_FILE = path.join(DATA_DIR, 'vapid.json');
const MAX_BODY = 10 * 1024 * 1024;
const KEEP_BACKUPS = 30;
const SESSION_DAYS = 365;
const MAX_FAILS = 10;
const LOCK_MS = 15 * 60 * 1000;
const IGDB_CLIENT_ID = process.env.IGDB_CLIENT_ID ?? '';
const IGDB_CLIENT_SECRET = process.env.IGDB_CLIENT_SECRET ?? '';

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// ---------- storage ----------

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return fallback;
    throw e;
  }
}

async function writeJson(file, value) {
  const tmp = `${file}.tmp`;
  await writeFile(tmp, JSON.stringify(value));
  await rename(tmp, file);
}

// All writes go through one queue so concurrent requests never interleave.
let queue = Promise.resolve();
function serial(fn) {
  const run = queue.then(fn);
  queue = run.catch(() => {});
  return run;
}

// Read on every request (the file is tiny) so the reset-password CLI is picked up live.
const loadUsers = () => readJson(USERS_FILE, { users: [] });

let secret;
async function loadSecret() {
  try {
    secret = Buffer.from((await readFile(SECRET_FILE, 'utf8')).trim(), 'hex');
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    secret = randomBytes(32);
    await writeFile(SECRET_FILE, secret.toString('hex'), { mode: 0o600 });
  }
}

const stateFile = (uid) => path.join(STATE_DIR, `${uid}.json`);

async function backupOncePerDay(uid, doc) {
  if (!doc.data) return;
  const day = new Date().toISOString().slice(0, 10);
  const name = `${uid}-${day}.json`;
  const files = await readdir(BACKUP_DIR);
  if (files.includes(name)) return;
  await writeFile(path.join(BACKUP_DIR, name), JSON.stringify(doc));
  const mine = files.filter((f) => f.startsWith(`${uid}-`) && f.endsWith('.json')).sort();
  for (const old of mine.slice(0, Math.max(0, mine.length + 1 - KEEP_BACKUPS))) {
    await unlink(path.join(BACKUP_DIR, old));
  }
}

// ---------- accounts ----------

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;
const normalize = (u) => String(u ?? '').trim().toLowerCase();

async function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = (await scrypt(password, salt, 64)).toString('hex');
  return { salt, hash };
}

async function checkPassword(user, password) {
  const { hash } = await hashPassword(password, user.salt);
  return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.hash, 'hex'));
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    throw new HttpError(400, 'La contraseña tiene que tener al menos 8 caracteres');
  }
}

const b64 = (buf) => Buffer.from(buf).toString('base64url');
const sign = (payload) => b64(createHmac('sha256', secret).update(payload).digest());

function issueToken(user) {
  const payload = b64(JSON.stringify({ u: user.id, v: user.pwVersion, e: Date.now() + SESSION_DAYS * 864e5 }));
  return `${payload}.${sign(payload)}`;
}

async function authenticate(req) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const [payload, sig] = token.split('.');
  if (!payload || !sig) throw new HttpError(401, 'Iniciá sesión para sincronizar');
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    throw new HttpError(401, 'Sesión inválida, volvé a iniciar sesión');
  }
  let claims;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    throw new HttpError(401, 'Sesión inválida, volvé a iniciar sesión');
  }
  const { u, v, e } = claims;
  const user = (await loadUsers()).users.find((x) => x.id === u);
  // A password change bumps pwVersion, which signs out every other device.
  if (!user || user.pwVersion !== v || Date.now() > e) throw new HttpError(401, 'La sesión venció o se cambió la contraseña, volvé a iniciar sesión');
  return user;
}

// Per-username lockout after repeated wrong passwords (doesn't trust client IP headers).
const fails = new Map();
function assertNotLocked(username) {
  const f = fails.get(username);
  if (f && f.count >= MAX_FAILS && Date.now() < f.until) {
    throw new HttpError(429, 'Demasiados intentos. Probá de nuevo en unos minutos.');
  }
}
function recordFail(username) {
  const f = fails.get(username);
  const fresh = !f || Date.now() > f.until;
  fails.set(username, { count: fresh ? 1 : f.count + 1, until: Date.now() + LOCK_MS });
}

const publicUser = (u) => ({ username: u.username, public: Boolean(u.public) });

// Usernames keep the capitals they were written with ("Nico") but never matter when
// looking someone up: "nico", "NICO" and "Nico" are the same account.
const byName = (users, name) => users.find((u) => normalize(u.username) === normalize(name));

function checkUsername(raw) {
  const username = String(raw ?? '').trim();
  if (!USERNAME_RE.test(normalize(username))) {
    throw new HttpError(400, 'El usuario tiene que tener de 3 a 32 letras, números, puntos o guiones');
  }
  return username;
}

/** Changes the name of an account (sessions stay valid: they're tied to the account, not the name). */
async function renameUser(id, raw) {
  const username = checkUsername(raw);
  return serial(async () => {
    const db = await loadUsers();
    const user = db.users.find((u) => u.id === id);
    if (!user) throw new HttpError(404, 'No existe ese usuario');
    const taken = byName(db.users, username);
    if (taken && taken.id !== id) throw new HttpError(409, 'Ese usuario ya existe');
    user.username = username;
    await writeJson(USERS_FILE, db);
    return publicUser(user);
  });
}

async function register(body) {
  const username = checkUsername(body.username);
  validatePassword(body.password);
  const { salt, hash } = await hashPassword(body.password);
  return serial(async () => {
    const db = await loadUsers();
    // A friend's invite link opens signup even when it is closed, and makes them friends.
    const inviter = body.invite ? db.users.find((u) => u.friendCode && u.friendCode === String(body.invite)) : null;
    if (body.invite && !inviter) throw new HttpError(400, 'La invitación no es válida o ya se cambió. Pedí un link nuevo.');
    if (db.users.length > 0 && !ALLOW_SIGNUP && !inviter) throw new HttpError(403, 'El registro está cerrado: ya hay una cuenta creada');
    if (byName(db.users, username)) throw new HttpError(409, 'Ese usuario ya existe');
    const user = { id: randomBytes(8).toString('hex'), username, salt, hash, pwVersion: 1, createdAt: new Date().toISOString() };
    if (inviter) {
      user.friends = [inviter.id];
      inviter.friends = [...new Set([...(inviter.friends ?? []), user.id])];
    }
    db.users.push(user);
    await writeJson(USERS_FILE, db);
    // The first account inherits data saved by the earlier shared-code version, if any.
    if (db.users.length === 1) {
      const legacy = await readJson(LEGACY_STATE, null);
      if (legacy?.data) {
        await writeJson(stateFile(user.id), legacy);
        await rename(LEGACY_STATE, `${LEGACY_STATE}.migrated`);
      }
    }
    return { token: issueToken(user), user: publicUser(user) };
  });
}

async function login(body) {
  const username = normalize(body.username);
  assertNotLocked(username);
  const user = byName((await loadUsers()).users, username);
  if (!user || typeof body.password !== 'string' || !(await checkPassword(user, body.password))) {
    recordFail(username);
    throw new HttpError(401, 'Usuario o contraseña incorrectos');
  }
  fails.delete(username);
  return { token: issueToken(user), user: publicUser(user) };
}

async function setPassword(username, password) {
  validatePassword(password);
  const { salt, hash } = await hashPassword(password);
  return serial(async () => {
    const db = await loadUsers();
    const user = byName(db.users, username);
    if (!user) throw new HttpError(404, 'No existe ese usuario');
    Object.assign(user, { salt, hash, pwVersion: user.pwVersion + 1 });
    await writeJson(USERS_FILE, db);
    return user;
  });
}

// ---------- critic scores (IGDB) ----------

const igdbEnabled = () => Boolean(IGDB_CLIENT_ID && IGDB_CLIENT_SECRET);

let twitchToken = null;
async function igdbToken(refresh = false) {
  if (!refresh && twitchToken && Date.now() < twitchToken.until) return twitchToken.value;
  const qs = new URLSearchParams({ client_id: IGDB_CLIENT_ID, client_secret: IGDB_CLIENT_SECRET, grant_type: 'client_credentials' });
  const res = await fetch(`https://id.twitch.tv/oauth2/token?${qs}`, { method: 'POST' });
  if (!res.ok) throw new HttpError(502, 'Twitch rechazó IGDB_CLIENT_ID / IGDB_CLIENT_SECRET');
  const json = await res.json();
  twitchToken = { value: json.access_token, until: Date.now() + (json.expires_in - 3600) * 1000 };
  return twitchToken.value;
}

async function igdbQuery(body, retry = true, endpoint = 'games') {
  const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: 'POST',
    headers: { 'Client-ID': IGDB_CLIENT_ID, Authorization: `Bearer ${await igdbToken(!retry)}`, 'Content-Type': 'text/plain' },
    body,
  });
  if (res.status === 401 && retry) return igdbQuery(body, false, endpoint);
  if (!res.ok) throw new HttpError(502, `Error de IGDB (${res.status})`);
  return res.json();
}

// "FINAL FANTASY VII REMAKE INTERGRADE" and "Final Fantasy VII Remake: Intergrade" are the same game.
const simplify = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '');

const yearOf = (unix) => (unix ? new Date(unix * 1000).getUTCFullYear() : null);

/**
 * Best match for a game name (and release year, to tell remakes apart). Results
 * are IGDB's unless other ways to read their name and year are given.
 */
function pickMatch(results, name, year, nameOf = (g) => g.name, releasedIn = (g) => yearOf(g.first_release_date)) {
  const want = simplify(name);
  const near = (g) => !year || !releasedIn(g) || Math.abs(releasedIn(g) - year) <= 1;
  const exact = results.filter((g) => simplify(nameOf(g)) === want);
  return (
    exact.find(near) ??
    exact[0] ??
    // Subtitles differ a lot between catalogs; only trust a partial match from the same year.
    results.find((g) => near(g) && year && (simplify(nameOf(g)).startsWith(want) || want.startsWith(simplify(nameOf(g)))))
  );
}

const CRITIC_TTL = 7 * 864e5;
const critics = new Map();

async function igdbScore(name, year) {
  const q = String(name).replace(/["\\]/g, ' ').slice(0, 120);
  const results = await igdbQuery(
    `search "${q}"; fields name,first_release_date,aggregated_rating,aggregated_rating_count,url; limit 20;`,
  );
  const g = pickMatch(results, name, year);
  return g?.aggregated_rating
    ? { score: Math.round(g.aggregated_rating), source: 'igdb', reviews: g.aggregated_rating_count ?? null, url: g.url ?? null }
    : null;
}

// Steam's store shows the (PC) Metacritic score and its users' reviews, and needs
// no account. The app id comes from RAWG's store links; without it, an exact
// name match in Steam's search.
async function steamJson(url) {
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  if (!res.ok) throw new HttpError(502, `Error de Steam (${res.status})`);
  return res.json();
}

async function steamAppId(name, appId) {
  if (appId) return appId;
  const qs = new URLSearchParams({ term: String(name).slice(0, 120), l: 'english', cc: 'US' });
  const { items = [] } = await steamJson(`https://store.steampowered.com/api/storesearch/?${qs}`);
  const match = items.find((i) => simplify(i.name) === simplify(name));
  return match ? String(match.id) : null;
}

async function steamMetacritic(id) {
  const details = await steamJson(`https://store.steampowered.com/api/appdetails?appids=${id}`);
  const mc = details?.[id]?.data?.metacritic;
  return mc?.score ? { score: mc.score, source: 'metacritic', reviews: null, url: mc.url ?? null } : null;
}

/**
 * Steam users' reviews, as SteamDB rates them: the positive share pulled
 * towards 50% when there are few reviews, so 10/10 doesn't beat 9,500/10,000.
 */
async function steamReviews(id) {
  const qs = new URLSearchParams({ json: '1', language: 'all', purchase_type: 'all', num_per_page: '0', l: 'spanish' });
  const { query_summary: q } = await steamJson(`https://store.steampowered.com/appreviews/${id}?${qs}`);
  const total = (q?.total_positive ?? 0) + (q?.total_negative ?? 0);
  if (total < 10) return null;
  const share = q.total_positive / total;
  const rating = share - (share - 0.5) * 2 ** -Math.log10(total + 1);
  return {
    rating: Math.round(rating * 100),
    positive: Math.round(share * 100),
    total,
    label: q.review_score_desc ?? null,
    url: `https://steamdb.info/app/${id}/`,
  };
}

const CRITIC_MISS_TTL = 864e5;

async function criticScore(name, year, steamId) {
  const key = `${simplify(name)}|${year ?? ''}|${steamId ?? ''}`;
  const hit = critics.get(key);
  const found = (v) => v.score != null || v.steam != null;
  if (hit && Date.now() - hit.at < (found(hit.value) ? CRITIC_TTL : CRITIC_MISS_TTL)) return hit.value;
  let failed = false;
  const attempt = (fn) =>
    fn().catch((e) => {
      console.error(`critics: ${e.message}`);
      failed = true;
      return null;
    });
  const id = await attempt(() => steamAppId(name, steamId));
  const [metacritic, steam] = id
    ? await Promise.all([attempt(() => steamMetacritic(id)), attempt(() => steamReviews(id))])
    : [null, null];
  const critic = metacritic ?? (igdbEnabled() ? await attempt(() => igdbScore(name, year)) : null);
  const value = { ...(critic ?? { score: null }), steam };
  // A source that was down shouldn't hide the score for a whole day.
  if (found(value) || !failed) {
    if (critics.size > 5000) critics.clear();
    critics.set(key, { at: Date.now(), value });
  }
  return value;
}

// ---------- IMDb ratings ----------
// IMDb has no free API, but publishes every title's rating daily for personal,
// non-commercial use. Kept as sorted typed arrays (~15 MB for ~1.6M titles).

const IMDB_URL = process.env.IMDB_RATINGS_URL ?? 'https://datasets.imdbws.com/title.ratings.tsv.gz';
let imdb = null;

async function loadImdb() {
  const res = await fetch(IMDB_URL);
  if (!res.ok || !res.body) throw new Error(`IMDb respondió ${res.status}`);
  let ids = new Uint32Array(2_000_000);
  let ratings = new Uint8Array(ids.length);
  let votes = new Uint32Array(ids.length);
  let n = 0;
  const lines = readline.createInterface({ input: Readable.fromWeb(res.body).pipe(createGunzip()), crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.startsWith('tt')) continue;
    const [tconst, rating, numVotes] = line.split('\t');
    if (n === ids.length) {
      const grow = (a) => {
        const b = new a.constructor(a.length * 2);
        b.set(a);
        return b;
      };
      [ids, ratings, votes] = [grow(ids), grow(ratings), grow(votes)];
    }
    ids[n] = Number(tconst.slice(2));
    ratings[n] = Math.round(Number(rating) * 10);
    votes[n] = Number(numVotes);
    n++;
  }
  // The file is sorted as text ("tt10000000" before "tt1000001"); binary search needs numbers.
  const order = new Uint32Array(n).map((_, i) => i).sort((a, b) => ids[a] - ids[b]);
  imdb = {
    ids: order.map((i) => ids[i]),
    ratings: new Uint8Array(n).map((_, k) => ratings[order[k]]),
    votes: new Uint32Array(n).map((_, k) => votes[order[k]]),
  };
  console.log(`IMDb: ${n} puntajes cargados`);
}

function refreshImdb() {
  loadImdb()
    .then(() => setTimeout(refreshImdb, 864e5))
    .catch((e) => {
      console.error(`IMDb: ${e.message}; reintento en una hora`);
      setTimeout(refreshImdb, 36e5);
    });
}

function imdbRating(tconst) {
  const id = Number(/^tt(\d{1,10})$/.exec(tconst ?? '')?.[1]);
  if (!imdb || !id) return null;
  let lo = 0;
  let hi = imdb.ids.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (imdb.ids[mid] === id) return { rating: imdb.ratings[mid] / 10, votes: imdb.votes[mid] };
    if (imdb.ids[mid] < id) lo = mid + 1;
    else hi = mid - 1;
  }
  return null;
}

// ---------- game lengths (HowLongToBeat, or IGDB) ----------
// HowLongToBeat has no public API: its site searches with a token that an "init"
// call hands out. The route has moved over time, so the current one is tried
// first and the older one after. When HLTB is down or changes again, IGDB's
// "time to beat" (if configured) stands in.

const HLTB = process.env.HLTB_URL ?? 'https://howlongtobeat.com';
const HLTB_ROUTES = ['/api/search/site', '/api/bleed'];
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const LENGTH_TTL = 14 * 864e5;
let hltbSession = null;
const lengths = new Map();

async function hltbInit() {
  for (const route of HLTB_ROUTES) {
    const res = await fetch(`${HLTB}${route}/init?t=${Date.now()}`, {
      headers: { 'User-Agent': BROWSER_UA, Accept: '*/*', Referer: 'https://howlongtobeat.com/' },
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    const json = res?.ok ? await res.json().catch(() => null) : null;
    if (json?.token) {
      hltbSession = { route, token: json.token, hpKey: json.hpKey ?? null, hpVal: json.hpVal ?? null, until: Date.now() + 30 * 60_000 };
      return hltbSession;
    }
  }
  throw new HttpError(502, 'HowLongToBeat no respondió');
}

async function hltbSearch(name, retry = true) {
  const s = hltbSession && Date.now() < hltbSession.until ? hltbSession : await hltbInit();
  const body = {
    searchType: 'games',
    searchTerms: String(name).trim().split(/\s+/).slice(0, 20),
    searchPage: 1,
    size: 20,
    searchOptions: {
      games: {
        userId: 0,
        platform: '',
        sortCategory: 'popular',
        rangeCategory: 'main',
        rangeTime: { min: 0, max: 0 },
        gameplay: { perspective: '', flow: '', genre: '', difficulty: '' },
        rangeYear: { min: '', max: '' },
        modifier: '',
      },
      users: { sortCategory: 'postcount' },
      lists: { sortCategory: 'follows' },
      filter: '',
      sort: 0,
      randomizer: 0,
    },
    useCache: true,
  };
  if (s.hpKey) body[s.hpKey] = s.hpVal;
  const res = await fetch(`${HLTB}${s.route}`, {
    method: 'POST',
    headers: {
      'User-Agent': BROWSER_UA,
      'Content-Type': 'application/json',
      Accept: '*/*',
      Origin: 'https://howlongtobeat.com',
      Referer: 'https://howlongtobeat.com/',
      'x-auth-token': s.token,
      ...(s.hpKey ? { 'x-hp-key': s.hpKey, 'x-hp-val': String(s.hpVal) } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  // An expired token: get a new one, once.
  if ([401, 403, 404].includes(res.status) && retry) {
    hltbSession = null;
    return hltbSearch(name, false);
  }
  if (!res.ok) throw new HttpError(502, `Error de HowLongToBeat (${res.status})`);
  const json = await res.json();
  if (!Array.isArray(json?.data)) throw new HttpError(502, 'HowLongToBeat respondió algo inesperado');
  return json.data;
}

/** Seconds to hours, one decimal; 0 means "no data". */
const toHours = (seconds) => (Number(seconds) > 0 ? Math.round(Number(seconds) / 360) / 10 : null);

async function hltbLength(name, year) {
  const g = pickMatch(await hltbSearch(name), name, year, (x) => x.game_name ?? '', (x) => Number(x.release_world) || null);
  if (!g) return null;
  const [main, plus, full, all] = [g.comp_main, g.comp_plus, g.comp_100, g.comp_all].map(toHours);
  // The headline is HLTB's own: every play style together; else story + extras.
  const hours = all ?? plus ?? main ?? full;
  return hours ? { hours, main, plus, full, source: 'hltb', url: `https://howlongtobeat.com/game/${g.game_id}` } : null;
}

async function igdbLength(name, year) {
  const q = String(name).replace(/["\\]/g, ' ').slice(0, 120);
  const g = pickMatch(await igdbQuery(`search "${q}"; fields name,first_release_date,url; limit 20;`), name, year);
  if (!g) return null;
  const [t] = await igdbQuery(`fields hastily,normally,completely; where game_id = ${Number(g.id)};`, true, 'game_time_to_beats');
  const [main, plus, full] = [t?.hastily, t?.normally, t?.completely].map(toHours);
  const hours = plus ?? main ?? full;
  return hours ? { hours, main, plus, full, source: 'igdb', url: g.url ?? null } : null;
}

async function gameLength(name, year) {
  const key = `${simplify(name)}|${year ?? ''}`;
  const hit = lengths.get(key);
  if (hit && Date.now() - hit.at < (hit.value ? LENGTH_TTL : CRITIC_MISS_TTL)) return hit.value;
  let failed = false;
  const attempt = (fn) =>
    fn().catch((e) => {
      console.error(`length: ${e.message}`);
      failed = true;
      return null;
    });
  const value = (await attempt(() => hltbLength(name, year))) ?? (igdbEnabled() ? await attempt(() => igdbLength(name, year)) : null);
  // A source that was down shouldn't hide the length for a whole day.
  if (value || !failed) {
    if (lengths.size > 5000) lengths.clear();
    lengths.set(key, { at: Date.now(), value });
  }
  return value;
}

// ---------- Rotten Tomatoes ----------
// Critics (Tomatometer) and audience (Popcornmeter) for movies and series. Wikidata
// links each IMDb id to its Rotten Tomatoes page, whose scorecard is embedded as JSON.

const WIKIDATA = process.env.WIKIDATA_URL ?? 'https://query.wikidata.org/sparql';
const RT = process.env.RT_URL ?? 'https://www.rottentomatoes.com';
const tomatoes = new Map();

async function rtPath(imdbId) {
  const query = `SELECT ?rt WHERE { ?item wdt:P345 "${imdbId}"; wdt:P1258 ?rt. } LIMIT 5`;
  const res = await fetch(`${WIKIDATA}?${new URLSearchParams({ query, format: 'json' })}`, {
    headers: { Accept: 'application/sparql-results+json', 'User-Agent': 'GamesTracker/1.0 (self-hosted personal app)' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new HttpError(502, `Error de Wikidata (${res.status})`);
  const json = await res.json();
  const paths = (json?.results?.bindings ?? []).map((b) => b?.rt?.value).filter((v) => /^(m|tv)\/[^\s/?#]+$/.test(v ?? ''));
  return paths[0] ?? null;
}

const percent = (v) => {
  const n = Number.parseFloat(String(v ?? ''));
  return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n) : null;
};

async function rtScores(imdbId) {
  const page = await rtPath(imdbId);
  if (!page) return null;
  const res = await fetch(`${RT}/${page}`, {
    headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en-US,en;q=0.9', Accept: 'text/html' },
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new HttpError(502, `Error de Rotten Tomatoes (${res.status})`);
  const html = await res.text();
  const card = /<script[^>]*id="media-scorecard-json"[^>]*>([\s\S]*?)<\/script>/.exec(html)?.[1];
  if (!card) return null;
  const data = JSON.parse(card);
  const critics = percent(data?.criticsScore?.score);
  const audience = percent(data?.audienceScore?.score);
  if (critics == null && audience == null) return null;
  return {
    critics,
    criticReviews: Number(data?.criticsScore?.reviewCount) || null,
    audience,
    url: `https://www.rottentomatoes.com/${page}`,
  };
}

async function tomatoScores(imdbId) {
  const hit = tomatoes.get(imdbId);
  if (hit && Date.now() - hit.at < (hit.value ? CRITIC_TTL : CRITIC_MISS_TTL)) return hit.value;
  const value = await rtScores(imdbId).catch((e) => {
    // Down or changed: shown without it, and asked again next time.
    console.error(`rotten tomatoes: ${e.message}`);
    return undefined;
  });
  if (value === undefined) return null;
  if (tomatoes.size > 5000) tomatoes.clear();
  tomatoes.set(imdbId, { at: Date.now(), value });
  return value;
}

// ---------- public profiles ----------
// Opt-in, read-only view of someone's tier list (what they rated) for a shareable
// link. Lists, notes, platforms, dates started and API keys never leave the server.

async function setPublic(user, value) {
  if (typeof value !== 'boolean') throw new HttpError(400, 'Formato inválido');
  return serial(async () => {
    const db = await loadUsers();
    const u = db.users.find((x) => x.id === user.id);
    if (!u) throw new HttpError(401, 'Sesión inválida, volvé a iniciar sesión');
    u.public = value;
    await writeJson(USERS_FILE, db);
    return publicUser(u);
  });
}

const str = (v, max = 300) => (typeof v === 'string' ? v.slice(0, max) : null);

async function publicProfile(name, viewer = null) {
  const user = byName((await loadUsers()).users, name);
  // Friends see each other's tier list unless they turned that off; anyone sees a public one.
  const allowed = user && (user.public || viewer?.id === user.id || canSee(viewer, user));
  if (!allowed) throw new HttpError(404, 'Este perfil no existe o no es público');
  const doc = await readJson(stateFile(user.id), { updatedAt: null, data: null });
  const data = doc.data ?? { games: {}, ratings: {}, lists: [] };
  const ratings = {};
  for (const [id, r] of Object.entries(data.ratings ?? {})) {
    if (!r || typeof r.score !== 'number') continue;
    ratings[id] = { gameId: id, score: r.score, tier: str(r.tier, 20), status: str(r.status, 20), finishedAt: str(r.finishedAt, 10) };
  }
  const wanted = new Set(Object.keys(ratings));
  const games = {};
  for (const id of wanted) {
    const g = data.games?.[id];
    if (!g) continue;
    games[id] = {
      id,
      name: str(g.name),
      // Covers made on the device (data URLs) can be huge; the profile shows the title instead.
      cover: typeof g.cover === 'string' && g.cover.startsWith('https://') ? g.cover : null,
      released: str(g.released, 10),
      genres: Array.isArray(g.genres) ? g.genres.filter((x) => typeof x === 'string').slice(0, 6) : [],
      platforms: [],
    };
  }
  return { username: user.username, updatedAt: doc.updatedAt ?? null, games, ratings };
}

// ---------- friends ----------
// Friendship is mutual and starts from a personal invite link (friendCode). Nothing is
// shared by default: each person picks which friends see their ratings (sharesWith).
// With "announce" (off by default) those friends also get a notification for each new rating.

const SCREEN_ID = /^(tmdb|dscr):/;
const TIER_LABEL = { malo: 'Malo', aburrido: 'Aburrido', safa: 'Safa', bueno: 'Bueno', buenisimo: 'Buenísimo', historico: 'Histórico' };
const MAX_FRIENDS = 200;
const FEED_SIZE = 80;
const ACTIVITY_KEEP = 100;

const areFriends = (a, b) => Boolean(a && b && a.id !== b.id && (a.friends ?? []).includes(b.id) && (b.friends ?? []).includes(a.id));
/** Whether `viewer` may see `owner`'s ratings: friends, and `owner` chose to share with them. */
const canSee = (viewer, owner) => areFriends(viewer, owner) && (owner.sharesWith ?? []).includes(viewer.id);
const newCode = () => randomBytes(9).toString('base64url');
const safeCover = (c) => (typeof c === 'string' && c.startsWith('https://') ? c : null);
const gameCard = (g, id) => ({ id, name: str(g?.name) ?? '?', cover: safeCover(g?.cover), released: str(g?.released, 10), genres: [], platforms: [] });

async function readData(uid) {
  return (await readJson(stateFile(uid), { data: null })).data ?? { games: {}, ratings: {} };
}

/** Runs `fn` on the stored copy of `user` (and the whole db) and saves it. */
function updateUsers(fn) {
  return serial(async () => {
    const db = await loadUsers();
    const out = await fn(db);
    await writeJson(USERS_FILE, db);
    return out;
  });
}

async function friendsOf(user) {
  const { users } = await loadUsers();
  const me = users.find((u) => u.id === user.id) ?? user;
  return users.filter((u) => areFriends(me, u));
}

function summary(data) {
  const out = { games: { count: 0, sum: 0 }, screen: { count: 0, sum: 0 } };
  for (const [id, r] of Object.entries(data.ratings ?? {})) {
    if (typeof r?.score !== 'number' || !data.games?.[id]) continue;
    const m = SCREEN_ID.test(id) ? out.screen : out.games;
    m.count++;
    m.sum += r.score;
  }
  const avg = (m) => ({ count: m.count, average: m.count ? Math.round(m.sum / m.count) : null });
  return { games: avg(out.games), screen: avg(out.screen) };
}

async function friendsOverview(user) {
  const code =
    user.friendCode ??
    (await updateUsers((db) => {
      const me = db.users.find((u) => u.id === user.id);
      me.friendCode ??= newCode();
      return me.friendCode;
    }));
  const friends = await Promise.all(
    (await friendsOf(user)).map(async (f) => ({
      username: f.username,
      // They share with me / I share with them.
      shares: canSee(user, f),
      iShare: canSee(f, user),
      ...(canSee(user, f) ? summary(await readData(f.id)) : {}),
    })),
  );
  friends.sort((a, b) => a.username.localeCompare(b.username));
  return { code, announce: Boolean(user.announce), friends };
}

async function inviteInfo(code) {
  const owner = (await loadUsers()).users.find((u) => u.friendCode && u.friendCode === code);
  if (!owner) throw new HttpError(404, 'La invitación no es válida o ya se cambió. Pedí un link nuevo.');
  return { username: owner.username };
}

function addFriend(user, code) {
  return updateUsers((db) => {
    const me = db.users.find((u) => u.id === user.id);
    const owner = db.users.find((u) => u.friendCode && u.friendCode === String(code ?? ''));
    if (!owner) throw new HttpError(404, 'La invitación no es válida o ya se cambió. Pedí un link nuevo.');
    if (owner.id === me.id) throw new HttpError(400, 'Ese es tu propio link: mandáselo a tus amigos.');
    if ((me.friends ?? []).length >= MAX_FRIENDS) throw new HttpError(400, 'Llegaste al máximo de amigos');
    me.friends = [...new Set([...(me.friends ?? []), owner.id])];
    owner.friends = [...new Set([...(owner.friends ?? []), me.id])];
    return { username: owner.username };
  });
}

function removeFriend(user, username) {
  return updateUsers((db) => {
    const me = db.users.find((u) => u.id === user.id);
    const other = byName(db.users, username);
    if (!other) return { ok: true };
    me.friends = (me.friends ?? []).filter((id) => id !== other.id);
    other.friends = (other.friends ?? []).filter((id) => id !== me.id);
    me.sharesWith = (me.sharesWith ?? []).filter((id) => id !== other.id);
    other.sharesWith = (other.sharesWith ?? []).filter((id) => id !== me.id);
    return { ok: true };
  });
}

/** Turns sharing my ratings with one friend on or off. */
function shareWith(user, username, share) {
  if (typeof share !== 'boolean') throw new HttpError(400, 'Formato inválido');
  return updateUsers((db) => {
    const me = db.users.find((u) => u.id === user.id);
    const other = byName(db.users, username);
    if (!areFriends(me, other)) throw new HttpError(404, 'No son amigos');
    const rest = (me.sharesWith ?? []).filter((id) => id !== other.id);
    me.sharesWith = share ? [...rest, other.id] : rest;
    return { username: other.username, iShare: share };
  });
}

function resetCode(user) {
  return updateUsers((db) => {
    const me = db.users.find((u) => u.id === user.id);
    me.friendCode = newCode();
    return { code: me.friendCode };
  });
}

function socialSettings(user, body) {
  return updateUsers((db) => {
    const me = db.users.find((u) => u.id === user.id);
    if (typeof body.announce === 'boolean') me.announce = body.announce;
    return { announce: Boolean(me.announce) };
  });
}

/** What each friend gave one title. */
async function friendRatings(user, gameId) {
  if (!gameId) throw new HttpError(400, 'Falta el id');
  const out = [];
  for (const f of await friendsOf(user)) {
    if (!canSee(user, f)) continue;
    const r = (await readData(f.id)).ratings?.[gameId];
    if (typeof r?.score === 'number') out.push({ username: f.username, score: r.score, tier: str(r.tier, 20), status: str(r.status, 20) });
  }
  return { ratings: out.sort((a, b) => b.score - a.score) };
}

/** Friends' most recent ratings, newest first. */
async function friendFeed(user) {
  const items = [];
  for (const f of await friendsOf(user)) {
    if (!canSee(user, f)) continue;
    const data = await readData(f.id);
    for (const [id, r] of Object.entries(data.ratings ?? {})) {
      if (typeof r?.score !== 'number' || !data.games?.[id]) continue;
      items.push({ username: f.username, game: gameCard(data.games[id], id), score: r.score, tier: str(r.tier, 20), at: Number(r.updatedAt) || 0 });
    }
  }
  return { items: items.sort((a, b) => b.at - a.at).slice(0, FEED_SIZE) };
}

// ---------- notifications ----------

let vapid = null;
async function loadVapid() {
  vapid = await readJson(VAPID_FILE, null);
  if (!vapid) {
    vapid = generateVapidKeys();
    await writeFile(VAPID_FILE, JSON.stringify(vapid), { mode: 0o600 });
  }
}

const activityFile = (uid) => path.join(ACTIVITY_DIR, `${uid}.json`);
const pushFile = (uid) => path.join(PUSH_DIR, `${uid}.json`);
const PUSH_HOSTS = /(^|\.)(fcm\.googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com)$/;

/** New or re-scored ratings between two saved copies (only recent edits, not old history arriving from a device). */
function newRatings(before, after) {
  if (!before) return [];
  const since = Date.now() - 24 * 3600 * 1000;
  const out = [];
  for (const [id, r] of Object.entries(after.ratings ?? {})) {
    const prev = before.ratings?.[id];
    if (typeof r?.score !== 'number' || !after.games?.[id] || (prev && prev.score === r.score)) continue;
    if ((Number(r.updatedAt) || 0) < since) continue;
    out.push({ id: randomBytes(6).toString('hex'), game: gameCard(after.games[id], id), score: r.score, tier: str(r.tier, 20), at: Number(r.updatedAt) });
  }
  // A bulk import shouldn't flood friends.
  return out.sort((a, b) => b.at - a.at).slice(0, 5);
}

async function announce(user, events) {
  if (!events.length) return;
  await serial(async () => {
    const list = await readJson(activityFile(user.id), []);
    await writeJson(activityFile(user.id), [...events, ...list].slice(0, ACTIVITY_KEEP));
  });
  for (const f of await friendsOf(user)) {
    // Only the friends this person shares with hear about it.
    if (!canSee(f, user)) continue;
    await pushTo(
      f.id,
      events.map((e) => ({
        title: SCREEN_ID.test(e.game.id) ? 'MediaTracker' : 'GamesTracker',
        body: `${user.username} le puso ${e.score} a ${e.game.name}${TIER_LABEL[e.tier] ? ` · ${TIER_LABEL[e.tier]}` : ''}`,
        url: `#/juego/${encodeURIComponent(e.game.id)}`,
        tag: `${user.username}:${e.game.id}`,
      })),
    );
  }
}

/** Sends notifications to every device of one account, forgetting the ones that expired. */
async function pushTo(uid, payloads) {
  const subs = await readJson(pushFile(uid), []);
  if (!subs.length || !payloads.length) return;
  const gone = new Set();
  for (const sub of subs) {
    const subject = /^https:\/\//.test(sub.origin ?? '') ? sub.origin : 'mailto:gamestracker@example.com';
    for (const payload of payloads) {
      if ((await sendPush(sub, payload, vapid, subject)) === 'gone') gone.add(sub.endpoint);
    }
  }
  if (gone.size) {
    await serial(async () => {
      const now = await readJson(pushFile(uid), []);
      await writeJson(pushFile(uid), now.filter((s) => !gone.has(s.endpoint)));
    });
  }
}

async function notifications(user) {
  const items = [];
  for (const f of await friendsOf(user)) {
    if (!canSee(user, f)) continue;
    for (const e of await readJson(activityFile(f.id), [])) items.push({ ...e, username: f.username });
  }
  items.sort((a, b) => b.at - a.at);
  const seen = Number(user.seenAt) || 0;
  return { items: items.slice(0, 50), unread: items.filter((e) => e.at > seen).length };
}

function markSeen(user) {
  return updateUsers((db) => {
    db.users.find((u) => u.id === user.id).seenAt = Date.now();
    return { ok: true };
  });
}

async function subscribePush(user, body) {
  const sub = body.subscription;
  let host;
  try {
    host = new URL(sub?.endpoint).hostname;
    if (new URL(sub.endpoint).protocol !== 'https:') throw new Error();
  } catch {
    throw new HttpError(400, 'Suscripción inválida');
  }
  // Only real push services: the server POSTs to this URL.
  if (!PUSH_HOSTS.test(host) || typeof sub.keys?.p256dh !== 'string' || typeof sub.keys?.auth !== 'string') {
    throw new HttpError(400, 'Suscripción inválida');
  }
  const entry = { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }, origin: str(body.origin, 200), addedAt: Date.now() };
  await serial(async () => {
    const subs = (await readJson(pushFile(user.id), [])).filter((s) => s.endpoint !== entry.endpoint);
    await writeJson(pushFile(user.id), [entry, ...subs].slice(0, 10));
  });
  return { ok: true };
}

async function unsubscribePush(user, endpoint) {
  await serial(async () => {
    const subs = await readJson(pushFile(user.id), []);
    await writeJson(pushFile(user.id), subs.filter((s) => s.endpoint !== endpoint));
  });
  return { ok: true };
}

// ---------- Trakt (what was watched in Nuvio) ----------
// Nuvio scrobbles to Trakt. With a Trakt app's keys on the server, each account can
// connect its Trakt with a code (device flow). Every few minutes the server reads the
// new history and, when a movie was watched or a series' last aired episode was seen,
// leaves it "to rate" and sends a notification to that person's devices.

const TRAKT_ID = process.env.TRAKT_CLIENT_ID ?? '';
// Apps created on Trakt since October 2026 get no secret (they're "PKCE" apps); the
// device code alone proves the sign-in, so the secret is only sent when there is one.
const TRAKT_SECRET = process.env.TRAKT_CLIENT_SECRET ?? '';
const traktSecret = TRAKT_SECRET ? { client_secret: TRAKT_SECRET } : {};
const TRAKT_API = process.env.TRAKT_API_URL ?? 'https://api.trakt.tv';
const TRAKT_POLL_MS = Math.max(2, Number(process.env.TRAKT_POLL_MINUTES) || 10) * 60_000;
const TRAKT_DIR = path.join(DATA_DIR, 'trakt');
const traktEnabled = () => Boolean(TRAKT_ID);
const traktFile = (uid) => path.join(TRAKT_DIR, `${uid}.json`);
/** Device codes waiting for the person to approve them on trakt.tv/activate. */
const traktDevices = new Map();

function traktFetch(method, p, { token, body } = {}) {
  return fetch(`${TRAKT_API}${p}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': TRAKT_ID,
      'User-Agent': 'GamesTracker/1.0',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
}

function saveTrakt(uid, data) {
  return serial(() => writeJson(traktFile(uid), data));
}

async function traktStart(user) {
  if (!traktEnabled()) throw new HttpError(503, 'El servidor todavía no tiene configurado Trakt');
  const res = await traktFetch('POST', '/oauth/device/code', { body: { client_id: TRAKT_ID } }).catch(() => null);
  if (!res?.ok) throw new HttpError(502, 'Trakt no respondió, probá en un rato');
  const d = await res.json();
  traktDevices.set(user.id, { code: d.device_code, until: Date.now() + d.expires_in * 1000 });
  return { userCode: d.user_code, url: d.verification_url, interval: d.interval, expiresIn: d.expires_in };
}

async function traktPoll(user) {
  const dev = traktDevices.get(user.id);
  if (!dev || Date.now() > dev.until) return { status: 'expired' };
  const res = await traktFetch('POST', '/oauth/device/token', {
    body: { code: dev.code, client_id: TRAKT_ID, ...traktSecret },
  }).catch(() => null);
  if (!res || res.status === 400 || res.status === 429) return { status: 'pending' };
  if (res.status !== 200) {
    traktDevices.delete(user.id);
    return { status: res.status === 418 ? 'denied' : 'expired' };
  }
  const t = await res.json();
  traktDevices.delete(user.id);
  const settings = await traktFetch('GET', '/users/settings', { token: t.access_token })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  // Only what is watched from now on counts; the old history isn't brought back.
  await saveTrakt(user.id, {
    access: t.access_token,
    refresh: t.refresh_token,
    expiresAt: (Number(t.created_at) + Number(t.expires_in)) * 1000,
    account: str(settings?.user?.username, 60),
    since: new Date().toISOString(),
    pending: [],
    done: [],
  });
  return { status: 'connected' };
}

/** Keeps the token alive; returns null when the connection no longer works. */
async function freshTrakt(uid, t) {
  if (t.broken) return null;
  if (Date.now() < t.expiresAt - 24 * 3600 * 1000) return t;
  const res = await traktFetch('POST', '/oauth/token', {
    body: {
      refresh_token: t.refresh,
      client_id: TRAKT_ID,
      ...traktSecret,
      redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
      grant_type: 'refresh_token',
    },
  }).catch(() => null);
  if (!res) return t;
  if (!res.ok) {
    if (res.status === 400 || res.status === 401) await saveTrakt(uid, { ...t, broken: true });
    return null;
  }
  // Refresh tokens are single-use: the new one replaces the old right away.
  const n = await res.json();
  const next = { ...t, access: n.access_token, refresh: n.refresh_token, expiresAt: (Number(n.created_at) + Number(n.expires_in)) * 1000 };
  await saveTrakt(uid, next);
  return next;
}

/** Reads the new Trakt history of one account and queues what was finished. */
async function traktCheck(uid) {
  if (!traktEnabled()) return;
  let t = await readJson(traktFile(uid), null);
  if (!t) return;
  t = await freshTrakt(uid, t);
  if (!t) return;
  const res = await traktFetch('GET', `/sync/history?${new URLSearchParams({ start_at: t.since, limit: '100' })}`, { token: t.access }).catch(() => null);
  if (!res) return;
  if (res.status === 401) return saveTrakt(uid, { ...t, broken: true });
  if (!res.ok) return;
  const history = await res.json();
  if (!Array.isArray(history) || !history.length) return;

  const ratings = (await readData(uid)).ratings ?? {};
  const done = new Set(t.done ?? []);
  const found = [];
  const shows = new Map();
  for (const h of history) {
    if (h.type === 'movie' && h.movie?.ids?.tmdb) {
      found.push({ kind: 'movie', tmdb: h.movie.ids.tmdb, title: str(h.movie.title), year: h.movie.year ?? null, at: h.watched_at });
    } else if (h.type === 'episode' && h.show?.ids?.trakt && h.show.ids.tmdb && !shows.has(h.show.ids.trakt)) {
      shows.set(h.show.ids.trakt, h);
    }
  }
  // A series counts as finished when every aired episode was watched.
  for (const [traktId, h] of shows) {
    const p = await traktFetch('GET', `/shows/${traktId}/progress/watched?specials=false`, { token: t.access })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    if (p && p.aired > 0 && p.completed >= p.aired) {
      found.push({ kind: 'tv', tmdb: h.show.ids.tmdb, title: str(h.show.title), year: h.show.year ?? null, at: h.watched_at });
    }
  }

  const fresh = [];
  for (const f of found) {
    const key = `${f.kind}:${f.tmdb}`;
    const id = `tmdb:${f.kind}:${f.tmdb}`;
    if (done.has(key) || ratings[id]) continue;
    done.add(key);
    fresh.push({ key, id, kind: f.kind, title: f.title ?? '?', year: f.year, at: Date.parse(f.at) || Date.now() });
  }
  const newest = history.reduce((m, h) => Math.max(m, Date.parse(h.watched_at) || 0), Date.parse(t.since) || 0);
  await saveTrakt(uid, {
    ...t,
    since: new Date(newest + 1000).toISOString(),
    pending: [...fresh, ...(t.pending ?? [])].slice(0, 50),
    done: [...done].slice(-500),
  });
  await pushTo(
    uid,
    fresh.map((f) => ({
      title: 'MediaTracker',
      body: `Terminaste ${f.title}${f.kind === 'tv' ? ' (la serie completa)' : ''}. ¿Cuánto le das?`,
      url: `#/juego/${encodeURIComponent(f.id)}?puntuar=1`,
      tag: `rate:${f.id}`,
    })),
  );
}

async function traktStatus(user) {
  const t = await readJson(traktFile(user.id), null);
  if (!t) return { enabled: traktEnabled(), connected: false, pending: [] };
  const ratings = (await readData(user.id)).ratings ?? {};
  return {
    enabled: traktEnabled(),
    connected: true,
    broken: Boolean(t.broken),
    account: t.account ?? null,
    // Whatever got rated meanwhile (on any device) stops being pending.
    pending: (t.pending ?? []).filter((p) => !ratings[p.id]),
  };
}

async function traktDismiss(user, key) {
  const t = await readJson(traktFile(user.id), null);
  if (t) await saveTrakt(user.id, { ...t, pending: (t.pending ?? []).filter((p) => p.key !== key) });
  return { ok: true };
}

async function traktDisconnect(user) {
  await serial(() => unlink(traktFile(user.id)).catch(() => {}));
  return { ok: true };
}

let traktRunning = false;
async function traktCheckAll() {
  if (traktRunning || !traktEnabled()) return;
  traktRunning = true;
  try {
    for (const f of await readdir(TRAKT_DIR)) {
      if (f.endsWith('.json')) await traktCheck(f.slice(0, -5)).catch((e) => console.error('trakt', e.message));
    }
  } finally {
    traktRunning = false;
  }
}

// ---------- covers for share images ----------
// A canvas can only be exported if its images come from our own origin, so
// covers for the share images are fetched through here. Only these hosts.

const IMAGE_HOSTS = new Set(['media.rawg.io', 'image.tmdb.org']);
const MAX_IMAGE = 8 * 1024 * 1024;

async function proxyImage(res, raw) {
  let target;
  try {
    target = new URL(raw ?? '');
  } catch {
    throw new HttpError(400, 'URL inválida');
  }
  if (target.protocol !== 'https:' || !IMAGE_HOSTS.has(target.hostname)) throw new HttpError(400, 'Origen no permitido');
  const upstream = await fetch(target).catch(() => null);
  // CDNs may redirect, but never off HTTPS.
  if (upstream && new URL(upstream.url).protocol !== 'https:') throw new HttpError(502, 'No se pudo traer la imagen');
  const type = upstream?.headers.get('content-type') ?? '';
  if (!upstream?.ok || !type.startsWith('image/')) throw new HttpError(502, 'No se pudo traer la imagen');
  const body = Buffer.from(await upstream.arrayBuffer());
  if (body.length > MAX_IMAGE) throw new HttpError(502, 'Imagen demasiado grande');
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'public, max-age=604800, immutable' });
  res.end(body);
}

// ---------- http ----------

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new HttpError(413, 'Demasiados datos'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(new HttpError(400, 'JSON inválido'));
      }
    });
    req.on('error', reject);
  });
}

const validData = (d) =>
  d && typeof d === 'object' && typeof d.games === 'object' && typeof d.ratings === 'object' && Array.isArray(d.lists);

async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const { pathname } = url;
  const route = `${req.method} ${pathname}`;

  if (req.method === 'GET' && pathname.startsWith('/api/public/')) {
    let name;
    try {
      name = decodeURIComponent(pathname.slice('/api/public/'.length));
    } catch {
      throw new HttpError(404, 'Este perfil no existe o no es público');
    }
    const viewer = await authenticate(req).catch(() => null);
    return send(res, 200, await publicProfile(name, viewer));
  }
  if (req.method === 'GET' && pathname.startsWith('/api/invite/')) {
    return send(res, 200, await inviteInfo(pathname.slice('/api/invite/'.length)));
  }

  switch (route) {
    case 'GET /api/health': {
      const { users } = await loadUsers();
      return send(res, 200, {
        ok: true,
        hasUsers: users.length > 0,
        signupOpen: users.length === 0 || ALLOW_SIGNUP,
        igdb: igdbEnabled(),
        imdb: imdb != null,
        trakt: traktEnabled(),
      });
    }
    case 'POST /api/auth/register':
      return send(res, 200, await register(await readBody(req)));
    case 'POST /api/auth/login':
      return send(res, 200, await login(await readBody(req)));
    case 'GET /api/auth/me':
      return send(res, 200, { user: publicUser(await authenticate(req)) });
    case 'POST /api/auth/username': {
      const user = await authenticate(req);
      return send(res, 200, { user: await renameUser(user.id, (await readBody(req)).username) });
    }
    case 'POST /api/auth/password': {
      const user = await authenticate(req);
      const body = await readBody(req);
      if (typeof body.current !== 'string' || !(await checkPassword(user, body.current))) {
        throw new HttpError(401, 'La contraseña actual no es correcta');
      }
      const updated = await setPassword(user.username, body.next);
      return send(res, 200, { token: issueToken(updated) });
    }
    case 'POST /api/profile': {
      const user = await authenticate(req);
      const body = await readBody(req);
      return send(res, 200, { user: await setPublic(user, body.public) });
    }
    case 'GET /api/state': {
      const user = await authenticate(req);
      return send(res, 200, await readJson(stateFile(user.id), { version: 0, updatedAt: null, data: null }));
    }
    case 'PUT /api/state': {
      const user = await authenticate(req);
      const body = await readBody(req);
      if (!Number.isInteger(body.baseVersion) || !validData(body.data)) throw new HttpError(400, 'Formato inválido');
      const out = await serial(async () => {
        const doc = await readJson(stateFile(user.id), { version: 0, updatedAt: null, data: null });
        // Another device wrote since this one last read: it must merge and retry.
        if (body.baseVersion !== doc.version) return { status: 409, body: doc };
        await backupOncePerDay(user.id, doc);
        const next = { version: doc.version + 1, updatedAt: new Date().toISOString(), data: body.data };
        await writeJson(stateFile(user.id), next);
        return { status: 200, body: { version: next.version, updatedAt: next.updatedAt }, events: user.announce && (user.sharesWith ?? []).length ? newRatings(doc.data, body.data) : [] };
      });
      send(res, out.status, out.body);
      // Friends hear about new ratings after the device already got its answer.
      if (out.events?.length) announce(user, out.events).catch((e) => console.error('announce', e));
      return;
    }
    case 'GET /api/friends':
      return send(res, 200, await friendsOverview(await authenticate(req)));
    case 'POST /api/friends/add':
      return send(res, 200, await addFriend(await authenticate(req), (await readBody(req)).code));
    case 'POST /api/friends/remove':
      return send(res, 200, await removeFriend(await authenticate(req), (await readBody(req)).username));
    case 'POST /api/friends/code':
      return send(res, 200, await resetCode(await authenticate(req)));
    case 'POST /api/friends/share': {
      const body = await readBody(req);
      return send(res, 200, await shareWith(await authenticate(req), body.username, body.share));
    }
    case 'POST /api/friends/settings':
      return send(res, 200, await socialSettings(await authenticate(req), await readBody(req)));
    case 'GET /api/friends/ratings':
      return send(res, 200, await friendRatings(await authenticate(req), url.searchParams.get('id')));
    case 'GET /api/friends/feed':
      return send(res, 200, await friendFeed(await authenticate(req)));
    case 'GET /api/notifications':
      return send(res, 200, await notifications(await authenticate(req)));
    case 'POST /api/notifications/seen':
      return send(res, 200, await markSeen(await authenticate(req)));
    case 'GET /api/push/key':
      return send(res, 200, { key: vapid.publicKey });
    case 'POST /api/push/subscribe':
      return send(res, 200, await subscribePush(await authenticate(req), await readBody(req)));
    case 'POST /api/push/unsubscribe':
      return send(res, 200, await unsubscribePush(await authenticate(req), (await readBody(req)).endpoint));
    case 'GET /api/trakt':
      return send(res, 200, await traktStatus(await authenticate(req)));
    case 'POST /api/trakt/connect':
      return send(res, 200, await traktStart(await authenticate(req)));
    case 'POST /api/trakt/poll':
      return send(res, 200, await traktPoll(await authenticate(req)));
    case 'POST /api/trakt/check': {
      const user = await authenticate(req);
      await traktCheck(user.id);
      return send(res, 200, await traktStatus(user));
    }
    case 'POST /api/trakt/dismiss':
      return send(res, 200, await traktDismiss(await authenticate(req), (await readBody(req)).key));
    case 'POST /api/trakt/disconnect':
      return send(res, 200, await traktDisconnect(await authenticate(req)));
    case 'GET /api/critics': {
      // Only for signed-in users, so the server's IGDB quota can't be used by strangers.
      await authenticate(req);
      const name = url.searchParams.get('name')?.trim();
      if (!name) throw new HttpError(400, 'Falta el nombre del juego');
      const year = Number(url.searchParams.get('year')) || null;
      const steam = url.searchParams.get('steam');
      return send(res, 200, await criticScore(name, year, steam && /^\d{1,10}$/.test(steam) ? steam : null));
    }
    case 'GET /api/length': {
      // Signed-in only, like the critics: it spends the server's lookups.
      await authenticate(req);
      const name = url.searchParams.get('name')?.trim();
      if (!name) throw new HttpError(400, 'Falta el nombre del juego');
      return send(res, 200, { length: await gameLength(name.slice(0, 200), Number(url.searchParams.get('year')) || null) });
    }
    case 'GET /api/rt': {
      await authenticate(req);
      const id = url.searchParams.get('imdb') ?? '';
      if (!/^tt\d{1,10}$/.test(id)) throw new HttpError(400, 'Falta el id de IMDb');
      return send(res, 200, { scores: await tomatoScores(id) });
    }
    case 'GET /api/img':
      return proxyImage(res, url.searchParams.get('url'));
    case 'GET /api/imdb': {
      if (!imdb) throw new HttpError(503, 'Los puntajes de IMDb todavía se están descargando');
      return send(res, 200, { rating: imdbRating(url.searchParams.get('id')) });
    }
    default:
      return send(res, 404, { error: 'Not found' });
  }
}

await mkdir(STATE_DIR, { recursive: true });
await mkdir(BACKUP_DIR, { recursive: true });
await mkdir(ACTIVITY_DIR, { recursive: true });
await mkdir(PUSH_DIR, { recursive: true });
await mkdir(TRAKT_DIR, { recursive: true });
await loadSecret();
await loadVapid();

if (process.argv[2] === 'rename-user') {
  const [, , , from, to] = process.argv;
  try {
    const user = byName((await loadUsers()).users, from);
    if (!user) throw new Error(`No existe el usuario "${from}"`);
    console.log(`Usuario renombrado a "${(await renameUser(user.id, to)).username}".`);
    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

if (process.argv[2] === 'reset-password') {
  const [, , , username, password] = process.argv;
  try {
    await setPassword(username, password);
    console.log(`Contraseña de "${normalize(username)}" actualizada. Las sesiones abiertas se cerraron.`);
    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

if (process.env.IMDB !== 'off') refreshImdb();
if (traktEnabled()) setInterval(() => void traktCheckAll(), TRAKT_POLL_MS).unref?.();

http
  .createServer((req, res) => {
    handle(req, res).catch((e) => {
      if (!(e instanceof HttpError)) console.error(e);
      if (!res.headersSent) send(res, e.status ?? 500, { error: e instanceof HttpError ? e.message : 'Error del servidor' });
    });
  })
  .listen(PORT, () => console.log(`GamesTracker API on :${PORT}`));
