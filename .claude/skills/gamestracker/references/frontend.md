# Frontend (`src/`)

React 18 + TS + Vite 5 + Tailwind 4 (tokens de color en `index.css`, `data-mode` en `<html>` cambia el acento:
violeta/rosa para juegos, amarillo/naranja para series y pelis). Fuentes Inter + Space Grotesk (`font-display`).
PWA con vite-plugin-pwa; `public/push-sw.js` se importa en el service worker (`importScripts`) para los push.
Ruteo con **HashRouter**: los links internos son `#/juego/<id>`.

## Rutas (`App.tsx`)

`/` Inicio · `/descubrir` (+ `/descubrir/explorar`) · `/buscar` · `/juego/:id` (ficha; `?puntuar=1` abre la hoja
de puntaje) · `/listas` y `/listas/:id` · `/mis-juegos` (biblioteca/tier list + "Compartir") · `/estadisticas` ·
`/resumen` (año en revisión) · `/diario` · `/amigos` (`?agregar=<código>` para invitaciones) · `/cuenta` ·
`/ajustes` · `/p/:usuario` (tier list pública, sin la navegación de la app).

## Stores (zustand)

- `store/useStore.ts` (persist `gamestraker`, versión 4): `games` (snapshots), `ratings`, `lists`, `logs`,
  `starts`/`startsAt`, `goals`, tombs, `apiKey` (RAWG) y `tmdbKey`. Acciones: `rememberGame`, `saveRating`,
  `deleteRating`, `addToList(listId, game, 'top'|'bottom')` (en listas "ahora" pone fecha de inicio),
  `removeFromList`, `reorderList`, `addLog`, `deleteLog`, `importData`. `snapshot(game)` guarda la mejor carátula
  conocida (`bestCover`).
- `store/useSync.ts` (persist `gamestraker-sync`): token, username, estado de sincronización.
- `store/useUi.ts` (persist `gamestraker-ui`): `mode` (`games` | `screen`). `useMode()`.
- `store/useToast.ts`: `useToast.getState().show('texto')`.
- Stores sin persistir: `useTrakt` (lib/trakt), `useNotices` (lib/social), `useCovers` (lib/covers).

## Módulos de `src/lib`

| Archivo | Qué hace |
|---|---|
| `catalog.ts` | Punto único de datos: `searchItems`, `popularItems`, `itemDetail` (con caché), `sagaItems`, `similarItems`, `useKeys()` / `currentKeys()` (Ajustes gana sobre build). Sin key → catálogos demo (`src/data`). |
| `rawg.ts` | Cliente RAWG: `toGame`, `unique()` (oculta duplicados "Soulcalibur"/"Soulcalibur (1998)"), `resizeImage(url, 420|640|1280)` (también reescribe tamaños de IGDB). |
| `tmdb.ts` | Cliente TMDB en `es-MX`, región `AR` para streaming. `tmdbDetail`, `tmdbItem`, géneros en castellano. |
| `covers.ts` | Carátulas IGDB: `useGameCover(game)` (espera hasta 2,5 s mostrando placeholder, sin parpadeo de RAWG), `bestCover(game)` (sincrónico), `askAll`. Caché `gamestraker-covers`. |
| `gameIndex.ts` | Índice de juegos populares: `loadGameIndex()` (se precarga 2 s después de abrir) y `searchGameIndex(q)` (normaliza tildes; exacto → prefijo/palabras → subcadena, por popularidad). |
| `critics.ts` | Llamadas al servidor: `gameScores` (Metacritic/IGDB + Steam), `imdbRating`, `gameLength` (HLTB), `tomatoScores` (RT). |
| `durations.ts` | Horas por título para totales de listas y la ruleta (`gamestraker-durations-2`). `roughHours()`. |
| `trakt.ts` | Estado de Trakt, conectar/poll/revisar, `dismissToRate`, y `addWatching` (pone lo empezado arriba de Viendo ahora y lo confirma con `/trakt/watching`). |
| `social.ts` | Amigos, avisos (`startNotices` refresca avisos y Trakt cada 3 min), Web Push (`enablePush`/`disablePush`), `timeAgo`. |
| `sync.ts` / `merge.ts` | Sincronización con `PUT /api/state` + merge por timestamps/tombs; `api(method, path, body)`. |
| `savedTitles.ts` | Arreglos de una sola vez por dispositivo: renombrar series/pelis guardadas a español latino (`gamestraker-latam-names`) y pasar carátulas guardadas a IGDB (`gamestraker-igdb-covers`). |
| `tiers.ts` / `tierIcons.ts` | Escala y los íconos propios (Path2D, sirven en SVG y canvas). |
| `celebrate.ts` | Fuegos artificiales del Histórico (respeta reduced-motion, vibra). |
| `tint.ts` | Color dominante de la carátula para el brillo de la ficha (`gamestraker-tints-2`). |
| `shareImage.ts` / `cards.ts` | Imágenes 1080×1920 para compartir (puntaje, tier list `tierCard`, año); las imágenes pasan por `/api/img`. |
| `diary.ts`, `stats.ts`, `taste.ts`, `discover.ts`, `kinds.ts`, `format.ts`, `mode.ts`, `types.ts` | Diario por día, estadísticas, recomendaciones por gusto, filas de Descubrir, filtros pelis/series, formatos de fecha/horas, modos y listas de sistema, tipos. |

## Componentes notables

`Cover` (carátula con IGDB, `data-cover` para la transición), `CoverTransition` (View Transitions API al tocar una
carátula), `RatingSheet` (hoja de puntaje; compara tus horas con HowLongToBeat), `TierSection` / `TierIcon` /
`TierShareSheet`, `ToRateCard` ("Para puntuar" de Trakt en Inicio), `TraktSettings`, `FriendsSettings`,
`FriendsOnTitle`, `Again` (rejugar/rever + historial), `Roulette` ("¿Qué hago ahora?"), `ErrorBoundary`
("Algo se rompió").

## Ficha (`pages/GamePage.tsx`)

- Juegos: Metacritic (RAWG o Steam) / "Críticos" IGDB, "Steam N%", tarjeta **"Cuánto dura"** (HowLongToBeat:
  número principal + Historia / Con extras / Al 100%).
- Series/pelis: "TMDB N%", "IMDb 9,0", "RT críticos N%", "RT público N%".
- Póster con IGDB para juegos; en escritorio el fondo borroso usa la imagen horizontal de RAWG.

## Convenciones de UI

- Textos en castellano rioplatense, cortos y concretos. Nada de emojis genéricos como íconos (Nico los pidió
  sacar): usar lucide-react o íconos propios.
- Probar siempre en celular (iPhone 13 en Playwright) y escritorio. Sin scroll horizontal.
- Diseño cuidado: Nico rechaza lo que se ve "berreta" — tarjetas con tinte del tier, buen espaciado, animaciones
  suaves.
