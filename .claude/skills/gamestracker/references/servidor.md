# Servidor (`server/index.mjs`)

Node 22, **sin dependencias**, un solo archivo organizado en secciones `// ---------- nombre ----------`
(storage, auth, critic scores (IGDB), covers (IGDB), game lengths (HLTB/IGDB), popular games index, Rotten
Tomatoes, IMDb ratings, public profiles, friends, notifications, Trakt, http). `server/webpush.mjs` hace Web Push
(VAPID RFC 8292 + cifrado aes128gcm RFC 8291) con `node:crypto`. El `Dockerfile` copia `*.mjs`.

Patrones internos: `readJson`/`writeJson` (escritura atómica), `serial(fn)` (cola para no pisar archivos),
`HttpError(status, msg)`, `send(res, status, body)`, `readBody(req)`, `authenticate(req)` (token Bearer),
`str(v, max)` para sanear strings, `simplify(name)` para comparar nombres de juegos, `pickMatch(results, name, year,
nameOf?, releasedIn?)` para elegir el juego correcto (exacto + año ±1; parcial solo con año).

## Datos en disco (`DATA_DIR`, volumen `gamestraker_data`)

| Archivo / carpeta | Contenido |
|---|---|
| `users.json` | Cuentas: id, username (case-preserving, se compara sin mayúsculas con `byName`), hash scrypt, `friends`, `friendCode`, `sharesWith`, `announce`, `seenAt`, `public`, intentos fallidos. |
| `secret` | Clave HMAC de los tokens de sesión (365 días). |
| `state/<uid>.json` | `{version, updatedAt, data}`: el estado sincronizado del usuario (games, ratings, lists, logs, tombs, starts, goals, settings con keys RAWG/TMDB). |
| `backups/` | Copia diaria del estado de cada usuario (se guardan 30). |
| `activity/` | Feed de puntajes para amigos. |
| `push/` | Suscripciones Web Push por usuario. |
| `vapid.json` | Claves VAPID (se generan solas). |
| `trakt/<uid>.json` | Tokens de Trakt, `since`, `pending` (para puntuar), `done`, `watching`, `watchingAdded`, `showProgress`, `broken`. |
| `covers.json` | Caché de carátulas IGDB por id `rawg:N` (`{url, at}`; las no encontradas se reintentan a los 7 días). |
| `games-index.json` | Índice de ~10.000 juegos populares de RAWG (se rehace cada 7 días). |
| `state.json` | Formato viejo (migración). |

## Endpoints

Auth / cuenta: `GET /api/health` (ok, hasUsers, signupOpen, igdb, imdb, trakt) · `POST /api/auth/register`
(cerrado tras la primera cuenta salvo `ALLOW_SIGNUP=true` o link de invitación) · `POST /api/auth/login` (bloqueo
tras 10 fallos, 15 min) · `GET /api/auth/me` · `POST /api/auth/username` (renombrar) · `POST /api/auth/password` ·
`POST /api/profile` (perfil público on/off).

Estado: `GET /api/state` · `PUT /api/state` (`{baseVersion, data}`; 409 si otro dispositivo escribió → el cliente
mergea y reintenta). Al guardar dispara avisos a amigos y, si llegó una key de RAWG y no hay índice, lo arma.

Público: `GET /api/public/:usuario` (tier list solo si es pública, o si el que mira es amigo con permiso) ·
`GET /api/invite/:code`.

Amigos: `GET /api/friends` · `POST /api/friends/add|remove|code|share|settings` · `GET /api/friends/ratings?id=` ·
`GET /api/friends/feed`. Modelo: amistad mutua; `canSee(viewer, owner) = sonAmigos && owner.sharesWith incluye
viewer` (todo **apagado por defecto**, se comparte amigo por amigo). `announce` (avisar cuando puntúo) también
arranca apagado.

Avisos: `GET /api/notifications` · `POST /api/notifications/seen` · `GET /api/push/key` ·
`POST /api/push/subscribe|unsubscribe` (solo endpoints de FCM/Mozilla/Apple/Windows, `PUSH_HOSTS`).

Trakt: `GET /api/trakt` (enabled, connected, broken, account, `pending`, `watching`) · `POST /api/trakt/connect`
(device code) · `/poll` · `/check` (revisar ahora) · `/dismiss {key}` · `/watching {keys}` (marcar agregados a
Viendo ahora) · `/disconnect`.

Datos externos (con sesión salvo IMDb/img): `GET /api/critics?name&year&steam&mc` (`mc` = página de Metacritic; responde
`score/source` + `steam`, `metacritic` y `igdb` con crítica y usuarios; `METACRITIC_URL` para mocks) · `GET /api/length?name&year` ·
`POST /api/covers {games:[{id,name,year}]}` (hasta 120, responde `{covers:{id:url|null}}`; los omitidos = no se
pudo preguntar) · `GET /api/games/index` (gzip + ETag/304, `Cache-Control: private, max-age=14400`) ·
`GET /api/games/discover?from&to&order=best|popular&genre&platform&page` (IGDB → ids de RAWG; 503 sin IGDB) ·
`GET /api/rt?imdb=tt…` · `GET /api/imdb?id=tt…` (503 mientras baja el dataset) · `GET /api/img?url=` (proxy de
imágenes de `media.rawg.io`, `image.tmdb.org`, `images.igdb.com` para canvas/colores).

CLI dentro del contenedor:
```bash
docker compose exec api node index.mjs reset-password <usuario> <contraseña-nueva>
docker compose exec api node index.mjs rename-user <usuario> <nombre-nuevo>
```

## Variables de entorno (servicio `api`)

| Variable | Para qué |
|---|---|
| `ALLOW_SIGNUP` | `true` deja crear más cuentas (si no, solo con invitación). |
| `IGDB_CLIENT_ID` / `IGDB_CLIENT_SECRET` | App de Twitch (dev.twitch.tv/console). Activa carátulas, nota de críticos y duración de respaldo. |
| `TRAKT_CLIENT_ID` | App de Trakt. **Alcanza solo con el Client ID** (las apps nuevas son PKCE sin secret). |
| `TRAKT_CLIENT_SECRET` | Opcional, solo apps viejas que tengan secret. |
| `TRAKT_POLL_MINUTES` | Cada cuánto revisa Trakt (default 10, mínimo 2). |
| `RAWG_KEY` | Key de RAWG para el índice; compose la pasa desde `VITE_RAWG_KEY`. Si falta, usa la guardada en Ajustes por alguna cuenta. |
| `GAMES_INDEX=off` / `GAMES_INDEX_PAGES` | Apagar el índice / páginas de 40 (default 250 ≈ 10.000 juegos). |
| `IMDB=off` / `IMDB_RATINGS_URL` | Apagar el dataset de IMDb / otra URL. |
| Para tests: `TRAKT_API_URL`, `HLTB_URL`, `WIKIDATA_URL`, `RT_URL`, `IGDB_API_URL`, `TWITCH_TOKEN_URL`, `RAWG_API_URL` | Apuntar a mocks locales. |

Build (servicio `web`, en `.env`): `VITE_RAWG_KEY`, `VITE_TMDB_KEY` (se meten en el build; cambiarlas requiere
`--build`). Las keys cargadas en Ajustes de la app ganan sobre las del build.

## Integraciones

- **Steam** (sin key): app id desde las tiendas de RAWG o búsqueda exacta; Metacritic de PC + reseñas con fórmula
  tipo SteamDB (`share - (share-0.5)·2^-log10(total+1)`). Caché 7 días (fallos 1 día).
- **IGDB**: token de Twitch (client_credentials), todas las llamadas pasan por `igdbTurn()` (≥260 ms entre pedidos,
  límite 4/s). `igdbQuery(body, retry, endpoint)`.
  - Carátulas: una consulta `where name ~ "A" | name ~ "B"…` por tanda de 40 + `search` individual para los que
    faltan (máx. 8). URL `https://images.igdb.com/igdb/image/upload/t_cover_big_2x/<image_id>.jpg`
    (el cliente cambia a `t_1080p` para tamaños grandes). Se quita el sufijo "(1998)" de RAWG antes de buscar.
  - Duración de respaldo: `game_time_to_beats` (hastily/normally/completely).
- **HowLongToBeat** (sin API oficial, frágil): `GET /api/search/site/init?t=` → `{token, hpKey?, hpVal?}`, luego
  `POST /api/search/site` con `x-auth-token` (y `x-hp-key`/`x-hp-val` + campo `hpKey` en el body). Fallback a la
  ruta vieja `/api/bleed`. Token se renueva 1 vez ante 401/403/404. Campos en segundos: `comp_all` (todos los
  estilos = número principal), `comp_plus`, `comp_main`, `comp_100`. Si falla → IGDB → promedio de RAWG.
- **Rotten Tomatoes**: SPARQL a Wikidata (`P345` IMDb id → `P1258` RT id, ej. `tv/better_call_saul`), luego la
  página de RT y el JSON `<script id="media-scorecard-json">` → `criticsScore.score` (Tomatómetro) y
  `audienceScore.score` (Popcornmeter).
- **IMDb**: `title.ratings.tsv.gz` diario, cargado en typed arrays ordenados (~1,7 M títulos), búsqueda binaria.
- **Trakt**: device flow (`/oauth/device/code` → `/oauth/device/token` sin secret), refresh tokens de un solo uso
  (se guarda el nuevo). Cada `TRAKT_POLL_MINUTES`:
  - `traktWatching`: `/sync/playback/movies` (pausadas <95%), `/sync/playback/episodes` y
    `/sync/watched/shows` (vistas en 30 días) → progreso por serie (cacheado por `last_watched_at`, máx. 15) →
    `watching`.
  - Historial desde `since`: película vista o serie con `completed >= aired` → `pending` + push "Terminaste X.
    ¿Cuánto le das?" con link `#/juego/<id>?puntuar=1`. Una vez por título, nunca algo ya puntuado.
- **Índice de juegos populares**: RAWG `/games?ordering=-added&page_size=40&exclude_additions=true`, 250 páginas
  a 400 ms. Entrada compacta `[id, name, released, imagen sin prefijo, genres, platforms, score, esScoreRAWG]`.
  Una corrida cortada solo reemplaza un índice más chico.

## Deploy

- Manual: `cd /home/genoud/GamesTraker && git pull origin main && docker compose up -d --build`.
- Auto (cron cada 2 min, si Nico lo instaló):
  ```bash
  (crontab -l 2>/dev/null | grep -v auto-update.sh; echo '*/2 * * * * /home/genoud/GamesTraker/deploy/auto-update.sh >> /home/genoud/gamestraker-deploy.log 2>&1') | crontab -
  ```
  Log: `tail /home/genoud/gamestraker-deploy.log`. Guarda el último commit en `.deployed`.
- Chequeo rápido: `curl -s localhost:3030/api/health` (esperar ~10 s tras reiniciar: un 502 justo después es el
  `api` arrancando). Logs: `docker compose logs api --tail 30`.
- Agregar claves sin mostrarlas:
  ```bash
  read -p "Client ID: " id && read -s -p "Secret: " sec && echo && printf '\nX_ID=%s\nX_SECRET=%s\n' "$id" "$sec" >> .env
  ```
