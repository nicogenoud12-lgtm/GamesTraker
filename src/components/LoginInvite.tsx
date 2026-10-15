import { Link } from 'react-router-dom';
import { Cloud, X } from 'lucide-react';
import { useSync } from '../store/useSync';

/** Home-screen nudge to log in, shown while signed out on the real server. */
export default function LoginInvite({ className = '' }: { className?: string }) {
  const show = useSync((s) => !s.token && s.server !== null && !s.inviteDismissed);
  const firstTime = useSync((s) => s.server?.hasUsers === false);
  if (!show) return null;
  return (
    <div className={`relative flex items-center gap-3 rounded-3xl border border-accent/30 bg-accent/10 p-4 ${className}`}>
      <Cloud className="shrink-0 text-accent" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{firstTime ? 'Creá tu cuenta' : 'Iniciá sesión'}</p>
        <p className="text-sm text-muted">Para tener tus juegos en el celu y en la compu.</p>
      </div>
      <Link to="/cuenta" className="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black">
        {firstTime ? 'Crear' : 'Entrar'}
      </Link>
      <button
        onClick={() => useSync.setState({ inviteDismissed: true })}
        aria-label="Ahora no"
        className="absolute -top-2 -right-2 rounded-full border border-line bg-surface p-1 text-muted hover:text-white"
      >
        <X size={14} />
      </button>
    </div>
  );
}
