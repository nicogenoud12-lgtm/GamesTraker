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
- Todo se guarda en el dispositivo (localStorage). Desde Ajustes podés exportar/importar un backup.

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

La key de RAWG se mete en el build (el `.env` lo lee `docker-compose.yml`), así que si la cambiás hay que
volver a correr `docker compose up -d --build`.

### Vercel (previews de PRs)

Vercel está conectado al repo: cada PR tiene su link de preview para probar antes de mergear.
La variable `VITE_RAWG_KEY` está cargada en Vercel (tipo Config, Production + Preview).

## Stack

React 18 + TypeScript + Vite, Tailwind CSS 4, Zustand (persistencia), dnd-kit (reordenar), vite-plugin-pwa.
