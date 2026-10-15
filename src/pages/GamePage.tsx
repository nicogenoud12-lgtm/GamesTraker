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
import { resizeImage } from '../lib/rawg';
import { formatDate, year } from '../lib/format';
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

  return (
    <div>
      <div className="relative">
        <div className="absolute inset-0 h-[420px] overflow-hidden">
          {coverSrc && <img src={coverSrc} alt="" className="h-full w-full scale-125 object-cover opacity-50 blur-3xl" />}
          <div className="absolute inset-0 bg-gradient-to-b from-bg/30 via-bg/60 to-bg" />
        </div>

        <div className="pt-safe relative px-4">
          <button
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
            aria-label="Volver"
            className="mt-4 rounded-full bg-black/40 p-2.5 backdrop-blur"
          >
            <ArrowLeft size={20} />
          </button>
        </div>

        <div className="relative flex flex-col items-center px-5 pt-2 text-center">
          <TiltedCard
            imageSrc={coverSrc}
            altText={game.name}
            containerWidth={200}
            containerHeight={266}
            imageWidth={200}
            imageHeight={266}
            rotateAmplitude={12}
            scaleOnHover={1.04}
            radius={18}
            showTooltip={false}
          >
            {generatedCover && (
              <div className="absolute inset-0 flex items-end p-4 text-left">
                <span className="font-display text-xl leading-tight font-bold drop-shadow-lg">{game.name}</span>
              </div>
            )}
          </TiltedCard>

          <h1 className="mt-5 font-display text-2xl leading-tight font-bold tracking-tight">{game.name}</h1>
          {meta && <p className="mt-1 text-sm text-muted">{meta}</p>}
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
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
          </div>
        </div>
      </div>

      <div className="relative mt-6 px-5">
        {rating ? (
          <button
            onClick={() => setRateOpen(true)}
            className="flex w-full items-center gap-4 rounded-3xl border border-line bg-surface p-4 text-left"
          >
            <ScoreRing score={rating.score} size={76} stroke={7} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold tracking-wider text-muted uppercase">Tu puntaje</p>
              <div className="mt-1.5">
                <TierChip tier={rating.tier} />
              </div>
              <p className="mt-1.5 truncate text-xs text-muted">
                {[STATUSES.find((s) => s.id === rating.status)?.label, rating.platform, formatDate(rating.finishedAt)]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <Pencil size={18} className="text-muted" />
          </button>
        ) : (
          <button
            onClick={() => setRateOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-pink-500 py-4 font-display text-base font-bold shadow-lg shadow-violet-500/20 active:scale-[.98]"
          >
            <Star size={18} fill="currentColor" /> Puntuar este juego
          </button>
        )}

        {rating?.note && <p className="mt-3 rounded-2xl bg-surface px-4 py-3 text-sm text-white/80 italic">“{rating.note}”</p>}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={togglePlaying}
            className={`flex items-center justify-center gap-2 rounded-2xl border py-3 text-sm font-semibold transition ${playing ? 'border-accent/50 bg-accent/15 text-accent' : 'border-line bg-surface'}`}
          >
            {playing ? <Check size={16} /> : <Play size={16} />} {playing ? 'Jugando' : 'Estoy jugando'}
          </button>
          <button
            onClick={() => setListOpen(true)}
            className="flex items-center justify-center gap-2 rounded-2xl border border-line bg-surface py-3 text-sm font-semibold"
          >
            <ListPlus size={16} /> {inLists.length ? `En ${inLists.length} lista${inLists.length > 1 ? 's' : ''}` : 'A una lista'}
          </button>
        </div>

      </div>

      {/* Hidden until loaded: most games have no series, so no skeleton flash. */}
      <GameRail title="De la misma saga" subtitle="Ordenados por fecha de salida" games={series ?? []} />

      <div className="px-5">
        {detail?.description && (
          <section className="mt-7">
            <h2 className="mb-2 font-display text-lg font-bold">Sobre el juego</h2>
            <p className={`text-sm leading-relaxed whitespace-pre-line text-white/75 ${expanded ? '' : 'line-clamp-5'}`}>
              {detail.description}
            </p>
            {detail.description.length > 280 && (
              <button onClick={() => setExpanded(!expanded)} className="mt-1 text-sm font-semibold text-accent">
                {expanded ? 'Ver menos' : 'Ver más'}
              </button>
            )}
          </section>
        )}

        {detail && detail.screenshots.length > 0 && (
          <section className="mt-7">
            <h2 className="mb-3 font-display text-lg font-bold">Capturas</h2>
            <ScrollRow className="-mx-5 flex gap-3 px-5">
              {detail.screenshots.map((s) => (
                <img
                  key={s}
                  src={resizeImage(s, 640) ?? s}
                  alt=""
                  loading="lazy"
                  className="aspect-video w-72 shrink-0 rounded-2xl object-cover"
                />
              ))}
            </ScrollRow>
          </section>
        )}

        {game.platforms.length > 0 && (
          <section className="mt-7">
            <h2 className="mb-2 font-display text-lg font-bold">Plataformas</h2>
            <p className="text-sm text-white/75">{game.platforms.join(', ')}</p>
          </section>
        )}

        {detail && (detail.playtime || detail.publishers.length > 0 || detail.website) && (
          <dl className="mt-7 grid grid-cols-2 gap-3 text-sm">
            {detail.playtime && <Info label="Duración promedio" value={`${detail.playtime} h`} />}
            {detail.publishers[0] && <Info label="Distribuye" value={detail.publishers[0]} />}
            {detail.released && <Info label="Lanzamiento" value={formatDate(detail.released)} />}
            {detail.website && (
              <a href={detail.website} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-accent">
                Sitio oficial <ExternalLink size={14} />
              </a>
            )}
          </dl>
        )}
      </div>

      <RatingSheet game={game} open={rateOpen} onClose={() => setRateOpen(false)} />
      <ListPickerSheet game={game} open={listOpen} onClose={() => setListOpen(false)} />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface px-4 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
