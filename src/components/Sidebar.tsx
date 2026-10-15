import { Link, NavLink } from 'react-router-dom';
import { BarChart3, Cloud, CloudOff, Compass, Gamepad2, House, ListOrdered, LogIn, RefreshCw, Search, Settings } from 'lucide-react';
import Cover from './Cover';
import { NEXT_LIST_ID, useStore } from '../store/useStore';
import { useSync } from '../store/useSync';

const NAV = [
  { to: '/', label: 'Inicio', icon: House, end: true },
  { to: '/descubrir', label: 'Descubrir', icon: Compass, end: false },
  { to: '/buscar', label: 'Buscar', icon: Search, end: false },
  { to: '/listas', label: 'Listas', icon: ListOrdered, end: false },
  { to: '/mis-juegos', label: 'Mis juegos', icon: Gamepad2, end: false },
  { to: '/estadisticas', label: 'Estadísticas', icon: BarChart3, end: false },
];

/** Desktop navigation (lg and up); phones use the bottom TabBar instead. */
export default function Sidebar() {
  const upNext = useStore((s) => {
    const id = s.lists.find((l) => l.id === NEXT_LIST_ID)?.gameIds[0];
    return id ? s.games[id] : undefined;
  });

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-white/5 bg-[#0d0d13] px-4 py-6 lg:flex">
      <Link to="/" className="px-3 font-display text-2xl font-bold tracking-tight">
        Games<span className="grad-text">Traker</span>
      </Link>

      <nav className="mt-8 space-y-1">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition ${isActive ? 'bg-accent/15 text-white' : 'text-muted hover:bg-white/5 hover:text-white'}`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={19} className={isActive ? 'text-accent' : ''} strokeWidth={isActive ? 2.4 : 2} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {upNext && (
        <Link
          to={`/juego/${encodeURIComponent(upNext.id)}`}
          className="group mt-8 flex items-center gap-3 rounded-2xl border border-line bg-surface p-2.5 transition hover:border-white/20"
        >
          <Cover game={upNext} showTitle={false} className="h-14 w-11 shrink-0 rounded-lg" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-widest text-accent uppercase">Lo próximo</p>
            <p className="truncate text-sm font-semibold">{upNext.name}</p>
          </div>
        </Link>
      )}

      <div className="mt-auto space-y-1">
        <SyncLine />
        <NavLink
          to="/ajustes"
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition ${isActive ? 'bg-accent/15 text-white' : 'text-muted hover:bg-white/5 hover:text-white'}`
          }
        >
          <Settings size={19} /> Ajustes
        </NavLink>
      </div>
    </aside>
  );
}

function SyncLine() {
  const status = useSync((s) => s.status);
  const canLogin = useSync((s) => !s.token && s.server !== null);
  if (status === 'off') {
    if (!canLogin) return null;
    return (
      <Link to="/cuenta" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-accent hover:bg-white/5">
        <LogIn size={17} /> Iniciar sesión
      </Link>
    );
  }
  const Icon = status === 'error' ? CloudOff : status === 'syncing' ? RefreshCw : Cloud;
  const label = status === 'error' ? 'Error al sincronizar' : status === 'syncing' ? 'Sincronizando…' : 'Sincronizado';
  return (
    <Link
      to="/ajustes"
      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${status === 'error' ? 'text-rose-400' : 'text-emerald-300/90'}`}
    >
      <Icon size={17} className={status === 'syncing' ? 'animate-spin' : ''} /> {label}
    </Link>
  );
}
