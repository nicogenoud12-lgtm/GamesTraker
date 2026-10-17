# Historia y decisiones

PRs relevantes en `nicogenoud12-lgtm/GamesTraker` (todos squash-mergeados a `main`):

| PR | Qué |
|---|---|
| #30 | Transición de carátula (View Transitions), tinte de color en la ficha, festejo del Histórico. |
| #31 | Diario con rejugadas/revistas (`logs`). |
| #32 / #33 | Perfil público reducido a **solo la tier list** compartible (botón "Compartir" en Biblioteca, imagen + link). |
| #34 | Auto-deploy por cron (`deploy/auto-update.sh`), porque no hay SSH desde las sesiones. |
| #35 / #36 | Amigos: invitaciones, puntajes de amigos, avisos in-app y Web Push. Después: compartir **amigo por amigo**, todo apagado por defecto (caso de uso: compartir solo con la novia). |
| #37 | Rediseño de la tier list (antes "parecía berreta"). |
| #38 | Dominio nuevo `tracker.genoud-nube.com.ar`. |
| #39 | Íconos propios para los tiers en vez de emojis. |
| #40 | Fuegos artificiales de ~2 s al puntuar Histórico. |
| #41 | Cambiar nombre de usuario (Ajustes y CLI `rename-user`). |
| #42 | Nuvio vía Trakt: aviso para puntuar lo terminado. |
| #43 | Arreglo del crash React #185 (selector de zustand que devolvía `[]` nuevo en `ToRateCard`). |
| #44 | Trakt sin Client Secret (apps PKCE nuevas desde oct-2026). |
| #45 | HowLongToBeat (duración), Rotten Tomatoes, TMDB en español latino (`es-MX`). |
| #46 | Carátulas de IGDB + ocultar duplicados de RAWG. |
| #47 | Lo empezado en Trakt ("Continuar viendo") pasa solo a **Viendo ahora**. |
| #48 | Búsqueda al instante con índice de ~10.000 juegos populares. |
| #49 | (otra sesión) Arrastrar una fila ya no abre la carátula; Volver deja Explorar donde estaba. |
| #50–#55 | Mis juegos con carátulas enteras, desenfoque gradual (GradualBlur), brillo en la carátula de la ficha (BorderGlow), ruedita que se frena en las filas, ícono de la lista en la carátula, ruleta en todas las listas. |
| (este) | Lo mejor / más popular de períodos recientes (este año, año pasado, últimos 30 días, próximamente) desde **IGDB** vía `/api/games/discover`; crítica y jugadores **separados** en tarjetas, filas y ficha. |

## Decisiones tomadas (no re-discutir)

- **Compartir:** lo público es solo la tier list. Amigos: permiso por amigo, apagado por defecto; avisar a amigos
  cuando puntúo, apagado por defecto.
- **Duración de juegos:** número principal = HowLongToBeat "todos los estilos" (`comp_all`); si no hay, historia +
  extras. Respaldo IGDB, después RAWG.
- **Carátulas de juegos:** IGDB (tapa oficial); RAWG queda como catálogo y como fondo horizontal.
- **Idioma de títulos:** latino (`es-MX`). Nunca España.
- **Búsqueda rápida:** por popularidad de RAWG (`-added`) en vez de "más de 1000 reseñas en Steam" (pedir Steam
  juego por juego no escala).
- **Descubrir por período reciente:** IGDB (crítica = `aggregated_rating` con 3+ reseñas; popular = visitas de IGDB,
  `popularity_primitives` tipo 1), cruzado a ids de RAWG por nombre y año. RAWG casi no tiene Metacritic de juegos
  nuevos. Períodos viejos siguen con RAWG.
- **Puntajes:** `metacritic` = crítica; `userScore`/`userLabel` = jugadores (RAWG o IGDB). Nunca mezclar los dos en un
  mismo número. En carátulas y filas va **un solo número** (crítica, si no jugadores); en la ficha, **todos**, en este
  orden: Metacritic crítica, Metacritic usuarios (de su página, `title="Metascore N out of 100"` / `"User score N out of
  10"`), IGDB crítica, IGDB usuarios, Steam, RAWG jugadores.
- **Caché de notas:** en el navegador (`gamestraker-scores`, no se sincroniza), por id de título. La ficha muestra lo
  guardado al instante y revalida; cada sitio que responde reemplaza lo suyo, el que falla deja lo guardado. Precarga en
  segundo plano de los juegos puntuados o en listas (40 por visita, 1 cada 1,5 s, vencen a los 14 días).
- **Playnite:** extensión PowerShell (`Type: Script`) que la app arma como `.pext` con la clave adentro. Al abrir
  Playnite manda los juegos jugados; en cada arranque/cierre, ese juego. Arrancado → Jugando ahora (una vez, con la
  fecha), y también lo jugado en los últimos 7 días que no está terminado (Playnite solo dice "Jugando" si se lo
  configura); sale de Próximos a jugar. Marcado Superado/Completado → aviso para puntuar con horas, estado y fecha. En la primera sincronización solo
  cuenta lo jugado en los últimos 30 días (si no, avisaría por todo lo viejo). El servidor busca cada nombre en RAWG
  (`search_precise`), probando la key del `.env` y si RAWG la rechaza las de Ajustes; si no puede (sin key de RAWG en el servidor, o RAWG falla) Ajustes muestra por qué y la app los
  busca con su key al abrirse y se los pasa (`/api/playnite/resolve`), que los recuerda para los próximos avisos.
- **Trakt → Viendo ahora:** una vez por título; si Nico lo saca de la lista, no vuelve. Fecha de inicio = el día
  que se agrega.

## Pendientes / ideas ofrecidas

- Compartir con un amigo solo un lado (solo series y pelis, o solo juegos). Se ofreció, Nico no respondió.

## Estado de configuración conocido del servidor (oct-2026)

- `.env` con `TRAKT_CLIENT_ID` e `IGDB_CLIENT_ID`/`IGDB_CLIENT_SECRET`; health daba `igdb:true, imdb:true,
  trakt:true`. Trakt conectado (cuenta de Trakt de Nico). Usuario de la app: "Nico".
- Las keys de RAWG y TMDB están cargadas en Ajustes de la app (y/o en el `.env` como `VITE_*`).
