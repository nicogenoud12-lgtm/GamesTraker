// GamesTraker sync API: stores one JSON document (ratings, lists, game
// snapshots) shared by every device that knows SYNC_TOKEN. No dependencies.
import http from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

const PORT = Number(process.env.PORT ?? 8787);
const DATA_DIR = process.env.DATA_DIR ?? '/data';
const TOKEN = (process.env.SYNC_TOKEN ?? '').trim();
const FILE = path.join(DATA_DIR, 'state.json');
const MAX_BODY = 10 * 1024 * 1024;
const KEEP_BACKUPS = 30;

const configured = TOKEN.length >= 12;
if (!configured) console.warn('SYNC_TOKEN missing or shorter than 12 chars: sync is disabled.');

const digest = (s) => createHash('sha256').update(s).digest();
const tokenDigest = digest(TOKEN);

let doc = { version: 0, updatedAt: null, data: null };
// Writes are chained so concurrent PUTs are applied one after another.
let queue = Promise.resolve();

async function load() {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    doc = JSON.parse(await readFile(FILE, 'utf8'));
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
}

async function backupOncePerDay() {
  if (!doc.data) return;
  const name = `state-${new Date().toISOString().slice(0, 10)}.json`;
  const files = await readdir(DATA_DIR);
  if (files.includes(name)) return;
  await writeFile(path.join(DATA_DIR, name), JSON.stringify(doc));
  const backups = files.filter((f) => /^state-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  for (const old of backups.slice(0, Math.max(0, backups.length + 1 - KEEP_BACKUPS))) {
    await unlink(path.join(DATA_DIR, old));
  }
}

async function save(next) {
  await backupOncePerDay();
  const tmp = `${FILE}.tmp`;
  await writeFile(tmp, JSON.stringify(next));
  await rename(tmp, FILE);
  doc = next;
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function authorized(req) {
  const header = req.headers.authorization ?? '';
  const given = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  return given.length > 0 && timingSafeEqual(digest(given), tokenDigest);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('Body too large'), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function validData(d) {
  return (
    d &&
    typeof d === 'object' &&
    typeof d.games === 'object' &&
    typeof d.ratings === 'object' &&
    Array.isArray(d.lists)
  );
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/health') return send(res, 200, { ok: true, configured });
  if (url.pathname !== '/api/state') return send(res, 404, { error: 'Not found' });
  if (!configured) return send(res, 503, { error: 'La sincronización no está configurada en el servidor' });
  if (!authorized(req)) return send(res, 401, { error: 'Código de sincronización incorrecto' });

  if (req.method === 'GET') return send(res, 200, doc);

  if (req.method === 'PUT') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch (e) {
      return send(res, e.status ?? 400, { error: e.status ? e.message : 'JSON inválido' });
    }
    if (!Number.isInteger(body?.baseVersion) || !validData(body?.data)) {
      return send(res, 400, { error: 'Formato inválido' });
    }
    const result = (queue = queue.then(async () => {
      // Someone else wrote since this client last read: it must merge and retry.
      if (body.baseVersion !== doc.version) return { status: 409, body: doc };
      const next = { version: doc.version + 1, updatedAt: new Date().toISOString(), data: body.data };
      await save(next);
      return { status: 200, body: { version: next.version, updatedAt: next.updatedAt } };
    }));
    queue = queue.catch(() => {});
    const { status, body: out } = await result;
    return send(res, status, out);
  }

  return send(res, 405, { error: 'Method not allowed' });
}

await load();
http
  .createServer((req, res) => {
    handle(req, res).catch((e) => {
      console.error(e);
      if (!res.headersSent) send(res, 500, { error: 'Error del servidor' });
    });
  })
  .listen(PORT, () => console.log(`GamesTraker sync API on :${PORT} (version ${doc.version})`));
