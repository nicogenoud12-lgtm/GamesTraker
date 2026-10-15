import type { GameDetail } from '../lib/types';

// Offline catalog used until a RAWG API key is configured. Covers are generated
// from `hue` since we can't ship official artwork.
interface DemoEntry {
  slug: string;
  name: string;
  released: string;
  genres: string[];
  platforms: string[];
  developer: string;
  description: string;
  hue: number;
}

const ENTRIES: DemoEntry[] = [
  { slug: 'zelda-botw', name: 'The Legend of Zelda: Breath of the Wild', released: '2017-03-03', genres: ['Aventura', 'Mundo abierto'], platforms: ['Nintendo Switch', 'Wii U'], developer: 'Nintendo', description: 'Link despierta en un Hyrule en ruinas y tiene total libertad para explorarlo.', hue: 150 },
  { slug: 'zelda-totk', name: 'The Legend of Zelda: Tears of the Kingdom', released: '2023-05-12', genres: ['Aventura', 'Mundo abierto'], platforms: ['Nintendo Switch'], developer: 'Nintendo', description: 'Secuela de Breath of the Wild que suma islas en el cielo y construcción libre.', hue: 170 },
  { slug: 'elden-ring', name: 'Elden Ring', released: '2022-02-25', genres: ['RPG', 'Acción'], platforms: ['PlayStation 5', 'Xbox Series S/X', 'PC'], developer: 'FromSoftware', description: 'Un RPG de acción en mundo abierto creado junto a George R. R. Martin.', hue: 40 },
  { slug: 'hollow-knight', name: 'Hollow Knight', released: '2017-02-24', genres: ['Metroidvania', 'Indie'], platforms: ['PC', 'Nintendo Switch', 'PlayStation 4'], developer: 'Team Cherry', description: 'Explorá el reino subterráneo de Hallownest en este metroidvania dibujado a mano.', hue: 220 },
  { slug: 'hades', name: 'Hades', released: '2020-09-17', genres: ['Roguelike', 'Acción'], platforms: ['PC', 'Nintendo Switch', 'PlayStation 5'], developer: 'Supergiant Games', description: 'Zagreus intenta escapar del inframundo una y otra vez.', hue: 0 },
  { slug: 'god-of-war-2018', name: 'God of War', released: '2018-04-20', genres: ['Acción', 'Aventura'], platforms: ['PlayStation 4', 'PC'], developer: 'Santa Monica Studio', description: 'Kratos y su hijo Atreus emprenden un viaje por los reinos nórdicos.', hue: 200 },
  { slug: 'rdr2', name: 'Red Dead Redemption 2', released: '2018-10-26', genres: ['Acción', 'Mundo abierto'], platforms: ['PlayStation 4', 'Xbox One', 'PC'], developer: 'Rockstar Games', description: 'Arthur Morgan y la banda de Van der Linde en el ocaso del Lejano Oeste.', hue: 10 },
  { slug: 'witcher-3', name: 'The Witcher 3: Wild Hunt', released: '2015-05-18', genres: ['RPG', 'Mundo abierto'], platforms: ['PC', 'PlayStation 4', 'Xbox One', 'Nintendo Switch'], developer: 'CD Projekt Red', description: 'Geralt de Rivia busca a Ciri mientras la Cacería Salvaje la persigue.', hue: 0 },
  { slug: 'baldurs-gate-3', name: "Baldur's Gate 3", released: '2023-08-03', genres: ['RPG', 'Estrategia'], platforms: ['PC', 'PlayStation 5', 'Xbox Series S/X'], developer: 'Larian Studios', description: 'Un RPG basado en Dungeons & Dragons donde cada decisión importa.', hue: 280 },
  { slug: 'celeste', name: 'Celeste', released: '2018-01-25', genres: ['Plataformas', 'Indie'], platforms: ['PC', 'Nintendo Switch', 'PlayStation 4'], developer: 'Maddy Makes Games', description: 'Ayudá a Madeline a escalar la montaña Celeste.', hue: 320 },
  { slug: 'stardew-valley', name: 'Stardew Valley', released: '2016-02-26', genres: ['Simulación', 'Indie'], platforms: ['PC', 'Nintendo Switch', 'PlayStation 4', 'iOS', 'Android'], developer: 'ConcernedApe', description: 'Heredaste la granja de tu abuelo. Es hora de empezar una nueva vida.', hue: 100 },
  { slug: 'minecraft', name: 'Minecraft', released: '2011-11-18', genres: ['Sandbox', 'Supervivencia'], platforms: ['PC', 'PlayStation 4', 'Xbox One', 'Nintendo Switch'], developer: 'Mojang', description: 'Construí, explorá y sobreviví en un mundo de bloques infinito.', hue: 110 },
  { slug: 'portal-2', name: 'Portal 2', released: '2011-04-18', genres: ['Puzzle', 'Shooter'], platforms: ['PC', 'PlayStation 3', 'Xbox 360'], developer: 'Valve', description: 'Volvé a Aperture Science con la pistola de portales y GLaDOS.', hue: 25 },
  { slug: 'half-life-2', name: 'Half-Life 2', released: '2004-11-16', genres: ['Shooter'], platforms: ['PC', 'Xbox 360'], developer: 'Valve', description: 'Gordon Freeman llega a City 17 para enfrentar a la Alianza.', hue: 30 },
  { slug: 'mario-odyssey', name: 'Super Mario Odyssey', released: '2017-10-27', genres: ['Plataformas'], platforms: ['Nintendo Switch'], developer: 'Nintendo', description: 'Mario y Cappy recorren reinos para rescatar a Peach.', hue: 355 },
  { slug: 'mario-galaxy', name: 'Super Mario Galaxy', released: '2007-11-01', genres: ['Plataformas'], platforms: ['Wii'], developer: 'Nintendo', description: 'Saltá entre planetoides en esta aventura espacial.', hue: 250 },
  { slug: 'last-of-us', name: 'The Last of Us Part I', released: '2022-09-02', genres: ['Acción', 'Aventura'], platforms: ['PlayStation 5', 'PC'], developer: 'Naughty Dog', description: 'Joel y Ellie atraviesan unos Estados Unidos devastados.', hue: 90 },
  { slug: 'last-of-us-2', name: 'The Last of Us Part II', released: '2020-06-19', genres: ['Acción', 'Aventura'], platforms: ['PlayStation 4', 'PlayStation 5'], developer: 'Naughty Dog', description: 'Ellie emprende un viaje de venganza en Seattle.', hue: 60 },
  { slug: 'gta-v', name: 'Grand Theft Auto V', released: '2013-09-17', genres: ['Acción', 'Mundo abierto'], platforms: ['PC', 'PlayStation 5', 'Xbox Series S/X'], developer: 'Rockstar North', description: 'Tres criminales muy distintos en Los Santos.', hue: 140 },
  { slug: 'cyberpunk-2077', name: 'Cyberpunk 2077', released: '2020-12-10', genres: ['RPG', 'Shooter'], platforms: ['PC', 'PlayStation 5', 'Xbox Series S/X'], developer: 'CD Projekt Red', description: 'Mercenario en Night City, con un chip que contiene a Johnny Silverhand.', hue: 55 },
  { slug: 'disco-elysium', name: 'Disco Elysium', released: '2019-10-15', genres: ['RPG'], platforms: ['PC', 'PlayStation 5', 'Nintendo Switch'], developer: 'ZA/UM', description: 'Un detective amnésico resuelve un asesinato en Revachol.', hue: 15 },
  { slug: 'outer-wilds', name: 'Outer Wilds', released: '2019-05-28', genres: ['Aventura', 'Exploración'], platforms: ['PC', 'PlayStation 4', 'Xbox One'], developer: 'Mobius Digital', description: 'Un sistema solar atrapado en un bucle de 22 minutos.', hue: 30 },
  { slug: 'sekiro', name: 'Sekiro: Shadows Die Twice', released: '2019-03-22', genres: ['Acción'], platforms: ['PC', 'PlayStation 4', 'Xbox One'], developer: 'FromSoftware', description: 'Un shinobi en el Japón de la era Sengoku.', hue: 5 },
  { slug: 'bloodborne', name: 'Bloodborne', released: '2015-03-24', genres: ['RPG', 'Acción'], platforms: ['PlayStation 4'], developer: 'FromSoftware', description: 'Cazá bestias en la ciudad gótica de Yharnam.', hue: 340 },
  { slug: 'persona-5', name: 'Persona 5 Royal', released: '2020-03-31', genres: ['RPG', 'JRPG'], platforms: ['PlayStation 4', 'PC', 'Nintendo Switch'], developer: 'Atlus', description: 'Estudiantes de día, Ladrones Fantasma de noche.', hue: 350 },
  { slug: 'ff7-rebirth', name: 'Final Fantasy VII Rebirth', released: '2024-02-29', genres: ['RPG', 'Acción'], platforms: ['PlayStation 5', 'PC'], developer: 'Square Enix', description: 'Cloud y compañía dejan Midgar en esta segunda parte del remake.', hue: 200 },
  { slug: 'astro-bot', name: 'Astro Bot', released: '2024-09-06', genres: ['Plataformas'], platforms: ['PlayStation 5'], developer: 'Team Asobi', description: 'Astro recorre galaxias para rescatar a su tripulación.', hue: 210 },
  { slug: 'balatro', name: 'Balatro', released: '2024-02-20', genres: ['Cartas', 'Roguelike'], platforms: ['PC', 'Nintendo Switch', 'PlayStation 5', 'iOS'], developer: 'LocalThunk', description: 'Un roguelike de póker con comodines que rompen las reglas.', hue: 0 },
  { slug: 'hollow-knight-silksong', name: 'Hollow Knight: Silksong', released: '2025-09-04', genres: ['Metroidvania', 'Indie'], platforms: ['PC', 'Nintendo Switch', 'PlayStation 5'], developer: 'Team Cherry', description: 'Hornet escala un reino nuevo gobernado por la seda y la canción.', hue: 345 },
  { slug: 'clair-obscur', name: 'Clair Obscur: Expedition 33', released: '2025-04-24', genres: ['RPG'], platforms: ['PC', 'PlayStation 5', 'Xbox Series S/X'], developer: 'Sandfall Interactive', description: 'Una expedición para detener a la Pintora antes de que vuelva a pintar un número.', hue: 30 },
  { slug: 'fifa-world', name: 'EA Sports FC 25', released: '2024-09-27', genres: ['Deportes'], platforms: ['PlayStation 5', 'Xbox Series S/X', 'PC'], developer: 'EA Vancouver', description: 'Fútbol con licencias oficiales y modo Carrera.', hue: 160 },
  { slug: 'doom-eternal', name: 'DOOM Eternal', released: '2020-03-20', genres: ['Shooter'], platforms: ['PC', 'PlayStation 4', 'Xbox One'], developer: 'id Software', description: 'El Slayer vuelve para arrasar con el infierno en la Tierra.', hue: 15 },
];

function coverSvg(e: { hue: number }): string {
  return generatedCover(e.hue);
}

/** Gradient placeholder cover for demo items (no official artwork can be bundled). */
export function generatedCover(hue: number): string {
  const a = `hsl(${hue} 70% 45%)`;
  const b = `hsl(${(hue + 40) % 360} 60% 14%)`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400"><defs><linearGradient id="g" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient><radialGradient id="r" cx="0.8" cy="0.15" r="0.7"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="300" height="400" fill="url(#g)"/><rect width="300" height="400" fill="url(#r)"/><circle cx="240" cy="330" r="120" fill="#000" opacity=".18"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const DEMO_GAMES: GameDetail[] = ENTRIES.map((e) => ({
  id: `demo:${e.slug}`,
  name: e.name,
  cover: coverSvg(e),
  released: e.released,
  genres: e.genres,
  platforms: e.platforms,
  description: e.description,
  developers: [e.developer],
  publishers: [],
  metacritic: null,
  playtime: null,
  website: null,
  screenshots: [],
}));

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function demoSearch(query: string): GameDetail[] {
  const q = normalize(query.trim());
  return DEMO_GAMES.filter((g) => normalize(g.name).includes(q) || g.genres.some((x) => normalize(x).includes(q)));
}
