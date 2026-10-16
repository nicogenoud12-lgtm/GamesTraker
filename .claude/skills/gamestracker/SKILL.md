---
name: gamestracker
description: Contexto técnico completo de GamesTracker / MediaTracker, la app personal de Nico para puntuar juegos, series y películas (tier list, listas, diario, amigos, Trakt/Nuvio, HowLongToBeat, IGDB, Rotten Tomatoes). Usar cuando el usuario hable de "la app de juegos", "GamesTracker", "MediaTracker", "tracker.genoud-nube.com.ar", "la tier list", "puntuar juegos/series/pelis", "Viendo ahora", "Trakt", "Nuvio", el repo nicogenoud12-lgtm/GamesTraker, o pida cambios, arreglos o deploys de esa app.
---

# GamesTracker / MediaTracker

App personal (PWA) para puntuar **juegos** (lado "GamesTracker") y **series y películas** (lado "MediaTracker"),
con escala propia, listas, diario, estadísticas, amigos y avisos. La usa Nico (y amigos/novia que él invita).

- **Repo:** `nicogenoud12-lgtm/GamesTraker` (rama principal `main`). Ojo: el repo se llama *GamesTraker* (sin la "c").
- **Producción:** <https://tracker.genoud-nube.com.ar> (antes `juegos.genoud-nube.com.ar`). Servidor casero CasaOS,
  carpeta `/home/genoud/GamesTraker`, Docker Compose.
- **Idioma:** toda la UI, textos, commits y PRs en **español rioplatense** (vos, "puntuá", "fijate"). Títulos de
  series/pelis en **español latino** (TMDB `es-MX`), nunca de España.

## Cómo se trabaja con Nico

1. Nico pide algo (muchas veces con capturas). Implementar en la rama asignada, **probar de verdad**
   (servidor con mocks + Playwright con capturas), abrir PR, esperar el check **`docker`** en verde, **squash-merge**
   y desuscribirse del PR.
2. Después decirle cómo deployar. Si tiene el cron de auto-update, se actualiza solo en ~2 min; si no:
   ```bash
   cd /home/genoud/GamesTraker && git pull origin main && docker compose up -d --build
   ```
   Si cambió el `.env`, hay que correr `docker compose up -d` igual (el auto-update solo mira el código).
3. Respuestas cortas, en castellano, sin jerga innecesaria. Explicar qué cambia para él, qué tiene que hacer
   (si algo), y avisar honestamente lo que no se pudo probar contra el servicio real.
4. **Nunca** pedirle que pegue tokens/claves en el chat. Para cargar claves en el servidor darle comandos con
   `read -p` / `read -s -p` que las agregan al `.env` sin mostrarlas. Para verificar sin exponer:
   `docker compose exec api sh -c 'test -n "$VAR" && echo OK || echo FALTA'`.
5. No hay acceso SSH al servidor ni salida a internet desde el entorno de desarrollo: todo lo externo (RAWG,
   TMDB, IGDB, HLTB, Trakt, Steam, RT) se prueba con **mocks** apuntando las variables `*_URL` del servidor.
6. Sin identificadores de modelo en commits ni PRs. No renombrar las claves de storage del usuario
   (`gamestraker`, `gamestraker-sync`, `gamestraker-ui`) ni el volumen `gamestraker_data`.

## Arquitectura en una mirada

| Parte | Qué es |
|---|---|
| `src/` | React 18 + TypeScript + Vite 5, Tailwind 4, zustand (persist), react-router **HashRouter** (`#/juego/...`), vite-plugin-pwa, lucide-react, componentes de React Bits en `src/components/reactbits`. |
| `server/index.mjs` | API en **Node 22 sin dependencias** (un solo archivo grande + `webpush.mjs`). Datos en JSON bajo `DATA_DIR` (`/data`, volumen `gamestraker_data`). |
| `docker-compose.yml` | `web` (nginx con el build, puerto **3030**→80, proxy de `/api` al `api`) + `api` (puerto 8787 interno). |
| `.github/workflows/build.yml` | Check **`docker`**: arma las imágenes y prueba la API con `curl` (registro, estado, amigos, Trakt, etc.). |
| `deploy/auto-update.sh` | Auto-deploy por cron: si `origin/main` cambió, `git merge --ff-only` + `docker compose up -d --build`. |

Fuentes de datos: **RAWG** (catálogo de juegos, key en Ajustes o `VITE_RAWG_KEY`), **TMDB** (series/pelis,
`es-MX`, región AR para streaming), **IGDB** (carátulas, nota de críticos, duración de respaldo), **HowLongToBeat**
(duración), **Steam** (Metacritic de PC y reseñas tipo SteamDB), **IMDb** (dataset diario), **Rotten Tomatoes**
(vía Wikidata), **Trakt** (lo que se ve en Nuvio).

## Conceptos del dominio

- **Dos modos:** `games` y `screen` (`src/lib/mode.ts`, `MODES`). Ids: `rawg:<id>` para juegos,
  `tmdb:movie:<id>` / `tmdb:tv:<id>` para pelis/series (también `demo:` / `dscr:` en modo demo).
- **Escala (tiers)** de 0 a 100 (`src/lib/tiers.ts`): Malo (0), Aburrido (35), Safa (50), Bueno (65),
  Buenísimo (80), **Histórico (92)**. Íconos propios en `tierIcons.ts`/`TierIcon.tsx` (nada de emojis).
  Puntuar un Histórico dispara fuegos artificiales (`celebrate.ts`, ~2 s).
- **Listas de sistema:** `playing` (Jugando ahora), `next`, `watching` (**Viendo ahora**), `towatch`. Puntuar
  algo lo saca de la lista "ahora"/"próximo" de su modo.
- **Rating:** score, tier, status (terminado/completado/abandonado), plataforma, fechas, horas, replay, nota.
  **Logs** = rejugadas/revistas (diario). **Snapshots** (`games`) guardan nombre/carátula para mostrar offline.
- **Sincronización:** todo el estado local se sube a `PUT /api/state` con `baseVersion` (409 → merge y reintento).
  Las keys de RAWG/TMDB viajan en `settings` y llegan a todos los dispositivos.

Detalle completo:
- Servidor, endpoints, datos en disco, variables de entorno e integraciones → [references/servidor.md](references/servidor.md)
- Frontend: archivos clave, stores, convenciones y trampas → [references/frontend.md](references/frontend.md)
- Historia de cambios (PRs), decisiones tomadas y pendientes → [references/historia.md](references/historia.md)

## Reglas de oro (trampas ya pisadas)

- **Selectores de zustand:** nunca devolver un objeto/array nuevo (`s.x ?? []`) → React error #185 (loop
  infinito). Usar una constante compartida (`const NONE: T[] = []`) o seleccionar primitivos.
- **Prettier:** no correrlo con la config por defecto sobre archivos existentes (cambia comillas a dobles). Si hace
  falta: `npx prettier --single-quote --print-width 130` y solo en archivos nuevos.
- **Matar procesos en pruebas:** no usar `pkill -f "<patrón>"` si el patrón aparece en el propio comando (mata la
  shell). Usar `kill $(pgrep -f "^node server/inde[x]")`.
- **Usuarios de prueba:** nombre de 3 a 32 caracteres (`ci-test`, no `ci`).
- **Rama ya mergeada:** se recrea desde `origin/main` (`git checkout -B <rama> origin/main`) y se pushea con
  `--force-with-lease` solo si el remoto tiene únicamente historia ya mergeada.
- **Comentarios en código:** en inglés, explicando el *porqué*; textos de UI en castellano. Seguir el estilo del
  archivo (densidad de comentarios, nombres).
- **Servicios externos frágiles** (HLTB, RT): siempre con fallback y caché; si fallan, la ficha se muestra sin ese
  dato, nunca rompe.

## Verificación estándar antes de abrir PR

```bash
npx tsc -b && npm run build && node --check server/index.mjs
# servidor de prueba con datos en el scratchpad y mocks:
DATA_DIR=/tmp/x PORT=8787 ALLOW_SIGNUP=true IMDB=off GAMES_INDEX=off node server/index.mjs
# app: npx vite --port 5199  + Playwright (Chromium en /opt/pw-browsers) con page.route() para mockear APIs,
# sembrando localStorage con addInitScript + guardia en sessionStorage.
```
Y agregar al workflow de CI un `curl` que cubra lo nuevo del servidor cuando aplique.
