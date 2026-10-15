import { useEffect, useState } from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import Sheet from './Sheet';
import { STATUSES, TIERS, TIER_BY_ID, tierForScore } from '../lib/tiers';
import type { Game, PlayStatus, TierId } from '../lib/types';
import { useStore } from '../store/useStore';
import { useToast } from '../store/useToast';

interface Props {
  game: Game;
  open: boolean;
  onClose: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export default function RatingSheet({ game, open, onClose }: Props) {
  const existing = useStore((s) => s.ratings[game.id]);
  const saveRating = useStore((s) => s.saveRating);
  const deleteRating = useStore((s) => s.deleteRating);
  const toast = useToast((s) => s.show);

  const [score, setScore] = useState(70);
  const [tier, setTier] = useState<TierId>('bueno');
  const [tierManual, setTierManual] = useState(false);
  const [status, setStatus] = useState<PlayStatus>('terminado');
  const [platform, setPlatform] = useState<string>('');
  const [finishedAt, setFinishedAt] = useState(today());
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open) return;
    const s = existing?.score ?? 70;
    setScore(s);
    setTier(existing?.tier ?? tierForScore(s).id);
    setTierManual(existing ? existing.tier !== tierForScore(existing.score).id : false);
    setStatus(existing?.status ?? 'terminado');
    setPlatform(existing?.platform ?? '');
    setFinishedAt(existing?.finishedAt ?? today());
    setNote(existing?.note ?? '');
  }, [open, existing]);

  const changeScore = (value: number) => {
    const v = Math.max(0, Math.min(100, Math.round(value)));
    setScore(v);
    if (!tierManual) setTier(tierForScore(v).id);
  };

  const pickTier = (id: TierId) => {
    setTier(id);
    setTierManual(id !== tierForScore(score).id);
  };

  const save = () => {
    saveRating(game, { score, tier, status, platform: platform || null, finishedAt: finishedAt || null, note: note.trim() });
    toast(existing ? 'Puntaje actualizado' : `${game.name}: ${score} · ${TIER_BY_ID[tier].label}`);
    onClose();
  };

  const remove = () => {
    deleteRating(game.id);
    toast('Puntaje eliminado');
    onClose();
  };

  const color = TIER_BY_ID[tier].color;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={existing ? 'Editar puntaje' : 'Puntuar'}
      footer={
        <div className="flex gap-2">
          {existing && (
            <button onClick={remove} aria-label="Eliminar puntaje" className="rounded-2xl bg-white/5 px-4 text-rose-400">
              <Trash2 size={20} />
            </button>
          )}
          <button
            onClick={save}
            className="flex-1 rounded-2xl py-3.5 font-display text-base font-bold text-black transition active:scale-[.98]"
            style={{ background: color }}
          >
            Guardar
          </button>
        </div>
      }
    >
      <p className="mb-4 truncate text-sm text-muted">{game.name}</p>

      <div className="flex items-center justify-center gap-6">
        <button
          onClick={() => changeScore(score - 1)}
          aria-label="Restar"
          className="rounded-full bg-white/5 p-3 text-muted active:scale-90"
        >
          <Minus size={20} />
        </button>
        <div className="w-36 text-center">
          <div
            className="font-display text-7xl leading-none font-bold tabular-nums transition-colors"
            style={{ color, textShadow: `0 0 40px ${color}55` }}
          >
            {score}
          </div>
          <div className="mt-1 text-xs tracking-widest text-muted uppercase">de 100</div>
        </div>
        <button
          onClick={() => changeScore(score + 1)}
          aria-label="Sumar"
          className="rounded-full bg-white/5 p-3 text-muted active:scale-90"
        >
          <Plus size={20} />
        </button>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        value={score}
        onChange={(e) => changeScore(Number(e.target.value))}
        className="score-range mt-4"
        style={{ ['--thumb' as string]: color }}
        aria-label="Puntaje"
      />

      <div className="mt-5 mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">En palabras</h3>
        <span className="text-xs text-muted">{tierManual ? 'Elegido por vos' : 'Sugerido por el puntaje'}</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {TIERS.map((t) => {
          const active = t.id === tier;
          return (
            <button
              key={t.id}
              onClick={() => pickTier(t.id)}
              className="flex flex-col items-center gap-1 rounded-2xl border py-3 transition active:scale-95"
              style={{
                borderColor: active ? t.color : 'var(--color-line)',
                background: active ? `${t.color}1f` : 'transparent',
                color: active ? t.color : undefined,
              }}
            >
              <span className="text-2xl">{t.emoji}</span>
              <span className="text-sm font-semibold">{t.label}</span>
            </button>
          );
        })}
      </div>

      <h3 className="mt-6 mb-2 text-sm font-semibold">Estado</h3>
      <div className="grid grid-cols-3 rounded-2xl bg-white/5 p-1">
        {STATUSES.map((s) => (
          <button
            key={s.id}
            onClick={() => setStatus(s.id)}
            className={`rounded-xl py-2 text-sm font-medium transition ${status === s.id ? 'bg-white text-black' : 'text-muted'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Plataforma</span>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm"
          >
            <option value="">—</option>
            {game.platforms.map((p) => (
              <option key={p}>{p}</option>
            ))}
            {platform && !game.platforms.includes(platform) && <option>{platform}</option>}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Fecha</span>
          <input
            type="date"
            value={finishedAt}
            onChange={(e) => setFinishedAt(e.target.value)}
            className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm [color-scheme:dark]"
          />
        </label>
      </div>

      <label className="mt-5 block">
        <span className="mb-1.5 block text-sm font-semibold">Notas</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="¿Qué te pareció?"
          className="w-full resize-none rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm placeholder:text-muted/60"
        />
      </label>
    </Sheet>
  );
}
