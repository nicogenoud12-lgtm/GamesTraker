import type { GameDetail } from '../lib/types';
import type { ScreenKind } from '../lib/mode';
import { generatedCover } from './demo';

// Offline series & movies used until a TMDB key is configured.
interface Entry {
  slug: string;
  kind: ScreenKind;
  name: string;
  released: string;
  genres: string[];
  by: string;
  description: string;
  hue: number;
  saga?: string;
}

const ENTRIES: Entry[] = [
  { slug: 'breaking-bad', kind: 'tv', name: 'Breaking Bad', released: '2008-01-20', genres: ['Drama', 'Crimen'], by: 'Vince Gilligan', description: 'Un profesor de química con cáncer empieza a fabricar metanfetamina para asegurar el futuro de su familia.', hue: 100, saga: 'bb' },
  { slug: 'better-call-saul', kind: 'tv', name: 'Better Call Saul', released: '2015-02-08', genres: ['Drama', 'Crimen'], by: 'Vince Gilligan', description: 'La transformación de Jimmy McGill en el abogado Saul Goodman.', hue: 30, saga: 'bb' },
  { slug: 'the-office', kind: 'tv', name: 'The Office', released: '2005-03-24', genres: ['Comedia'], by: 'Greg Daniels', description: 'El día a día de una oficina de venta de papel en Scranton, filmado como documental.', hue: 210 },
  { slug: 'succession', kind: 'tv', name: 'Succession', released: '2018-06-03', genres: ['Drama'], by: 'Jesse Armstrong', description: 'Los hijos de un magnate de los medios se pelean por el control del imperio familiar.', hue: 45 },
  { slug: 'severance', kind: 'tv', name: 'Severance', released: '2022-02-17', genres: ['Drama', 'Misterio', 'Ciencia ficción y fantasía'], by: 'Dan Erickson', description: 'Empleados que separaron quirúrgicamente sus recuerdos del trabajo de los de su vida.', hue: 190 },
  { slug: 'dark', kind: 'tv', name: 'Dark', released: '2017-12-01', genres: ['Drama', 'Misterio', 'Ciencia ficción y fantasía'], by: 'Baran bo Odar', description: 'La desaparición de un chico revela los secretos de cuatro familias de un pueblo alemán.', hue: 260 },
  { slug: 'chernobyl', kind: 'tv', name: 'Chernobyl', released: '2019-05-06', genres: ['Drama', 'Historia'], by: 'Craig Mazin', description: 'La historia del desastre nuclear de 1986 y de quienes lo enfrentaron.', hue: 80 },
  { slug: 'the-last-of-us', kind: 'tv', name: 'The Last of Us', released: '2023-01-15', genres: ['Drama', 'Acción y aventura'], by: 'Craig Mazin', description: 'Joel y Ellie cruzan unos Estados Unidos devastados por una pandemia de hongos.', hue: 120 },
  { slug: 'stranger-things', kind: 'tv', name: 'Stranger Things', released: '2016-07-15', genres: ['Drama', 'Misterio', 'Ciencia ficción y fantasía'], by: 'The Duffer Brothers', description: 'Un grupo de chicos de Hawkins enfrenta fuerzas sobrenaturales en los años 80.', hue: 350 },
  { slug: 'el-encargado', kind: 'tv', name: 'El encargado', released: '2022-05-11', genres: ['Comedia', 'Drama'], by: 'Mariano Cohn y Gastón Duprat', description: 'Eliseo, encargado de un edificio de Buenos Aires, hace lo que sea para no perder su puesto.', hue: 20 },
  { slug: 'el-padrino', kind: 'movie', name: 'El padrino', released: '1972-03-24', genres: ['Drama', 'Crimen'], by: 'Francis Ford Coppola', description: 'El patriarca de la familia Corleone le pasa el control de su imperio a su hijo menos pensado.', hue: 15, saga: 'padrino' },
  { slug: 'el-padrino-2', kind: 'movie', name: 'El padrino: Parte II', released: '1974-12-20', genres: ['Drama', 'Crimen'], by: 'Francis Ford Coppola', description: 'Michael Corleone consolida su poder mientras se cuenta el ascenso de su padre.', hue: 25, saga: 'padrino' },
  { slug: 'interstellar', kind: 'movie', name: 'Interstellar', released: '2014-11-05', genres: ['Ciencia ficción', 'Drama', 'Aventura'], by: 'Christopher Nolan', description: 'Un grupo de exploradores viaja por un agujero de gusano para salvar a la humanidad.', hue: 220 },
  { slug: 'el-origen', kind: 'movie', name: 'El origen', released: '2010-07-15', genres: ['Acción', 'Ciencia ficción'], by: 'Christopher Nolan', description: 'Un ladrón que roba secretos a través de los sueños recibe un último encargo.', hue: 200 },
  { slug: 'parasite', kind: 'movie', name: 'Parásitos', released: '2019-05-30', genres: ['Comedia', 'Suspenso', 'Drama'], by: 'Bong Joon-ho', description: 'Una familia pobre se infiltra, de a uno, en la casa de una familia rica.', hue: 140 },
  { slug: 'dune-2', kind: 'movie', name: 'Dune: Parte dos', released: '2024-02-27', genres: ['Ciencia ficción', 'Aventura'], by: 'Denis Villeneuve', description: 'Paul Atreides se une a los Fremen para vengarse de quienes destruyeron a su familia.', hue: 35 },
  { slug: 'oppenheimer', kind: 'movie', name: 'Oppenheimer', released: '2023-07-19', genres: ['Drama', 'Historia'], by: 'Christopher Nolan', description: 'La historia del físico que dirigió la creación de la bomba atómica.', hue: 10 },
  { slug: 'relatos-salvajes', kind: 'movie', name: 'Relatos salvajes', released: '2014-08-21', genres: ['Comedia', 'Suspenso', 'Drama'], by: 'Damián Szifron', description: 'Seis historias de gente que pierde el control y termina haciendo justicia por mano propia.', hue: 0 },
  { slug: 'el-secreto-de-sus-ojos', kind: 'movie', name: 'El secreto de sus ojos', released: '2009-08-13', genres: ['Drama', 'Crimen', 'Misterio'], by: 'Juan José Campanella', description: 'Un empleado judicial retirado escribe una novela sobre un caso que nunca pudo olvidar.', hue: 50 },
  { slug: 'el-viaje-de-chihiro', kind: 'movie', name: 'El viaje de Chihiro', released: '2001-07-20', genres: ['Animación', 'Fantasía', 'Familia'], by: 'Hayao Miyazaki', description: 'Una nena queda atrapada en un mundo de espíritus y tiene que salvar a sus padres.', hue: 170 },
  { slug: 'pulp-fiction', kind: 'movie', name: 'Tiempos violentos', released: '1994-09-10', genres: ['Crimen', 'Suspenso'], by: 'Quentin Tarantino', description: 'Historias cruzadas de gánsteres, boxeadores y ladrones en Los Ángeles.', hue: 55 },
  { slug: 'batman-dark-knight', kind: 'movie', name: 'Batman: El caballero de la noche', released: '2008-07-16', genres: ['Acción', 'Crimen', 'Drama'], by: 'Christopher Nolan', description: 'Batman enfrenta al Guasón, que quiere sumir a Ciudad Gótica en el caos.', hue: 230 },
];

export const DEMO_SCREEN: (GameDetail & { saga?: string })[] = ENTRIES.map((e) => ({
  id: `dscr:${e.kind}:${e.slug}`,
  name: e.name,
  cover: generatedCover(e.hue),
  released: e.released,
  genres: e.genres,
  platforms: [],
  description: e.description,
  developers: [e.by],
  publishers: [],
  metacritic: null,
  playtime: null,
  website: null,
  screenshots: [],
  saga: e.saga,
}));

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function demoScreenSearch(query: string): GameDetail[] {
  const q = normalize(query.trim());
  return DEMO_SCREEN.filter((g) => normalize(g.name).includes(q) || g.genres.some((x) => normalize(x).includes(q)));
}
