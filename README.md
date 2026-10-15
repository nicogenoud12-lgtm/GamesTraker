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

## Publicar en GitHub Pages

1. En el repo: **Settings → Pages → Source: GitHub Actions**.
2. (Opcional) **Settings → Secrets → Actions**: crear `RAWG_KEY` con tu key, así no hace falta pegarla en la app.
   Ojo: queda incluida en el JS publicado (RAWG está pensada para usarse así desde el navegador).
3. Cada push a `main` despliega en `https://<usuario>.github.io/GamesTraker/`.

## Stack

React 18 + TypeScript + Vite, Tailwind CSS 4, Zustand (persistencia), dnd-kit (reordenar), vite-plugin-pwa.
