import { useEffect } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';

/** Name shared by the tapped cover and the detail page's cover, so the browser morphs one into the other. */
export const COVER_TRANSITION = 'game-cover';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * One listener for the whole app: tapping anything with a cover that opens a
 * game, series or movie grows that cover into the detail page's cover, using
 * the browser's View Transitions. Browsers without them just navigate.
 */
export default function CoverTransition() {
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof document.startViewTransition !== 'function') return;

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (reducedMotion()) return;
      const link = (e.target as Element | null)?.closest?.('a[href^="#/juego/"]');
      if (!(link instanceof HTMLAnchorElement) || link.target) return;
      const cover = link.querySelector<HTMLElement>('[data-cover]');
      if (!cover) return;
      const href = link.getAttribute('href')!;
      if (href === window.location.hash) return;
      const path = href.slice(1);

      // The link's own onClick (it remembers the game) still runs; only its navigation is skipped.
      e.preventDefault();
      cover.style.viewTransitionName = COVER_TRANSITION;
      const transition = document.startViewTransition(() => {
        cover.style.viewTransitionName = '';
        flushSync(() => navigate(path));
      });
      transition.finished.finally(() => {
        cover.style.viewTransitionName = '';
      });
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [navigate]);

  return null;
}
