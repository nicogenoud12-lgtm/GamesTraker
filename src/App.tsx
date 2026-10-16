import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { startSync } from './lib/sync';
import { useMode } from './store/useUi';
import { MODES } from './lib/mode';
import Sidebar from './components/Sidebar';
import TabBar from './components/TabBar';
import Toast from './components/Toast';
import Home from './pages/Home';
import Search from './pages/Search';
import GamePage from './pages/GamePage';
import Lists from './pages/Lists';
import ListDetail from './pages/ListDetail';
import Library from './pages/Library';
import Settings from './pages/Settings';
import Discover from './pages/Discover';
import Explore from './pages/Explore';
import Stats from './pages/Stats';
import YearReview from './pages/YearReview';
import Diary from './pages/Diary';
import PublicProfile from './pages/PublicProfile';
import Friends from './pages/Friends';
import { startNotices } from './lib/social';
import { refreshSavedCovers, refreshSavedTitles } from './lib/savedTitles';
import { useSync } from './store/useSync';
import { loadGameIndex } from './lib/gameIndex';
import { useStore } from './store/useStore';
import Account from './pages/Account';
import ScrollToTop from './components/ScrollToTop';
import CoverTransition from './components/CoverTransition';

export default function App() {
  useEffect(() => startSync(), []);
  useEffect(() => startNotices(), []);
  // The TMDB key may arrive later, with the first sync on a new device.
  const tmdbKey = useStore((s) => s.tmdbKey);
  useEffect(() => void refreshSavedTitles(), [tmdbKey]);
  // Covers come from our server: once signed in.
  const token = useSync((s) => s.token);
  useEffect(() => void refreshSavedCovers(), [token]);
  // The popular games index, ready before the first search (the browser keeps it between visits).
  useEffect(() => {
    if (!token) return;
    const t = setTimeout(() => void loadGameIndex(), 2000);
    return () => clearTimeout(t);
  }, [token]);
  const mode = useMode();
  useEffect(() => {
    document.documentElement.dataset.mode = mode;
    // The tab is named after the side in use: GamesTracker / MediaTracker.
    document.title = `${MODES[mode].brand}Tracker`;
  }, [mode]);
  const { pathname } = useLocation();

  // Someone else's public profile is shown on its own, without this device's navigation.
  if (pathname.startsWith('/p/')) {
    return (
      <>
        <ScrollToTop />
        <Routes>
          <Route path="/p/:username" element={<PublicProfile />} />
        </Routes>
        <Toast />
      </>
    );
  }

  return (
    <div className="min-h-dvh lg:overflow-x-clip lg:pl-64">
      <ScrollToTop />
      <CoverTransition />
      <Sidebar />
      <main className="mx-auto max-w-lg pb-28 lg:max-w-6xl lg:px-6 lg:pb-12 2xl:max-w-7xl">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/descubrir" element={<Discover />} />
          <Route path="/descubrir/explorar" element={<Explore />} />
          <Route path="/buscar" element={<Search />} />
          <Route path="/juego/:id" element={<GamePage />} />
          <Route path="/listas" element={<Lists />} />
          <Route path="/listas/:id" element={<ListDetail />} />
          <Route path="/mis-juegos" element={<Library />} />
          <Route path="/ajustes" element={<Settings />} />
          <Route path="/estadisticas" element={<Stats />} />
          <Route path="/resumen" element={<YearReview />} />
          <Route path="/diario" element={<Diary />} />
          <Route path="/amigos" element={<Friends />} />
          <Route path="/cuenta" element={<Account />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
      <TabBar />
      <Toast />
    </div>
  );
}
