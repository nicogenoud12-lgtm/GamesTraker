import { MODES, type Mode } from '../lib/mode';
import { useUi } from '../store/useUi';

/** Segmented switch between the games and the series & movies "apps". */
export default function ModeSwitch({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  const mode = useUi((s) => s.mode);
  const setMode = useUi((s) => s.setMode);
  return (
    <div role="tablist" aria-label="Colección" className={`grid grid-cols-2 rounded-2xl border border-white/10 bg-black/30 p-1 backdrop-blur ${className}`}>
      {(Object.keys(MODES) as Mode[]).map((m) => {
        const { icon: Icon, label } = MODES[m];
        const active = m === mode;
        return (
          <button
            key={m}
            role="tab"
            aria-selected={active}
            onClick={() => setMode(m)}
            className={`flex items-center justify-center gap-1.5 rounded-xl font-semibold transition ${compact ? 'py-1.5 text-xs' : 'py-2 text-sm'} ${active ? 'bg-accent text-black shadow-lg' : 'text-muted hover:text-white'}`}
          >
            <Icon size={compact ? 14 : 16} strokeWidth={2.4} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
