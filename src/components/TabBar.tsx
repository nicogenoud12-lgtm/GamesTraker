import { NavLink } from 'react-router-dom';
import { Compass, House, ListOrdered, Search } from 'lucide-react';
import { MODES } from '../lib/mode';
import { useMode } from '../store/useUi';

const TABS = [
  { to: '/', label: 'Inicio', icon: House, end: true },
  { to: '/descubrir', label: 'Descubrir', icon: Compass, end: false },
  { to: '/buscar', label: 'Buscar', icon: Search, end: false },
  { to: '/listas', label: 'Listas', icon: ListOrdered, end: false },
];

export default function TabBar() {
  const mode = useMode();
  const tabs = [...TABS, { to: '/mis-juegos', label: mode === 'games' ? 'Mis juegos' : 'Mis títulos', icon: MODES[mode].icon, end: false }];
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-white/5 bg-bg/80 backdrop-blur-xl lg:hidden">
      <ul className="mx-auto flex max-w-lg">
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 pt-2.5 pb-2 text-[11px] font-medium transition ${isActive ? 'text-white' : 'text-muted'}`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`rounded-full px-3.5 py-1 transition ${isActive ? 'bg-accent/20 text-accent' : ''}`}>
                    <Icon size={21} strokeWidth={isActive ? 2.4 : 2} />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
