import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Layout effect so the new page is already at the top when a view transition snapshots it.
export default function ScrollToTop() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
