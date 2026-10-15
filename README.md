# GamesTraker

App para puntuar los juegos que vas jugando y armar tu lista de próximos.

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

Animaciones de [React Bits](https://reactbits.dev): Aurora (fondo del inicio), TiltedCard (carátula en la ficha)
y CountUp (estadísticas), en `src/components/reactbits/`.

## Desarrollo

```bash
npm install
cp .env.example .env   # opcional: VITE_RAWG_KEY=tu_key
npm run dev
```

La API key de RAWG es gratis: <https://rawg.io/apidocs>. También se puede pegar desde Ajustes dentro de la app.

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

La key de RAWG se mete en el build (el `.env` lo lee `docker-compose.yml`), así que si la cambiás hay que
volver a correr `docker compose up -d --build`.

### Chequeo de PRs

Cada PR corre el workflow **Build** (`.github/workflows/build.yml`), que arma la misma imagen de Docker
que el servidor. Si queda en verde, el PR compila y se puede mergear.

## Stack

React 18 + TypeScript + Vite, Tailwind CSS 4, Zustand (persistencia), dnd-kit (reordenar), vite-plugin-pwa.
