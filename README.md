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

Animaciones de [React Bits](https://reactbits.dev): Aurora (fondo del inicio), TiltedCard (carátula en la ficha)
y CountUp (estadísticas), en `src/components/reactbits/`.

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
`juegos.genoud-nube.com.ar` → `http://10.0.0.69:3030`.

Actualizar después de mergear un PR:

```bash
cd /home/genoud/GamesTraker
git pull origin main
docker compose up -d --build
```

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

### Puntaje de IMDb (series y pelis)

IMDb no tiene una API gratis, pero publica todos los días un archivo con el puntaje y los votos de cada título
([IMDb Non-Commercial Datasets](https://developer.imdb.com/non-commercial-datasets/), para uso personal y no
comercial). El servidor lo baja al arrancar y una vez por día (~8 MB) y la ficha muestra "IMDb 8,7" usando el id
de IMDb que trae TMDB. No hace falta configurar nada; con `IMDB=off` en el servicio `api` se desactiva.

### Nota de críticos (Steam / IGDB)

RAWG no tiene la nota de Metacritic de muchos juegos. Para esos, el servidor la busca en la tienda de
Steam (muestra el Metacritic de la versión de PC) sin necesitar ninguna cuenta ni clave. De Steam también
sale el **puntaje de los usuarios** ("Steam 89%"), calculado como lo hace SteamDB: el porcentaje de reseñas
positivas, acercado al 50% cuando hay pocas reseñas.

Para juegos que no están en Steam se puede sumar, opcionalmente, la nota de críticos de
[IGDB](https://www.igdb.com) (promedio de reseñas de medios), que el servidor pide con una app de Twitch:

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

El secret queda solo en el servidor; la app le pregunta la nota a `/api/critics` (solo con sesión iniciada).

Las keys de RAWG y TMDB (`VITE_RAWG_KEY`, `VITE_TMDB_KEY`) se meten en el build (el `.env` lo lee `docker-compose.yml`), así que si la cambiás hay que
volver a correr `docker compose up -d --build`.

### Chequeo de PRs

Cada PR corre el workflow **Build** (`.github/workflows/build.yml`), que arma la misma imagen de Docker
que el servidor. Si queda en verde, el PR compila y se puede mergear.

## Stack

React 18 + TypeScript + Vite, Tailwind CSS 4, Zustand (persistencia), dnd-kit (reordenar), vite-plugin-pwa.
