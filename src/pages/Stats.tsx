import { useMemo, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ColumnChart, RankBars } from '../components/Charts';
import Cover from '../components/Cover';
import ScrollRow from '../components/ScrollRow';
import { ScoreBadge, TierChip } from '../components/Score';
import { daysBetween, formatHours, shortPlatforms } from '../lib/format';
import { TIERS } from '../lib/tiers';
import type { Game, Rating } from '../lib/types';
import { useStore } from '../store/useStore';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

interface Entry {
  game: Game;
  rating: Rating;
  /** Year and month the game was finished (or rated, if no date was set). */
  year: number;
  month: number;
}

function when(r: Rating): { year: number; month: number } {
  if (r.finishedAt) return { year: Number(r.finishedAt.slice(0, 4)), month: Number(r.finishedAt.slice(5, 7)) - 1 };
  const d = new Date(r.createdAt);
  return { year: d.getFullYear(), month: d.getMonth() };
}

const average = (xs: Entry[]) => (xs.length ? Math.round(xs.reduce((n, e) => n + e.rating.score, 0) / xs.length) : 0);

function topCounts(values: string[], limit = 6): { label: string; value: number }[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, value]) => ({ label, value }));
}

export default function Stats() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const games = useStore((s) => s.games);
  const ratings = useStore((s) => s.ratings);

  const all = useMemo<Entry[]>(
    () =>
      Object.values(ratings)
        .filter((r) => games[r.gameId])
        .map((r) => ({ game: games[r.gameId], rating: r, ...when(r) })),
    [games, ratings],
  );
  const years = [...new Set(all.map((e) => e.year))].sort((a, b) => b - a);
  const yearParam = Number(params.get('anio'));
  const year = years.includes(yearParam) ? yearParam : null;
  const entries = year ? all.filter((e) => e.year === year) : all;
  const setYear = (y: number | null) => setParams(y ? { anio: String(y) } : {}, { replace: true });

  if (all.length === 0) {
    return (
      <div>
        <Header onBack={() => navigate(-1)} />
        <p className="mt-10 px-5 text-center text-muted">Puntuá algunos juegos y acá vas a ver tus estadísticas por año.</p>
      </div>
    );
  }

  const finished = entries.filter((e) => e.rating.status !== 'abandonado');
  const dropped = entries.length - finished.length;
  const best = entries.slice().sort((a, b) => b.rating.score - a.rating.score)[0];
  const tierCounts = TIERS.map((t) => ({ tier: t, n: entries.filter((e) => e.rating.tier === t.id).length }));
  const timed = entries.filter((e) => e.rating.hours != null && e.rating.hours > 0);
  const totalHours = timed.reduce((n, e) => n + (e.rating.hours ?? 0), 0);
  const longest = timed.slice().sort((a, b) => (b.rating.hours ?? 0) - (a.rating.hours ?? 0))[0];
  const fastest = finished
    .filter((e) => e.rating.startedAt && e.rating.finishedAt)
    .map((e) => ({ e, days: daysBetween(e.rating.startedAt!, e.rating.finishedAt!) + 1 }))
    .filter((x) => x.days >= 1)
    .sort((a, b) => a.days - b.days)[0];
  const replayYes = entries.filter((e) => e.rating.replay === 'si').length;
  const replayAnswered = entries.filter((e) => e.rating.replay).length;
  const platforms = topCounts(entries.map((e) => e.rating.platform).filter((p): p is string => Boolean(p)).map((p) => shortPlatforms([p], 1)));
  const genres = topCounts(entries.flatMap((e) => e.game.genres));

  return (
    <div>
      <Header onBack={() => navigate(-1)} />

      <ScrollRow className="flex gap-2 px-5 pb-4">
        <YearChip active={!year} onClick={() => setYear(null)}>
          Todos
        </YearChip>
        {years.map((y) => (
          <YearChip key={y} active={year === y} onClick={() => setYear(y)}>
            {y}
          </YearChip>
        ))}
      </ScrollRow>

      <div className="grid grid-cols-2 gap-2 px-5 sm:grid-cols-4 lg:gap-4">
        <Tile label={finished.length === 1 ? 'Terminado' : 'Terminados'} value={finished.length} />
        <Tile label="Promedio" value={average(entries)} />
        <Tile label="Horas jugadas" value={Math.round(totalHours)} />
        <Tile label="Históricos" value={entries.filter((e) => e.rating.tier === 'historico').length} />
      </div>
      {dropped > 0 && (
        <p className="mt-2 px-5 text-xs text-muted">
          + {dropped} abandonado{dropped > 1 ? 's' : ''}
        </p>
      )}

      <div className="lg:mt-2 lg:grid lg:grid-cols-2 lg:gap-x-4 lg:px-5">
      {year ? (
        <Card title={`Juegos por mes en ${year}`} wide>
          <ColumnChart
            bars={MONTHS.map((m, i) => {
              const inMonth = entries.filter((e) => e.month === i);
              return {
                key: String(i),
                label: m,
                value: inMonth.length,
                detail: inMonth.length ? `promedio ${average(inMonth)}` : undefined,
              };
            })}
          />
        </Card>
      ) : (
        years.length > 1 && (
          <Card title="Juegos por año" hint="Tocá un año para verlo en detalle" wide>
            <ColumnChart
              bars={years
                .slice()
                .reverse()
                .map((y) => {
                  const inYear = all.filter((e) => e.year === y);
                  return { key: String(y), label: String(y), value: inYear.length, detail: `promedio ${average(inYear)}` };
                })}
              onSelect={(k) => setYear(Number(k))}
            />
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="pb-1 font-medium">Año</th>
                  <th className="pb-1 text-right font-medium">Juegos</th>
                  <th className="pb-1 text-right font-medium">Promedio</th>
                </tr>
              </thead>
              <tbody>
                {years.map((y) => {
                  const inYear = all.filter((e) => e.year === y);
                  return (
                    <tr key={y} className="border-t border-white/5">
                      <td className="py-1.5">
                        <button onClick={() => setYear(y)} className="font-semibold">
                          {y}
                        </button>
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{inYear.length}</td>
                      <td className="py-1.5 text-right tabular-nums">{average(inYear)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )
      )}

      {best && (
        <Card title={year ? `El mejor de ${year}` : 'Tu mejor juego'}>
          <Link to={`/juego/${encodeURIComponent(best.game.id)}`} className="flex items-center gap-4">
            <Cover game={best.game} className="aspect-[3/4] w-20 shrink-0 rounded-xl text-[10px]" />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 font-display text-lg leading-tight font-bold">{best.game.name}</p>
              <div className="mt-2 flex items-center gap-2">
                <ScoreBadge score={best.rating.score} className="text-base" />
                <TierChip tier={best.rating.tier} size="sm" />
              </div>
            </div>
          </Link>
        </Card>
      )}

      {(timed.length > 0 || fastest || replayAnswered > 0) && (
        <Card title="Tiempo de juego">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            {timed.length > 0 && (
              <>
                <div>
                  <dt className="text-xs text-muted">Total</dt>
                  <dd className="font-display text-xl font-bold tabular-nums">{formatHours(Math.round(totalHours * 10) / 10)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Promedio por juego</dt>
                  <dd className="font-display text-xl font-bold tabular-nums">
                    {formatHours(Math.round((totalHours / timed.length) * 10) / 10)}
                  </dd>
                </div>
              </>
            )}
            {longest && (
              <div className="col-span-2">
                <dt className="text-xs text-muted">El más largo</dt>
                <dd className="truncate">
                  <Link to={`/juego/${encodeURIComponent(longest.game.id)}`} className="font-semibold hover:underline">
                    {longest.game.name}
                  </Link>{' '}
                  <span className="text-muted">· {formatHours(longest.rating.hours!)}</span>
                </dd>
              </div>
            )}
            {fastest && (
              <div className="col-span-2">
                <dt className="text-xs text-muted">El que terminaste más rápido</dt>
                <dd className="truncate">
                  <Link to={`/juego/${encodeURIComponent(fastest.e.game.id)}`} className="font-semibold hover:underline">
                    {fastest.e.game.name}
                  </Link>{' '}
                  <span className="text-muted">· {fastest.days === 1 ? 'en un día' : `en ${fastest.days} días`}</span>
                </dd>
              </div>
            )}
            {replayAnswered > 0 && (
              <div className="col-span-2">
                <dt className="text-xs text-muted">Los volverías a jugar</dt>
                <dd>
                  <span className="font-semibold tabular-nums">{replayYes}</span>
                  <span className="text-muted"> de {replayAnswered} que respondiste</span>
                </dd>
              </div>
            )}
          </dl>
        </Card>
      )}

      <Card title="Tu escala">
        <div className="flex h-3 gap-[2px] overflow-hidden rounded-full">
          {tierCounts.map(({ tier, n }) =>
            n ? <div key={tier.id} className="first:rounded-l-full last:rounded-r-full" style={{ flex: n, background: tier.color }} /> : null,
          )}
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
          {tierCounts
            .slice()
            .reverse()
            .map(({ tier, n }) => (
              <li key={tier.id} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: tier.color }} />
                <span className="text-white/80">
                  {tier.emoji} {tier.label}
                </span>
                <span className="ml-auto text-muted tabular-nums">{n}</span>
              </li>
            ))}
        </ul>
      </Card>

      {platforms.length > 0 && (
        <Card title="Plataformas">
          <RankBars rows={platforms} />
        </Card>
      )}
      {genres.length > 0 && (
        <Card title="Géneros">
          <RankBars rows={genres} />
        </Card>
      )}
      </div>
    </div>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <header className="pt-safe px-4 lg:pt-6">
      <button onClick={onBack} aria-label="Volver" className="mt-4 rounded-full bg-white/5 p-2.5 lg:hidden">
        <ArrowLeft size={20} />
      </button>
      <h1 className="mt-3 px-1 pb-4 font-display text-3xl font-bold tracking-tight lg:text-4xl">Estadísticas</h1>
    </header>
  );
}

function YearChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold tabular-nums transition ${active ? 'border-accent bg-accent/20 text-accent' : 'border-line text-muted'}`}
    >
      {children}
    </button>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-3 py-3">
      <div className="font-display text-3xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

function Card({ title, hint, wide, children }: { title: string; hint?: string; wide?: boolean; children: ReactNode }) {
  return (
    <section className={`mx-5 mt-4 rounded-3xl border border-line bg-surface p-4 lg:mx-0 lg:p-5 ${wide ? 'lg:col-span-2' : ''}`}>
      <h2 className="font-display text-base font-bold">{title}</h2>
      {hint && <p className="text-xs text-muted">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}
