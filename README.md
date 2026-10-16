# GamesTracker

App para puntuar los juegos que vas jugando y armar tu lista de próximos… y lo mismo con series y películas.

- **Dos modos con un switch**: **Juegos** (violeta) y **Series y pelis** (ámbar). Cada uno tiene sus propias
  listas, colección, descubrir y estadísticas, como si fueran dos apps dentro de la misma.

- **Puntaje 0–100** + **puntaje en palabras**: Malo 💀 · Aburrido 😴 · Safa 🤷 · Bueno 👍 · Buenísimo 🔥 · Histórico 👑.
  La palabra se sugiere según el número, pero podés elegir otra.
- **Estado, plataforma, fecha y notas** en cada puntaje.
- **Listas**: "Jugando ahora", "Próximos a jugar" y las que quieras crear. Se reordenan arrastrando.
  Cuando puntuás un juego, sale solo de "Jugando ahora" y "Próximos".
- **Base de juegos de [RAWG](https://rawg.io)** (+800.000 juegos con carátulas, capturas y datos).
  Sin API key funciona en modo demo con un catálogo chico.
- **Mis juegos**: tu colección filtrada por palabra y ordenada por puntaje, fecha o nombre.
- Es una **PWA**: en el celular, abrila en el navegador y elegí "Agregar a pantalla de inicio".
- **Cuenta con usuario y contraseña** para sincronizar entre dispositivos a través del servidor propio. Sin
  iniciar sesión, todo queda en el dispositivo; desde Ajustes también se puede exportar/importar un backup.
- **Descubrir**: recomendaciones, rankings por año/década y explorador con filtros.
- **De la misma saga** en la ficha de cada juego y **estadísticas por año**.
- **Series y pelis** con datos de [TMDB](https://www.themoviedb.org): "Viendo ahora", "Quiero ver", dónde verla
  (Netflix, Prime Video, Disney+, Max…), tráiler, reparto y recomendaciones. Sin key, modo demo.

Animaciones de [React Bits](https://reactbits.dev): Aurora (fondo del inicio), TiltedCard (carátula en la ficha),
CountUp (estadísticas) y CircularCarousel (carátulas de cada lista), en `src/components/reactbits/`.

## Desarrollo

```bash
npm install
cp .env.example .env   # opcional: VITE_RAWG_KEY=tu_key
npm run dev
```

La API key de RAWG es gratis: <https://rawg.io/apidocs>, y la de TMDB también: <https://www.themoviedb.org/settings/api>.
Las dos se pueden pegar desde Ajustes dentro de la app y se sincronizan con la cuenta.

## Deploy

### Servidor propio (CasaOS + Cloudflare Tunnel)

Igual que la app de gastos: Docker con nginx en el puerto **3030**.

Primera vez:

```bash
ssh genoud@familia
cd /home/genoud
git clone https://github.com/nicogenoud12-lgtm/GamesTraker.git
cd GamesTraker
echo "VITE_RAWG_KEY=tu_key_de_rawg" > .env
docker compose up -d --build
```

En Cloudflare (**Networking → Tunnels → tu túnel → Routes**) agregar una ruta
`tracker.genoud-nube.com.ar` → `http://10.0.0.69:3030`.

Actualizar a mano después de mergear un PR:

```bash
cd /home/genoud/GamesTraker
git pull origin main
docker compose up -d --build
```

#### Actualización automática

`deploy/auto-update.sh` se fija si `main` cambió en GitHub y, si cambió, lo baja y reconstruye. Si no hay
nada nuevo no hace nada, y si un build falla lo reintenta en la próxima pasada. Para que corra solo cada
2 minutos (una sola vez, en el servidor):

```bash
cd /home/genoud/GamesTraker && git pull origin main
(crontab -l 2>/dev/null | grep -v auto-update.sh; echo '*/2 * * * * /home/genoud/GamesTraker/deploy/auto-update.sh >> /home/genoud/gamestraker-deploy.log 2>&1') | crontab -
```

Desde ahí, cada PR mergeado queda en el servidor en unos minutos. Para ver qué hizo:
`tail /home/genoud/gamestraker-deploy.log`. Para apagarlo: `crontab -l | grep -v auto-update.sh | crontab -`.

### Cuentas y sincronización

`docker-compose.yml` levanta dos servicios: `web` (nginx con la app) y `api` (`server/`, cuentas y
sincronización). nginx deriva `/api/` a la API, así que no hace falta otra ruta en Cloudflare.

- La primera vez, en la app: **Ajustes → Crear mi cuenta** (o el aviso del inicio). Esa primera cuenta
  cierra el registro; para permitir más cuentas, poner `ALLOW_SIGNUP=true` en el `.env`.
- En cada otro dispositivo se entra una vez con usuario y contraseña; la sesión dura un año.
- Cambiar la contraseña desde la app cierra las sesiones de los otros dispositivos.
- Si te olvidás la contraseña:

  ```bash
  docker compose exec api node index.mjs reset-password <usuario> <contraseña-nueva>
  ```

- Los datos quedan en el volumen `gamestraker_data`: `users.json` (contraseñas con scrypt), `state/` (un
  archivo por cuenta) y `backups/` (una copia por día, se guardan las últimas 30).
- Si se edita en dos dispositivos a la vez, gana la edición más reciente de cada puntaje o lista, y lo
  borrado no vuelve a aparecer.

### Amigos

En **Amigos** (barra lateral, o el botón de personas en el inicio del celu) cada uno tiene un link de invitación.
Quien lo abre se crea una cuenta, aunque el registro esté cerrado, o entra con la suya, y quedan como amigos.

- **Puntajes:** no se comparte nada por defecto. En Amigos, cada uno prende "Compartirle mis puntajes" con los amigos
  que quiera, uno por uno. Esos amigos lo ven en Amigos, en la escala de esa persona y en la ficha de cada título.
  Las notas nunca se comparten.
- **Avisos** ("juan le puso 94 a Hades"): vienen apagados. Se prenden en Ajustes → Amigos y les llegan solo a los
  amigos con los que se comparte.
  - Aparecen en Amigos, con el número en el ícono.
  - Si el amigo prendió "Notificaciones en este dispositivo", también le llegan como notificación del teléfono o la
    compu. En iPhone, primero hay que agregar la app a la pantalla de inicio.
- **Servidor:** las notificaciones usan Web Push con claves propias (`vapid.json` en el volumen de datos, se crean
  solas). No hace falta ninguna cuenta externa.

### Nuvio → "Para puntuar" (con Trakt)

Cuando terminás una película o una serie entera en Nuvio, la app te avisa para que la puntúes. Al tocar el aviso
se abre la ficha con el puntaje listo. Funciona así: Nuvio anota en Trakt lo que mirás, y el servidor lee tu
historial de Trakt cada 10 minutos.

1. **App de Trakt (una vez, en el servidor):**
   - Entrá a <https://trakt.tv/oauth/applications> → **New application**.
   - Nombre: `GamesTracker`. Redirect URI: `urn:ietf:wg:oauth:2.0:oob`.
   - Copiá el **Client ID** al `.env` del servidor y reiniciá con `docker compose up -d --build`:

   ```bash
   TRAKT_CLIENT_ID=...
   ```

   Las apps nuevas de Trakt no traen **Client Secret** ("Not issued … PKCE"): está bien, no hace falta. Si tu app
   es vieja y sí tiene uno, podés agregar también `TRAKT_CLIENT_SECRET=...`. El aviso amarillo de "Insecure redirect
   URIs" se puede ignorar: la app no usa redirecciones, se conecta con un código.

2. **En Nuvio:** Ajustes → Trakt → iniciá sesión con tu cuenta de Trakt.
3. **En la app:** Ajustes → **Nuvio (con Trakt)** → **Conectar con Trakt**. Entrá a trakt.tv/activate, poné el código
   y autorizá con la misma cuenta.
4. **Notificaciones:** para que lleguen al teléfono, prendé Ajustes → Amigos → **Notificaciones en este dispositivo**.

Qué cuenta como terminado y qué se avisa:

- **Película:** cuenta cuando la terminás. **Serie:** cuando viste todos los episodios emitidos.
- **Sin repetir:** se avisa una sola vez por título y nunca de algo que ya puntuaste. Lo pendiente también aparece en
  el inicio, en **Para puntuar**.
- **Historial viejo:** solo cuenta lo que mires desde que lo conectás.
- **Viendo ahora:** lo que Trakt tiene en "Continuar viendo" (películas pausadas y series vistas en el último mes
  que no terminaste) se agrega solo arriba de **Viendo ahora**, una vez por título: si lo sacás de la lista, no
  vuelve.
- **Privacidad:** cada cuenta conecta su propio Trakt. Las claves de acceso quedan en el servidor (`trakt/` en el
  volumen de datos).

### Puntaje de IMDb (series y pelis)

IMDb no tiene una API gratis, pero publica todos los días un archivo con el puntaje y los votos de cada título
([IMDb Non-Commercial Datasets](https://developer.imdb.com/non-commercial-datasets/), para uso personal y no
comercial). El servidor lo baja al arrancar y una vez por día (~8 MB) y la ficha muestra "IMDb 8,7" usando el id
de IMDb que trae TMDB. No hace falta configurar nada; con `IMDB=off` en el servicio `api` se desactiva.

### Rotten Tomatoes (series y pelis)

La ficha también muestra el **Tomatómetro** ("RT críticos 98%") y el **Popcornmeter** ("RT público 96%"). El
servidor busca en [Wikidata](https://www.wikidata.org) la página de Rotten Tomatoes que corresponde al id de IMDb
y lee los puntajes de ahí. No hace falta configurar nada; si Rotten Tomatoes no responde, la ficha se muestra
sin esos dos.

### Carátulas de los juegos (IGDB)

RAWG no tiene la tapa de los juegos: solo una imagen horizontal de fondo (muchas veces una captura) y a veces
nada. Con IGDB configurado (ver abajo), la app muestra la **carátula oficial de IGDB** y deja la de RAWG solo
si IGDB no la tiene. El servidor la busca por nombre y año, la guarda en `covers.json` (en el volumen de datos)
y no la vuelve a pedir. Los juegos repetidos de RAWG ("Soulcalibur" y "Soulcalibur (1998)") se muestran una sola
vez.

### Cuánto dura un juego (HowLongToBeat)

La ficha de cada juego muestra cuánto dura según [HowLongToBeat](https://howlongtobeat.com): el número grande
es el de todos los estilos de juego juntos (el mismo que muestra HowLongToBeat arriba de todo) o, si no hay, el
de historia + extras. Abajo va el detalle: historia, con extras y al 100%. Ese número también se usa para el
total de horas de las listas y para comparar con lo que tardaste al puntuar.

HowLongToBeat no tiene API oficial y cada tanto cambia cómo busca. Si deja de responder y está configurado
IGDB (ver abajo), se usa el "time to beat" de IGDB; si no, el promedio de RAWG.

### Nota de críticos (Steam / IGDB)

RAWG no tiene la nota de Metacritic de muchos juegos. Para esos, el servidor la busca en la tienda de
Steam (muestra el Metacritic de la versión de PC) sin necesitar ninguna cuenta ni clave. De Steam también
sale el **puntaje de los usuarios** ("Steam 89%"), calculado como lo hace SteamDB: el porcentaje de reseñas
positivas, acercado al 50% cuando hay pocas reseñas.

Para juegos que no están en Steam se puede sumar, opcionalmente, la nota de críticos de
[IGDB](https://www.igdb.com) (promedio de reseñas de medios), que el servidor pide con una app de Twitch.
IGDB también da las carátulas de los juegos y su duración cuando HowLongToBeat no responde:

1. Entrá a <https://dev.twitch.tv/console> con tu cuenta de Twitch (hace falta tener activada la verificación
   en dos pasos) y tocá **Register Your Application**.
2. Nombre: `GamesTracker`, OAuth Redirect URL: `http://localhost`, categoría: **Application Integration**,
   tipo de cliente: **Confidential**.
3. Abrí la app creada, copiá el **Client ID** y tocá **New Secret** para generar el **Client Secret**.
4. Agregalos al `.env` del servidor y reiniciá con `docker compose up -d --build`:

   ```bash
   IGDB_CLIENT_ID=...
   IGDB_CLIENT_SECRET=...
   ```

El secret queda solo en el servidor; la app le pregunta la nota a `/api/critics` y la duración a `/api/length`
(solo con sesión iniciada).

Las keys de RAWG y TMDB (`VITE_RAWG_KEY`, `VITE_TMDB_KEY`) se meten en el build (el `.env` lo lee `docker-compose.yml`), así que si la cambiás hay que
volver a correr `docker compose up -d --build`.

### Chequeo de PRs

Cada PR corre el workflow **Build** (`.github/workflows/build.yml`), que arma la misma imagen de Docker
que el servidor. Si queda en verde, el PR compila y se puede mergear.

## Stack

React 18 + TypeScript + Vite, Tailwind CSS 4, Zustand (persistencia), dnd-kit (reordenar), vite-plugin-pwa.
