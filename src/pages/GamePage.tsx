import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, ExternalLink, ListPlus, Loader2, Pencil, Play, Star } from 'lucide-react';
import TiltedCard from '../components/reactbits/TiltedCard';
import RatingSheet from '../components/RatingSheet';
import ScrollRow from '../components/ScrollRow';
import ListPickerSheet from '../components/ListPickerSheet';
import { ScoreRing, TierChip } from '../components/Score';
import { gameDetail, effectiveKey, seriesGames } from '../lib/catalog';
import GameRail from '../components/GameRail';
import { useIsDesktop } from '../lib/useMedia';
import { resizeImage } from '../lib/rawg';
import { daysBetween, formatDate, formatHours, year } from '../lib/format';
import { STATUSES } from '../lib/tiers';
import type { Game, GameDetail } from '../lib/types';
import { NEXT_LIST_ID, PLAYING_LIST_ID, useStore } from '../store/useStore';
import { useToast } from '../store/useToast';

export default function GamePage() {
  const { id = '' } = useParams();
  const gameId = decodeURIComponent(id);
  const navigate = useNavigate();
  const key = effectiveKey(useStore((s) => s.apiKey));
  const snapshot = useStore((s) => s.games[gameId]);
  const rating = useStore((s) => s.ratings[gameId]);
  const lists = useStore((s) => s.lists);
  const addToList = useStore((s) => s.addToList);
  const removeFromList = useStore((s) => s.removeFromList);
  const toast = useToast((s) => s.show);

  const [detail, setDetail] = useState<GameDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rateOpen, setRateOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [series, setSeries] = useState<Game[] | null>(null);
  const isDesktop = useIsDesktop();

  useEffect(() => {
    const ctrl = new AbortController();
    setSeries(null);
    seriesGames(key, gameId, ctrl.signal)
      .then(setSeries)
      // The series row is a bonus: if it fails, just don't show it.
      .catch(() => !ctrl.signal.aborted && setSeries([]));
    return () => ctrl.abort();
  }, [gameId, key]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    gameDetail(key, gameId)
      .then((d) => alive && setDetail(d))
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [gameId, key]);

  const game: Game | null = detail ?? snapshot ?? null;

  if (!game) {
    return (
      <div className="pt-safe flex min-h-[60dvh] flex-col items-center justify-center gap-3 px-5 text-muted">
        {loading ? <Loader2 className="animate-spin" /> : <p>{error ?? 'No encontramos este juego.'}</p>}
        <button onClick={() => navigate(-1)} className="text-sm text-accent">
          Volver
        </button>
      </div>
    );
  }

  const playing = lists.find((l) => l.id === PLAYING_LIST_ID)?.gameIds.includes(game.id) ?? false;
  const inLists = lists.filter((l) => l.gameIds.includes(game.id));
  const generatedCover = !game.cover || game.cover.startsWith('data:');
  const coverSrc = game.cover?.startsWith('data:') ? game.cover : (resizeImage(game.cover, 640) ?? undefined);

  const togglePlaying = () => {
    if (playing) {
      removeFromList(PLAYING_LIST_ID, game.id);
      toast('Quitado de Jugando ahora');
    } else {
      addToList(PLAYING_LIST_ID, game);
      removeFromList(NEXT_LIST_ID, game.id);
      toast('Agregado a Jugando ahora');
    }
  };

  const meta = [year(game.released), detail?.developers[0]].filter(Boolean).join(' · ');
  const took = rating?.startedAt && rating.finishedAt ? daysBetween(rating.startedAt, rating.finishedAt) : null;
  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate('/'));
  const coverSize = isDesktop ? { w: 300, h: 400 } : { w: 200, h: 266 };

  const cover = (
    <TiltedCard
      imageSrc={coverSrc}
      altText={game.name}
      containerWidth={coverSize.w}
      containerHeight={coverSize.h}
      imageWidth={coverSize.w}
      imageHeight={coverSize.h}
      rotateAmplitude={12}
      scaleOnHover={1.04}
      radius={isDesktop ? 22 : 18}
      showTooltip={false}
    >
      {generatedCover && (
        <div className="absolute inset-0 flex items-end p-4 text-left">
          <span className="font-display text-xl leading-tight font-bold drop-shadow-lg">{game.name}</span>
        </div>
      )}
    </TiltedCard>
  );

  const chips = (
    <>
      {game.genres.slice(0, 4).map((g) => (
        <span key={g} className="rounded-full bg-white/8 px-2.5 py-1 text-xs text-white/80">
          {g}
        </span>
      ))}
      {detail?.metacritic != null && (
        <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-semibold text-emerald-300">
          Metacritic {detail.metacritic}
        </span>
      )}
    </>
  );

  const ratingBlock = rating ? (
    <button
      onClick={() => setRateOpen(true)}
      className="flex w-full items-center gap-4 rounded-3xl border border-line bg-surface p-4 text-left transition hover:border-white/20"
    >
      <ScoreRing score={rating.score} size={76} stroke={7} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold tracking-wider text-muted uppercase">Tu puntaje</p>
        <div className="mt-1.5">
          <TierChip tier={rating.tier} />
        </div>
        <p className="mt-1.5 truncate text-xs text-muted">
          {[
            STATUSES.find((s) => s.id === rating.status)?.label,
            rating.platform,
            rating.hours != null ? formatHours(rating.hours) : null,
            formatDate(rating.finishedAt),
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {(took != null || rating.replay) && (
          <p className="mt-0.5 truncate text-xs text-muted">
            {[
              took != null && took >= 0 ? `Le dedicaste ${took === 0 ? 'un día' : `${took + 1} días`}` : null,
              rating.replay ? REPLAY_LABEL[rating.replay] : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
      </div>
      <Pencil size={18} className="text-muted" />
    </button>
  ) : (
    <button
      onClick={() => setRateOpen(true)}
      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-pink-500 py-4 font-display text-base font-bold shadow-lg shadow-violet-500/20 transition hover:brightness-110 active:scale-[.98]"
    >
      <Star size={18} fill="currentColor" /> Puntuar este juego
    </button>
  );

  const note = rating?.note && <p className="mt-3 rounded-2xl bg-surface px-4 py-3 text-sm text-white/80 italic">“{rating.note}”</p>;

  const actions = (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <button
        onClick={togglePlaying}
        className={`flex items-center justify-center gap-2 rounded-2xl border py-3 text-sm font-semibold transition ${playing ? 'border-accent/50 bg-accent/15 text-accent' : 'border-line bg-surface hover:border-white/20'}`}
      >
        {playing ? <Check size={16} /> : <Play size={16} />} {playing ? 'Jugando' : 'Estoy jugando'}
      </button>
      <button
        onClick={() => setListOpen(true)}
        className="flex items-center justify-center gap-2 rounded-2xl border border-line bg-surface py-3 text-sm font-semibold transition hover:border-white/20"
      >
        <ListPlus size={16} /> {inLists.length ? `En ${inLists.length} lista${inLists.length > 1 ? 's' : ''}` : 'A una lista'}
      </button>
    </div>
  );

  const description = detail?.description && (
    <section className="mt-7">
      <h2 className="mb-2 font-display text-lg font-bold">Sobre el juego</h2>
      <p
        className={`text-sm leading-relaxed whitespace-pre-line text-white/75 lg:text-[15px] ${expanded ? '' : isDesktop ? 'line-clamp-[9]' : 'line-clamp-5'}`}
      >
        {detail.description}
      </p>
      {detail.description.length > (isDesktop ? 700 : 280) && (
        <button onClick={() => setExpanded(!expanded)} className="mt-1 text-sm font-semibold text-accent">
          {expanded ? 'Ver menos' : 'Ver más'}
        </button>
      )}
    </section>
  );

  const platforms = game.platforms.length > 0 && (
    <section className="mt-7">
      <h2 className="mb-2 font-display text-lg font-bold">Plataformas</h2>
      <p className="text-sm text-white/75">{game.platforms.join(', ')}</p>
    </section>
  );

  const info = detail && (detail.playtime || detail.publishers.length > 0 || detail.website) && (
    <dl className="mt-7 grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
      {detail.playtime && <Info label="Duración promedio" value={`${detail.playtime} h`} />}
      {detail.publishers[0] && <Info label="Distribuye" value={detail.publishers[0]} />}
      {detail.released && <Info label="Lanzamiento" value={formatDate(detail.released)} />}
      {detail.website && (
        <a href={detail.website} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-accent">
          Sitio oficial <ExternalLink size={14} />
        </a>
      )}
    </dl>
  );

  const screenshots = detail && detail.screenshots.length > 0 && (
    <section className="mt-7">
      <h2 className="mb-3 font-display text-lg font-bold">Capturas</h2>
      {isDesktop ? (
        <div className="grid grid-cols-3 gap-3">
          {detail.screenshots.slice(0, 6).map((s) => (
            <img key={s} src={resizeImage(s, 640) ?? s} alt="" loading="lazy" className="aspect-video w-full rounded-2xl object-cover" />
          ))}
        </div>
      ) : (
        <ScrollRow className="-mx-5 flex gap-3 px-5">
          {detail.screenshots.map((s) => (
            <img key={s} src={resizeImage(s, 640) ?? s} alt="" loading="lazy" className="aspect-video w-72 shrink-0 rounded-2xl object-cover" />
          ))}
        </ScrollRow>
      )}
    </section>
  );

  // Hidden until loaded: most games have no series, so no skeleton flash.
  const seriesRail = <GameRail title="De la misma saga" subtitle="Ordenados por fecha de salida" games={series ?? []} />;

  const sheets = (
    <>
      <RatingSheet game={game} open={rateOpen} onClose={() => setRateOpen(false)} avgHours={detail?.playtime} />
      <ListPickerSheet game={game} open={listOpen} onClose={() => setListOpen(false)} />
    </>
  );

  if (isDesktop) {
    const wide = game.cover?.startsWith('data:') ? game.cover : (resizeImage(game.cover, 1280) ?? undefined);
    return (
      <div className="pb-6">
        <div className="relative -mx-6 h-[360px] overflow-hidden">
          {wide && <img src={wide} alt="" className="h-full w-full scale-110 object-cover opacity-45 blur-md" />}
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/50 to-bg/10" />
          <div className="absolute inset-0 bg-gradient-to-r from-bg/80 to-transparent" />
          <button
            onClick={goBack}
            aria-label="Volver"
            className="absolute top-6 left-6 flex items-center gap-2 rounded-full bg-black/40 py-2 pr-4 pl-3 text-sm font-semibold backdrop-blur transition hover:bg-black/60"
          >
            <ArrowLeft size={18} /> Volver
          </button>
        </div>

        <div className="relative -mt-[250px] grid grid-cols-[300px_1fr] gap-12">
          <div>
            {cover}
            <div className="mt-6">
              {ratingBlock}
              {note}
              {actions}
            </div>
          </div>
          <div className="min-w-0 pt-28">
            <h1 className="font-display text-5xl leading-[1.05] font-bold tracking-tight">{game.name}</h1>
            {meta && <p className="mt-3 text-lg text-white/70">{meta}</p>}
            <div className="mt-4 flex flex-wrap gap-1.5">{chips}</div>
            {description}
            {info}
            {platforms}
          </div>
        </div>

        <div className="-mx-5">{seriesRail}</div>
        {screenshots}
        {sheets}
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
        <div className="absolute inset-0 h-[420px] overflow-hidden">
          {coverSrc && <img src={coverSrc} alt="" className="h-full w-full scale-125 object-cover opacity-50 blur-3xl" />}
          <div className="absolute inset-0 bg-gradient-to-b from-bg/30 via-bg/60 to-bg" />
        </div>

        <div className="pt-safe relative px-4">
          <button onClick={goBack} aria-label="Volver" className="mt-4 rounded-full bg-black/40 p-2.5 backdrop-blur">
            <ArrowLeft size={20} />
          </button>
        </div>

        <div className="relative flex flex-col items-center px-5 pt-2 text-center">
          {cover}
          <h1 className="mt-5 font-display text-2xl leading-tight font-bold tracking-tight">{game.name}</h1>
          {meta && <p className="mt-1 text-sm text-muted">{meta}</p>}
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">{chips}</div>
        </div>
      </div>

      <div className="relative mt-6 px-5">
        {ratingBlock}
        {note}
        {actions}
      </div>

      {seriesRail}

      <div className="px-5">
        {description}
        {screenshots}
        {platforms}
        {info}
      </div>

      {sheets}
    </div>
  );
}

const REPLAY_LABEL = { si: 'Lo volvería a jugar', quizas: 'Quizás lo vuelva a jugar', no: 'No lo volvería a jugar' } as const;

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface px-4 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
