import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Share2, Target } from 'lucide-react';
import Cover from '../components/Cover';
import ScrollRow from '../components/ScrollRow';
import { ScoreBadge } from '../components/Score';
import ShareSheet from '../components/ShareSheet';
import { yearCard, type YearSummary } from '../lib/cards';
import { daysBetween, formatHours, localDay } from '../lib/format';
import { kindOf, modeOf, MODES } from '../lib/mode';
import { MONTH_NAMES, topCounts, whenRated } from '../lib/stats';
import type { Game, Rating } from '../lib/types';
import { useStore } from '../store/useStore';
import { useMode } from '../store/useUi';

interface Entry {
  game: Game;
  rating: Rating;
  month: number;
}

/** Year in review for the current mode, with a yearly goal and a shareable image. */
export default function YearReview() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const mode = useMode();
  const copy = MODES[mode];
  const games = useStore((s) => s.games);
  const ratings = useStore((s) => s.ratings);
  const goals = useStore((s) => s.goals);
  const setGoal = useStore((s) => s.setGoal);
  const [shareOpen, setShareOpen] = useState(false);

  const thisYear = new Date().getFullYear();
  const all = useMemo(
    () =>
      Object.values(ratings)
        .filter((r) => games[r.gameId] && modeOf(r.gameId) === mode)
        .map((r) => ({ game: games[r.gameId], rating: r, ...whenRated(r) })),
    [games, ratings, mode],
  );
  const years = [...new Set([thisYear, ...all.map((e) => e.year)])].sort((a, b) => b - a);
  const year = Number(params.get('anio')) || thisYear;
  const entries: Entry[] = all.filter((e) => e.year === year);
  const goalKey = `${mode}-${year}`;
  const goal = goals[goalKey]?.target ?? null;

  const sorted = [...entries].sort((a, b) => b.rating.score - a.rating.score);
  const average = entries.length ? Math.round(entries.reduce((n, e) => n + e.rating.score, 0) / entries.length) : 0;
  const legendary = entries.filter((e) => e.rating.tier === 'historico').length;
  const hours = entries.reduce((n, e) => n + (e.rating.hours ?? 0), 0);
  const movies = entries.filter((e) => kindOf(e.game.id) === 'movie').length;
  const series = entries.filter((e) => kindOf(e.game.id) === 'tv').length;
  const bestMonth = topCounts(entries.map((e) => String(e.month)), 1)[0];
  const genre = topCounts(entries.flatMap((e) => e.game.genres), 1)[0];
  const platform = topCounts(entries.map((e) => e.rating.platform).filter((p): p is string => Boolean(p)), 1)[0];
  const longest = mode === 'games' ? entries.filter((e) => e.rating.hours).sort((a, b) => b.rating.hours! - a.rating.hours!)[0] : undefined;
  const first = [...entries].sort((a, b) => (a.rating.finishedAt ?? '9').localeCompare(b.rating.finishedAt ?? '9'))[0];

  const summary: YearSummary = {
    year,
    mode,
    count: entries.length,
    average,
    legendary,
    hours: hours || null,
    movies,
    series,
    goal,
    top: sorted.slice(0, 5).map((e) => ({ game: e.game, score: e.rating.score, tier: e.rating.tier })),
  };

  return (
    <div className="pb-8">
      <header className="pt-safe px-5 lg:px-0 lg:pt-8">
        <button onClick={() => navigate(-1)} aria-label="Volver" className="mt-4 rounded-full bg-white/5 p-2.5 lg:hidden">
          <ArrowLeft size={20} />
        </button>
        <p className="mt-4 text-sm text-muted">Resumen del año · {copy.label}</p>
        <h1 className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text font-display text-6xl font-bold tracking-tight text-transparent lg:text-7xl">
          Tu {year}
        </h1>
      </header>

      <ScrollRow className="mt-4 flex gap-2 px-5 lg:px-0">
        {years.map((y) => (
          <button
            key={y}
            onClick={() => setParams(y === thisYear ? {} : { anio: String(y) }, { replace: true })}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold tabular-nums transition ${y === year ? 'border-accent bg-accent/20 text-accent' : 'border-line text-muted'}`}
          >
            {y}
          </button>
        ))}
      </ScrollRow>

      <div className="lg:grid lg:grid-cols-2 lg:gap-x-6">
        <GoalCard
          key={goalKey}
          goal={goal}
          done={entries.length}
          year={year}
          current={year === thisYear}
          items={copy.items}
          onSave={(n) => setGoal(goalKey, n)}
        />

        <section className="mx-5 mt-4 grid grid-cols-2 gap-3 lg:mx-0">
          {mode === 'games' ? (
            <>
              <Stat value={entries.length} label={entries.length === 1 ? 'juego' : 'juegos'} />
              <Stat value={hours ? formatHours(Math.round(hours)) : '—'} label="jugadas" />
            </>
          ) : (
            <>
              <Stat value={movies} label={movies === 1 ? 'película' : 'películas'} />
              <Stat value={series} label={series === 1 ? 'serie' : 'series'} />
            </>
          )}
          <Stat value={average || '—'} label="promedio" />
          <Stat value={legendary} label={legendary === 1 ? 'histórico' : 'históricos'} />
        </section>
      </div>

      {entries.length === 0 ? (
        <p className="mx-5 mt-8 text-center text-muted">
          Todavía no puntuaste {mode === 'games' ? 'juegos' : 'series ni películas'} de {year}.
        </p>
      ) : (
        <>
          <section className="mt-7">
            <h2 className="mb-3 px-5 font-display text-lg font-bold lg:px-0">Tu top {Math.min(5, sorted.length)}</h2>
            <ScrollRow className="flex gap-3 px-5 lg:px-0">
              {sorted.slice(0, 5).map((e, i) => (
                <Link key={e.game.id} to={`/juego/${encodeURIComponent(e.game.id)}`} className="relative w-32 shrink-0 lg:w-40">
                  <span className="absolute top-1.5 left-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-accent font-display text-sm font-bold text-black shadow-lg">
                    {i + 1}
                  </span>
                  <Cover game={e.game} className="aspect-[3/4] rounded-2xl text-xs" />
                  <span className="absolute top-1.5 right-1.5 rounded-lg bg-black/75 backdrop-blur">
                    <ScoreBadge score={e.rating.score} />
                  </span>
                  <p className="mt-1.5 line-clamp-2 text-sm leading-tight font-medium">{e.game.name}</p>
                </Link>
              ))}
            </ScrollRow>
          </section>

          <section className="mx-5 mt-6 grid gap-3 lg:mx-0 lg:grid-cols-2">
            {bestMonth && (
              <Fact label="Tu mes más activo">
                {MONTH_NAMES[Number(bestMonth.label)]} · {bestMonth.value} {bestMonth.value === 1 ? copy.item : copy.items}
              </Fact>
            )}
            {genre && <Fact label="Tu género del año">{genre.label}</Fact>}
            {platform && <Fact label={mode === 'games' ? 'Donde más jugaste' : 'Donde más viste'}>{platform.label}</Fact>}
            {longest && (
              <Fact label="El que más horas te llevó">
                {longest.game.name} · {formatHours(longest.rating.hours!)}
              </Fact>
            )}
            {first?.rating.finishedAt && <Fact label={`El primero de ${year}`}>{first.game.name}</Fact>}
          </section>
        </>
      )}

      <div className="mx-5 mt-8 lg:mx-0 lg:max-w-sm">
        <button
          onClick={() => setShareOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-accent to-accent-2 py-3.5 font-display font-bold text-black"
        >
          <Share2 size={18} /> Compartir mi {year}
        </button>
      </div>

      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title={`Mi ${year}`}
        filename={`mi-${year}-${mode === 'games' ? 'juegos' : 'series-y-pelis'}.png`}
        render={() => yearCard(summary)}
      />
    </div>
  );
}

function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="rounded-3xl border border-line bg-surface px-4 py-4">
      <div className="font-display text-4xl font-bold tabular-nums">{value}</div>
      <div className="text-sm text-muted">{label}</div>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-3">
      <p className="text-xs font-semibold tracking-wider text-muted uppercase">{label}</p>
      <p className="mt-0.5 font-semibold first-letter:uppercase">{children}</p>
    </div>
  );
}

interface GoalProps {
  goal: number | null;
  done: number;
  year: number;
  current: boolean;
  items: string;
  onSave: (n: number) => void;
}

/** Yearly goal with a progress bar; this year's also says whether you're ahead or behind. */
function GoalCard({ goal, done, year, current, items, onSave }: GoalProps) {
  const [editing, setEditing] = useState(goal == null && current);
  const [value, setValue] = useState(String(goal ?? ''));
  const save = () => {
    const n = Math.round(Number(value));
    if (n > 0 && n <= 1000) {
      onSave(n);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <section className="mx-5 mt-5 rounded-3xl border border-accent/30 bg-accent/10 p-4 lg:mx-0">
        <p className="flex items-center gap-2 font-semibold">
          <Target size={18} className="text-accent" /> ¿Cuántos {items} querés terminar en {year}?
        </p>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={1000}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Ej: 24"
            aria-label="Meta del año"
            className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2"
          />
          <button type="submit" className="rounded-xl bg-accent px-4 font-semibold text-black">
            Guardar
          </button>
        </form>
      </section>
    );
  }
  if (goal == null) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="mx-5 mt-5 flex w-[calc(100%-2.5rem)] items-center gap-2 rounded-3xl border border-dashed border-line p-4 text-left text-sm text-muted lg:mx-0 lg:w-full"
      >
        <Target size={18} className="text-accent" /> Ponerte una meta para {year}
      </button>
    );
  }

  const pct = Math.min(1, done / goal);
  // Where you "should" be today if the goal were spread evenly over the year.
  const dayOfYear = daysBetween(`${year}-01-01`, localDay()) + 1;
  const expected = Math.floor((goal * dayOfYear) / (year % 4 === 0 ? 366 : 365));
  const pace = !current
    ? done >= goal
      ? '¡Meta cumplida!'
      : `Terminaste ${done} de ${goal}`
    : done >= goal
      ? '¡Meta cumplida! 🎉'
      : done > expected
        ? `Vas ${done - expected} adelante del ritmo`
        : done < expected
          ? `Vas ${expected - done} atrás del ritmo`
          : 'Vas justo al ritmo';
  return (
    <section className="mx-5 mt-5 rounded-3xl border border-line bg-surface p-4 lg:mx-0">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-semibold">
          <Target size={18} className="text-accent" /> Meta {year}
        </p>
        <button onClick={() => setEditing(true)} aria-label="Cambiar meta" className="rounded-full p-1.5 text-muted hover:text-white">
          <Pencil size={16} />
        </button>
      </div>
      <p className="mt-2 font-display text-3xl font-bold tabular-nums">
        {done} <span className="text-lg text-muted">de {goal} {items}</span>
      </p>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/5">
        <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2 transition-all" style={{ width: `${pct * 100}%` }} />
      </div>
      <p className="mt-2 text-sm text-muted">{pace}</p>
    </section>
  );
}
