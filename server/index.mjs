// GamesTraker sync API: user accounts (username + password) and one JSON
// document per user with their ratings, lists and game snapshots, plus a
// proxy to IGDB's critic scores (its API needs a secret and blocks browsers).
// No dependencies; everything lives under DATA_DIR.
//
// CLI (inside the container):
//   node index.mjs reset-password <usuario> <contraseña-nueva>
import http from 'node:http';
import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);

const PORT = Number(process.env.PORT ?? 8787);
const DATA_DIR = process.env.DATA_DIR ?? '/data';
const ALLOW_SIGNUP = process.env.ALLOW_SIGNUP === 'true';
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SECRET_FILE = path.join(DATA_DIR, 'secret');
const STATE_DIR = path.join(DATA_DIR, 'state');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const LEGACY_STATE = path.join(DATA_DIR, 'state.json');
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

const publicUser = (u) => ({ username: u.username });

async function register(body) {
  const username = normalize(body.username);
  if (!USERNAME_RE.test(username)) {
    throw new HttpError(400, 'El usuario tiene que tener de 3 a 32 letras, números, puntos o guiones');
  }
  validatePassword(body.password);
  const { salt, hash } = await hashPassword(body.password);
  return serial(async () => {
    const db = await loadUsers();
    if (db.users.length > 0 && !ALLOW_SIGNUP) throw new HttpError(403, 'El registro está cerrado: ya hay una cuenta creada');
    if (db.users.some((u) => u.username === username)) throw new HttpError(409, 'Ese usuario ya existe');
    const user = { id: randomBytes(8).toString('hex'), username, salt, hash, pwVersion: 1, createdAt: new Date().toISOString() };
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
  const user = (await loadUsers()).users.find((u) => u.username === username);
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
    const user = db.users.find((u) => u.username === normalize(username));
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

async function igdbQuery(body, retry = true) {
  const res = await fetch('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: { 'Client-ID': IGDB_CLIENT_ID, Authorization: `Bearer ${await igdbToken(!retry)}`, 'Content-Type': 'text/plain' },
    body,
  });
  if (res.status === 401 && retry) return igdbQuery(body, false);
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

/** Best IGDB match for a game name (and release year, to tell remakes apart). */
function pickMatch(results, name, year) {
  const want = simplify(name);
  const near = (g) => !year || !yearOf(g.first_release_date) || Math.abs(yearOf(g.first_release_date) - year) <= 1;
  const exact = results.filter((g) => simplify(g.name) === want);
  return (
    exact.find(near) ??
    exact[0] ??
    // Subtitles differ a lot between catalogs; only trust a partial match from the same year.
    results.find((g) => near(g) && year && (simplify(g.name).startsWith(want) || want.startsWith(simplify(g.name))))
  );
}

const CRITIC_TTL = 7 * 864e5;
const critics = new Map();

async function criticScore(name, year) {
  const key = `${simplify(name)}|${year ?? ''}`;
  const hit = critics.get(key);
  if (hit && Date.now() - hit.at < CRITIC_TTL) return hit.value;
  const q = String(name).replace(/["\\]/g, ' ').slice(0, 120);
  const results = await igdbQuery(
    `search "${q}"; fields name,first_release_date,aggregated_rating,aggregated_rating_count,url; limit 20;`,
  );
  const g = pickMatch(results, name, year);
  const value =
    g && g.aggregated_rating
      ? { score: Math.round(g.aggregated_rating), reviews: g.aggregated_rating_count ?? null, name: g.name, url: g.url ?? null }
      : { score: null };
  if (critics.size > 5000) critics.clear();
  critics.set(key, { at: Date.now(), value });
  return value;
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

  switch (route) {
    case 'GET /api/health': {
      const { users } = await loadUsers();
      return send(res, 200, {
        ok: true,
        hasUsers: users.length > 0,
        signupOpen: users.length === 0 || ALLOW_SIGNUP,
        critics: igdbEnabled(),
      });
    }
    case 'POST /api/auth/register':
      return send(res, 200, await register(await readBody(req)));
    case 'POST /api/auth/login':
      return send(res, 200, await login(await readBody(req)));
    case 'GET /api/auth/me':
      return send(res, 200, { user: publicUser(await authenticate(req)) });
    case 'POST /api/auth/password': {
      const user = await authenticate(req);
      const body = await readBody(req);
      if (typeof body.current !== 'string' || !(await checkPassword(user, body.current))) {
        throw new HttpError(401, 'La contraseña actual no es correcta');
      }
      const updated = await setPassword(user.username, body.next);
      return send(res, 200, { token: issueToken(updated) });
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
        return { status: 200, body: { version: next.version, updatedAt: next.updatedAt } };
      });
      return send(res, out.status, out.body);
    }
    case 'GET /api/critics': {
      // Only for signed-in users, so the server's IGDB quota can't be used by strangers.
      await authenticate(req);
      if (!igdbEnabled()) throw new HttpError(503, 'Faltan IGDB_CLIENT_ID e IGDB_CLIENT_SECRET en el servidor');
      const name = url.searchParams.get('name')?.trim();
      if (!name) throw new HttpError(400, 'Falta el nombre del juego');
      const year = Number(url.searchParams.get('year')) || null;
      return send(res, 200, await criticScore(name, year));
    }
    default:
      return send(res, 404, { error: 'Not found' });
  }
}

await mkdir(STATE_DIR, { recursive: true });
await mkdir(BACKUP_DIR, { recursive: true });
await loadSecret();

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

http
  .createServer((req, res) => {
    handle(req, res).catch((e) => {
      if (!(e instanceof HttpError)) console.error(e);
      if (!res.headersSent) send(res, e.status ?? 500, { error: e instanceof HttpError ? e.message : 'Error del servidor' });
    });
  })
  .listen(PORT, () => console.log(`GamesTraker API on :${PORT}`));
